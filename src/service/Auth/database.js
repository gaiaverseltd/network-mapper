import { auth, firestore, storage } from ".";
import { sendNotificationEmail } from "../email/emailService.js";
import {
  addDoc,
  collection,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  orderBy,
  limit,
  startAfter,
  setDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";

import { ref, getDownloadURL, uploadBytesResumable } from "firebase/storage";
import { toast } from "react-toastify";

// Collection names (single source of truth)
const COLLECTION_PROFILES = "profiles";
const COLLECTION_NOTIFICATIONS = "notification";
const COLLECTION_MESSAGES = "messages";
const COLLECTION_TAG_CATEGORIES = "tagCategories";
const COLLECTION_TAGS = "tags";
const COLLECTION_CUSTOM_FIELDS = "customFields";

// Collection references
const profilesRef = () => collection(firestore, COLLECTION_PROFILES);
const notificationsRef = () => collection(firestore, COLLECTION_NOTIFICATIONS);
const messagesRef = () => collection(firestore, COLLECTION_MESSAGES);
const tagCategoriesRef = () => collection(firestore, COLLECTION_TAG_CATEGORIES);
const tagsRef = () => collection(firestore, COLLECTION_TAGS);
const customFieldsRef = () => collection(firestore, COLLECTION_CUSTOM_FIELDS);

/** Run a query and return the first document's data, or null */
async function queryOne(collRef, field, value) {
  const q = query(collRef, where(field, "==", value));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() };
}

/** Run a query and return all documents as array of { id, ...data } */
async function queryAll(collRef, ...queryConstraints) {
  const q = query(collRef, ...queryConstraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export const Create_Account = async ({
  email,
  uid,
  bio,
  name,
  age,
  username,
  profileimg,
}) => {
  try {
    const payload = {
      email: email ?? "",
      name: name ?? "",
      uid: uid,
      dateofbirth: age ?? "",
      bio: bio ?? "",
      report: [],
      restricted: false,
      privacy: false,
      isAdmin: false,
      profileImageURL: profileimg ?? null,
      notification: 0,
      createdAt: new Date(),
      follower: [],
      following: [],
      blockusers: [],
      saved: [],
      username: (username ?? "").trim().toLowerCase(),
      post: [],
      classificationTagId: null,
      customFields: {},
      profileResources: [],
    };
    await setDoc(doc(firestore, COLLECTION_PROFILES, uid), payload);
    return true;
  } catch (err) {
    console.error("Create_Account error:", err?.code, err?.message, err);
    toast.error("Something went wrong. Please try again or log in again.");
    return false;
  }
};
export const Create_notification = async (uid, intent) => {
  try {
    await addDoc(notificationsRef(), {
      uid: uid,
      intent: intent,
      time: new Date(),
    });

    // Send email notification asynchronously
    sendNotificationEmailAsync(uid, intent).catch((emailError) => {
      // Log email error but don't fail notification creation
      console.error("Error sending notification email:", emailError);
    });
  } catch (err) {
    console.error("Error creating notification:", err);
  }
};

/**
 * Helper function to send email notification
 * Runs asynchronously to not block notification creation
 */
const sendNotificationEmailAsync = async (uid, intent) => {
  try {
    // Only send emails for eligible activity types (exclude profile views and others)
    const emailEligibleTypes = new Set([
      "postlike",
      "commentlike",
      "addcomment",
      "addreply",
      "replylike",
      "follow",
      "message",
    ]);

    if (!intent?.type || !emailEligibleTypes.has(intent.type)) {
      return; // Skip non-eligible notification types
    }

    // Get recipient user data
    const recipientUser = await get_userdata(uid);
    if (!recipientUser?.email) {
      console.warn("No email address found for user:", uid);
      return;
    }

    // Get actor user data for email content
    let actorUser = null;
    if (intent?.likeby) {
      actorUser = await get_userdata(intent.likeby);
    } else if (intent?.fromUid) {
      actorUser = await get_userdata(intent.fromUid);
    }

  // Email service imported statically at module top so Vite bundles it
    
    // Build URL for notification
    let postUrl = "";
    if (intent?.type === "message" && actorUser?.username) {
      postUrl = `${window.location.origin}/messages/${actorUser.username}`;
    } else if (intent?.postid) {
      if (actorUser?.username) {
        postUrl = `${window.location.origin}/profile/${actorUser.username}/${intent.postid}`;
      } else if (recipientUser?.username) {
        postUrl = `${window.location.origin}/profile/${recipientUser.username}/${intent.postid}`;
      }
    }

    // Send email notification
    await sendNotificationEmail(
      recipientUser.email,
      intent.type,
      {
        actorName: actorUser?.name || "Someone",
        actorUsername: actorUser?.username || "",
        recipientName: recipientUser?.name || "User",
        postUrl: postUrl,
        postContent: intent?.text || intent?.postContent || "",
      }
    );
  } catch (error) {
    console.error("Error in sendNotificationEmailAsync:", error);
    throw error;
  }
};

export const get_userdata = async (uid) => {
  try {
    const byId = await getDoc(doc(firestore, COLLECTION_PROFILES, uid));
    if (byId.exists()) {
      const data = { id: byId.id, ...byId.data() };
      return data;
    }
    const profile = await queryOne(profilesRef(), "uid", uid);
    if (profile) {
      await setDoc(doc(firestore, COLLECTION_PROFILES, uid), { ...profile });
      return { ...profile, id: uid };
    }
    return null;
  } catch (err) {
    console.error("[Auth DB] get_userdata error", err?.code, err?.message, err);
    return null;
  }
};
export const Get_notification = async (uid) => {
  try {
    const list = await queryAll(
      notificationsRef(),
      where("uid", "==", uid),
      orderBy("time", "desc"),
    );
    return list;
  } catch (err) {
    console.error("Get_notification:", err);
    return [];
  }
};
export const get_userdatabyname = async (username) => {
  try {
    return await queryOne(profilesRef(), "username", username.trim()) ?? null;
  } catch (err) {
    console.error("get_userdatabyname:", err);
    return null;
  }
};

/** Build deterministic conversation ID for two users */
function conversationId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

/** Upload a message attachment; returns { url, name, type: 'image'|'file' }. Path: message-attachments/{fromUid}/{timestamp}_{name} */
export const uploadMessageAttachment = async (file, fromUid) => {
  if (!file || !fromUid) return null;
  const safeName = (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `message-attachments/${fromUid}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);
  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      () => {},
      (err) => {
        console.error("uploadMessageAttachment:", err);
        toast.error("Upload failed");
        reject(err);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          const type = (file.type || "").startsWith("image/") ? "image" : "file";
          resolve({ url, name: file.name || safeName, type });
        } catch (err) {
          reject(err);
        }
      }
    );
  });
};

/** Send a message from one user to another. Optional attachments: [{ url, name?, type: 'image'|'file' }]. Creates notification for recipient. */
export const sendMessage = async (fromUid, toUid, text, attachments = []) => {
  try {
    const trimmed = String(text || "").trim();
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    if (!trimmed && !hasAttachments) return null;
    const cid = conversationId(fromUid, toUid);
    const payload = {
      conversationId: cid,
      fromUid,
      toUid,
      text: trimmed || "",
      read: false,
      createdAt: new Date(),
    };
    if (hasAttachments) payload.attachments = attachments;
    const docRef = await addDoc(messagesRef(), payload);
    const preview = trimmed ? trimmed.slice(0, 80) : (hasAttachments ? "📎 Attachment" : "");
    await Create_notification(toUid, {
      type: "message",
      fromUid,
      text: preview,
    });
    return { id: docRef.id, conversationId: cid, fromUid, toUid, text: payload.text, attachments: payload.attachments, read: false, createdAt: new Date() };
  } catch (err) {
    console.error("sendMessage:", err);
    toast.error("Failed to send message");
    return null;
  }
};

/** Get messages between two users, ordered by createdAt asc */
export const getConversation = async (uid1, uid2) => {
  try {
    const cid = conversationId(uid1, uid2);
    // Split into two queries so each aligns with security rules (fromUid/toUid == auth.uid)
    const [sent, received] = await Promise.all([
      queryAll(
        messagesRef(),
        where("conversationId", "==", cid),
        where("fromUid", "==", uid1),
        orderBy("createdAt", "asc"),
      ),
      queryAll(
        messagesRef(),
        where("conversationId", "==", cid),
        where("toUid", "==", uid1),
        orderBy("createdAt", "asc"),
      ),
    ]);
    const list = [...sent, ...received].sort(
      (a, b) =>
        (a.createdAt?.toDate?.() ?? a.createdAt) -
        (b.createdAt?.toDate?.() ?? b.createdAt)
    );
    return list;
  } catch (err) {
    console.error("getConversation:", err);
    return [];
  }
};

/** Get list of conversation partners for a user (otherUserId, lastMessage, unreadCount) */
export const getConversationsForUser = async (uid) => {
  try {
    const sent = await queryAll(
      messagesRef(),
      where("fromUid", "==", uid),
      orderBy("createdAt", "desc"),
    );
    const received = await queryAll(
      messagesRef(),
      where("toUid", "==", uid),
      orderBy("createdAt", "desc"),
    );
    const partnersMap = new Map();
    for (const m of sent) {
      const other = m.toUid;
      if (!partnersMap.has(other) || partnersMap.get(other).createdAt < m.createdAt) {
        partnersMap.set(other, { otherUid: other, lastMessage: m, lastAt: m.createdAt?.toDate?.() ?? m.createdAt });
      }
    }
    for (const m of received) {
      const other = m.fromUid;
      const existing = partnersMap.get(other);
      const mTime = m.createdAt?.toDate?.() ?? m.createdAt;
      if (!existing || (existing.lastAt < mTime)) {
        partnersMap.set(other, { otherUid: other, lastMessage: m, lastAt: mTime });
      }
    }
    const list = [];
    for (const [otherUid, data] of partnersMap.entries()) {
      const unreadFromOther = await queryAll(
        messagesRef(),
        where("conversationId", "==", conversationId(uid, otherUid)),
        where("toUid", "==", uid),
        where("read", "==", false),
      );
      list.push({
        otherUid,
        lastMessage: data.lastMessage,
        lastAt: data.lastAt,
        unreadCount: unreadFromOther.length,
      });
    }
    list.sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
    return list;
  } catch (err) {
    console.error("getConversationsForUser:", err);
    return [];
  }
};

/** Count unread messages for a user */
export const getUnreadMessageCount = async (uid) => {
  try {
    const list = await queryAll(
      messagesRef(),
      where("toUid", "==", uid),
      where("read", "==", false),
    );
    return list.length;
  } catch (err) {
    console.error("getUnreadMessageCount:", err);
    return 0;
  }
};

/** Mark messages from another user as read */
export const markConversationAsRead = async (myUid, otherUid) => {
  try {
    const cid = conversationId(myUid, otherUid);
    const unread = await queryAll(
      messagesRef(),
      where("conversationId", "==", cid),
      where("toUid", "==", myUid),
      where("read", "==", false),
    );
    const batch = writeBatch(firestore);
    for (const m of unread) {
      batch.update(doc(firestore, COLLECTION_MESSAGES, m.id), { read: true });
    }
    await batch.commit();
  } catch (err) {
    console.error("markConversationAsRead:", err);
  }
};

export const getpostdata = async (username, postid) => {
  try {
    var res = [];
    const data = await get_userdatabyname(username);
    await data?.post.map((pot) => {
      if (postid === pot.postid) {
        res.push(pot);
      }
    });
    return res[0];
  } catch (err) {
    console.error("Error: Post not found");
  }
};
export const getpostdatabyuid = async (uid, postid) => {
  try {
    var res = [];
    const data = await get_userdata(uid);
    await data?.post.map((pot) => {
      if (postid === pot.postid) {
        res.push(pot);
      }
    });
    return res[0];
  } catch (err) {
    console.error("getpostdatabyuid:", err);
  }
};

/** Remove undefined values so Firestore updateDoc doesn't throw */
function stripUndefined(obj) {
  if (obj == null || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date)
        ? stripUndefined(v)
        : v;
    }
  }
  return out;
}

export const updateuserdata = async (userdata) => {
  try {
    if (!userdata?.uid) return;
    const payload = stripUndefined(userdata);
    await updateDoc(doc(firestore, COLLECTION_PROFILES, userdata.uid), payload);
  } catch (err) {
    console.error("updateuserdata:", err);
  }
};

export const updateprofileuserdata = async (userdata, username) => {
  try {
    const profile = await queryOne(profilesRef(), "username", username);
    if (!profile?.id) return;
    await updateDoc(doc(firestore, COLLECTION_PROFILES, profile.id), userdata);
    if (profile.uid && profile.uid !== profile.id) {
      await updateDoc(doc(firestore, COLLECTION_PROFILES, profile.uid), userdata);
    }
  } catch (err) {
    console.error("updateprofileuserdata:", err);
  }
};
export const getallpost = async () => {
  try {
    // Treat only explicit `privacy === true` as private; missing/null should remain visible.
    const list = await queryAll(profilesRef());
    return list
      .filter((p) => p?.privacy !== true)
      .map((p) => p.post)
      .flat();
  } catch (err) {
    console.error("getallpost:", err);
    return [];
  }
};

export const getallprofile = async () => {
  try {
    // Treat only explicit `privacy === true` as private; missing/null should remain visible.
    const list = await queryAll(profilesRef());
    const publicProfiles = list.filter((p) => p?.privacy !== true);
    publicProfiles.sort((a, b) =>
      (a?.name ?? a?.username ?? "").localeCompare(b?.name ?? b?.username ?? "", undefined, { sensitivity: "base" })
    );
    return publicProfiles;
  } catch (err) {
    console.error("getallprofile:", err);
    return [];
  }
};

const PAGE_SIZE = 20;

/**
 * Fetch non-admin profiles for admin users list (paginated).
 * Requires Firestore composite index: profiles (isAdmin == false, createdAt asc).
 * @param {number} pageSize
 * @param {import("firebase/firestore").DocumentSnapshot | null} lastDoc
 * @returns {{ profiles: Array<{ id: string } & import("firebase/firestore").DocumentData>, lastDoc: import("firebase/firestore").DocumentSnapshot | null }}
 */
export const getNonAdminProfilesPaginated = async (pageSize = PAGE_SIZE, lastDoc = null) => {
  try {
    const constraints = [
      where("isAdmin", "==", false),
      orderBy("createdAt", "asc"),
      limit(pageSize),
    ];
    if (lastDoc) constraints.push(startAfter(lastDoc));
    const q = query(profilesRef(), ...constraints);
    const snapshot = await getDocs(q);
    const profiles = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    const newLastDoc = snapshot.docs.length === pageSize ? snapshot.docs[snapshot.docs.length - 1] : null;
    return { profiles, lastDoc: newLastDoc };
  } catch (err) {
    console.error("getNonAdminProfilesPaginated:", err);
    return { profiles: [], lastDoc: null };
  }
};

// ——— Tag categories & tags (admin-managed; used later for profile fields) ———

/** Get all tag categories, ordered by order then name */
export const getTagCategories = async () => {
  try {
    const list = await queryAll(tagCategoriesRef(), orderBy("order", "asc"));
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.name ?? "").localeCompare(b.name ?? ""));
  } catch (err) {
    console.error("getTagCategories:", err);
    return [];
  }
};

/** Get all tags for a category, sorted alphabetically by label */
export const getTagsByCategoryId = async (categoryId) => {
  try {
    const list = await queryAll(tagsRef(), where("categoryId", "==", categoryId));
    return list.sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""));
  } catch (err) {
    console.error("getTagsByCategoryId:", err);
    return [];
  }
};

const CLASSIFICATION_CATEGORY_NAME = "classification";

/** Get tag options for the Classification profile field (tags from the "Classification" tag category) */
export const getClassificationTagOptions = async () => {
  try {
    const categories = await getTagCategories();
    const classificationCategory = categories.find(
      (c) => (c.name ?? "").trim().toLowerCase() === CLASSIFICATION_CATEGORY_NAME
    );
    if (!classificationCategory) return [];
    return getTagsByCategoryId(classificationCategory.id);
  } catch (err) {
    console.error("getClassificationTagOptions:", err);
    return [];
  }
};

/** Create a tag category. name required; slug/order optional */
export const createTagCategory = async ({ name, slug, order }) => {
  try {
    const payload = {
      name: (name ?? "").trim(),
      slug: (slug ?? "").trim() || null,
      order: typeof order === "number" ? order : 0,
      createdAt: new Date(),
    };
    const ref = await addDoc(tagCategoriesRef(), payload);
    return { id: ref.id, ...payload };
  } catch (err) {
    console.error("createTagCategory:", err);
    if (err?.code === "permission-denied") {
      toast.error(
        "Permission denied. Deploy firestore rules and ensure your profile document is at profiles/{yourUid} with isAdmin: true. See README."
      );
    } else {
      toast.error("Could not create tag category.");
    }
    return null;
  }
};

/** Update a tag category */
export const updateTagCategory = async (id, { name, slug, order }) => {
  try {
    const updates = {};
    if (name !== undefined) updates.name = (name ?? "").trim();
    if (slug !== undefined) updates.slug = (slug ?? "").trim() || null;
    if (typeof order === "number") updates.order = order;
    if (Object.keys(updates).length === 0) return;
    await updateDoc(doc(firestore, COLLECTION_TAG_CATEGORIES, id), updates);
  } catch (err) {
    console.error("updateTagCategory:", err);
    toast.error("Could not update tag category.");
    throw err;
  }
};

/** Delete a tag category and all its tags */
export const deleteTagCategory = async (id) => {
  try {
    const tags = await getTagsByCategoryId(id);
    const batch = writeBatch(firestore);
    for (const t of tags) {
      batch.delete(doc(firestore, COLLECTION_TAGS, t.id));
    }
    batch.delete(doc(firestore, COLLECTION_TAG_CATEGORIES, id));
    await batch.commit();
  } catch (err) {
    console.error("deleteTagCategory:", err);
    toast.error("Could not delete tag category.");
    throw err;
  }
};

/** Create a tag in a category. categoryId and label required. Slug is set to the document id (mandatory). */
export const createTag = async ({ categoryId, label }) => {
  try {
    const labelTrimmed = (label ?? "").trim();
    const ref = await addDoc(tagsRef(), {
      categoryId,
      label: labelTrimmed,
      slug: null,
      createdAt: new Date(),
    });
    await updateDoc(ref, { slug: ref.id });
    return { id: ref.id, categoryId, label: labelTrimmed, slug: ref.id, createdAt: new Date() };
  } catch (err) {
    console.error("createTag:", err);
    toast.error("Could not create tag.");
    return null;
  }
};

/** Update a tag. Slug is always set to the document id (mandatory). */
export const updateTag = async (id, { categoryId, label }) => {
  try {
    const updates = { slug: id };
    if (categoryId !== undefined) updates.categoryId = categoryId;
    if (label !== undefined) updates.label = (label ?? "").trim();
    await updateDoc(doc(firestore, COLLECTION_TAGS, id), updates);
  } catch (err) {
    console.error("updateTag:", err);
    toast.error("Could not update tag.");
    throw err;
  }
};

/** Check if any profile uses this tag (e.g. as classification). */
export const isTagUsedByProfiles = async (tagId) => {
  try {
    const q = query(
      profilesRef(),
      where("classificationTagId", "==", tagId),
      limit(1)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (err) {
    console.error("isTagUsedByProfiles:", err);
    return true; // block delete on error to be safe
  }
};

/** Delete a tag. Fails if the tag is assigned to any profile. */
export const deleteTag = async (id) => {
  try {
    const inUse = await isTagUsedByProfiles(id);
    if (inUse) {
      toast.error("Cannot delete tag: it is assigned to one or more profiles.");
      throw new Error("TAG_IN_USE");
    }
    await deleteDoc(doc(firestore, COLLECTION_TAGS, id));
  } catch (err) {
    if (err?.message === "TAG_IN_USE") throw err;
    console.error("deleteTag:", err);
    toast.error("Could not delete tag.");
    throw err;
  }
};

// ——— Custom fields (admin-managed; used on profiles and posts) ———

const APPLIES_PROFILE = "profile";
const APPLIES_POST = "post";
const APPLIES_BOTH = "both";

/** Get all custom field definitions, ordered by order then label */
export const getCustomFields = async () => {
  try {
    const list = await queryAll(customFieldsRef(), orderBy("order", "asc"));
    return list.sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.label ?? "").localeCompare(b.label ?? "")
    );
  } catch (err) {
    console.error("getCustomFields:", err);
    return [];
  }
};

/** Get custom field definitions that apply to profiles (profile or both) */
export const getCustomFieldsForProfile = async () => {
  const all = await getCustomFields();
  return all.filter(
    (f) => f.appliesTo === APPLIES_PROFILE || f.appliesTo === APPLIES_BOTH
  );
};

/** Get custom field definitions that apply to posts (post or both) */
export const getCustomFieldsForPost = async () => {
  const all = await getCustomFields();
  return all.filter(
    (f) => f.appliesTo === APPLIES_POST || f.appliesTo === APPLIES_BOTH
  );
};

const VALID_TYPES = ["text", "number", "date", "url", "phone", "note", "lookup", "file", "image"];

/** Create a custom field. label and key required; key must be unique. For type "lookup", tagCategoryId is required. showAsFilter (default true) controls whether it appears in search filters. aiDescription is optional context for AI to understand data in this field. */
export const createCustomField = async ({
  label,
  key,
  type = "text",
  appliesTo = APPLIES_BOTH,
  required = false,
  order = 0,
  minLength,
  maxLength,
  tagCategoryId,
  showAsFilter = true,
  aiDescription,
}) => {
  try {
    const keyTrimmed = (key ?? "").trim().toLowerCase().replace(/\s+/g, "_");
    const labelTrimmed = (label ?? "").trim();
    if (!labelTrimmed || !keyTrimmed) {
      toast.error("Label and key are required.");
      return null;
    }
    const existing = await getCustomFields();
    if (existing.some((f) => (f.key ?? "").toLowerCase() === keyTrimmed)) {
      toast.warning("A custom field with this key already exists.");
      return null;
    }
    const typeVal = VALID_TYPES.includes(type) ? type : "text";
    if (typeVal === "lookup" && !(tagCategoryId ?? "").trim()) {
      toast.error("Tag category is required for Lookup fields.");
      return null;
    }
    const payload = {
      label: labelTrimmed,
      key: keyTrimmed,
      type: typeVal,
      appliesTo:
        appliesTo === APPLIES_PROFILE || appliesTo === APPLIES_POST
          ? appliesTo
          : APPLIES_BOTH,
      required: !!required,
      order: typeof order === "number" ? order : 0,
      showAsFilter: showAsFilter !== false,
      createdAt: new Date(),
    };
    const aiDescTrimmed = (aiDescription ?? "").trim();
    if (aiDescTrimmed) payload.aiDescription = aiDescTrimmed;
    if (minLength != null && minLength !== "") {
      const n = Number(minLength);
      if (!Number.isNaN(n) && n >= 0) payload.minLength = n;
    }
    if (maxLength != null && maxLength !== "") {
      const n = Number(maxLength);
      if (!Number.isNaN(n) && n >= 0) payload.maxLength = n;
    }
    if (typeVal === "lookup" && (tagCategoryId ?? "").trim())
      payload.tagCategoryId = (tagCategoryId ?? "").trim();
    const ref = await addDoc(customFieldsRef(), payload);
    return { id: ref.id, ...payload };
  } catch (err) {
    console.error("createCustomField:", err);
    if (err?.code === "permission-denied") {
      toast.error("Permission denied. Ensure you are an admin.");
    } else {
      toast.error("Could not create custom field.");
    }
    return null;
  }
};

/** Update a custom field */
export const updateCustomField = async (
  id,
  { label, key, type, appliesTo, required, order, minLength, maxLength, tagCategoryId, showAsFilter, aiDescription }
) => {
  try {
    const updates = {};
    if (label !== undefined) updates.label = (label ?? "").trim();
    if (key !== undefined) {
      const k = (key ?? "").trim().toLowerCase().replace(/\s+/g, "_");
      if (k) updates.key = k;
    }
    if (type !== undefined)
      updates.type = VALID_TYPES.includes(type) ? type : "text";
    if (appliesTo !== undefined)
      updates.appliesTo =
        appliesTo === APPLIES_PROFILE || appliesTo === APPLIES_POST
          ? appliesTo
          : APPLIES_BOTH;
    if (required !== undefined) updates.required = !!required;
    if (order !== undefined) updates.order = typeof order === "number" ? order : 0;
    if (showAsFilter !== undefined) updates.showAsFilter = showAsFilter !== false;
    if (minLength !== undefined) {
      if (minLength === "" || minLength == null) updates.minLength = null;
      else {
        const n = Number(minLength);
        if (!Number.isNaN(n) && n >= 0) updates.minLength = n;
      }
    }
    if (maxLength !== undefined) {
      if (maxLength === "" || maxLength == null) updates.maxLength = null;
      else {
        const n = Number(maxLength);
        if (!Number.isNaN(n) && n >= 0) updates.maxLength = n;
      }
    }
    if (tagCategoryId !== undefined) {
      updates.tagCategoryId = (tagCategoryId ?? "").trim() || null;
    }
    if (aiDescription !== undefined) {
      const v = (aiDescription ?? "").trim();
      updates.aiDescription = v || null;
    }
    if (Object.keys(updates).length === 0) return;
    await updateDoc(doc(firestore, COLLECTION_CUSTOM_FIELDS, id), updates);
  } catch (err) {
    console.error("updateCustomField:", err);
    toast.error("Could not update custom field.");
    throw err;
  }
};

/** Delete a custom field definition (does not remove stored values on profiles/posts) */
export const deleteCustomField = async (id) => {
  try {
    await deleteDoc(doc(firestore, COLLECTION_CUSTOM_FIELDS, id));
  } catch (err) {
    console.error("deleteCustomField:", err);
    toast.error("Could not delete custom field.");
    throw err;
  }
};

export const check_data_is_exist = async (uid) => {
  try {
    const data = await get_userdata(uid);
    return !!data;
  } catch (err) {
    console.error("check_data_is_exist:", err);
    return false;
  }
};

export const check_username_is_exist = async (username) => {
  try {
    return (await get_userdatabyname(username)) ?? false;
  } catch (err) {
    console.error("check_username_is_exist:", err);
    return false;
  }
};
/** Get a display file name from a custom field storage URL (path ends with {timestamp}_{name}). */
export const getFileNameFromStorageUrl = (url) => {
  if (!url || typeof url !== "string") return "File";
  try {
    const pathMatch = url.match(/\/o\/(.+?)(?:\?|$)/);
    const path = pathMatch ? decodeURIComponent(pathMatch[1].replace(/\%2F/g, "/")) : "";
    const segment = path.split("/").pop() || "";
    const name = segment.replace(/^\d+_/, "");
    return name || "File";
  } catch {
    return "File";
  }
};

/** Upload a file for the profile Resources section. Path: {uid}/profile-resources/{resourceId}_{name} */
export const uploadProfileResourceFile = async (file, resourceId) => {
  if (!file || !auth?.currentUser?.uid) return null;
  const path = `${auth.currentUser.uid}/profile-resources/${resourceId}_${file.name}`;
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);
  return new Promise((resolve, reject) => {
    toast.info("Uploading…");
    uploadTask.on(
      "state_changed",
      () => {},
      (err) => {
        console.error("uploadProfileResourceFile:", err);
        toast.error("Upload failed.");
        reject(err);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          toast.success("Uploaded.");
          resolve(url);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
};

/** Upload a file for a custom field; returns the download URL. Path: {uid}/custom-fields/{fieldKey}/{timestamp}_{name} */
export const uploadCustomFieldFile = async (file, fieldKey) => {
  if (!file || !auth?.currentUser?.uid) return null;
  const path = `${auth.currentUser.uid}/custom-fields/${fieldKey}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);
  return new Promise((resolve, reject) => {
    toast.info("Uploading…");
    uploadTask.on(
      "state_changed",
      () => {},
      (err) => {
        console.error("uploadCustomFieldFile:", err);
        toast.error("Upload failed.");
        reject(err);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          toast.success("Uploaded.");
          resolve(url);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
};

export const Getimagedownloadlink = async (image) => {
  try {
    if (image === null) {
      return null;
    }
    const imageUrl = await new Promise((resolve, reject) => {
      try {
        const storageRef = ref(
          storage,
          `${auth.currentUser.uid}/${image.name}`,
        );
        const uploadTask = uploadBytesResumable(storageRef, image);
        toast.info("image is being uploading");
        uploadTask.on(
          "state_changed",
          () => {},
          (error) => {
            console.error("Error during upload:", error);
            reject(error);
          },
          async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            } catch (error) {
              console.error("Error getting download URL:", error);
              reject(error);
            }
          },
        );
      } catch (error) {
        resolve(null);
      }
    });
    return imageUrl;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

export const updatepost = async (post, postedby) => {
  try {
    const profile = await queryOne(profilesRef(), "uid", postedby);
    if (!profile?.id || !Array.isArray(profile.post)) return;
    const postIndex = profile.post.findIndex((p) => p.postid === post.postid);
    if (postIndex === -1) return;
    const updatedPost = [...profile.post];
    updatedPost[postIndex] = post;
    await updateDoc(doc(firestore, COLLECTION_PROFILES, profile.id), {
      post: updatedPost,
    });
  } catch (err) {
    console.error("updatepost:", err);
  }
};
