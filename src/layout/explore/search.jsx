import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useQueries } from "@tanstack/react-query";
import { BsArrowUp } from "react-icons/bs";
import UserCard from "../../component/user-card";
import { useAllProfiles, useCustomFieldsForProfile, useClassificationTagOptions } from "../../hooks/queries";
import { getTagsByCategoryId } from "../../service/Auth/database";
import { recordSearchRequest } from "../../service/searchAnalytics";
import {
  getProfileSearchHaystack,
  getProfileCustomFieldEffectiveValue,
} from "../../component/imported-profile-summary";
import { useUserdatacontext } from "../../service/context/usercontext";
import { suggestSearchFiltersCallable } from "../../service/Auth";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

const PAGE_SIZE = 20;

const SUGGESTIONS = [
  "Researchers",
  "Educators",
  "Developers",
  "Scientists",
  "Network Members",
];

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

function debounce(func, delay) {
  let timeoutId;
  return (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

function buildKeywordTerms(input) {
  const raw = String(input || "")
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const stop = new Set(["in", "on", "at", "the", "a", "an", "of", "for", "to", "and", "or"]);
  return raw.filter((t) => !stop.has(t));
}

export default function Search({ bio = false, filters = {}, onFiltersChange }) {
  const { userdata, defaultprofileimage } = useUserdatacontext();
  const [question, setQuestion] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);
  const { data: allusers = [] } = useAllProfiles();
  const { data: profileCustomFieldsRaw = [] } = useCustomFieldsForProfile();
  const profileCustomFields = useMemo(() => {
    const configured = profileCustomFieldsRaw.filter((f) => f.showAsFilter !== false);
    const byKey = new Map(configured.map((f) => [f.key, f]));
    DEFAULT_PROFILE_FILTER_FIELDS.forEach((f) => {
      if (!byKey.has(f.key)) byKey.set(f.key, { id: `builtin-${f.key}`, ...f, showAsFilter: true });
    });
    return Array.from(byKey.values());
  }, [profileCustomFieldsRaw]);
  const { data: classificationOptions = [] } = useClassificationTagOptions();
  const lookups = useMemo(
    () => profileCustomFields.filter((f) => f.type === "lookup" && f.tagCategoryId),
    [profileCustomFields]
  );
  const tagQueries = useQueries({
    queries: lookups.map((f) => ({
      queryKey: ["tags", f.tagCategoryId],
      queryFn: () => getTagsByCategoryId(f.tagCategoryId),
      enabled: !!f.tagCategoryId,
    })),
  });
  const lookupTagsByKey = useMemo(() => {
    const acc = {};
    lookups.forEach((f, i) => {
      if (tagQueries[i]?.data) acc[f.key] = tagQueries[i].data;
    });
    return acc;
  }, [lookups, tagQueries]);
  const filterSchema = useMemo(
    () => ({
      classification: classificationOptions.map((t) => ({ id: t.id, label: t.label })),
      customFields: profileCustomFields.map((f) => {
        const base = { key: f.key, label: f.label, type: f.type };
        if (f.type === "lookup" && (lookupTagsByKey[f.key] ?? []).length > 0) {
          return { ...base, options: lookupTagsByKey[f.key].map((o) => ({ id: o.id, label: o.label })) };
        }
        return base;
      }),
      directoryScope: [
        { value: "directory", label: "Directory / imported members only" },
        { value: "not_directory", label: "Exclude directory / imported members" },
      ],
    }),
    [classificationOptions, profileCustomFields, lookupTagsByKey]
  );

  const keyword = (filters.keyword ?? "").toString().trim();

  const relaventusers = useMemo(() => {
    let list = allusers;
    if (keyword) {
      const terms = buildKeywordTerms(keyword);
      if (terms.length > 0) {
        list = list.filter((user) => {
          const haystack = getProfileSearchHaystack(user);
          return terms.every((term) => {
            if (haystack.includes(term)) return true;
            // Basic singular fallback: "researchers" should match "researcher".
            if (term.endsWith("s") && term.length > 3) return haystack.includes(term.slice(0, -1));
            return false;
          });
        });
      }
    }
    const classificationTagId = (filters.classificationTagId ?? "").trim();
    if (classificationTagId) {
      list = list.filter((user) => (user?.classificationTagId ?? "") === classificationTagId);
    }
    const directoryScope = (filters.directoryScope ?? "").trim();
    const hasMemberData = (user) =>
      !!(user?.memberData && typeof user.memberData === "object" && Object.keys(user.memberData).length > 0);
    if (directoryScope === "directory") {
      list = list.filter(hasMemberData);
    } else if (directoryScope === "not_directory") {
      list = list.filter((user) => !hasMemberData(user));
    }
    const sourceMemberIdFilter = (filters.sourceMemberId ?? "").trim();
    if (sourceMemberIdFilter) {
      const q = sourceMemberIdFilter.toLowerCase();
      list = list.filter((user) =>
        String(user?.sourceMemberId ?? "")
          .toLowerCase()
          .includes(q)
      );
    }
    profileCustomFields.forEach((field) => {
      const filterVal = (filters[field.key] ?? "").trim();
      if (!filterVal) return;
      list = list.filter((user) => {
        const val = getProfileCustomFieldEffectiveValue(user, field.key);
        if (field.type === "lookup") return val === filterVal;
        if (field.type === "file" || field.type === "image") {
          const hasFile = !!val;
          return filterVal === "yes" ? hasFile : !hasFile;
        }
        return val.toLowerCase().includes(filterVal.toLowerCase());
      });
    });
    return list;
  }, [allusers, filters, keyword, profileCustomFields]);

  const visibleUsers = useMemo(
    () => relaventusers.slice(0, visibleCount),
    [relaventusers, visibleCount]
  );
  const hasMoreLocal = visibleCount < relaventusers.length;

  const searchKey = useMemo(() => JSON.stringify({ keyword, ...filters }), [keyword, filters]);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchKey]);

  useEffect(() => {
    if (!hasMoreLocal || !sentinelRef.current) return;
    const el = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, relaventusers.length));
        }
      },
      { rootMargin: "200px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMoreLocal, relaventusers.length]);

  const debouncedRecordSearch = useCallback(
    debounce((query, filteredUsers) => {
      if (userdata?.uid && query) {
        const results = filteredUsers.map((u) => ({
          id: u.id,
          uid: u.uid,
          username: u.username ?? "",
          name: u.name ?? "",
        }));
        recordSearchRequest(userdata.uid, query, { bio }, results);
      }
    }, 500),
    [userdata?.uid, bio]
  );

  useEffect(() => {
    if (keyword && relaventusers.length > 0) {
      debouncedRecordSearch(keyword, relaventusers);
    }
  }, [keyword, relaventusers, debouncedRecordSearch]);

  const handleQuestionInputChange = useCallback(
    (value) => {
      setQuestion(value);
      onFiltersChange?.((prev) => ({
        ...(prev && typeof prev === "object" ? prev : {}),
        keyword: value,
      }));
    },
    [onFiltersChange]
  );

  const handleNlpSubmit = useCallback(
    async (e) => {
      e?.preventDefault();
      const trimmed = question.trim();
      if (!userdata?.uid || !trimmed || suggestLoading) return;
      setSuggestLoading(true);
      try {
        const data = await suggestSearchFiltersCallable(trimmed, filterSchema);
        const suggested = data?.filters && typeof data.filters === "object" ? data.filters : {};
        onFiltersChange?.((prev) => ({ ...(prev && typeof prev === "object" ? prev : {}), ...suggested }));
      } catch (err) {
        console.error("suggestSearchFilters:", err);
        const code = err?.code ?? err?.details?.code;
        if (code === "unauthenticated") {
          toast.info("Sign in to use AI search.");
        } else {
          toast.error("AI search failed. Try again.");
        }
      } finally {
        setSuggestLoading(false);
      }
    },
    [question, userdata?.uid, suggestLoading, filterSchema, onFiltersChange]
  );

  const hasAnyParam =
    keyword !== "" ||
    (filters.classificationTagId ?? "").trim() !== "" ||
    (filters.directoryScope ?? "").trim() !== "" ||
    (filters.sourceMemberId ?? "").trim() !== "" ||
    profileCustomFields.some((f) => (filters[f.key] ?? "").trim() !== "");
  const showLocalResults = hasAnyParam;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <form
        onSubmit={handleNlpSubmit}
        className="shrink-0 rounded-3xl bg-gradient-to-br from-bg-secondary to-bg-tertiary p-1 border border-border-default shadow-large"
      >
        <div className="relative flex items-end gap-3 rounded-2xl bg-bg-tertiary border border-border-default overflow-hidden">
          <input
            type="search"
            value={question}
            name="search"
            onChange={(e) => handleQuestionInputChange(e.target.value)}
            className="flex-1 min-h-[120px] px-6 py-5 pb-14 bg-transparent text-[17px] text-text-primary placeholder:text-text-tertiary focus:outline-none resize-none"
            placeholder="Ask a question?"
          />
          <button
            type="submit"
            disabled={!question.trim() || suggestLoading}
            className="absolute right-4 bottom-4 w-10 h-10 flex items-center justify-center rounded-xl bg-orange-500 hover:bg-orange-600 text-white transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Search"
          >
            {suggestLoading ? (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <BsArrowUp className="w-5 h-5" />
            )}
          </button>
        </div>

        <div className="mt-5 px-1">
          <p className="text-[15px] text-text-secondary mb-3">
            Not sure where to start? Try one of these:
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleQuestionInputChange(s)}
                className="px-4 py-2 rounded-full bg-bg-tertiary border border-border-default text-text-primary text-[15px] hover:bg-bg-hover hover:border-border-hover transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </form>

      {showLocalResults && (
        <div className="flex-1 min-h-0 flex flex-col mt-4 overflow-hidden">
          <div
            className="flex-1 min-h-[200px] overflow-y-auto rounded-2xl border border-border-default bg-bg-tertiary"
            style={{ maxHeight: "calc(100vh - 16rem)" }}
          >
            <div className="p-4">
              {relaventusers?.length === 0 && keyword && (
                <Link
                  to={`/profile/${keyword}`}
                  className="block px-4 py-3 hover:bg-bg-hover rounded-lg transition-colors"
                >
                  <span className="text-[15px] text-text-primary">
                    Search for <span className="font-bold">"{keyword}"</span>
                  </span>
                </Link>
              )}
              {relaventusers?.length === 0 && !keyword && (
                <p className="text-[15px] text-text-secondary py-2">No members match your filters.</p>
              )}
              {relaventusers?.length > 0 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {visibleUsers.map((profile) => (
                      <UserCard
                        key={profile.id ?? profile.uid}
                        profile={profile}
                        defaultprofileimage={defaultprofileimage}
                      />
                    ))}
                  </div>
                  {hasMoreLocal && (
                    <div ref={sentinelRef} className="flex justify-center py-6">
                      <span className="inline-block w-4 h-4 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
