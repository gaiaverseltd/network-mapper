#!/usr/bin/env node
/**
 * Flatten Firestore profile documents: move directory data from nested `memberData` and
 * string `customFields` onto top-level fields (arrays + scalars) matching the shape produced
 * by an updated ingest / see `src/lib/profile-directory-fields.js`.
 *
 * Requires Firebase Admin (key.json, GOOGLE_APPLICATION_CREDENTIALS, or ADC).
 *
 * Usage:
 *   pnpm migrate:profiles:flatten
 *   node scripts/migrate-profiles-flatten.js --dry-run
 *   node scripts/migrate-profiles-flatten.js --limit 10
 *   node scripts/migrate-profiles-flatten.js --uid YOUR_AUTH_UID
 *   node scripts/migrate-profiles-flatten.js --skip-delete-legacy   # keep memberData/customFields
 *   node scripts/migrate-profiles-flatten.js --defaults-only        # only fill missing keys; no legacy flatten
 *
 * Default: every profile gets missing directory defaults; profiles with legacy shape also get
 * flattened and (unless --skip-delete-legacy) have `customFields` and `memberData` removed.
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import {
  legacyToFlatDirectoryFields,
  profileHasLegacyDirectoryShape,
  directoryDefaultsPatch,
} from "../src/lib/profile-directory-fields.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipDeleteLegacy = args.includes("--skip-delete-legacy");
const defaultsOnly = args.includes("--defaults-only");

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
const limit = getLimit();
const singleUid = (getFlag("--uid", "") || "").trim();

const COLLECTION_PROFILES = "profiles";

async function initAdmin() {
  const { initializeApp, cert, applicationDefault, getApps } = await import("firebase-admin/app");
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
      const opts = { credential: applicationDefault() };
      if (projectId) opts.projectId = projectId;
      initializeApp(opts);
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
      console.error("❌ Set project ID (key.json project_id, GOOGLE_CLOUD_PROJECT, or .firebaserc).");
      process.exit(1);
    }
  }

  return adminFs.getFirestore();
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {Record<string, unknown>} data
 */
function buildUpdatePayload(data) {
  if (defaultsOnly) {
    return {
      updates: directoryDefaultsPatch(data),
      hasLegacy: false,
      removeLegacy: false,
    };
  }
  const hasLegacy = profileHasLegacyDirectoryShape(data);
  /** @type {Record<string, unknown>} */
  let flat = {};
  if (hasLegacy) {
    flat = legacyToFlatDirectoryFields(data);
  }
  const withFlat = { ...data, ...flat };
  const fill = directoryDefaultsPatch(withFlat);
  const updates = { ...flat, ...fill };
  return { updates, hasLegacy, removeLegacy: hasLegacy && !skipDeleteLegacy };
}

async function main() {
  const db = await initAdmin();
  const { FieldValue } = await import("firebase-admin/firestore");

  /** @type {FirebaseFirestore.QueryDocumentSnapshot[]} */
  let docs;
  if (singleUid) {
    const d = await db.collection(COLLECTION_PROFILES).doc(singleUid).get();
    docs = d.exists ? [d] : [];
  } else {
    const snap = await db.collection(COLLECTION_PROFILES).get();
    docs = snap.docs;
  }

  if (!docs.length) {
    console.log("No matching profile documents.");
    return;
  }

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  const max = limit > 0 ? limit : docs.length;

  for (let i = 0; i < docs.length && processed < max; i++) {
    const doc = docs[i];
    const data = doc.data();
    if (!data || typeof data !== "object") {
      skipped++;
      continue;
    }
    processed++;
    const { updates, hasLegacy, removeLegacy } = buildUpdatePayload(data);
    const keys = Object.keys(updates);
    if (keys.length === 0 && !removeLegacy) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(
        `[dry-run] ${doc.id} legacy=${hasLegacy} keys=${keys.join(", ") || "(none)"} deleteLegacy=${removeLegacy}`
      );
      updated++;
      continue;
    }

    const ref = db.collection(COLLECTION_PROFILES).doc(doc.id);
    const payload = { ...updates };
    if (removeLegacy) {
      payload.customFields = FieldValue.delete();
      payload.memberData = FieldValue.delete();
    }
    await ref.update(payload);
    updated++;
    if (processed % 50 === 0) console.log(`  … ${processed} processed`);
  }

  console.log("\n--- migrate-profiles-flatten ---");
  console.log(`Processed: ${processed}, Updated: ${updated}, Skipped: ${skipped}, dryRun=${dryRun}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
