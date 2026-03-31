/**
 * Admin-only callable: create a new user (Auth + profile doc).
 * Caller must be authenticated and have isAdmin: true on their profile.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const COLLECTION_PROFILES = "profiles";

function uniqueUsername(base, existingUsernames) {
  let safe = (base ?? "user")
    .replace(/[^a-z0-9._-]/gi, "")
    .replace(/\./g, "_")
    .toLowerCase()
    .slice(0, 30);
  if (!safe) safe = "user";
  let username = safe;
  let n = 1;
  while (existingUsernames.has(username)) {
    username = `${safe}${n}`;
    n += 1;
  }
  return username;
}

exports.adminCreateUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  const callerUid = request.auth.uid;

  const callerProfile = await admin.firestore().collection(COLLECTION_PROFILES).doc(callerUid).get();
  if (!callerProfile.exists || !callerProfile.data()?.isAdmin) {
    throw new HttpsError("permission-denied", "Only admins can create users.");
  }

  const { email, password, name, username: requestedUsername } = request.data || {};
  const emailTrimmed = (email ?? "").trim().toLowerCase();
  const passwordTrimmed = (password ?? "").trim();
  const nameTrimmed = (name ?? "").trim();
  if (!emailTrimmed || !passwordTrimmed) {
    throw new HttpsError("invalid-argument", "Email and password are required.");
  }
  if (passwordTrimmed.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
  }

  const profilesSnap = await admin.firestore().collection(COLLECTION_PROFILES).get();
  const existingUsernames = new Set(
    profilesSnap.docs.map((d) => (d.data().username ?? "").toLowerCase()).filter(Boolean)
  );
  const username = requestedUsername?.trim()
    ? uniqueUsername(requestedUsername.replace(/\s+/g, "_"), existingUsernames)
    : uniqueUsername((emailTrimmed.split("@")[0] || "user"), existingUsernames);

  let user;
  try {
    user = await admin.auth().createUser({
      email: emailTrimmed,
      emailVerified: false,
      password: passwordTrimmed,
      displayName: nameTrimmed || emailTrimmed,
    });
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "This email is already registered.");
    }
    if (err.code === "auth/invalid-email") {
      throw new HttpsError("invalid-argument", "Invalid email address.");
    }
    if (err.code === "auth/weak-password") {
      throw new HttpsError("invalid-argument", "Password is too weak.");
    }
    throw new HttpsError("internal", err.message || "Failed to create user.");
  }

  const profile = {
    email: emailTrimmed,
    name: nameTrimmed || emailTrimmed,
    uid: user.uid,
    dateofbirth: "",
    bio: "",
    report: [],
    restricted: false,
    privacy: false,
    isAdmin: false,
    profileImageURL: null,
    notification: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    follower: [],
    following: [],
    blockusers: [],
    saved: [],
    username,
    post: [],
    classificationTagId: null,
    customFields: {},
    profileResources: [],
  };

  await admin.firestore().collection(COLLECTION_PROFILES).doc(user.uid).set(profile);

  return {
    success: true,
    uid: user.uid,
    email: user.email,
    username,
    name: profile.name,
  };
});
