/**
 * Canonical directory / profile fields (flat Firestore shape).
 * Used by migrate-profiles-flatten.js and client display helpers.
 */

export const DIRECTORY_STRING_ARRAY_KEYS = [
  "areasOfInterest",
  "fieldsOfStudy",
  "languagesSpoken",
  "networkActivities",
  "topicsOfInterest",
  "title",
  "workCountries",
];

export const DIRECTORY_DEFAULTS = {
  areasOfInterest: [],
  fieldsOfStudy: [],
  languagesSpoken: [],
  networkActivities: [],
  topicsOfInterest: [],
  title: [],
  workCountries: [],
  profileWebsites: [],
  firstName: "",
  lastName: "",
  city: "",
  state: "",
  country: "",
  countryOfOrigin: "",
  classification: "",
  gender: "",
  organization: "",
  phone: "",
  profileUrl: "",
  location: { city: "", countries: [], stateProvince: "" },
  shareContactInfo: false,
  isDuplicate: false,
};

/** @param {unknown} val */
export function toTrimmedString(val) {
  if (val == null) return "";
  return String(val).trim();
}

/** Semicolon-first split (matches ingest / CSV style), then comma. */
export function parseListString(val) {
  if (val == null) return [];
  if (Array.isArray(val)) {
    return val.map((x) => toTrimmedString(x)).filter(Boolean);
  }
  const s = toTrimmedString(val);
  if (!s) return [];
  const bySemi = s.split(/\s*;\s*/).map((x) => x.trim()).filter(Boolean);
  if (bySemi.length > 1) return bySemi;
  return s.split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean);
}

export function arrayToLine(arr) {
  if (arr == null) return "";
  if (Array.isArray(arr)) return arr.filter(Boolean).map(String).join("; ");
  return String(arr).trim();
}

/** @param {unknown} val */
export function classificationToString(val) {
  if (val == null) return "";
  if (Array.isArray(val)) return val.filter(Boolean).map(String).join("; ");
  return toTrimmedString(val);
}

/** @param {unknown} val */
export function countryOfOriginToString(val) {
  if (val == null) return "";
  if (Array.isArray(val)) {
    const parts = val.filter(Boolean).map(String);
    return parts.length === 1 ? parts[0] : parts.join("; ");
  }
  return toTrimmedString(val);
}

/**
 * @param {Record<string, unknown>} profile
 * @returns {Record<string, unknown>}
 */
export function mergeDirectoryDefaults(profile) {
  if (!profile || typeof profile !== "object") return { ...DIRECTORY_DEFAULTS };
  const out = { ...profile };
  for (const [k, v] of Object.entries(DIRECTORY_DEFAULTS)) {
    if (out[k] !== undefined) continue;
    if (typeof v === "boolean") {
      out[k] = false;
    } else if (DIRECTORY_STRING_ARRAY_KEYS.includes(k) || k === "profileWebsites") {
      out[k] = [];
    } else if (k === "location") {
      out.location = { ...DIRECTORY_DEFAULTS.location };
    } else {
      out[k] = v;
    }
  }
  for (const key of DIRECTORY_STRING_ARRAY_KEYS) {
    if (!Array.isArray(out[key])) out[key] = out[key] == null ? [] : parseListString(out[key]);
  }
  if (!Array.isArray(out.profileWebsites)) {
    out.profileWebsites =
      out.profileWebsites == null || out.profileWebsites === ""
        ? []
        : parseListString(out.profileWebsites);
  }
  if (out.location == null || typeof out.location !== "object") {
    out.location = { ...DIRECTORY_DEFAULTS.location };
  } else {
    out.location = {
      city: toTrimmedString(out.location.city),
      stateProvince: toTrimmedString(out.location.stateProvince),
      countries: Array.isArray(out.location.countries)
        ? out.location.countries.map((c) => toTrimmedString(c)).filter(Boolean)
        : [],
    };
  }
  return out;
}

/**
 * Build flat directory fields from legacy `memberData` + `customFields`.
 * Does not include uid, email, etc. — caller merges onto existing doc.
 * @param {Record<string, unknown>} data
 * @returns {Record<string, unknown>}
 */
export function legacyToFlatDirectoryFields(data) {
  const cf =
    data.customFields && typeof data.customFields === "object" && !Array.isArray(data.customFields)
      ? data.customFields
      : {};
  const md =
    data.memberData && typeof data.memberData === "object" && !Array.isArray(data.memberData)
      ? data.memberData
      : null;

  const loc = md?.location && typeof md.location === "object" ? md.location : {};
  const city = toTrimmedString(cf.city ?? loc.city ?? "");
  const state = toTrimmedString(cf.state ?? loc.stateProvince ?? "");
  const countriesFromMd = Array.isArray(loc.countries)
    ? loc.countries.map((c) => toTrimmedString(c)).filter(Boolean)
    : [];
  const countryFromCf = toTrimmedString(cf.country ?? "");
  const countries = countriesFromMd.length ? countriesFromMd : countryFromCf ? [countryFromCf] : [];

  const firstName = toTrimmedString(md?.firstName ?? "");
  const lastName = toTrimmedString(md?.lastName ?? "");
  let fn = firstName;
  let ln = lastName;
  if (!fn && !ln && data.name) {
    const parts = toTrimmedString(data.name).split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      fn = parts[0];
    } else if (parts.length > 1) {
      fn = parts[0];
      ln = parts.slice(1).join(" ");
    }
  }

  const titleArr = Array.isArray(md?.title)
    ? md.title.map((t) => toTrimmedString(t)).filter(Boolean)
    : parseListString(cf.title ?? md?.title);
  const org = toTrimmedString(cf.organization ?? md?.organization ?? "");
  const classificationStr = classificationToString(cf.classification ?? md?.classification ?? "");

  const bioExisting = toTrimmedString(data.bio ?? "");
  const bioParts = [arrayToLine(titleArr), org, classificationStr].filter(Boolean);
  const bio = bioExisting || bioParts.join(" • ") || "";

  const profileWebsites = Array.isArray(md?.profileWebsites)
    ? md.profileWebsites.map((u) => toTrimmedString(u)).filter(Boolean)
    : parseListString(cf.profileUrl ?? "");

  const profileUrl =
    toTrimmedString(profileWebsites[0] ?? cf.profileUrl ?? "") || "";

  const fieldsOfStudy = Array.isArray(md?.fieldsOfStudy)
    ? md.fieldsOfStudy.map((x) => toTrimmedString(x)).filter(Boolean)
    : parseListString(cf.fieldsOfStudy ?? "");
  const areasOfInterest = Array.isArray(md?.areasOfInterest)
    ? md.areasOfInterest.map((x) => toTrimmedString(x)).filter(Boolean)
    : parseListString(cf.areasOfInterest ?? "");
  const topicsOfInterest = Array.isArray(md?.topicsOfInterest)
    ? md.topicsOfInterest.map((x) => toTrimmedString(x)).filter(Boolean)
    : parseListString(cf.topicsOfInterest ?? "");
  const networkActivities = Array.isArray(md?.networkActivities)
    ? md.networkActivities.map((x) => toTrimmedString(x)).filter(Boolean)
    : parseListString(cf.networkActivities ?? "");
  const languagesSpoken = Array.isArray(md?.languagesSpoken)
    ? md.languagesSpoken.map((x) => toTrimmedString(x)).filter(Boolean)
    : parseListString(cf.languagesSpoken ?? "");

  const workCountries = Array.isArray(md?.workCountries)
    ? md.workCountries.map((x) => toTrimmedString(x)).filter(Boolean)
    : parseListString(cf.workCountries ?? "");

  const mdOrigin = md?.countryOfOrigin;
  const countryOfOrigin =
    countryOfOriginToString(cf.countryOfOrigin ?? mdOrigin) ||
    (countries[0] ?? "");

  const country = countryFromCf || countries[0] || "";

  const phone = toTrimmedString(cf.phone ?? md?.phone ?? "");
  const gender = toTrimmedString(cf.gender ?? md?.gender ?? "");

  const shareContactInfo =
    typeof md?.shareContactInfo === "boolean"
      ? md.shareContactInfo
      : typeof data.shareContactInfo === "boolean"
        ? data.shareContactInfo
        : false;

  const isDuplicate = md?.isDuplicate === true || data.isDuplicate === true;

  const flat = {
    firstName: fn,
    lastName: ln,
    bio,
    city,
    state,
    country,
    countryOfOrigin,
    classification: classificationStr,
    gender,
    organization: org,
    phone,
    title: titleArr,
    fieldsOfStudy,
    areasOfInterest,
    topicsOfInterest,
    networkActivities,
    languagesSpoken,
    workCountries,
    profileUrl,
    profileWebsites,
    location: {
      city: city || toTrimmedString(loc.city ?? ""),
      stateProvince: state || toTrimmedString(loc.stateProvince ?? ""),
      countries: countries.length ? countries : country ? [country] : [],
    },
    shareContactInfo,
    isDuplicate,
  };

  return mergeDirectoryDefaults(flat);
}

/**
 * True if document likely still uses nested memberData / string customFields for directory data.
 * @param {Record<string, unknown>} data
 */
export function profileHasLegacyDirectoryShape(data) {
  if (!data || typeof data !== "object") return false;
  const md = data.memberData;
  if (md && typeof md === "object" && !Array.isArray(md) && Object.keys(md).length > 0) {
    return true;
  }
  const cf = data.customFields;
  if (!cf || typeof cf !== "object" || Array.isArray(cf)) return false;
  const keys = Object.keys(cf).filter((k) => toTrimmedString(cf[k]) !== "");
  return keys.length > 0;
}

/**
 * Patch missing canonical directory keys only (does not remove legacy).
 * @param {Record<string, unknown>} data
 */
export function directoryDefaultsPatch(data) {
  const merged = mergeDirectoryDefaults(data);
  /** @type {Record<string, unknown>} */
  const patch = {};
  for (const key of Object.keys(DIRECTORY_DEFAULTS)) {
    if (data[key] === undefined) patch[key] = merged[key];
  }
  if (data.location === undefined) patch.location = merged.location;
  return patch;
}

/** Admin forms: one line per list entry. */
export function stringListToMultiline(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.map((x) => String(x).trim()).filter(Boolean).join("\n");
}

/** Admin forms: newline-separated list → string[]. */
export function multilineToStringList(text) {
  if (text == null) return [];
  return String(text)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Form textarea key → Firestore array field (user edit + admin).
 * @type {{ formKey: string; profileKey: string; label: string }[]}
 */
export const PROFILE_EDIT_STRING_LIST_BINDINGS = [
  { formKey: "titleText", profileKey: "title", label: "Title (one per line)" },
  { formKey: "fieldsOfStudyText", profileKey: "fieldsOfStudy", label: "Fields of study (one per line)" },
  { formKey: "areasOfInterestText", profileKey: "areasOfInterest", label: "Areas of interest (one per line)" },
  { formKey: "topicsOfInterestText", profileKey: "topicsOfInterest", label: "Topics of interest (one per line)" },
  { formKey: "networkActivitiesText", profileKey: "networkActivities", label: "Network activities (one per line)" },
  { formKey: "languagesSpokenText", profileKey: "languagesSpoken", label: "Languages spoken (one per line)" },
  { formKey: "workCountriesText", profileKey: "workCountries", label: "Countries of work (one per line)" },
  { formKey: "profileWebsitesText", profileKey: "profileWebsites", label: "Profile websites (one per line)" },
];

/**
 * Multiline string fields + location JSON for profile edit UIs.
 * @param {Record<string, unknown> | null | undefined} profile
 */
/**
 * Empty value for a profile schema custom field (Firestore `customFields` map).
 * Only fills keys that are still `undefined` so explicit `null` (e.g. cleared file) is preserved.
 * @param {string | undefined} type
 * @returns {unknown}
 */
export function emptyProfileCustomFieldValueForType(type) {
  // All current profile schema types use empty string in controlled inputs; file/image treat "" as unset.
  if (type === "boolean") return false;
  return "";
}

/**
 * Ensure every configured profile custom field key exists so edit UIs stay controlled.
 * @param {Record<string, unknown> | null | undefined} customFields
 * @param {{ key?: string; type?: string }[] | null | undefined} fieldDefs
 * @returns {Record<string, unknown>}
 */
export function mergeProfileCustomFieldsDefaults(customFields, fieldDefs) {
  const base =
    customFields && typeof customFields === "object" && !Array.isArray(customFields)
      ? { ...customFields }
      : {};
  if (!Array.isArray(fieldDefs)) return base;
  for (const def of fieldDefs) {
    const key = def?.key;
    if (key == null || String(key).trim() === "") continue;
    if (base[key] !== undefined) continue;
    base[key] = emptyProfileCustomFieldValueForType(def.type);
  }
  return base;
}

export function profileToEditFormStringLists(profile) {
  const m = mergeDirectoryDefaults(profile || {});
  let locationJson;
  try {
    locationJson = JSON.stringify(m.location ?? { city: "", countries: [], stateProvince: "" }, null, 2);
  } catch {
    locationJson = JSON.stringify({ city: "", countries: [], stateProvince: "" }, null, 2);
  }
  /** @type {Record<string, string>} */
  const out = { locationJson };
  for (const { formKey, profileKey } of PROFILE_EDIT_STRING_LIST_BINDINGS) {
    out[formKey] = stringListToMultiline(m[profileKey]);
  }
  return out;
}

/**
 * Apply `*Text` textareas + `locationJson` onto a profile payload; removes those transient keys.
 * @param {Record<string, unknown>} form
 * @returns {{ ok: true, data: Record<string, unknown> } | { ok: false, error: string }}
 */
export function mergeEditFormStringListsIntoProfile(form) {
  if (!form || typeof form !== "object") return { ok: false, error: "Invalid form" };
  const next = { ...form };
  for (const { formKey, profileKey } of PROFILE_EDIT_STRING_LIST_BINDINGS) {
    next[profileKey] = multilineToStringList(next[formKey]);
    delete next[formKey];
  }
  const raw = (next.locationJson ?? "").trim();
  delete next.locationJson;
  try {
    if (!raw) {
      next.location = { city: "", countries: [], stateProvince: "" };
    } else {
      const loc = JSON.parse(raw);
      if (!loc || typeof loc !== "object" || Array.isArray(loc)) {
        return { ok: false, error: "Location must be a JSON object." };
      }
      next.location = {
        city: toTrimmedString(loc.city),
        stateProvince: toTrimmedString(loc.stateProvince),
        countries: Array.isArray(loc.countries)
          ? loc.countries.map((c) => toTrimmedString(c)).filter(Boolean)
          : [],
      };
    }
  } catch {
    return { ok: false, error: "Location JSON is invalid." };
  }
  const n = parseInt(String(next.notification ?? 0), 10);
  next.notification = Number.isFinite(n) ? n : 0;
  delete next.createdAt;
  return { ok: true, data: next };
}
