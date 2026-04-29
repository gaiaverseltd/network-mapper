import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useUserdatacontext } from "../service/context/usercontext";
import {
  getNonAdminProfilesPaginated,
  updateuserdata,
  getTagsByCategoryId,
  uploadCustomFieldFile,
  getFileNameFromStorageUrl,
  get_userdatabyname,
  get_userdata,
  Getimagedownloadlink,
} from "../service/Auth/database";
import { adminCreateUser } from "../service/Auth/index";
import { useCustomFieldsForProfile, useClassificationTagOptions } from "../hooks/queries";
import { useQueries } from "@tanstack/react-query";
import UserCard from "../component/user-card";
import ImportedProfileSummary, {
  DIRECTORY_VALUE_EMPTY,
  getImportedSummaryRows,
  getProfileSearchHaystack,
  profileHasDirectorySummaryContext,
} from "../component/imported-profile-summary";
import {
  mergeDirectoryDefaults,
  mergeProfileCustomFieldsDefaults,
  multilineToStringList,
  PROFILE_EDIT_STRING_LIST_BINDINGS,
  stringListToMultiline,
} from "../lib/profile-directory-fields.js";
import { Popupitem } from "../ui/popup";
import { toast } from "react-toastify";
import { MdPeople as PeopleIcon } from "react-icons/md";
import { MdSearch as SearchIcon } from "react-icons/md";
import { MdAdd as AddIcon } from "react-icons/md";
import { MdInsertDriveFile as FileIcon } from "react-icons/md";
import { MdDownload as DownloadIcon } from "react-icons/md";
import * as XLSX from "xlsx";

const PAGE_SIZE = 20;
const SORT_JOINED = "joined";
const SORT_NAME = "name";
const SORT_POSTS = "posts";
const FILTER_ALL = "all";
const FILTER_HAS_POSTS = "has_posts";
const FILTER_NO_POSTS = "no_posts";
const FILTER_DIRECTORY = "directory";

const US_STATE_OPTIONS = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming", "District of Columbia",
];

function emptyAdminEditForm() {
  return {
    name: "",
    username: "",
    bio: "",
    customFields: {},
    email: "",
    dateofbirth: "",
    profileImageURL: "",
    privacy: false,
    restricted: false,
    classificationTagId: "",
    importSource: "",
    sourceMemberId: "",
    isAdmin: false,
    adminNotes: [],
    memberDataJson: "{}",
    profileResourcesJson: "[]",
    firstName: "",
    lastName: "",
    phone: "",
    city: "",
    state: "",
    country: "",
    countryOfOrigin: "",
    classification: "",
    gender: "",
    organization: "",
    profileUrl: "",
    notification: "0",
    shareContactInfo: false,
    isDuplicate: false,
    titleText: "",
    fieldsOfStudyText: "",
    areasOfInterestText: "",
    topicsOfInterestText: "",
    networkActivitiesText: "",
    languagesSpokenText: "",
    workCountriesText: "",
    profileWebsitesText: "",
    json_location: JSON.stringify({ city: "", countries: [], stateProvince: "" }, null, 2),
    json_follower: "[]",
    json_following: "[]",
    json_post: "[]",
    json_saved: "[]",
    json_report: "[]",
    json_blockusers: "[]",
    json_profileResources: "[]",
    json_customFields: "{}",
  };
}

/** Search text for admin list: profile + directory/import fields + uid. */
function adminProfileSearchHaystack(p) {
  const base = getProfileSearchHaystack(p);
  const extra = [p?.uid, p?.id, p?.notification != null ? String(p.notification) : ""].filter(Boolean).join(" ");
  return `${base} ${extra}`.trim().toLowerCase();
}

const DIRECTORY_EXPORT_HEADERS = [
  "Import source",
  "Source member ID",
  "Title",
  "Organization",
  "Location",
  "Classification",
  "Gender",
  "Languages",
  "Fields of study",
  "Topics of interest",
  "Areas of interest",
  "Country of origin",
  "Countries of work",
  "Network activities",
  "Share contact info",
  "First name",
  "Last name",
  "Phone",
  "Profile URL",
  "Country (root)",
  "State (root)",
  "City (root)",
  "Notification count",
];

function directoryExportCellValues(profile) {
  const rows = getImportedSummaryRows(profile, { showEmptyFields: true });
  const m = Object.fromEntries(rows.map((r) => [r.key, String(r.value ?? "")]));
  const p = mergeDirectoryDefaults(profile);
  const cell = (v) => (v == null || v === DIRECTORY_VALUE_EMPTY ? "" : String(v));
  return [
    profile.importSource ?? "",
    profile.sourceMemberId != null && profile.sourceMemberId !== "" ? String(profile.sourceMemberId) : "",
    cell(m.title),
    cell(m.organization),
    cell(m.location),
    cell(m.classification),
    cell(m.gender),
    cell(m.languages),
    cell(m.fields),
    cell(m.topics),
    cell(m.interests),
    cell(m.origin),
    cell(m.workCountries),
    cell(m.network),
    cell(m.shareContact),
    p.firstName ?? "",
    p.lastName ?? "",
    p.phone ?? "",
    p.profileUrl ?? "",
    p.country ?? "",
    p.state ?? "",
    p.city ?? "",
    String(profile.notification ?? ""),
  ];
}

function formatFieldDisplayName(key) {
  const raw = String(key ?? "").trim();
  if (!raw) return "Field";
  const withSpaces = raw
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return withSpaces
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function shouldUseTextareaForString(value, threshold = 100) {
  if (value == null) return false;
  const str = String(value);
  return str.length > threshold || str.includes("\n");
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d?.getTime?.())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Admin read-only: show any Firestore field value without crashing on Timestamp / circular refs. */
function serializeProfileFieldValue(val, maxLen = 4000) {
  if (val === undefined || val === null) return "\u2014";
  if (typeof val === "object" && val !== null && typeof val.toDate === "function") {
    try {
      return val.toDate().toISOString();
    } catch {
      return String(val);
    }
  }
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  if (typeof val === "object") {
    try {
      const s = JSON.stringify(val, null, 2);
      if (s.length > maxLen) return `${s.slice(0, maxLen)}\n\u2026 (${s.length} characters total)`;
      return s;
    } catch {
      return String(val);
    }
  }
  return String(val);
}

export const AdminUsers = () => {
  const navigate = useNavigate();
  const { uid: editUid } = useParams();
  const isEditPage = !!editUid;
  const { userdata, defaultprofileimage, isAdmin } = useUserdatacontext();
  const [users, setUsers] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState(SORT_JOINED);
  const [filter, setFilter] = useState(FILTER_ALL);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [editForm, setEditForm] = useState(() => emptyAdminEditForm());
  const [editSaving, setEditSaving] = useState(false);
  const [uploadingFieldKey, setUploadingFieldKey] = useState(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [newCustomKey, setNewCustomKey] = useState("");
  const [newCustomValue, setNewCustomValue] = useState("");
  const [newAdminNote, setNewAdminNote] = useState("");
  const sentinelRef = useRef(null);

  const { data: profileCustomFields = [] } = useCustomFieldsForProfile({ enabled: !!isAdmin });
  const { data: classificationOptions = [] } = useClassificationTagOptions({ enabled: !!isAdmin && !!selectedProfile });
  const lookups = profileCustomFields.filter((f) => f.type === "lookup" && f.tagCategoryId);
  const tagQueries = useQueries({
    queries: lookups.map((f) => ({
      queryKey: ["tags", f.tagCategoryId],
      queryFn: () => getTagsByCategoryId(f.tagCategoryId),
      enabled: !!selectedProfile && !!f.tagCategoryId,
    })),
  });
  const lookupTagsByKey = lookups.reduce((acc, f, i) => {
    if (tagQueries[i]?.data) acc[f.key] = tagQueries[i].data;
    return acc;
  }, {});

  const loadPage = useCallback(async (cursor = null) => {
    const { profiles, lastDoc: nextCursor } = await getNonAdminProfilesPaginated(PAGE_SIZE, cursor);
    return { profiles, nextCursor };
  }, []);

  useEffect(() => {
    if (!userdata) return;
    if (!isAdmin) {
      navigate("/home", { replace: true });
      return;
    }

    let cancelled = false;
    setLoading(true);
    loadPage(null)
      .then(({ profiles, nextCursor }) => {
        if (cancelled) return;
        setUsers(profiles);
        setLastDoc(nextCursor);
        setHasMore(!!nextCursor);
      })
      .catch(() => {
        if (!cancelled) setHasMore(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userdata, navigate, loadPage]);

  const loadMore = useCallback(() => {
    if (!lastDoc || loadingMore || !hasMore) return;
    setLoadingMore(true);
    loadPage(lastDoc)
      .then(({ profiles, nextCursor }) => {
        setUsers((prev) => [...prev, ...profiles]);
        setLastDoc(nextCursor);
        setHasMore(!!nextCursor);
      })
      .finally(() => setLoadingMore(false));
  }, [lastDoc, loadingMore, hasMore, loadPage]);

  useEffect(() => {
    if (!hasMore || loading || !sentinelRef.current) return;
    const el = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "200px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  const searchLower = (search ?? "").trim().toLowerCase();
  const filteredUsers = useMemo(() => {
    let list = users;
    if (searchLower) {
      list = list.filter((p) => adminProfileSearchHaystack(p).includes(searchLower));
    }
    if (filter === FILTER_HAS_POSTS) list = list.filter((p) => (p.post?.length ?? 0) > 0);
    if (filter === FILTER_NO_POSTS) list = list.filter((p) => (p.post?.length ?? 0) === 0);
    if (filter === FILTER_DIRECTORY) {
      list = list.filter(
        (p) =>
          !!(
            p.importSource ||
            p.sourceMemberId ||
            (p.memberData && typeof p.memberData === "object" && Object.keys(p.memberData).length > 0) ||
            profileHasDirectorySummaryContext(p)
          )
      );
    }
    const sorted = [...list];
    if (sortBy === SORT_NAME) {
      sorted.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }));
    } else if (sortBy === SORT_POSTS) {
      sorted.sort((a, b) => (b.post?.length ?? 0) - (a.post?.length ?? 0));
    }
    return sorted;
  }, [users, searchLower, filter, sortBy]);

  const openEditModal = useCallback((profile) => {
    setSelectedProfile(profile);
    setPendingAvatarFile(null);
    setNewCustomKey("");
    setNewCustomValue("");
    const m = mergeDirectoryDefaults(profile);
    const safeJson = (v, fb) => {
      try {
        return JSON.stringify(v ?? fb, null, 2);
      } catch {
        return JSON.stringify(fb, null, 2);
      }
    };
    setEditForm({
      ...emptyAdminEditForm(),
      name: (profile.name ?? "").trim(),
      username: (profile.username ?? "").trim(),
      bio: (profile.bio ?? "").trim(),
      customFields: mergeProfileCustomFieldsDefaults(profile.customFields ?? {}, profileCustomFields),
      email: (profile.email ?? "").trim(),
      dateofbirth: profile.dateofbirth ?? "",
      profileImageURL: profile.profileImageURL ?? "",
      privacy: !!profile.privacy,
      restricted: !!profile.restricted,
      classificationTagId: profile.classificationTagId ?? "",
      importSource: (profile.importSource ?? "").trim(),
      sourceMemberId: profile.sourceMemberId != null ? String(profile.sourceMemberId) : "",
      isAdmin: !!profile.isAdmin,
      adminNotes: Array.isArray(profile.adminNotes) ? [...profile.adminNotes] : [],
      memberDataJson: (() => {
        try {
          if (
            profile.memberData &&
            typeof profile.memberData === "object" &&
            Object.keys(profile.memberData).length > 0
          ) {
            return JSON.stringify(profile.memberData, null, 2);
          }
        } catch {
          /* ignore */
        }
        return "{}";
      })(),
      profileResourcesJson: (() => {
        try {
          return JSON.stringify(profile.profileResources ?? [], null, 2);
        } catch {
          return "[]";
        }
      })(),
      firstName: m.firstName ?? "",
      lastName: m.lastName ?? "",
      phone: m.phone ?? "",
      city: m.city ?? "",
      state: m.state ?? "",
      country: m.country ?? "",
      countryOfOrigin: m.countryOfOrigin ?? "",
      classification: m.classification ?? "",
      gender: m.gender ?? "",
      organization: m.organization ?? "",
      profileUrl: m.profileUrl ?? "",
      notification: String(profile.notification ?? 0),
      shareContactInfo: !!m.shareContactInfo,
      isDuplicate: !!m.isDuplicate,
      titleText: stringListToMultiline(m.title),
      fieldsOfStudyText: stringListToMultiline(m.fieldsOfStudy),
      areasOfInterestText: stringListToMultiline(m.areasOfInterest),
      topicsOfInterestText: stringListToMultiline(m.topicsOfInterest),
      networkActivitiesText: stringListToMultiline(m.networkActivities),
      languagesSpokenText: stringListToMultiline(m.languagesSpoken),
      workCountriesText: stringListToMultiline(m.workCountries),
      profileWebsitesText: stringListToMultiline(m.profileWebsites),
      json_location: safeJson(m.location, { city: "", countries: [], stateProvince: "" }),
      json_follower: safeJson(profile.follower, []),
      json_following: safeJson(profile.following, []),
      json_post: safeJson(profile.post, []),
      json_saved: safeJson(profile.saved, []),
      json_report: safeJson(profile.report, []),
      json_blockusers: safeJson(profile.blockusers ?? profile.block, []),
      json_profileResources: safeJson(profile.profileResources, []),
      json_customFields: safeJson(profile.customFields, {}),
    });
  }, [profileCustomFields]);

  useEffect(() => {
    if (!selectedProfile) return;
    setEditForm((f) => ({
      ...f,
      customFields: mergeProfileCustomFieldsDefaults(f.customFields ?? {}, profileCustomFields),
    }));
  }, [selectedProfile, profileCustomFields]);

  const closeEditModal = useCallback(() => {
    if (!editSaving) {
      setSelectedProfile(null);
      setEditForm(emptyAdminEditForm());
      setPendingAvatarFile(null);
      setNewCustomKey("");
      setNewCustomValue("");
      setNewAdminNote("");
      navigate("/admin/users");
    }
  }, [editSaving, navigate]);

  const setCustomField = useCallback((key, value) => {
    setEditForm((f) => ({
      ...f,
      customFields: { ...(f.customFields ?? {}), [key]: value === "" ? undefined : value },
    }));
  }, []);


  useEffect(() => {
    if (!isEditPage || !editUid) return;
    const fromLoaded = users.find((u) => (u.uid ?? u.id) === editUid);
    if (fromLoaded) {
      openEditModal(fromLoaded);
      return;
    }
    let cancelled = false;
    get_userdata(editUid).then((profile) => {
      if (cancelled) return;
      if (!profile) {
        toast.error("User not found.");
        navigate("/admin/users", { replace: true });
        return;
      }
      openEditModal(profile);
    });
    return () => {
      cancelled = true;
    };
  }, [isEditPage, editUid, users, openEditModal, navigate]);

  const removeCustomFieldKey = useCallback((key) => {
    setEditForm((f) => {
      const next = { ...(f.customFields ?? {}) };
      delete next[key];
      return { ...f, customFields: next };
    });
  }, []);

  const handleAddAdminNote = useCallback(() => {
    if (!selectedProfile) return;
    const text = newAdminNote.trim();
    if (!text) {
      toast.error("Enter a note first.");
      return;
    }
    const note = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text,
      createdAt: new Date(),
      authorUid: userdata?.uid ?? "",
      authorName: userdata?.name ?? "",
      authorUsername: userdata?.username ?? "",
    };
    setEditForm((f) => ({
      ...f,
      adminNotes: [note, ...(Array.isArray(f.adminNotes) ? f.adminNotes : [])],
    }));
    setNewAdminNote("");
  }, [newAdminNote, selectedProfile, userdata?.uid, userdata?.name, userdata?.username]);

  const mergedProfileForAdmin = useMemo(
    () => (selectedProfile ? mergeDirectoryDefaults({ ...selectedProfile }) : null),
    [selectedProfile]
  );

  const adminFullDocumentKeys = useMemo(() => {
    if (!selectedProfile || !mergedProfileForAdmin) return [];
    return [...new Set([...Object.keys(selectedProfile), ...Object.keys(mergedProfileForAdmin)])].sort();
  }, [selectedProfile, mergedProfileForAdmin]);

  const previewProfileForSummary = useMemo(() => {
    if (!selectedProfile) return null;
    let memberData = selectedProfile.memberData;
    try {
      const raw = (editForm.memberDataJson ?? "").trim();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) memberData = parsed;
      }
    } catch {
      /* keep saved memberData */
    }
    let location = selectedProfile.location;
    try {
      const locRaw = (editForm.json_location ?? "").trim();
      if (locRaw) {
        const parsed = JSON.parse(locRaw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) location = parsed;
      }
    } catch {
      /* keep */
    }
    return {
      ...selectedProfile,
      name: editForm.name,
      username: editForm.username,
      bio: editForm.bio,
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      phone: editForm.phone,
      city: editForm.city,
      state: editForm.state,
      country: editForm.country,
      countryOfOrigin: editForm.countryOfOrigin,
      classification: editForm.classification,
      gender: editForm.gender,
      organization: editForm.organization,
      profileUrl: editForm.profileUrl,
      shareContactInfo: !!editForm.shareContactInfo,
      isDuplicate: !!editForm.isDuplicate,
      title: multilineToStringList(editForm.titleText),
      fieldsOfStudy: multilineToStringList(editForm.fieldsOfStudyText),
      areasOfInterest: multilineToStringList(editForm.areasOfInterestText),
      topicsOfInterest: multilineToStringList(editForm.topicsOfInterestText),
      networkActivities: multilineToStringList(editForm.networkActivitiesText),
      languagesSpoken: multilineToStringList(editForm.languagesSpokenText),
      workCountries: multilineToStringList(editForm.workCountriesText),
      profileWebsites: multilineToStringList(editForm.profileWebsitesText),
      location,
      customFields: editForm.customFields ?? {},
      memberData,
      importSource: editForm.importSource || null,
      sourceMemberId: editForm.sourceMemberId || null,
    };
  }, [selectedProfile, editForm]);

  const handleSaveProfile = useCallback(
    async (e) => {
      e.preventDefault();
      if (!selectedProfile) return;

      let memberDataParsed = {};
      try {
        const raw = (editForm.memberDataJson ?? "").trim();
        if (raw) memberDataParsed = JSON.parse(raw);
        if (memberDataParsed === null || typeof memberDataParsed !== "object" || Array.isArray(memberDataParsed)) {
          toast.error("Member data must be a JSON object (e.g. {}).");
          return;
        }
      } catch {
        toast.error("Member data JSON is invalid.");
        return;
      }

      let profileResourcesParsed = [];
      try {
        const raw = (editForm.profileResourcesJson ?? "").trim();
        if (raw) profileResourcesParsed = JSON.parse(raw);
        if (!Array.isArray(profileResourcesParsed)) {
          toast.error("Profile resources must be a JSON array.");
          return;
        }
      } catch {
        toast.error("Profile resources JSON is invalid.");
        return;
      }

      const parseJsonField = (raw, fallback, label, validator) => {
        try {
          const t = (raw ?? "").trim();
          if (!t) return fallback;
          const v = JSON.parse(t);
          if (validator && !validator(v)) {
            toast.error(`${label}: invalid shape.`);
            return null;
          }
          return v;
        } catch {
          toast.error(`${label}: invalid JSON.`);
          return null;
        }
      };

      const locationParsed = parseJsonField(
        editForm.json_location,
        { city: "", countries: [], stateProvince: "" },
        "Location",
        (v) => typeof v === "object" && v != null && !Array.isArray(v)
      );
      if (locationParsed === null) return;
      const followerParsed = parseJsonField(editForm.json_follower, [], "Followers", Array.isArray);
      if (followerParsed === null) return;
      const followingParsed = parseJsonField(editForm.json_following, [], "Following", Array.isArray);
      if (followingParsed === null) return;
      const postParsed = parseJsonField(editForm.json_post, [], "Posts", Array.isArray);
      if (postParsed === null) return;
      const savedParsed = parseJsonField(editForm.json_saved, [], "Saved", Array.isArray);
      if (savedParsed === null) return;
      const reportParsed = parseJsonField(editForm.json_report, [], "Report", Array.isArray);
      if (reportParsed === null) return;
      const blockusersParsed = parseJsonField(editForm.json_blockusers, [], "Block list", Array.isArray);
      if (blockusersParsed === null) return;
      let customFieldsFromJson = {};
      const cfParsed = parseJsonField(
        editForm.json_customFields,
        {},
        "Custom fields (JSON object)",
        (v) => typeof v === "object" && v != null && !Array.isArray(v)
      );
      if (cfParsed === null) return;
      customFieldsFromJson = cfParsed;

      const targetUid = selectedProfile.uid ?? selectedProfile.id;
      const uname = editForm.username.trim().toLowerCase().replace(/\s+/g, "_");
      const prevU = (selectedProfile.username ?? "").trim().toLowerCase();
      if (uname !== prevU) {
        const existing = await get_userdatabyname(uname);
        if (existing && existing.uid !== targetUid && existing.id !== targetUid) {
          toast.error("Username is already taken.");
          return;
        }
      }

      setEditSaving(true);
      try {
        let profileImageURL = (editForm.profileImageURL ?? "").trim() || null;
        if (pendingAvatarFile) {
          try {
            const url = await Getimagedownloadlink(pendingAvatarFile);
            if (url) profileImageURL = url;
          } catch {
            toast.error("Avatar upload failed.");
            setEditSaving(false);
            return;
          }
        }

        const customFieldsCleaned = {};
        Object.entries(editForm.customFields ?? {}).forEach(([k, v]) => {
          if (v != null && String(v).trim() !== "") customFieldsCleaned[k] = String(v).trim();
        });
        const mergedCustomFields = { ...customFieldsFromJson, ...customFieldsCleaned };
        Object.keys(mergedCustomFields).forEach((k) => {
          const v = mergedCustomFields[k];
          if (v == null) delete mergedCustomFields[k];
          else if (typeof v === "string" && v.trim() === "") delete mergedCustomFields[k];
        });

        const notificationNum = parseInt(String(editForm.notification ?? "0"), 10);
        const updated = {
          ...selectedProfile,
          uid: targetUid,
          name: editForm.name.trim(),
          username: uname,
          bio: editForm.bio.trim(),
          email: (editForm.email ?? "").trim(),
          dateofbirth: editForm.dateofbirth ?? "",
          profileImageURL,
          privacy: !!editForm.privacy,
          restricted: !!editForm.restricted,
          classificationTagId: (editForm.classificationTagId ?? "").trim() || null,
          importSource: (editForm.importSource ?? "").trim() || null,
          sourceMemberId: (editForm.sourceMemberId ?? "").trim() || null,
          isAdmin: !!editForm.isAdmin,
          adminNotes: Array.isArray(editForm.adminNotes) ? editForm.adminNotes : [],
          customFields: mergedCustomFields,
          memberData: memberDataParsed,
          profileResources: profileResourcesParsed,
          firstName: (editForm.firstName ?? "").trim(),
          lastName: (editForm.lastName ?? "").trim(),
          phone: (editForm.phone ?? "").trim(),
          city: (editForm.city ?? "").trim(),
          state: (editForm.state ?? "").trim(),
          country: (editForm.country ?? "").trim(),
          countryOfOrigin: (editForm.countryOfOrigin ?? "").trim(),
          classification: (editForm.classification ?? "").trim(),
          gender: (editForm.gender ?? "").trim(),
          organization: (editForm.organization ?? "").trim(),
          profileUrl: (editForm.profileUrl ?? "").trim(),
          notification: Number.isFinite(notificationNum) ? notificationNum : 0,
          shareContactInfo: !!editForm.shareContactInfo,
          isDuplicate: !!editForm.isDuplicate,
          title: multilineToStringList(editForm.titleText),
          fieldsOfStudy: multilineToStringList(editForm.fieldsOfStudyText),
          areasOfInterest: multilineToStringList(editForm.areasOfInterestText),
          topicsOfInterest: multilineToStringList(editForm.topicsOfInterestText),
          networkActivities: multilineToStringList(editForm.networkActivitiesText),
          languagesSpoken: multilineToStringList(editForm.languagesSpokenText),
          workCountries: multilineToStringList(editForm.workCountriesText),
          profileWebsites: multilineToStringList(editForm.profileWebsitesText),
          location: locationParsed,
          follower: followerParsed,
          following: followingParsed,
          post: postParsed,
          saved: savedParsed,
          report: reportParsed,
          blockusers: blockusersParsed,
          block: blockusersParsed,
        };
        await updateuserdata(updated);
        setUsers((prev) =>
          prev.map((p) => (p.id === selectedProfile.id || p.uid === selectedProfile.uid ? { ...p, ...updated } : p))
        );
        toast.success("Profile updated");
        if (updated.isAdmin) {
          toast.info("User is now an admin. Refresh the page if they should disappear from this list.");
        }
        closeEditModal();
      } catch (err) {
        toast.error(err?.message ?? "Failed to update profile");
      } finally {
        setEditSaving(false);
      }
    },
    [selectedProfile, editForm, pendingAvatarFile, closeEditModal]
  );

  const inputClass =
    "w-full px-3 py-2 rounded-lg bg-bg-default border border-border-default text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50 placeholder:text-text-tertiary";
  const labelClass = "block text-sm font-medium text-text-secondary mb-1.5";

  const allEditFields = useMemo(() => {
    const defined = new Set(profileCustomFields.map((f) => f.key));
    const extra = Object.keys(editForm.customFields ?? {})
      .filter((k) => !defined.has(k))
      .sort()
      .map((key) => ({ kind: "extraCustom", key }));
    const custom = profileCustomFields.map((f) => ({ kind: "custom", ...f }));
    return [...custom, ...extra];
  }, [profileCustomFields, editForm.customFields]);

  const mid = Math.ceil(allEditFields.length / 2) || 1;
  const leftFields = allEditFields.slice(0, mid);
  const rightFields = allEditFields.slice(mid);

  const renderField = (item) => {
    if (item.kind === "extraCustom") {
      const extraValue = editForm.customFields?.[item.key] ?? "";
      const extraAsTextarea = shouldUseTextareaForString(extraValue);
      return (
        <div key={`extra-${item.key}`} className="flex flex-col">
          <label className={labelClass}>
            {formatFieldDisplayName(item.key)}{" "}
            <span className="text-text-tertiary font-normal text-xs">(extra)</span>
          </label>
          <div className="flex gap-2 items-start">
            {extraAsTextarea ? (
              <textarea
                value={extraValue}
                onChange={(e) => setCustomField(item.key, e.target.value)}
                rows={3}
                className={`${inputClass} flex-1 min-w-0 resize-y min-h-[80px]`}
              />
            ) : (
              <input
                type="text"
                value={extraValue}
                onChange={(e) => setCustomField(item.key, e.target.value)}
                className={`${inputClass} flex-1 min-w-0`}
              />
            )}
            <button
              type="button"
              onClick={() => removeCustomFieldKey(item.key)}
              className="shrink-0 px-2 py-2 text-xs text-text-tertiary hover:text-status-error rounded-lg border border-border-default"
            >
              Remove
            </button>
          </div>
        </div>
      );
    }
    const field = item;
    const countryValue = (editForm.customFields?.country ?? "").trim();
    const stateUseSelect = field.key === "state" && countryValue.toLowerCase() === "united states";
    const fieldValue = editForm.customFields?.[field.key] ?? "";
    const stringAsTextarea =
      field.type === "text" && shouldUseTextareaForString(fieldValue);
    return (
      <div key={field.id} className="flex flex-col">
        <label className={labelClass}>
          {field.label}
          {field.required && <span className="text-status-error ml-0.5">*</span>}
        </label>
        {stateUseSelect ? (
          <select
            value={editForm.customFields?.[field.key] ?? ""}
            onChange={(e) => setCustomField(field.key, e.target.value || undefined)}
            className={inputClass}
            required={!!field.required}
          >
            <option value="">Select state</option>
            {US_STATE_OPTIONS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        ) : field.type === "number" ? (
          <input
            type="number"
            value={editForm.customFields?.[field.key] ?? ""}
            onChange={(e) => setCustomField(field.key, e.target.value === "" ? "" : e.target.value)}
            className={inputClass}
            required={!!field.required}
          />
        ) : field.type === "date" ? (
          <input
            type="date"
            value={editForm.customFields?.[field.key] ?? ""}
            onChange={(e) => setCustomField(field.key, e.target.value)}
            className={inputClass}
            required={!!field.required}
          />
        ) : field.type === "url" ? (
          <input
            type="url"
            placeholder="https://"
            value={editForm.customFields?.[field.key] ?? ""}
            onChange={(e) => setCustomField(field.key, e.target.value.trim())}
            className={inputClass}
            required={!!field.required}
          />
        ) : field.type === "phone" ? (
          <input
            type="tel"
            placeholder="e.g. +1 234 567 8900"
            value={editForm.customFields?.[field.key] ?? ""}
            onChange={(e) => setCustomField(field.key, e.target.value.trim())}
            className={inputClass}
            required={!!field.required}
          />
        ) : field.type === "lookup" ? (
          <select
            value={editForm.customFields?.[field.key] ?? ""}
            onChange={(e) => setCustomField(field.key, e.target.value || undefined)}
            className={inputClass}
            required={!!field.required}
          >
            <option value="">Select {field.label}</option>
            {(lookupTagsByKey[field.key] ?? []).map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.label}
              </option>
            ))}
          </select>
        ) : field.type === "note" ? (
          <textarea
            value={editForm.customFields?.[field.key] ?? ""}
            onChange={(e) => setCustomField(field.key, e.target.value)}
            rows={3}
            className={`${inputClass} resize-y min-h-[80px]`}
            required={!!field.required}
            minLength={field.minLength ?? undefined}
            maxLength={field.maxLength ?? undefined}
          />
        ) : field.type === "file" || field.type === "image" ? (
          <div className="space-y-2">
            {!editForm.customFields?.[field.key] && (
              <input
                type="file"
                accept={field.type === "image" ? "image/*" : "*"}
                disabled={!!uploadingFieldKey}
                className="block w-full text-sm text-text-primary file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-bg-elevated file:text-text-primary file:text-sm"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingFieldKey(field.key);
                  try {
                    const url = await uploadCustomFieldFile(file, field.key);
                    if (url) setCustomField(field.key, url);
                  } catch (_) {}
                  setUploadingFieldKey(null);
                  e.target.value = "";
                }}
              />
            )}
            {editForm.customFields?.[field.key] && (
              <div className="flex items-center gap-2 flex-wrap">
                {field.type === "image" ? (
                  <>
                    <a
                      href={editForm.customFields[field.key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0"
                    >
                      <img
                        src={editForm.customFields[field.key]}
                        alt={field.label}
                        className="h-16 w-16 object-cover rounded border border-border-default"
                      />
                    </a>
                    <span className="text-sm text-text-secondary truncate max-w-[180px]">
                      {getFileNameFromStorageUrl(editForm.customFields[field.key])}
                    </span>
                  </>
                ) : (
                  <a
                    href={editForm.customFields[field.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-accent-500 hover:underline min-w-0"
                  >
                    <FileIcon className="flex-shrink-0 text-lg text-text-secondary" />
                    <span className="truncate max-w-[180px]">
                      {getFileNameFromStorageUrl(editForm.customFields[field.key])}
                    </span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setCustomField(field.key, undefined)}
                  className="text-xs text-text-tertiary hover:text-status-error"
                >
                  Remove
                </button>
              </div>
            )}
            {uploadingFieldKey === field.key && (
              <span className="text-sm text-text-tertiary">Uploading…</span>
            )}
          </div>
        ) : stringAsTextarea ? (
          <textarea
            value={fieldValue}
            onChange={(e) => setCustomField(field.key, e.target.value)}
            rows={3}
            className={`${inputClass} resize-y min-h-[80px]`}
            required={!!field.required}
            minLength={field.minLength ?? undefined}
            maxLength={field.maxLength ?? undefined}
          />
        ) : (
          <input
            type="text"
            value={fieldValue}
            onChange={(e) => setCustomField(field.key, e.target.value)}
            className={inputClass}
            required={!!field.required}
            minLength={field.minLength ?? undefined}
            maxLength={field.maxLength ?? undefined}
          />
        )}
      </div>
    );
  };

  const handleExportExcel = useCallback(() => {
    const headers = [
      "Name",
      "Username",
      "Email",
      "Bio",
      "Joined",
      "Posts",
      "Followers",
      "Following",
      ...profileCustomFields.map((f) => f.label ?? formatFieldDisplayName(f.key)),
      ...DIRECTORY_EXPORT_HEADERS,
    ];
    const rows = filteredUsers.map((profile) => {
      const joinDate = profile.createdAt?.toDate
        ? profile.createdAt.toDate()
        : profile.createdAt
          ? new Date(profile.createdAt)
          : null;
      const joinStr = joinDate
        ? joinDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
        : "";
      return [
        profile.name ?? "",
        profile.username ?? "",
        profile.email ?? "",
        profile.bio ?? "",
        joinStr,
        (profile.post?.length ?? 0).toString(),
        (profile.follower?.length ?? 0).toString(),
        (profile.following?.length ?? 0).toString(),
        ...profileCustomFields.map((f) => (profile.customFields?.[f.key] ?? "").toString()),
        ...directoryExportCellValues(profile),
      ];
    });
    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    const filename = `users-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success(`Exported ${rows.length} user(s) to ${filename}`);
  }, [filteredUsers, profileCustomFields]);

  const handleAddUser = useCallback(
    async (e) => {
      e.preventDefault();
      const form = e.target;
      const email = (form.email?.value ?? "").trim();
      const password = (form.password?.value ?? "").trim();
      const name = (form.name?.value ?? "").trim();
      const username = (form.username?.value ?? "").trim();
      if (!email || !password) {
        toast.error("Email and password are required.");
        return;
      }
      if (password.length < 6) {
        toast.error("Password must be at least 6 characters.");
        return;
      }
      setAddSubmitting(true);
      try {
        const result = await adminCreateUser({ email, password, name, username: username || undefined });
        toast.success(`User created: @${result.username}`);
        setAddModalOpen(false);
        form.reset();
        const stub = {
          id: result.uid,
          uid: result.uid,
          email: result.email,
          name: result.name,
          username: result.username,
          post: [],
          follower: [],
          following: [],
          createdAt: { toDate: () => new Date() },
        };
        setUsers((prev) => [stub, ...prev]);
      } catch (err) {
        const msg = err?.message || err?.code || "Failed to create user.";
        toast.error(msg);
      } finally {
        setAddSubmitting(false);
      }
    },
    []
  );

  if (!userdata) return null;
  if (!isAdmin) return null;

  return (
    <Fragment>
      <Helmet>
        <title>Users | Admin | NetMap</title>
      </Helmet>

      {!isEditPage && (
      <div className="sticky top-0 z-20 bg-bg-default/80 backdrop-blur-xl border-b border-border-default">
        <div className="flex flex-wrap items-center gap-3 h-auto min-h-[53px] px-4 py-2">
          <div className="flex items-center gap-2">
            <PeopleIcon className="text-2xl text-text-secondary" />
            <h1 className="text-xl font-bold text-text-primary">Users</h1>
          </div>
          <div className="flex-1 flex flex-wrap items-center gap-2 min-w-0">
            <div className="relative flex-1 min-w-[140px] max-w-xs">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-lg" />
              <input
                type="search"
                placeholder="Search name, @username, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary placeholder:text-text-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="py-2 px-3 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50"
              aria-label="Filter users"
            >
              <option value={FILTER_ALL}>All</option>
              <option value={FILTER_DIRECTORY}>Directory import</option>
              <option value={FILTER_HAS_POSTS}>Has posts</option>
              <option value={FILTER_NO_POSTS}>No posts</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="py-2 px-3 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50"
              aria-label="Sort users"
            >
              <option value={SORT_JOINED}>Join date</option>
              <option value={SORT_NAME}>Name A–Z</option>
              <option value={SORT_POSTS}>Posts (high first)</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredUsers.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-elevated hover:bg-bg-secondary text-text-primary font-medium text-sm border border-border-default transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            <DownloadIcon className="text-lg" />
            Export to Excel
          </button>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 text-white font-medium text-sm transition-colors"
          >
            <AddIcon className="text-lg" />
            Add user
          </button>
        </div>
      </div>
      )}

      {!isEditPage && (
      <div className="w-full py-4 px-4">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-bg-tertiary rounded-xl overflow-hidden animate-pulse">
                <div className="h-32 bg-bg-secondary" />
                <div className="p-4 space-y-3">
                  <div className="flex justify-center -mt-12 mb-2">
                    <div className="w-20 h-20 rounded-full bg-bg-secondary border-4 border-bg-tertiary" />
                  </div>
                  <div className="h-4 w-24 rounded bg-bg-secondary mx-auto" />
                  <div className="h-3 w-32 rounded bg-bg-secondary mx-auto" />
                  <div className="h-3 w-28 rounded bg-bg-secondary mx-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <PeopleIcon className="text-6xl text-text-tertiary mb-4" />
            <p className="text-[15px] font-medium text-text-primary">
              {users.length === 0 ? "No non-admin users" : "No users match your search or filter"}
            </p>
            <p className="text-[13px] text-text-secondary mt-1">
              {users.length === 0
                ? "All accounts are admins or there are no users yet."
                : "Try a different search term or filter."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {filteredUsers.map((profile) => (
              <UserCard
                key={profile.id}
                profile={profile}
                defaultprofileimage={defaultprofileimage}
                onClick={(profile) => navigate(`/admin/users/${profile.uid ?? profile.id}`)}
                showEmail
                showDirectoryBadge
                fillGridCell
              />
            ))}
          </div>
        )}

        {!loading && hasMore && (
          <div ref={sentinelRef} className="flex justify-center py-6">
            {loadingMore && (
              <div className="flex items-center gap-2 text-text-secondary text-sm">
                <span className="inline-block w-4 h-4 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
                Loading more…
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {!isEditPage && addModalOpen && (
        <Popupitem closefunction={() => !addSubmitting && setAddModalOpen(false)}>
          <div className="bg-bg-tertiary rounded-xl border border-border-default shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-lg font-bold text-text-primary mb-4">Add new user</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Email *</label>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 rounded-lg bg-bg-default border border-border-default text-text-primary placeholder:text-text-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Password *</label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 rounded-lg bg-bg-default border border-border-default text-text-primary placeholder:text-text-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Display name</label>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder="Full name"
                  className="w-full px-3 py-2 rounded-lg bg-bg-default border border-border-default text-text-primary placeholder:text-text-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Username (optional)</label>
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  placeholder="Leave blank to derive from email"
                  className="w-full px-3 py-2 rounded-lg bg-bg-default border border-border-default text-text-primary placeholder:text-text-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="flex-1 py-2 px-4 rounded-lg bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-medium text-sm"
                >
                  {addSubmitting ? "Creating…" : "Create user"}
                </button>
                <button
                  type="button"
                  onClick={() => !addSubmitting && setAddModalOpen(false)}
                  disabled={addSubmitting}
                  className="py-2 px-4 rounded-lg bg-bg-elevated hover:bg-bg-secondary text-text-primary text-sm border border-border-default"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </Popupitem>
      )}

      {isEditPage && !selectedProfile && (
        <div className="px-4 py-10 text-sm text-text-secondary">Loading user…</div>
      )}

      {isEditPage && selectedProfile && (
        <div className="w-full py-4 px-4 min-h-0">
          <div className="w-full rounded-xl border border-border-default bg-bg-tertiary overflow-visible">
            <div className="sticky top-0 z-10 bg-bg-tertiary border-b border-border-default px-6 py-4 shadow-sm">
              <button
                type="button"
                onClick={closeEditModal}
                className="mb-3 px-3 py-1.5 rounded-lg bg-bg-elevated hover:bg-bg-secondary text-text-primary text-sm border border-border-default"
              >
                Back to users
              </button>
              <h2 className="text-lg font-bold text-text-primary">Edit user (full profile)</h2>
              <p className="text-sm text-text-secondary mt-1">
                UID {selectedProfile.uid ?? selectedProfile.id} · @
                {selectedProfile.username ?? selectedProfile.id}
              </p>
              <p className="text-xs text-text-tertiary mt-2">
                Profile email updates the Firestore document only. Changing login email may require Firebase Auth
                console or a backend function.
              </p>
              <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-text-secondary">
                <div>
                  <dt className="text-text-tertiary uppercase tracking-wide">UID</dt>
                  <dd className="font-mono text-text-primary break-all">{selectedProfile.uid ?? selectedProfile.id}</dd>
                </div>
                <div>
                  <dt className="text-text-tertiary uppercase tracking-wide">Joined</dt>
                  <dd>{formatDateTime(selectedProfile.createdAt)}</dd>
                </div>
              </dl>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div className="px-6 py-4 border-b border-border-default space-y-4 bg-bg-secondary/20">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                  Account & visibility
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Email (profile)</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      className={inputClass}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Date of birth</label>
                    <input
                      type="date"
                      value={
                        typeof editForm.dateofbirth === "string" &&
                        /^\d{4}-\d{2}-\d{2}$/.test(editForm.dateofbirth.trim())
                          ? editForm.dateofbirth.trim()
                          : ""
                      }
                      onChange={(e) => setEditForm((f) => ({ ...f, dateofbirth: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Profile image URL</label>
                    <input
                      type="url"
                      placeholder="https://…"
                      value={editForm.profileImageURL}
                      onChange={(e) => setEditForm((f) => ({ ...f, profileImageURL: e.target.value }))}
                      className={inputClass}
                    />
                    <p className="text-xs text-text-tertiary mt-1">
                      Or upload (stored under your admin account in Storage; URL is saved on the user profile).
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={editSaving}
                      className="mt-2 block w-full text-sm text-text-primary file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-bg-elevated file:text-text-primary"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setPendingAvatarFile(file ?? null);
                        if (file) {
                          setEditForm((f) => ({ ...f, profileImageURL: URL.createObjectURL(file) }));
                        }
                        e.target.value = "";
                      }}
                    />
                    {pendingAvatarFile && (
                      <p className="text-xs text-accent-500 mt-1">New image selected — will upload on Save.</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Classification</label>
                    {classificationOptions.length > 0 ? (
                      <select
                        value={editForm.classificationTagId}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, classificationTagId: e.target.value }))
                        }
                        className={inputClass}
                      >
                        <option value="">None</option>
                        {classificationOptions.map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={editForm.classificationTagId}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, classificationTagId: e.target.value }))
                        }
                        className={inputClass}
                        placeholder="Tag document ID (if no taxonomy loaded)"
                      />
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Import source</label>
                    <input
                      type="text"
                      value={editForm.importSource}
                      onChange={(e) => setEditForm((f) => ({ ...f, importSource: e.target.value }))}
                      className={inputClass}
                      placeholder="e.g. members.json"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Source member ID</label>
                    <input
                      type="text"
                      value={editForm.sourceMemberId}
                      onChange={(e) => setEditForm((f) => ({ ...f, sourceMemberId: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.privacy}
                      onChange={(e) => setEditForm((f) => ({ ...f, privacy: e.target.checked }))}
                      className="rounded border-border-default"
                    />
                    Private profile
                  </label>
                  <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.restricted}
                      onChange={(e) => setEditForm((f) => ({ ...f, restricted: e.target.checked }))}
                      className="rounded border-border-default"
                    />
                    Restricted
                  </label>
                  <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.isAdmin}
                      onChange={(e) => setEditForm((f) => ({ ...f, isAdmin: e.target.checked }))}
                      className="rounded border-border-default"
                    />
                    Admin user
                  </label>
                </div>
              </div>

              <div className="px-6 py-4 border-b border-border-default space-y-4 bg-bg-secondary/15">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                  Root profile fields (Firestore document)
                </h3>
                <p className="text-xs text-text-tertiary">
                  Flat directory fields and arrays. List fields use one value per line. JSON blocks must parse before Save.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>UID (read-only)</label>
                    <input
                      type="text"
                      disabled
                      value={selectedProfile.uid ?? selectedProfile.id ?? ""}
                      className={`${inputClass} opacity-70 cursor-not-allowed`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Created at (read-only)</label>
                    <input
                      type="text"
                      disabled
                      value={formatDateTime(selectedProfile.createdAt)}
                      className={`${inputClass} opacity-70 cursor-not-allowed`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Display name</label>
                    <input
                      type="text"
                      value={editForm.name ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Username</label>
                    <input
                      type="text"
                      value={editForm.username ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Bio</label>
                    <textarea
                      value={editForm.bio ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                      rows={3}
                      className={`${inputClass} resize-y min-h-[80px]`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>First name</label>
                    <input
                      type="text"
                      value={editForm.firstName ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Last name</label>
                    <input
                      type="text"
                      value={editForm.lastName ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input
                      type="text"
                      value={editForm.phone ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Notification count</label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.notification ?? "0"}
                      onChange={(e) => setEditForm((f) => ({ ...f, notification: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>City</label>
                    <input
                      type="text"
                      value={editForm.city ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>State / province</label>
                    <input
                      type="text"
                      value={editForm.state ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Country (root)</label>
                    <input
                      type="text"
                      value={editForm.country ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Country of origin</label>
                    <input
                      type="text"
                      value={editForm.countryOfOrigin ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, countryOfOrigin: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Classification (text)</label>
                    <input
                      type="text"
                      value={editForm.classification ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, classification: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Gender</label>
                    <input
                      type="text"
                      value={editForm.gender ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Organization</label>
                    <input
                      type="text"
                      value={editForm.organization ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, organization: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Profile URL (primary)</label>
                    <input
                      type="text"
                      placeholder="https://"
                      value={editForm.profileUrl ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, profileUrl: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.shareContactInfo}
                      onChange={(e) => setEditForm((f) => ({ ...f, shareContactInfo: e.target.checked }))}
                      className="rounded border-border-default"
                    />
                    Share contact info
                  </label>
                  <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.isDuplicate}
                      onChange={(e) => setEditForm((f) => ({ ...f, isDuplicate: e.target.checked }))}
                      className="rounded border-border-default"
                    />
                    Marked duplicate (import)
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PROFILE_EDIT_STRING_LIST_BINDINGS.map(({ formKey, label }) => (
                    <div key={formKey} className="md:col-span-2">
                      <label className={labelClass}>{label}</label>
                      <textarea
                        value={editForm[formKey] ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, [formKey]: e.target.value }))}
                        rows={3}
                        spellCheck={false}
                        className={`${inputClass} font-mono text-xs resize-y min-h-[72px]`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* {previewProfileForSummary && (
                <div className="px-6 py-4 border-b border-border-default bg-bg-secondary/30">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-3">
                    Directory preview (merged form + legacy member JSON)
                  </h3>
                  <ImportedProfileSummary profile={previewProfileForSummary} showEmptyFields />
                </div>
              )} */}

              {/* <details className="px-6 py-4 border-b border-border-default bg-bg-secondary/10" open>
                <summary className="text-xs font-semibold uppercase tracking-wide text-text-tertiary cursor-pointer">
                  Complete Firestore document (every key & value)
                </summary>
                <p className="text-xs text-text-tertiary mt-2 mb-3">
                  Values after directory defaults are applied where missing. Scroll this panel for long documents.
                </p>
                <div className="max-h-[min(70vh,32rem)] overflow-y-auto rounded-lg border border-border-default bg-bg-default/40 pr-1">
                  <dl className="divide-y divide-border-default/60">
                    {adminFullDocumentKeys.map((key) => (
                      <div key={key} className="px-3 py-2.5 grid grid-cols-1 sm:grid-cols-[minmax(0,11rem)_1fr] gap-x-4 gap-y-1">
                        <dt className="font-mono text-[11px] text-accent-500 shrink-0 break-all">{key}</dt>
                        <dd className="text-[11px] text-text-primary whitespace-pre-wrap break-words font-mono min-w-0">
                          {serializeProfileFieldValue(
                            selectedProfile[key] !== undefined ? selectedProfile[key] : mergedProfileForAdmin?.[key]
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </details> */}

              {/* <details className="px-6 py-3 border-b border-border-default">
                <summary className="text-xs font-semibold uppercase tracking-wide text-text-tertiary cursor-pointer">
                  Field names only (compact)
                </summary>
                <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-3 gap-y-1 font-mono text-[11px] text-text-secondary max-h-48 overflow-y-auto pr-1">
                  {adminFullDocumentKeys.map((k) => (
                    <li key={k} className="truncate" title={k}>
                      {k}
                    </li>
                  ))}
                </ul>
              </details> */}

              {/* <div className="px-6 py-4 border-b border-border-default space-y-2">
                <label className={labelClass}>Member data (JSON object, legacy)</label>
                <textarea
                  value={editForm.memberDataJson}
                  onChange={(e) => setEditForm((f) => ({ ...f, memberDataJson: e.target.value }))}
                  rows={10}
                  spellCheck={false}
                  className={`${inputClass} font-mono text-xs resize-y min-h-[160px]`}
                />
              </div>

              <div className="px-6 py-4 border-b border-border-default space-y-2">
                <label className={labelClass}>Profile resources (JSON array)</label>
                <p className="text-xs text-text-tertiary">
                  Array of objects (e.g. id, name, description, fileUrl) as stored on the profile.
                </p>
                <textarea
                  value={editForm.profileResourcesJson}
                  onChange={(e) => setEditForm((f) => ({ ...f, profileResourcesJson: e.target.value }))}
                  rows={8}
                  spellCheck={false}
                  className={`${inputClass} font-mono text-xs resize-y min-h-[120px]`}
                />
              </div> */}

              <div className="p-6">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-4">
                  Configurable custom fields (schema)
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    {leftFields.map((item) => renderField(item))}
                  </div>
                  <div className="space-y-4">
                    {rightFields.map((item) => renderField(item))}
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-border-default flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[140px] max-w-xs">
                    <label className={labelClass}>Add custom field key</label>
                    <input
                      type="text"
                      value={newCustomKey}
                      onChange={(e) => setNewCustomKey(e.target.value)}
                      placeholder="e.g. legacyId"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex-1 min-w-[160px] max-w-md">
                    <label className={labelClass}>Value</label>
                    <input
                      type="text"
                      value={newCustomValue}
                      onChange={(e) => setNewCustomValue(e.target.value)}
                      placeholder="Value"
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const k = newCustomKey.trim().replace(/\s+/g, "_");
                      if (!k) {
                        toast.error("Enter a field key.");
                        return;
                      }
                      setCustomField(k, newCustomValue);
                      setNewCustomKey("");
                      setNewCustomValue("");
                    }}
                    className="px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-sm text-text-primary hover:bg-bg-secondary"
                  >
                    Add field
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-border-default space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                    Admin notes
                  </h3>
                  <p className="text-xs text-text-tertiary">
                    Visible only to admins. Each note stores who wrote it and when.
                  </p>
                  <div className="space-y-2">
                    <textarea
                      value={newAdminNote}
                      onChange={(e) => setNewAdminNote(e.target.value)}
                      rows={3}
                      placeholder="Add an internal note about this user..."
                      className={`${inputClass} resize-y min-h-[80px]`}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddAdminNote}
                        className="px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-sm text-text-primary hover:bg-bg-secondary"
                      >
                        Add note
                      </button>
                      <span className="text-xs text-text-tertiary">Notes are saved when you click Save.</span>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-auto pr-1">
                    {(editForm.adminNotes ?? []).length === 0 ? (
                      <p className="text-sm text-text-tertiary">No admin notes yet.</p>
                    ) : (
                      (editForm.adminNotes ?? []).map((note) => (
                        <div key={note.id ?? `${note.authorUid}-${note.createdAt}`} className="rounded-lg border border-border-default bg-bg-default p-3">
                          <p className="text-sm text-text-primary whitespace-pre-wrap break-words">{note.text ?? ""}</p>
                          <p className="text-xs text-text-tertiary mt-2">
                            {note.authorName || note.authorUsername || "Admin"}{" "}
                            {note.authorUsername ? `(@${note.authorUsername})` : ""} ·{" "}
                            {formatDateTime(note.createdAt)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-6 mt-6 border-t border-border-default">
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-medium text-sm"
                  >
                    {editSaving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={closeEditModal}
                    disabled={editSaving}
                    className="px-4 py-2 rounded-lg bg-bg-elevated hover:bg-bg-secondary text-text-primary text-sm border border-border-default"
                  >
                    Cancel
                  </button>
                  <a
                    href={`/profile/${editForm.username || selectedProfile.username || ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg text-text-secondary hover:text-text-primary text-sm border border-border-default hover:bg-bg-elevated"
                  >
                    Open profile in new tab
                  </a>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </Fragment>
  );
};
