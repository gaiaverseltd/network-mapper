/**
 * Search analytics – record search requests and send to endpoint
 *
 * Stores in searches collection: uid, query, options, results
 */

const SEARCH_ANALYTICS_URL = import.meta.env.VITE_SearchAnalyticsUrl;

/**
 * Record a search request and send to the configured endpoint
 * @param {string} uid - User ID (Firebase Auth UID)
 * @param {string} query - Search query
 * @param {object} options - Search options (e.g. { bio: true })
 * @param {Array} results - Search results [{ id, uid, username, name }, ...]
 */
export async function recordSearchRequest(uid, query, options = {}, results = []) {
  if (!uid || !query || typeof query !== "string") return;
  const trimmed = query.trim();
  if (!trimmed) return;

  const url = SEARCH_ANALYTICS_URL;
  if (!url) return; // No endpoint configured – skip silently

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid,
        query: trimmed,
        options: typeof options === "object" ? options : {},
        results: Array.isArray(results) ? results : [],
      }),
    });
    if (!res.ok) {
      console.warn("Search analytics: endpoint returned", res.status);
    }
  } catch (err) {
    console.warn("Search analytics: failed to send", err.message);
  }
}
