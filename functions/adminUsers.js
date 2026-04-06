/**
 * Admin-only callable: create a new user (Auth + profile doc).
 * Caller must be authenticated and have isAdmin: true on their profile.
 *
 * If logs show Firestore gRPC PERMISSION_DENIED (code 7): the **runtime service account**
 * for this Gen 2 function (Cloud Run) needs Firestore IAM — not Firestore rules.
 * Google Cloud Console → IAM → find the service account used by this function
 * (often `PROJECT_NUMBER-compute@developer.gserviceaccount.com`) → add role
 * **Cloud Datastore User** (`roles/datastore.user`). Ensure **Cloud Firestore API** is enabled.
 *
 * This function sets `serviceAccount` to the App Engine default
 * (`PROJECT_ID@appspot.gserviceaccount.com`) so the Cloud Run revision uses the same
 * identity Firebase projects usually grant project-level access. If you still see
 * PERMISSION_DENIED, grant `roles/datastore.user` to that email as well.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// Loaded after admin.initializeApp() in index.js — use App Engine default SA for Gen 2.
const projectId = admin.app().options.projectId;
const appspotServiceAccount = projectId ? `${projectId}@appspot.gserviceaccount.com` : undefined;

const COLLECTION_PROFILES = "profiles";

/** @param {unknown} err */
function isFirestorePermissionDenied(err) {
  const code = err && typeof err === "object" && "code" in err ? err.code : undefined;
  const msg = err && typeof err === "object" && "message" in err && typeof err.message === "string" ? err.message : "";
  return code === 7 || msg.includes("PERMISSION_DENIED");
}

/** Client-visible hint; rules do not apply to Admin SDK — only IAM on the runtime service account. */
function firestoreIamHintForClient() {
  if (appspotServiceAccount && projectId) {
    return (
      `Grant ${appspotServiceAccount} the role “Cloud Datastore User” (roles/datastore.user) on GCP project ${projectId}. ` +
      "If Cloud Run uses a different service account, grant that account the same role. Redeploy functions after changing the runtime SA."
    );
  }
  return (
    "Grant this Cloud Run function’s service account the role “Cloud Datastore User” (roles/datastore.user) on the GCP project. " +
    "Confirm the exact email under Cloud Run → your function → YAML / Revisions → serviceAccountName."
  );
}

/** @param {unknown} err @param {string} step */
function rethrowFirestoreOrThrow(err, step) {
  if (isFirestorePermissionDenied(err)) {
    console.error(`[adminCreateUser] Firestore PERMISSION_DENIED at ${step}`, err);
    throw new HttpsError("failed-precondition", firestoreIamHintForClient());
  }
  throw err;
}

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

// Gen 2 runs on Cloud Run: OPTIONS preflight has no Firebase ID token. Without invoker: "public",
// Cloud Run can reject the request before our code runs → no CORS headers → browser blocks the call.
// Auth is still enforced below via request.auth (and admin check).
exports.adminCreateUser = onCall(
  {
    cors: true,
    ...(appspotServiceAccount ? { serviceAccount: appspotServiceAccount } : {}),
  },
  async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  const callerUid = request.auth.uid;

  console.log(
    "[adminCreateUser] firestore via Admin SDK projectId=%s configuredAppspotSA=%s env.GCLOUD_PROJECT=%s",
    projectId || "(missing)",
    appspotServiceAccount || "(none — using platform default SA)",
    process.env.GCLOUD_PROJECT || "(unset)"
  );

  let callerProfile;
  try {
    callerProfile = await admin.firestore().collection(COLLECTION_PROFILES).doc(callerUid).get();
  } catch (err) {
    rethrowFirestoreOrThrow(err, "read caller profile");
  }
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

  let profilesSnap;
  try {
    profilesSnap = await admin.firestore().collection(COLLECTION_PROFILES).get();
  } catch (err) {
    rethrowFirestoreOrThrow(err, "list profiles for usernames");
  }
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

  try {
    await admin.firestore().collection(COLLECTION_PROFILES).doc(user.uid).set(profile);
  } catch (err) {
    rethrowFirestoreOrThrow(err, "write new profile");
  }

  return {
    success: true,
    uid: user.uid,
    email: user.email,
    username,
    name: profile.name,
  };
  }
);
