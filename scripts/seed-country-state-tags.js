#!/usr/bin/env node
/**
 * Seed "Country" and "State / Province" tag categories with tags. Creates the
 * categories if they don't exist (matched by name, case-insensitive). Does
 * not re-add tags that already exist in that category (same label, case-insensitive).
 * Safe to run multiple times; only missing tags are added.
 *
 * Uses key.json or GOOGLE_APPLICATION_CREDENTIALS (same as other scripts).
 *
 * Usage:
 *   node scripts/seed-country-state-tags.js [options]
 *   pnpm seed:country-state-tags
 *   pnpm seed:country-state-tags -- --dry-run
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

const COLLECTION_TAG_CATEGORIES = "tagCategories";
const COLLECTION_TAGS = "tags";

const CATEGORY_COUNTRY = "Country";
const CATEGORY_STATE = "State / Province"; // matches custom field label so lookup uses this category

// US states + DC, then Canadian provinces/territories
const STATE_LABELS = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming", "District of Columbia",
  "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
  "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island",
  "Quebec", "Saskatchewan", "Yukon",
];

// ISO 3166-1 country names (English, common names)
const COUNTRY_LABELS = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina",
  "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados",
  "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina",
  "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
  "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia",
  "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
  "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini",
  "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana",
  "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras",
  "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
  "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo",
  "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya",
  "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives",
  "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia",
  "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia",
  "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Macedonia",
  "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay",
  "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa",
  "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles",
  "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa",
  "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland",
  "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga",
  "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine",
  "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu",
  "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
];

async function initFirebase() {
  const { initializeApp, cert, applicationDefault, getApps } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  if (getApps().length > 0) return getFirestore();

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

  return getFirestore();
}

/** Normalized names we treat as the same category (for state: "state" or "state / province"). */
const STATE_CATEGORY_ALIASES = ["state", "state / province"];

/** Get or create a tag category by name. Returns { id, created }. For State, also matches "State / Province". */
async function getOrCreateCategory(db, name, order) {
  const snap = await db.collection(COLLECTION_TAG_CATEGORIES).orderBy("order", "asc").get();
  const nameLower = name.trim().toLowerCase();
  const existing = snap.docs.find((d) => {
    const n = (d.data().name ?? "").trim().toLowerCase();
    if (n === nameLower) return true;
    if (nameLower === "state / province" && STATE_CATEGORY_ALIASES.includes(n)) return true;
    return false;
  });
  if (existing) return { id: existing.id, created: false };

  const ref = await db.collection(COLLECTION_TAG_CATEGORIES).add({
    name: name.trim(),
    slug: null,
    order: typeof order === "number" ? order : 0,
    createdAt: new Date(),
  });
  return { id: ref.id, created: true };
}

/** Get existing tag labels for a category (case-insensitive set). Used to skip re-adding. */
async function getExistingTagLabels(db, categoryId) {
  const snap = await db.collection(COLLECTION_TAGS).where("categoryId", "==", categoryId).get();
  const set = new Set();
  snap.docs.forEach((d) => {
    const label = (d.data().label ?? "").trim();
    if (label) set.add(label.toLowerCase());
  });
  return set;
}

function normaliseLabel(label) {
  return (label ?? "").trim().toLowerCase();
}

/** Add a tag; slug is set to doc id (two writes to match client behavior). */
async function addTag(db, categoryId, label) {
  const ref = await db.collection(COLLECTION_TAGS).add({
    categoryId,
    label: label.trim(),
    slug: null,
    createdAt: new Date(),
  });
  await db.collection(COLLECTION_TAGS).doc(ref.id).update({ slug: ref.id });
  return ref.id;
}

async function main() {
  const db = await initFirebase();

  console.log(`Seeding Country and State / Province tags${dryRun ? " (dry-run)" : ""}.\n`);

  // Ensure categories exist
  let countryCatId, stateCatId;
  if (dryRun) {
    const catSnap = await db.collection(COLLECTION_TAG_CATEGORIES).get();
    const countryCat = catSnap.docs.find(
      (d) => (d.data().name ?? "").trim().toLowerCase() === CATEGORY_COUNTRY.toLowerCase()
    );
    const stateCat = catSnap.docs.find((d) => {
      const n = (d.data().name ?? "").trim().toLowerCase();
      return n === CATEGORY_STATE.toLowerCase() || STATE_CATEGORY_ALIASES.includes(n);
    });
    countryCatId = countryCat?.id ?? "(would create Country category)";
    stateCatId = stateCat?.id ?? "(would create State / Province category)";
  } else {
    const countryRes = await getOrCreateCategory(db, CATEGORY_COUNTRY, 0);
    const stateRes = await getOrCreateCategory(db, CATEGORY_STATE, 1);
    if (countryRes.created) console.log(`  ✓ Created category: ${CATEGORY_COUNTRY}`);
    if (stateRes.created) console.log(`  ✓ Created category: ${CATEGORY_STATE}`);
    countryCatId = countryRes.id;
    stateCatId = stateRes.id;
  }

  // Only add tags whose label is not already in this category (case-insensitive). Safe to re-run.
  const countryExisting = dryRun ? new Set() : await getExistingTagLabels(db, countryCatId);
  const stateExisting = dryRun ? new Set() : await getExistingTagLabels(db, stateCatId);

  const countriesToAdd = COUNTRY_LABELS.filter((l) => !countryExisting.has(normaliseLabel(l)));
  const statesToAdd = STATE_LABELS.filter((l) => !stateExisting.has(normaliseLabel(l)));

  console.log(`Country: ${countriesToAdd.length} to add (${COUNTRY_LABELS.length - countriesToAdd.length} already exist, skipped).`);
  console.log(`State:   ${statesToAdd.length} to add (${STATE_LABELS.length - statesToAdd.length} already exist, skipped).\n`);

  if (dryRun) {
    if (countriesToAdd.length) {
      console.log("[dry-run] Would add countries:", countriesToAdd.slice(0, 15).join(", ") + (countriesToAdd.length > 15 ? ` ... +${countriesToAdd.length - 15} more` : ""));
    }
    if (statesToAdd.length) {
      console.log("[dry-run] Would add states:", statesToAdd.slice(0, 15).join(", ") + (statesToAdd.length > 15 ? ` ... +${statesToAdd.length - 15} more` : ""));
    }
    return;
  }

  const countryAddedThisRun = new Set(); // avoid duplicates within same run
  let added = 0;
  for (const label of countriesToAdd) {
    const key = normaliseLabel(label);
    if (countryAddedThisRun.has(key)) continue;
    countryAddedThisRun.add(key);
    await addTag(db, countryCatId, label);
    added++;
    if (added % 50 === 0) console.log(`  Country tags: ${added}/${countriesToAdd.length}`);
  }
  if (added > 0) console.log(`  ✓ Added ${added} country tag(s).`);

  const stateAddedThisRun = new Set();
  added = 0;
  for (const label of statesToAdd) {
    const key = normaliseLabel(label);
    if (stateAddedThisRun.has(key)) continue;
    stateAddedThisRun.add(key);
    await addTag(db, stateCatId, label);
    added++;
  }
  if (added > 0) console.log(`  ✓ Added ${added} state tag(s).`);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
