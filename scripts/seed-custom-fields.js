#!/usr/bin/env node
/**
 * Seed the customFields collection with the profile custom fields used by
 * ingest-users.js and seed-users.js. Skips any field whose key already exists.
 *
 * Uses key.json or GOOGLE_APPLICATION_CREDENTIALS (same as other scripts).
 *
 * Usage:
 *   node scripts/seed-custom-fields.js [options]
 *   pnpm seed:custom-fields
 *   pnpm seed:custom-fields -- --dry-run
 *
 * Options:
 *   --dry-run   List what would be added; no writes.
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const dryRun = process.argv.includes("--dry-run");

const COLLECTION_CUSTOM_FIELDS = "customFields";

/** Custom field definitions used on profiles (ingest + seed). key must match profile customFields keys. */
const CUSTOM_FIELD_DEFINITIONS = [
  { key: "phone", label: "Phone", type: "phone", appliesTo: "profile", order: 0 },
  { key: "classification", label: "Classification", type: "text", appliesTo: "profile", order: 1 },
  { key: "title", label: "Title", type: "text", appliesTo: "profile", order: 2 },
  { key: "organization", label: "Organization", type: "text", appliesTo: "profile", order: 3 },
  { key: "gender", label: "Gender", type: "text", appliesTo: "profile", order: 4 },
  { key: "country", label: "Country", type: "text", appliesTo: "profile", order: 5 },
  { key: "state", label: "State / Province", type: "text", appliesTo: "profile", order: 6 },
  { key: "city", label: "City", type: "text", appliesTo: "profile", order: 7 },
  { key: "profileUrl", label: "Profile / websites", type: "url", appliesTo: "profile", order: 8 },
  { key: "fieldsOfStudy", label: "Field(s) of study or work", type: "note", appliesTo: "profile", order: 9 },
  { key: "areasOfInterest", label: "Areas of interest/work", type: "note", appliesTo: "profile", order: 10 },
];

async function main() {
  const { initializeApp, cert, applicationDefault, getApps } = await import("firebase-admin/app");
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
          "❌ Firebase Admin credentials required. Put key.json in project root or set GOOGLE_APPLICATION_CREDENTIALS."
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
      console.error("❌ Project ID not set. Set GOOGLE_CLOUD_PROJECT or use a key file with project_id.");
      process.exit(1);
    }
  }

  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION_CUSTOM_FIELDS).orderBy("order", "asc").get();
  const existingByKey = new Map();
  snapshot.docs.forEach((d) => {
    const key = (d.data().key ?? "").toLowerCase().trim();
    if (key) existingByKey.set(key, { id: d.id, ...d.data() });
  });

  const toAdd = CUSTOM_FIELD_DEFINITIONS.filter(
    (def) => !existingByKey.has((def.key ?? "").toLowerCase().trim())
  );
  const skipped = CUSTOM_FIELD_DEFINITIONS.length - toAdd.length;

  console.log(`Custom fields: ${existingByKey.size} existing, ${toAdd.length} to add, ${skipped} skipped (already exist).`);
  if (toAdd.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (dryRun) {
    console.log("\n[dry-run] Would add:\n");
    toAdd.forEach((def, i) => {
      console.log(JSON.stringify({ ...def, createdAt: "(would set to now)" }, null, 2));
      if (i < toAdd.length - 1) console.log("");
    });
    return;
  }

  let added = 0;
  for (const def of toAdd) {
    const payload = {
      label: (def.label ?? "").trim(),
      key: (def.key ?? "").trim().toLowerCase().replace(/\s+/g, "_"),
      type: def.type ?? "text",
      appliesTo: def.appliesTo === "post" ? "post" : def.appliesTo === "profile" ? "profile" : "both",
      required: !!def.required,
      order: typeof def.order === "number" ? def.order : 0,
      createdAt: new Date(),
    };
    await db.collection(COLLECTION_CUSTOM_FIELDS).add(payload);
    console.log(`  ✓ ${payload.key} (${payload.label})`);
    added++;
  }
  console.log(`\nAdded ${added} custom field(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
