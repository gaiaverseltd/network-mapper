#!/usr/bin/env node
/**
 * Seed the app with realistic fake users using Faker.
 *
 * Creates Firebase Auth users and Firestore profile docs. Uses key.json or
 * GOOGLE_APPLICATION_CREDENTIALS (same as ingest-users.js).
 *
 * Usage:
 *   node scripts/seed-users.js [options]
 *   pnpm seed:users -- --count 20
 *   pnpm seed:users -- --count=10 --seed 42 --dry-run
 *
 * Options:
 *   --count N     Number of users to create (default: 10)
 *   --dry-run     Preview only; no writes
 *   --password P  Password for new users (default: NetMap2024!)
 *   --seed N      Faker seed for reproducible data (optional)
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { faker } from "@faker-js/faker";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const args = process.argv.slice(2);
const getFlag = (name, def) => {
  const i = args.indexOf(name);
  if (i === -1) return def;
  return args[i + 1] ?? def;
};
function getCount() {
  const withEq = args.find((a) => a.startsWith("--count="));
  if (withEq) return parseInt(withEq.replace(/^--count=/, ""), 10) || 10;
  return parseInt(getFlag("--count", "10"), 10) || 10;
}
const dryRun = args.includes("--dry-run");
const count = Math.min(Math.max(1, getCount()), 500);
const defaultPassword = getFlag("--password", "NetMap2024!");
const seedArg = getFlag("--seed", "");
if (seedArg) faker.seed(parseInt(seedArg, 10) || 0);

const COLLECTION_PROFILES = "profiles";

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

function buildProfile(uid, email, name, username, overrides = {}) {
  const title = overrides.title ?? faker.person.jobTitle();
  const org = overrides.org ?? faker.company.name();
  const bioParts = [title, org].filter(Boolean);
  const bio = overrides.bio ?? (bioParts.join(" • ") || faker.person.bio());

  const customFields = {
    ...(title && { title }),
    ...(org && { organization: org }),
    ...(overrides.phone && { phone: overrides.phone }),
    ...(overrides.gender && { gender: overrides.gender }),
    ...(overrides.country && { country: overrides.country }),
    ...(overrides.state && { state: overrides.state }),
    ...(overrides.city && { city: overrides.city }),
    ...(overrides.profileUrl && { profileUrl: overrides.profileUrl }),
    ...(overrides.fieldsOfStudy && { fieldsOfStudy: overrides.fieldsOfStudy }),
    ...(overrides.areasOfInterest && { areasOfInterest: overrides.areasOfInterest }),
  };

  return {
    email: email || "",
    name,
    uid,
    dateofbirth: overrides.dateofbirth ?? "",
    bio,
    report: [],
    restricted: false,
    privacy: false,
    isAdmin: overrides.isAdmin ?? false,
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
  };
}

function generateFakeUser(existingEmails) {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const name = `${firstName} ${lastName}`;
  let email = faker.internet.email({ firstName, lastName }).toLowerCase();
  let attempts = 0;
  while (existingEmails.has(email) && attempts < 100) {
    email = faker.internet.email({ firstName, lastName, provider: "example.com" }).toLowerCase();
    attempts++;
  }
  existingEmails.add(email);

  const state = faker.location.state({ abbreviated: false });
  const city = faker.location.city();
  const country = faker.location.country();
  const fields = [
    "neuroscience",
    "anthropology",
    "education",
    "psychology",
    "public health",
    "data science",
    "humanities",
    "engineering",
  ];
  const interests = [
    "community building",
    "research methods",
    "policy",
    "behavioral science",
    "qualitative methods",
    "quantitative methods",
  ];

  return {
    email,
    name,
    overrides: {
      title: faker.person.jobTitle(),
      org: faker.company.name(),
      phone: faker.phone.number(),
      gender: faker.helpers.arrayElement(["Male", "Female", "Non-binary", "Prefer not to say", ""]),
      country,
      state,
      city,
      profileUrl: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.4 }),
      fieldsOfStudy: faker.helpers.arrayElements(fields, { min: 1, max: 3 }).join("; "),
      areasOfInterest: faker.helpers.arrayElements(interests, { min: 1, max: 4 }).join("; "),
    },
  };
}

async function main() {
  let auth;
  let db;

  if (!dryRun) {
    const { initializeApp, cert, applicationDefault, getApps } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    const { getFirestore } = await import("firebase-admin/firestore");

    if (getApps().length === 0) {
      let projectId =
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCLOUD_PROJECT;
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
    auth = getAuth();
    db = getFirestore();
  }

  const existingEmails = new Set();
  const existingUsernames = new Set();
  const fakeUsers = [];
  for (let i = 0; i < count; i++) {
    fakeUsers.push(generateFakeUser(existingEmails));
  }

  console.log(`Seeding ${count} fake user(s)${dryRun ? " (dry-run)" : ""}.\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < fakeUsers.length; i++) {
    const { email, name, overrides } = fakeUsers[i];
    const username = deriveUsername(email, existingUsernames);
    if (!username) {
      skipped++;
      continue;
    }

    if (dryRun) {
      const profile = buildProfile("(dry-run)", email, name, username, overrides);
      console.log(`[dry-run] ${i + 1}. ${email} → @${username} (${name})\n${JSON.stringify(profile, null, 2)}\n`);
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
          displayName: name,
        });
      } catch (e) {
        if (e.code === "auth/email-already-exists") {
          console.warn(`  ⚠ Skip (auth exists): ${email}`);
          skipped++;
          continue;
        }
        throw e;
      }

      const profile = buildProfile(user.uid, email, name, username, overrides);
      await db.collection(COLLECTION_PROFILES).doc(user.uid).set(profile);
      console.log(`  ✓ ${i + 1}. ${email} → @${username}`);
      created++;
    } catch (err) {
      console.error(`  ✗ ${i + 1}. ${email}:`, err.message);
      if (
        err.message &&
        /invalid_grant|invalid_rapt|reauth/i.test(err.message) &&
        errors === 0
      ) {
        console.error(
          "\n  → Credential/key issue. Re-sync system time or generate a new service account key and set GOOGLE_APPLICATION_CREDENTIALS.\n"
        );
      }
      errors++;
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`);
  if (!dryRun && created > 0) {
    console.log(`\nUsers were created with password: ${defaultPassword}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
