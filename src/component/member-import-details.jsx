import React from "react";

const LABELS = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  title: "Title",
  organization: "Organization",
  phone: "Phone",
  gender: "Gender",
  classification: "Classification",
  location: "Location",
  countryOfOrigin: "Country of origin",
  workCountries: "Countries of work",
  languagesSpoken: "Languages",
  profileWebsites: "Websites",
  fieldsOfStudy: "Fields of study",
  areasOfInterest: "Areas of interest",
  topicsOfInterest: "Topics of interest",
  networkActivities: "Network activities",
  shareContactInfo: "Share contact info",
  status: "Status",
  isDuplicate: "Duplicate record",
  addedToMailchimpAt: "Added to mail (import)",
};

function formatScalar(val) {
  if (val == null || val === "") return null;
  if (val instanceof Date) return val.toLocaleString();
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "object") {
    if (val.seconds != null && val.nanoseconds != null) {
      try {
        return new Date(val.seconds * 1000).toLocaleString();
      } catch {
        return JSON.stringify(val);
      }
    }
    if (Array.isArray(val.countries) || val.stateProvince || val.city) {
      const parts = [
        Array.isArray(val.countries) ? val.countries.join(", ") : val.countries,
        val.stateProvince,
        val.city,
      ].filter(Boolean);
      return parts.length ? parts.join(" · ") : null;
    }
    return JSON.stringify(val);
  }
  return String(val);
}

function renderValue(key, val) {
  if (val == null || val === "") return null;

  if (key === "profileWebsites" || key === "location") {
    if (key === "location" && val && typeof val === "object" && !Array.isArray(val)) {
      const t = formatScalar(val);
      return t ? <span className="whitespace-pre-wrap">{t}</span> : null;
    }
    const urls = Array.isArray(val) ? val : [val];
    const list = urls.filter((u) => typeof u === "string" && u.trim());
    if (!list.length) return null;
    return (
      <span className="flex flex-col gap-1">
        {list.map((url, i) =>
          url.startsWith("http") ? (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-accent-500 hover:underline break-all">
              {url}
            </a>
          ) : (
            <span key={i} className="break-words">{url}</span>
          )
        )}
      </span>
    );
  }

  if (Array.isArray(val)) {
    const lines = val.filter((x) => x != null && String(x).trim()).map(String);
    if (!lines.length) return null;
    return <span className="whitespace-pre-wrap">{lines.join("; ")}</span>;
  }

  const s = formatScalar(val);
  return s ? <span className="whitespace-pre-wrap break-words">{s}</span> : null;
}

/**
 * Renders imported member directory fields from profile.memberData (ingest from members.json).
 */
export default function MemberImportDetails({ memberData }) {
  if (!memberData || typeof memberData !== "object") return null;

  const entries = Object.entries(memberData).filter(([k]) => k !== "__collections__");
  const rows = entries
    .map(([key, val]) => {
      const node = renderValue(key, val);
      if (!node) return null;
      const label = LABELS[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
      return { key, label, node };
    })
    .filter(Boolean);

  if (!rows.length) return null;

  return (
    <div className="mt-6 pt-6 border-t border-border-default">
      <h3 className="text-sm font-semibold text-text-primary mb-3">Directory profile</h3>
      <dl className="space-y-2 text-sm text-text-secondary">
        {rows.map(({ key, label, node }) => (
          <div key={key} className="grid grid-cols-1 sm:grid-cols-[minmax(0,11rem)_1fr] gap-1 sm:gap-3">
            <dt className="text-text-tertiary shrink-0">{label}</dt>
            <dd className="text-text-primary min-w-0">{node}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
