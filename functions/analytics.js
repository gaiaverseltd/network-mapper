/**
 * Search analytics – record search requests in the searches collection
 *
 * Document shape:
 *   - uid: user making the search
 *   - query: search text
 *   - options: search options (filters, etc.)
 *   - results: array of result items { id, uid, username, name }
 *   - createdAt: timestamp
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const COLLECTION_SEARCHES = "searches";

exports.recordSearch = onRequest({ cors: true }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const { uid, query, options = {}, results = [] } = req.body || {};

    if (!uid || typeof query !== "string") {
      res.status(400).json({ error: "Missing required fields: uid, query" });
      return;
    }

    const trimmed = String(query).trim();
    if (!trimmed) {
      res.status(400).json({ error: "query cannot be empty" });
      return;
    }

    const db = admin.firestore();
    await db.collection(COLLECTION_SEARCHES).add({
      uid,
      query: trimmed,
      options: typeof options === "object" ? options : {},
      results: Array.isArray(results) ? results : [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("recordSearch error:", error);
    res.status(500).json({ error: error.message || "Failed to record search" });
  }
});
