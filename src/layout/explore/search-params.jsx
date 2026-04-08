/**
 * Search params panel – filters based on profile fields (keyword, classification, directory snapshot,
 * source member id, and configured custom fields; values match customFields + memberData like edit profile).
 * Renders in the right column of the explore/search page.
 * Text-like fields show a select of distinct values from profiles when available.
 */

import React, { useCallback, useMemo } from "react";
import { useCustomFieldsForProfile, useAllProfiles, useClassificationTagOptions } from "../../hooks/queries";
import { useQueries } from "@tanstack/react-query";
import { getTagsByCategoryId } from "../../service/Auth/database";
import { getProfileCustomFieldEffectiveValue } from "../../component/imported-profile-summary";

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-bg-default border border-border-default text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50 placeholder:text-text-tertiary";
const labelClass = "block text-sm font-medium text-text-secondary mb-1.5";

const MAX_OPTIONS_FOR_SELECT = 100;
const DEFAULT_PROFILE_FILTER_FIELDS = [
  { key: "title", label: "Title", type: "text" },
  { key: "organization", label: "Organization", type: "text" },
  { key: "country", label: "Country", type: "text" },
  { key: "state", label: "State/Province", type: "text" },
  { key: "city", label: "City", type: "text" },
  { key: "gender", label: "Gender", type: "text" },
  { key: "fieldsOfStudy", label: "Fields of study", type: "text" },
  { key: "areasOfInterest", label: "Areas of interest", type: "text" },
  { key: "countryOfOrigin", label: "Country of origin", type: "text" },
  { key: "workCountries", label: "Work countries", type: "text" },
  { key: "memberStatus", label: "Member status", type: "text" },
  { key: "profileUrl", label: "Profile URL", type: "text" },
];

export default function SearchParams({ filters = {}, onFiltersChange }) {
  const { data: profileCustomFieldsRaw = [] } = useCustomFieldsForProfile();
  const profileCustomFields = useMemo(() => {
    const configured = profileCustomFieldsRaw.filter((f) => f.showAsFilter !== false);
    const byKey = new Map(configured.map((f) => [f.key, f]));
    DEFAULT_PROFILE_FILTER_FIELDS.forEach((f) => {
      if (!byKey.has(f.key)) byKey.set(f.key, { id: `builtin-${f.key}`, ...f, showAsFilter: true });
    });
    return Array.from(byKey.values());
  }, [profileCustomFieldsRaw]);
  const { data: allProfiles = [] } = useAllProfiles();
  const { data: classificationOptions = [] } = useClassificationTagOptions();
  const lookups = profileCustomFields.filter((f) => f.type === "lookup" && f.tagCategoryId);
  const tagQueries = useQueries({
    queries: lookups.map((f) => ({
      queryKey: ["tags", f.tagCategoryId],
      queryFn: () => getTagsByCategoryId(f.tagCategoryId),
      enabled: !!f.tagCategoryId,
    })),
  });
  const lookupTagsByKey = lookups.reduce((acc, f, i) => {
    if (tagQueries[i]?.data) acc[f.key] = tagQueries[i].data;
    return acc;
  }, {});

  /** Distinct non-empty values per field key (for text-like fields), sorted, for use as select options. */
  const distinctValuesByKey = useMemo(() => {
    const out = {};
    profileCustomFields.forEach((field) => {
      if (field.type === "lookup" || field.type === "file" || field.type === "image") return;
      const set = new Set();
      allProfiles.forEach((p) => {
        const v = getProfileCustomFieldEffectiveValue(p, field.key);
        if (v) set.add(v);
      });
      const arr = Array.from(set).sort((a, b) => (a || "").localeCompare(b || "", undefined, { sensitivity: "base" }));
      if (arr.length > 0 && arr.length <= MAX_OPTIONS_FOR_SELECT) out[field.key] = arr;
    });
    return out;
  }, [allProfiles, profileCustomFields]);

  const setFilter = useCallback(
    (key, value) => {
      onFiltersChange?.((prev) => ({ ...prev, [key]: value == null || value === "" ? "" : value }));
    },
    [onFiltersChange]
  );

  const clearAll = useCallback(() => {
    onFiltersChange?.(() => {
      const next = { keyword: "", classificationTagId: "", directoryScope: "", sourceMemberId: "" };
      profileCustomFields.forEach((f) => {
        next[f.key] = "";
      });
      return next;
    });
  }, [onFiltersChange, profileCustomFields]);
  const reassertFilters = useCallback(() => {
    onFiltersChange?.((prev) => ({ ...(prev && typeof prev === "object" ? prev : {}) }));
  }, [onFiltersChange]);

  const hasAnyFilter =
    (filters.keyword ?? "").trim() !== "" ||
    (filters.classificationTagId ?? "").trim() !== "" ||
    (filters.directoryScope ?? "").trim() !== "" ||
    (filters.sourceMemberId ?? "").trim() !== "" ||
    profileCustomFields.some((f) => (filters[f.key] ?? "").trim() !== "");

  return (
    <div className="w-full sticky top-8">
      <div className="bg-bg-tertiary rounded-2xl border border-border-default overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Search params</h2>
          {hasAnyFilter && (
            <button
              type="button"
              onClick={clearAll}
              className="text-sm text-text-tertiary hover:text-text-primary"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reassertFilters}
              className="w-full px-3 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium transition-colors"
            >
              Search
            </button>
          </div>

          <div>
            <label className={labelClass}>Keyword</label>
            <input
              type="search"
              value={filters.keyword ?? ""}
              onChange={(e) => setFilter("keyword", e.target.value)}
              placeholder="Name, username, bio, directory fields…"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Source member ID</label>
            <input
              type="text"
              value={filters.sourceMemberId ?? ""}
              onChange={(e) => setFilter("sourceMemberId", e.target.value)}
              placeholder="Partial match on imported member id…"
              className={inputClass}
            />
          </div>

          {profileCustomFields.map((field) => (
            <div key={field.id}>
              <label className={labelClass}>{field.label}</label>
              {field.type === "lookup" ? (
                <select
                  value={filters[field.key] ?? ""}
                  onChange={(e) => setFilter(field.key, e.target.value)}
                  className={inputClass}
                >
                  <option value="">Any</option>
                  {(lookupTagsByKey[field.key] ?? []).map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "file" || field.type === "image" ? (
                <select
                  value={filters[field.key] ?? ""}
                  onChange={(e) => setFilter(field.key, e.target.value)}
                  className={inputClass}
                >
                  <option value="">Any</option>
                  <option value="yes">Has file</option>
                  <option value="no">No file</option>
                </select>
              ) : distinctValuesByKey[field.key] ? (
                <select
                  value={filters[field.key] ?? ""}
                  onChange={(e) => setFilter(field.key, e.target.value)}
                  className={inputClass}
                >
                  <option value="">Any</option>
                  {distinctValuesByKey[field.key].map((val) => (
                    <option key={val} value={val}>
                      {val}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={filters[field.key] ?? ""}
                  onChange={(e) => setFilter(field.key, e.target.value)}
                  placeholder={`Filter by ${field.label}…`}
                  className={inputClass}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
