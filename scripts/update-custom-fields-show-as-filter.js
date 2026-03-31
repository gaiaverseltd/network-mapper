#!/usr/bin/env node
/**
 * Set showAsFilter: true on all custom field documents that don't have it.
 * Uses key.json or GOOGLE_APPLICATION_CREDENTIALS (same as other scripts).
 *
 * Usage:
 *   node scripts/update-custom-fields-show-as-filter.js [options]
 *   pnpm update:custom-fields-show-as-filter
 *   pnpm update:custom-fields-show-as-filter -- --dry-run
 *
 * Options:
 *   --dry-run   List what would be updated; no writes.
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const dryRun = process.argv.includes("--dry-run");

const COLLECTION_CUSTOM_FIELDS = "customFields";

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
  const snapshot = await db.collection(COLLECTION_CUSTOM_FIELDS).get();
  const toUpdate = [];
  snapshot.docs.forEach((d) => {
    const data = d.data();
    if (data.showAsFilter === undefined) {
      toUpdate.push({ id: d.id, key: data.key ?? d.id, label: data.label ?? "" });
    }
  });

  console.log(`Custom fields: ${snapshot.size} total, ${toUpdate.length} missing showAsFilter.`);
  if (toUpdate.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (dryRun) {
    console.log("\n[dry-run] Would set showAsFilter: true on:\n");
    toUpdate.forEach(({ id, key, label }) => console.log(`  ${id}  key=${key}  label=${label}`));
    return;
  }

  let updated = 0;
  for (const { id } of toUpdate) {
    await db.collection(COLLECTION_CUSTOM_FIELDS).doc(id).update({ showAsFilter: true });
    updated++;
  }
  console.log(`\nUpdated ${updated} custom field(s) with showAsFilter: true.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
