import React from "react";
import {
  MdWorkOutline as WorkIcon,
  MdOutlinePublic as LocationIcon,
  MdTranslate as LangIcon,
  MdSchool as StudyIcon,
  MdCategory as ClassIcon,
  MdPhone as PhoneIcon,
  MdPerson as PersonIcon,
} from "react-icons/md";
import {
  arrayToLine,
  mergeDirectoryDefaults,
  toTrimmedString,
} from "../lib/profile-directory-fields.js";

/** Displayed when a directory field has no value (show-all-rows mode). */
export const DIRECTORY_VALUE_EMPTY = "\u2014";

/** Use expanded directory rows (including placeholders) for imported / legacy-shaped profiles. */
export function profileHasDirectorySummaryContext(profile) {
  if (!profile) return false;
  const cf = profile.customFields;
  return !!(
    profile.importSource ||
    profile.sourceMemberId ||
    profile.memberData ||
    (cf && typeof cf === "object" && !Array.isArray(cf) && Object.keys(cf).length > 0)
  );
}

function arrJoin(val) {
  if (val == null) return "";
  if (Array.isArray(val)) return val.filter(Boolean).map(String).join("; ");
  return String(val).trim();
}

/**
 * Format location from a profile (top-level `location`) or legacy `memberData` snapshot.
 * @param {Record<string, unknown> | null | undefined} profileOrMemberData
 */
export function formatMemberLocation(profileOrMemberData) {
  if (!profileOrMemberData) return "";
  const loc =
    profileOrMemberData.location && typeof profileOrMemberData.location === "object"
      ? profileOrMemberData.location
      : profileOrMemberData.memberData?.location &&
          typeof profileOrMemberData.memberData.location === "object"
        ? profileOrMemberData.memberData.location
        : null;
  if (!loc) return "";
  const { countries, stateProvince, city } = loc;
  const c = Array.isArray(countries) ? countries.filter(Boolean).join(", ") : countries || "";
  const parts = [c, stateProvince, city].filter(Boolean);
  return parts.join(" · ");
}

/** @param {string} value @param {boolean} showEmptyFields */
function displayValue(value, showEmptyFields) {
  const v = value == null ? "" : String(value).trim();
  if (v) return v;
  if (!showEmptyFields) return "";
  return DIRECTORY_VALUE_EMPTY;
}

/**
 * Build labeled rows for directory / imported profiles.
 * @param {Record<string, unknown> | null | undefined} profile
 * @param {{ showEmptyFields?: boolean }} [options]
 */
export function getImportedSummaryRows(profile, options = {}) {
  const { showEmptyFields = true } = options;
  if (!profile) return showEmptyFields ? [] : [];
  const p = mergeDirectoryDefaults(profile);
  const md = profile.memberData && typeof profile.memberData === "object" ? profile.memberData : null;
  const cf = profile.customFields || {};
  const rows = [];

  const push = (key, label, raw, Icon) => {
    const v = raw == null ? "" : String(raw).trim();
    if (!showEmptyFields && !v) return;
    rows.push({ key, label, value: displayValue(v, showEmptyFields), icon: Icon });
  };

  const title =
    arrayToLine(p.title) ||
    toTrimmedString(cf.title) ||
    (Array.isArray(md?.title) ? md.title.filter(Boolean).join("; ") : toTrimmedString(md?.title));
  push("title", "Title", title, WorkIcon);

  const org =
    toTrimmedString(p.organization) ||
    toTrimmedString(cf.organization) ||
    toTrimmedString(md?.organization);
  push("organization", "Organization", org, WorkIcon);

  const loc =
    formatMemberLocation(profile) ||
    [p.country, p.state, p.city].filter(Boolean).join(" · ") ||
    [cf.country, cf.state, cf.city].filter(Boolean).join(" · ");
  push("location", "Location", loc, LocationIcon);

  const classification =
    toTrimmedString(p.classification) ||
    toTrimmedString(cf.classification) ||
    (Array.isArray(md?.classification) ? md.classification.join("; ") : toTrimmedString(md?.classification));
  push("classification", "Classification", classification, ClassIcon);

  const fn = toTrimmedString(p.firstName) || toTrimmedString(md?.firstName);
  push("firstName", "First name", fn, PersonIcon);
  const ln = toTrimmedString(p.lastName) || toTrimmedString(md?.lastName);
  push("lastName", "Last name", ln, PersonIcon);

  const gender = toTrimmedString(p.gender) || toTrimmedString(cf.gender) || toTrimmedString(md?.gender);
  push("gender", "Gender", gender);

  const phone =
    toTrimmedString(p.phone) || toTrimmedString(cf.phone) || toTrimmedString(md?.phone);
  push("phone", "Phone", phone, PhoneIcon);

  const langs =
    arrayToLine(p.languagesSpoken) ||
    toTrimmedString(cf.languagesSpoken) ||
    arrJoin(md?.languagesSpoken);
  push("languages", "Languages", langs, LangIcon);

  const fields =
    arrayToLine(p.fieldsOfStudy) ||
    toTrimmedString(cf.fieldsOfStudy) ||
    arrJoin(md?.fieldsOfStudy);
  push("fields", "Fields of study", fields, StudyIcon);

  const topics =
    arrayToLine(p.topicsOfInterest) ||
    toTrimmedString(cf.topicsOfInterest) ||
    arrJoin(md?.topicsOfInterest);
  push("topics", "Topics of interest", topics);

  const interests =
    arrayToLine(p.areasOfInterest) ||
    toTrimmedString(cf.areasOfInterest) ||
    arrJoin(md?.areasOfInterest);
  push("interests", "Areas of interest", interests);

  const origin =
    toTrimmedString(p.countryOfOrigin) ||
    toTrimmedString(cf.countryOfOrigin) ||
    arrJoin(md?.countryOfOrigin);
  push("origin", "Country of origin", origin);

  const work =
    arrayToLine(p.workCountries) ||
    toTrimmedString(cf.workCountries) ||
    arrJoin(md?.workCountries);
  push("workCountries", "Countries of work", work);

  const networkActs =
    arrayToLine(p.networkActivities) ||
    toTrimmedString(cf.networkActivities) ||
    arrJoin(md?.networkActivities);
  push("network", "Network activities", networkActs);

  const share =
    typeof p.shareContactInfo === "boolean"
      ? p.shareContactInfo
        ? "Yes"
        : "No"
      : md?.shareContactInfo != null
        ? md.shareContactInfo
          ? "Yes"
          : "No"
        : "";
  push("shareContact", "Share contact info", share);

  return rows;
}

/**
 * Effective value for a profile custom-field key: top-level directory fields, then
 * `customFields[key]`, then `memberData` fallbacks.
 */
export function getProfileCustomFieldEffectiveValue(profile, key) {
  if (!profile || key == null || key === "") return "";
  const k = String(key);
  const p = mergeDirectoryDefaults(profile);
  const cf = profile.customFields || {};
  const md = profile.memberData && typeof profile.memberData === "object" ? profile.memberData : null;
  const fromCf = (cf[k] ?? "").toString().trim();

  switch (k) {
    case "title": {
      const fromP = arrayToLine(p.title);
      if (fromP) return fromP;
      if (fromCf) return fromCf;
      if (md?.title == null) return "";
      return (Array.isArray(md.title) ? md.title.filter(Boolean).join("; ") : String(md.title)).trim();
    }
    case "organization": {
      const fromP = toTrimmedString(p.organization);
      if (fromP) return fromP;
      return (fromCf || (md?.organization != null ? String(md.organization) : "")).trim();
    }
    case "country": {
      const fromP = toTrimmedString(p.country) || arrayToLine(p.location?.countries);
      if (fromP) return fromP;
      if (fromCf) return fromCf;
      return md?.location?.countries ? arrJoin(md.location.countries) : "";
    }
    case "state": {
      const fromP = toTrimmedString(p.state) || toTrimmedString(p.location?.stateProvince);
      if (fromP) return fromP;
      if (fromCf) return fromCf;
      return (md?.location?.stateProvince ?? "").toString().trim();
    }
    case "city": {
      const fromP = toTrimmedString(p.city) || toTrimmedString(p.location?.city);
      if (fromP) return fromP;
      if (fromCf) return fromCf;
      return (md?.location?.city ?? "").toString().trim();
    }
    case "classification": {
      const fromP = toTrimmedString(p.classification);
      if (fromP) return fromP;
      if (fromCf) return fromCf;
      if (!md?.classification) return "";
      return (Array.isArray(md.classification)
        ? md.classification.join("; ")
        : String(md.classification)
      ).trim();
    }
    case "gender": {
      const fromP = toTrimmedString(p.gender);
      if (fromP) return fromP;
      return (fromCf || (md?.gender != null ? String(md.gender) : "")).trim();
    }
    case "phone": {
      const fromP = toTrimmedString(p.phone);
      if (fromP) return fromP;
      return (fromCf || (md?.phone != null ? String(md.phone) : "")).trim();
    }
    case "profileUrl": {
      const fromP = toTrimmedString(p.profileUrl) || arrayToLine(p.profileWebsites);
      if (fromP) return fromP;
      if (fromCf) return fromCf;
      return md?.profileWebsites ? arrJoin(md.profileWebsites) : "";
    }
    case "fieldsOfStudy": {
      const fromP = arrayToLine(p.fieldsOfStudy);
      if (fromP) return fromP;
      if (fromCf) return fromCf;
      return md?.fieldsOfStudy ? arrJoin(md.fieldsOfStudy) : "";
    }
    case "areasOfInterest": {
      const fromP = arrayToLine(p.areasOfInterest);
      if (fromP) return fromP;
      if (fromCf) return fromCf;
      return md?.areasOfInterest ? arrJoin(md.areasOfInterest) : "";
    }
    case "topicsOfInterest": {
      const fromP = arrayToLine(p.topicsOfInterest);
      if (fromP) return fromP;
      if (fromCf) return fromCf;
      return md?.topicsOfInterest ? arrJoin(md.topicsOfInterest) : "";
    }
    case "networkActivities": {
      const fromP = arrayToLine(p.networkActivities);
      if (fromP) return fromP;
      if (fromCf) return fromCf;
      return md?.networkActivities ? arrJoin(md.networkActivities) : "";
    }
    case "languagesSpoken": {
      const fromP = arrayToLine(p.languagesSpoken);
      if (fromP) return fromP;
      if (fromCf) return fromCf;
      return md?.languagesSpoken ? arrJoin(md.languagesSpoken) : "";
    }
    case "countryOfOrigin": {
      const fromP = toTrimmedString(p.countryOfOrigin);
      if (fromP) return fromP;
      if (fromCf) return fromCf;
      return md?.countryOfOrigin ? arrJoin(md.countryOfOrigin) : "";
    }
    case "workCountries": {
      const fromP = arrayToLine(p.workCountries);
      if (fromP) return fromP;
      if (fromCf) return fromCf;
      return md?.workCountries ? arrJoin(md.workCountries) : "";
    }
    case "memberStatus":
      return (fromCf || (md?.status != null ? String(md.status) : "")).toString().trim();
    default:
      return fromCf;
  }
}

/** Lowercase blob for keyword search (name, bio, customFields, directory/import fields). */
export function getProfileSearchHaystack(profile) {
  if (!profile) return "";
  const p = mergeDirectoryDefaults(profile);
  const parts = [
    profile.name,
    profile.username,
    profile.bio,
    profile.email,
    profile.sourceMemberId != null && profile.sourceMemberId !== "" ? String(profile.sourceMemberId) : "",
    p.firstName,
    p.lastName,
    arrayToLine(p.title),
    p.organization,
    p.classification,
    p.city,
    p.state,
    p.country,
    p.countryOfOrigin,
    arrayToLine(p.fieldsOfStudy),
    arrayToLine(p.areasOfInterest),
    arrayToLine(p.topicsOfInterest),
    arrayToLine(p.networkActivities),
    arrayToLine(p.languagesSpoken),
    arrayToLine(p.workCountries),
    p.phone,
    arrayToLine(p.profileWebsites),
    p.profileUrl,
  ];
  Object.values(profile.customFields ?? {}).forEach((v) => {
    if (v != null && String(v).trim() !== "") parts.push(String(v));
  });
  getImportedSummaryRows(profile, { showEmptyFields: false }).forEach((r) => {
    if (r.value != null && String(r.value).trim() !== "" && r.value !== DIRECTORY_VALUE_EMPTY) {
      parts.push(String(r.value));
    }
  });
  if (profile.memberData && typeof profile.memberData === "object") {
    try {
      parts.push(JSON.stringify(profile.memberData));
    } catch {
      /* ignore */
    }
  }
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/**
 * Primary + secondary line for list rows (explore sidebar, profileviewbox).
 */
export function getImportedListSubtitle(profile) {
  const rows = getImportedSummaryRows(profile, { showEmptyFields: false });
  const primary = [rows.find((r) => r.key === "title"), rows.find((r) => r.key === "organization")]
    .filter(Boolean)
    .map((r) => r.value)
    .filter((v) => v && v !== DIRECTORY_VALUE_EMPTY)
    .join(" · ");
  const loc = rows.find((r) => r.key === "location");
  const secondary =
    loc?.value && loc.value !== DIRECTORY_VALUE_EMPTY ? loc.value : "";
  return { primary, secondary };
}

/**
 * Compact grid of directory fields under the profile bio / in sidebars.
 */
export default function ImportedProfileSummary({ profile, className = "", showEmptyFields = true }) {
  const rows = getImportedSummaryRows(profile, { showEmptyFields });
  if (!rows.length) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {rows.map(({ key, label, value, icon: Icon }) => (
        <div key={key} className="flex gap-2 text-sm text-text-secondary items-start min-w-0">
          {Icon ? <Icon className="text-base shrink-0 mt-0.5 text-accent-500/90" aria-hidden /> : null}
          <div className="min-w-0">
            <span className="text-text-tertiary text-xs uppercase tracking-wide">{label}</span>
            <p className="text-text-primary text-[13px] leading-snug break-words">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
