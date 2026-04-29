/**
 * Default avatar file lives in `public/defaultprofileimage.svg` (URL `/defaultprofileimage.svg`).
 * Do not import from `src/assets/` — those are bundled paths and must not be stored as profileImageURL.
 */

/** @type {string} Vite serves `public/` at site root */
export const PUBLIC_DEFAULT_PROFILE_IMAGE = "/defaultprofileimage.svg";

/**
 * True for URLs that must never be used as `<img src>` / stored avatars:
 * old Vite `src/assets` paths, dev-server origins (localhost / 127.0.0.1), etc.
 * Loading those from a broken tab can trigger Chrome frame errors (chrome-error://chromewebdata/).
 */
/** @param {unknown} url */
export function isLegacyBrokenProfileImageUrl(url) {
  if (url == null) return false;
  const s = String(url).trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (
    lower.includes("/src/assets/defaultprofileimage") ||
    lower.includes("src/assets/defaultprofileimage") ||
    lower.includes("defaultprofileimage.png") ||
    (lower.includes("localhost") && lower.includes("/src/assets/"))
  ) {
    return true;
  }
  if (/^https?:\/\//i.test(s)) {
    try {
      const { hostname } = new URL(s);
      const h = hostname.toLowerCase();
      if (h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "0.0.0.0") {
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

/**
 * Safe value for `<img src>` / Avatar: never use legacy dev placeholder URLs stored in Firestore.
 * @param {unknown} url
 * @param {string} [fallback]
 * @returns {string}
 */
export function resolveDisplayProfileImageUrl(url, fallback = "") {
  if (url == null) return fallback;
  const s = String(url).trim();
  if (!s) return fallback;
  if (isLegacyBrokenProfileImageUrl(s)) return fallback;
  return s;
}

/**
 * Strip only legacy invalid placeholder URLs; leave valid URLs and missing values unchanged.
 * @param {Record<string, unknown> | null | undefined} doc
 * @returns {Record<string, unknown> | null | undefined}
 */
export function normalizeProfileDocProfileImage(doc) {
  if (!doc || typeof doc !== "object") return doc;
  const raw = doc.profileImageURL;
  if (raw == null || raw === "") return doc;
  const s = String(raw).trim();
  if (!s || !isLegacyBrokenProfileImageUrl(s)) return doc;
  return { ...doc, profileImageURL: null };
}
