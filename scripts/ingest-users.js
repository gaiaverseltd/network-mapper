#!/usr/bin/env node
/**
 * Ingest users and profiles from ./data/members.json (Firestore export shape) or ./data/2024.csv
 *
 * Creates Firebase Auth users and Firestore profile docs. For JSON members, stores full snapshot in
 * memberData plus customFields strings for discoverability.
 *
 * Requires Firebase Admin SDK (GOOGLE_APPLICATION_CREDENTIALS or key.json).
 *
 * Usage:
 *   node scripts/ingest-users.js [options]
 *   pnpm ingest:users -- --limit 5
 *
 * Options:
 *   --dry-run              Preview only; no writes
 *   --limit N              Process at most N records
 *   --file PATH            Input file (default: ./data/members.json)
 *   --password P           Default password for new Auth users (default: NetMap2024!)
 *   --include-duplicates   Import rows where isDuplicate === true (default: skip those)
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { legacyToFlatDirectoryFields } from "../src/lib/profile-directory-fields.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const args = process.argv.slice(2);
const getFlag = (name, def) => {
  const i = args.indexOf(name);
  if (i === -1) return def;
  return args[i + 1] ?? def;
};
function getLimit() {
  const withEq = args.find((a) => a.startsWith("--limit="));
  if (withEq) return parseInt(withEq.replace(/^--limit=/, ""), 10) || 0;
  return parseInt(getFlag("--limit", "0"), 10) || 0;
}
const dryRun = args.includes("--dry-run");
const limit = getLimit();
const filePath = getFlag("--file", resolve(rootDir, "data", "members.json"));
const defaultPassword = getFlag("--password", "NetMap2024!");
const includeDuplicates = args.includes("--include-duplicates");

const COLLECTION_PROFILES = "profiles";
const DEFAULT_JSON = resolve(rootDir, "data", "members.json");

function buildColMap(headers) {
  const m = {};
  headers.forEach((h, i) => {
    m[h.trim().toLowerCase()] = i;
  });
  return m;
}

function get(row, colMap, key) {
  const i = colMap[key];
  if (i == null) return "";
  const v = row[i];
  return (v == null || v === "" ? "" : String(v).trim()) || "";
}

function deriveUsername(email, existingUsernames) {
  if (!email) return null;
  const local = email.split("@")[0] || "user";
  let base = local
    .replace(/[^a-z0-9._-]/gi, "")
    .replace(/\./g, "_")
    .toLowerCase()
    .slice(0, 30);
  if (!base) base = "user";
  let username = base;
  let n = 1;
  while (existingUsernames.has(username)) {
    username = `${base}${n}`;
    n += 1;
  }
  existingUsernames.add(username);
  return username;
}

/** Join arrays to strings for customFields / bio-friendly text */
function arrayToLine(arr) {
  if (arr == null) return "";
  if (Array.isArray(arr)) return arr.filter(Boolean).map(String).join("; ");
  return String(arr).trim();
}

/** Strip Firestore-export noise and convert timestamps for JSON snapshots */
function sanitizeMemberSnapshot(raw) {
  if (raw == null || typeof raw !== "object") return raw;
  if (raw.__datatype__ === "timestamp" && raw.value != null) {
    return new Date(raw.value);
  }
  if (Array.isArray(raw)) {
    return raw.map((x) => sanitizeMemberSnapshot(x));
  }
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === "__collections__") continue;
    out[k] = sanitizeMemberSnapshot(v);
  }
  return out;
}

function memberJsonToProfile(memberId, member, uid, username) {
  const snap = sanitizeMemberSnapshot(member);
  const email = (snap.email || "").trim();
  const firstName = snap.firstName || "";
  const lastName = snap.lastName || "";
  const name = [firstName, lastName].filter(Boolean).join(" ") || email || username;
  const directory = legacyToFlatDirectoryFields({
    memberData: snap,
    customFields: {},
    name,
    email,
    bio: "",
  });

  return {
    ...directory,
    email,
    name,
    uid,
    dateofbirth: "",
    bio: directory.bio || "",
    report: [],
    restricted: false,
    privacy: false,
    isAdmin: false,
    profileImageURL: null,
    notification: 0,
    createdAt: new Date(),
    follower: [],
    following: [],
    blockusers: [],
    saved: [],
    username,
    post: [],
    classificationTagId: null,
    customFields: {},
    profileResources: [],
    importSource: "members.json",
    sourceMemberId: memberId,
  };
}

function rowToProfile(row, colMap, uid, username) {
  const firstName = get(row, colMap, "first name");
  const lastName = get(row, colMap, "last name");
  const name = [firstName, lastName].filter(Boolean).join(" ") || get(row, colMap, "email");
  const email = get(row, colMap, "email");
  const title = get(row, colMap, "title");
  const org = get(row, colMap, "organization");
  const classification = get(row, colMap, "classification");
  const bioParts = [title, org, classification].filter(Boolean);
  const bio = bioParts.join(" • ") || "";

  const customFields = {};
  const cf = (k, v) => {
    if (v && String(v).trim()) customFields[k] = String(v).trim();
  };
  cf("phone", get(row, colMap, "phone"));
  cf("classification", classification);
  cf("title", title);
  cf("organization", org);
  cf("gender", get(row, colMap, "gender"));
  cf("country", get(row, colMap, "country (where they live)"));
  cf("state", get(row, colMap, "state/province (where they live)"));
  cf("city", get(row, colMap, "city (where they live)"));
  cf("profileUrl", get(row, colMap, 'profile / websites (personal, professional, separate by semicolon)'));
  cf("fieldsOfStudy", get(row, colMap, "field(s) of study or work (e.g., neuroscience, anthropology, education)"));
  cf("areasOfInterest", get(row, colMap, "areas of interest/work (separate by semicolon)"));

  return {
    email: email || "",
    name,
    uid,
    dateofbirth: "",
    bio,
    report: [],
    restricted: false,
    privacy: false,
    isAdmin: false,
    profileImageURL: null,
    notification: 0,
    createdAt: new Date(),
    follower: [],
    following: [],
    blockusers: [],
    saved: [],
    username,
    post: [],
    classificationTagId: null,
    customFields,
    profileResources: [],
    importSource: "2024.csv",
  };
}

function loadJsonMembers(path) {
  const raw = readFileSync(path, "utf8");
  const data = JSON.parse(raw);
  const bucket = data?.__collections__?.members;
  if (!bucket || typeof bucket !== "object") {
    throw new Error("members.json must contain __collections__.members object (Firestore export shape).");
  }
  const list = [];
  for (const [id, doc] of Object.entries(bucket)) {
    if (!doc || typeof doc !== "object") continue;
    list.push({ memberId: id, ...doc });
  }
  return list;
}

function loadCsvRows(path) {
  const raw = readFileSync(path, "utf8");
  const records = parse(raw, {
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });
  if (records.length === 0) throw new Error("CSV is empty.");
  const headers = records[0];
  const colMap = buildColMap(headers);
  if (colMap["email"] == null) throw new Error("CSV must have an 'Email' column.");
  return { colMap, rows: records.slice(1) };
}

async function main() {
  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    console.error(`   Default is ${DEFAULT_JSON}. Use --file path/to/data.csv for CSV ingest.`);
    process.exit(1);
  }

  let auth;
  let db;

  if (!dryRun) {
    const { initializeApp, cert, applicationDefault, getApps } = await import("firebase-admin/app");
    const adminAuth = await import("firebase-admin/auth");
    const adminFs = await import("firebase-admin/firestore");

    if (getApps().length === 0) {
      let projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
      const credPath =
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        (existsSync(resolve(rootDir, "key.json")) ? resolve(rootDir, "key.json") : null);

      if (credPath && existsSync(credPath)) {
        const key = JSON.parse(readFileSync(credPath, "utf8"));
        if (key.project_id) projectId = key.project_id;
        initializeApp({ credential: cert(key), projectId: projectId || key.project_id });
      } else {
        try {
          const opts = { credential: applicationDefault() };
          if (projectId) opts.projectId = projectId;
          initializeApp(opts);
        } catch (e) {
          console.error(
            "❌ Firebase Admin credentials required. Put a service account key at project root key.json,",
            "or set GOOGLE_APPLICATION_CREDENTIALS to its path, or run: gcloud auth application-default login."
          );
          process.exit(1);
        }
      }

      if (!projectId) {
        try {
          const firebasercPath = resolve(rootDir, ".firebaserc");
          if (existsSync(firebasercPath)) {
            const rc = JSON.parse(readFileSync(firebasercPath, "utf8"));
            projectId = rc?.projects?.default;
          }
        } catch (_) {}
      }

      if (!projectId) {
        console.error(
          "❌ Project ID not set. Set GOOGLE_CLOUD_PROJECT (or GCLOUD_PROJECT) to your Firebase project ID,",
          "or use a service account JSON that includes project_id, or add .firebaserc with projects.default."
        );
        process.exit(1);
      }
    }
    auth = adminAuth.getAuth();
    db = adminFs.getFirestore();
  }

  const useJson = filePath.endsWith(".json");
  let toProcess = [];
  let colMap = null;
  let rows = null;

  if (useJson) {
    const members = loadJsonMembers(filePath);
    const filtered = members.filter((m) => {
      if (!includeDuplicates && m.isDuplicate === true) return false;
      return true;
    });
    toProcess = limit > 0 ? filtered.slice(0, limit) : filtered;
    console.log(`Loaded ${members.length} member record(s) from JSON; ${toProcess.length} after filter/limit.\n`);
  } else {
    ({ colMap, rows } = loadCsvRows(filePath));
    toProcess = limit > 0 ? rows.slice(0, limit) : rows;
    if (limit > 0) console.log(`Limiting to first ${limit} CSV row(s).\n`);
  }

  const existingUsernames = new Set();
  const seenEmails = new Set();

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];

    if (useJson) {
      const email = (item.email || "").trim().toLowerCase();
      if (!email) {
        skipped++;
        continue;
      }
      if (seenEmails.has(email)) {
        skipped++;
        continue;
      }
      seenEmails.add(email);

      const { memberId, ...rest } = item;
      const username = deriveUsername(item.email, existingUsernames);
      if (!username) {
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`[dry-run] ${i + 1}. ${item.email} → ${username} (${item.firstName || ""} ${item.lastName || ""})`);
        created++;
        continue;
      }

      try {
        let user;
        try {
          user = await auth.createUser({
            email: item.email.trim(),
            emailVerified: false,
            password: defaultPassword,
            displayName: [item.firstName, item.lastName].filter(Boolean).join(" "),
          });
        } catch (e) {
          if (e.code === "auth/email-already-exists") {
            console.warn(`  ⚠ Skip (auth exists): ${item.email}`);
            skipped++;
            continue;
          }
          throw e;
        }

        const profile = memberJsonToProfile(memberId, rest, user.uid, username);
        await db.collection(COLLECTION_PROFILES).doc(user.uid).set(profile);
        console.log(`  ✓ ${i + 1}. ${item.email} → ${username}`);
        created++;
      } catch (err) {
        console.error(`  ✗ ${i + 1}. ${item.email}:`, err.message);
        errors++;
      }
    } else {
      const row = item;
      const email = get(row, colMap, "email");
      if (!email) {
        skipped++;
        continue;
      }
      const username = deriveUsername(email, existingUsernames);
      if (!username) {
        skipped++;
        continue;
      }

      if (dryRun) {
        const name = [get(row, colMap, "first name"), get(row, colMap, "last name")].filter(Boolean).join(" ");
        console.log(`[dry-run] ${i + 1}. ${email} → ${username} (${name || "-"})`);
        created++;
        continue;
      }

      try {
        let user;
        try {
          user = await auth.createUser({
            email,
            emailVerified: false,
            password: defaultPassword,
            displayName: [get(row, colMap, "first name"), get(row, colMap, "last name")].filter(Boolean).join(" "),
          });
        } catch (e) {
          if (e.code === "auth/email-already-exists") {
            console.warn(`  ⚠ Skip (auth exists): ${email}`);
            skipped++;
            continue;
          }
          throw e;
        }

        const profile = rowToProfile(row, colMap, user.uid, username);
        await db.collection(COLLECTION_PROFILES).doc(user.uid).set(profile);
        console.log(`  ✓ ${i + 1}. ${email} → ${username}`);
        created++;
      } catch (err) {
        console.error(`  ✗ ${i + 1}. ${email}:`, err.message);
        if (
          (err.message && /invalid_grant|invalid_rapt|reauth/i.test(err.message)) &&
          errors === 0
        ) {
          console.error(
            "\n  → This is a credential/key issue. Try a fresh service account key and GOOGLE_APPLICATION_CREDENTIALS.\n"
          );
        }
        errors++;
      }
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`);
  if (!dryRun && created > 0) {
    console.log(`\nUsers were created with password: ${defaultPassword}`);
    console.log("They should reset their password on first login.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
