import React from "react";
import {
  MdWorkOutline as WorkIcon,
  MdOutlinePublic as LocationIcon,
  MdTranslate as LangIcon,
  MdSchool as StudyIcon,
  MdCategory as ClassIcon,
} from "react-icons/md";

function arrJoin(val) {
  if (val == null) return "";
  if (Array.isArray(val)) return val.filter(Boolean).map(String).join("; ");
  return String(val).trim();
}

export function formatMemberLocation(md) {
  if (!md?.location || typeof md.location !== "object") return "";
  const { countries, stateProvince, city } = md.location;
  const c = Array.isArray(countries) ? countries.filter(Boolean).join(", ") : countries || "";
  const parts = [c, stateProvince, city].filter(Boolean);
  return parts.join(" · ");
}

/**
 * Build labeled rows for directory-imported profiles (compact UI).
 */
export function getImportedSummaryRows(profile) {
  if (!profile) return [];
  const md = profile.memberData;
  const cf = profile.customFields || {};
  const rows = [];

  const title =
    cf.title ||
    (Array.isArray(md?.title) ? md.title.filter(Boolean).join("; ") : md?.title) ||
    "";
  const org = cf.organization || md?.organization || "";
  if (title) rows.push({ key: "title", label: "Title", value: title, icon: WorkIcon });
  if (org) rows.push({ key: "organization", label: "Organization", value: org, icon: WorkIcon });

  const loc = formatMemberLocation(md) || [cf.country, cf.state, cf.city].filter(Boolean).join(" · ");
  if (loc) rows.push({ key: "location", label: "Location", value: loc, icon: LocationIcon });

  const classification =
    cf.classification ||
    (Array.isArray(md?.classification) ? md.classification.join("; ") : md?.classification) ||
    "";
  if (classification)
    rows.push({ key: "classification", label: "Classification", value: classification, icon: ClassIcon });

  const gender = cf.gender || md?.gender || "";
  if (gender) rows.push({ key: "gender", label: "Gender", value: gender });

  const langs =
    cf.languagesSpoken || arrJoin(md?.languagesSpoken);
  if (langs) rows.push({ key: "languages", label: "Languages", value: langs, icon: LangIcon });

  const fields =
    cf.fieldsOfStudy || arrJoin(md?.fieldsOfStudy);
  if (fields)
    rows.push({ key: "fields", label: "Fields of study", value: fields, icon: StudyIcon });

  const topics = cf.topicsOfInterest || arrJoin(md?.topicsOfInterest);
  if (topics) rows.push({ key: "topics", label: "Topics of interest", value: topics });

  const interests = cf.areasOfInterest || arrJoin(md?.areasOfInterest);
  if (interests) rows.push({ key: "interests", label: "Areas of interest", value: interests });

  const origin = cf.countryOfOrigin || arrJoin(md?.countryOfOrigin);
  if (origin) rows.push({ key: "origin", label: "Country of origin", value: origin });

  const work = cf.workCountries || arrJoin(md?.workCountries);
  if (work) rows.push({ key: "workCountries", label: "Countries of work", value: work });

  const networkActs = cf.networkActivities || arrJoin(md?.networkActivities);
  if (networkActs) rows.push({ key: "network", label: "Network activities", value: networkActs });

  if (md?.shareContactInfo != null) {
    rows.push({
      key: "shareContact",
      label: "Share contact info",
      value: md.shareContactInfo ? "Yes" : "No",
    });
  }

  return rows;
}

/**
 * Effective value for a profile custom-field key: `customFields[key]` with memberData fallbacks
 * (same idea as edit profile / ingest: title, organization, location, etc.).
 */
export function getProfileCustomFieldEffectiveValue(profile, key) {
  if (!profile || key == null || key === "") return "";
  const k = String(key);
  const cf = profile.customFields || {};
  const md = profile.memberData;
  const fromCf = (cf[k] ?? "").toString().trim();
  if (!md || typeof md !== "object") return fromCf;

  switch (k) {
    case "title": {
      const t =
        fromCf ||
        (Array.isArray(md.title) ? md.title.filter(Boolean).join("; ") : md.title) ||
        "";
      return String(t).trim();
    }
    case "organization":
      return (fromCf || md.organization || "").toString().trim();
    case "country":
      return (fromCf || arrJoin(md.location?.countries)).toString().trim();
    case "state":
      return (fromCf || (md.location?.stateProvince ?? "")).toString().trim();
    case "city":
      return (fromCf || (md.location?.city ?? "")).toString().trim();
    case "classification":
      return (
        fromCf ||
        (Array.isArray(md.classification) ? md.classification.join("; ") : md.classification || "")
      )
        .toString()
        .trim();
    case "gender":
      return (fromCf || md.gender || "").toString().trim();
    case "phone":
      return (fromCf || md.phone || "").toString().trim();
    case "profileUrl":
      return (fromCf || arrJoin(md.profileWebsites)).toString().trim();
    case "fieldsOfStudy":
      return (fromCf || arrJoin(md.fieldsOfStudy)).toString().trim();
    case "areasOfInterest":
      return (fromCf || arrJoin(md.areasOfInterest)).toString().trim();
    case "topicsOfInterest":
      return (fromCf || arrJoin(md.topicsOfInterest)).toString().trim();
    case "networkActivities":
      return (fromCf || arrJoin(md.networkActivities)).toString().trim();
    case "languagesSpoken":
      return (fromCf || arrJoin(md.languagesSpoken)).toString().trim();
    case "countryOfOrigin":
      return (fromCf || arrJoin(md.countryOfOrigin)).toString().trim();
    case "workCountries":
      return (fromCf || arrJoin(md.workCountries)).toString().trim();
    case "memberStatus":
      return (fromCf || (md.status != null ? String(md.status) : "")).toString().trim();
    default:
      return fromCf;
  }
}

/** Lowercase blob for keyword search (name, bio, customFields, directory/import fields). */
export function getProfileSearchHaystack(profile) {
  if (!profile) return "";
  const parts = [
    profile.name,
    profile.username,
    profile.bio,
    profile.email,
    profile.sourceMemberId != null && profile.sourceMemberId !== "" ? String(profile.sourceMemberId) : "",
  ];
  Object.values(profile.customFields ?? {}).forEach((v) => {
    if (v != null && String(v).trim() !== "") parts.push(String(v));
  });
  getImportedSummaryRows(profile).forEach((r) => {
    if (r.value != null && String(r.value).trim() !== "") parts.push(String(r.value));
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
  const rows = getImportedSummaryRows(profile);
  const primary = [rows.find((r) => r.key === "title"), rows.find((r) => r.key === "organization")]
    .filter(Boolean)
    .map((r) => r.value)
    .filter(Boolean)
    .join(" · ");
  const loc = rows.find((r) => r.key === "location");
  const secondary = loc?.value || "";
  return { primary, secondary };
}

/**
 * Compact grid of directory fields under the profile bio / in sidebars.
 */
export default function ImportedProfileSummary({ profile, className = "" }) {
  const rows = getImportedSummaryRows(profile);
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
