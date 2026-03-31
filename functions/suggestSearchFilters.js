/**
 * Suggest search filters from a natural language question using Genkit (Google AI / Gemini).
 * Returns { filters: { keyword?, classificationTagId?, [customFieldKey]?: string } }
 *
 * Two entry points (same logic):
 * - suggestSearchFilters: callable (can have CORS issues with 2nd gen / Cloud Run)
 * - suggestSearchFiltersHttp: HTTP POST with Authorization: Bearer <idToken> (CORS enabled)
 *
 * Requires GOOGLE_GENAI_API_KEY in functions config or GEMINI_API_KEY in env.
 */

const admin = require("firebase-admin");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");
const { genkit } = require("genkit");
const { googleAI } = require("@genkit-ai/googleai");

const apiKeyParam = defineString("GOOGLE_GENAI_API_KEY", { description: "Google AI (Gemini) API key for Genkit" });

function getApiKey() {
  try {
    return apiKeyParam.value();
  } catch (e) {
    return process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "";
  }
}

function buildFilterSchemaPrompt(filterSchema) {
  const parts = [];
  if (filterSchema.classification && filterSchema.classification.length > 0) {
    parts.push(
      "Classification (use key 'classificationTagId', value = one of these exact ids): " +
        filterSchema.classification.map((o) => `"${o.label}" (id: ${o.id})`).join(", ")
    );
  }
  if (filterSchema.customFields && filterSchema.customFields.length > 0) {
    filterSchema.customFields.forEach((f) => {
      if (f.type === "lookup" && f.options && f.options.length > 0) {
        parts.push(
          `Field "${f.label}" (key: ${f.key}, use key '${f.key}', value = one of these exact ids): ` +
            f.options.map((o) => `"${o.label}" (id: ${o.id})`).join(", ")
        );
      } else {
        parts.push(
          `Field "${f.label}" (key: ${f.key}, type: ${f.type}): use key '${f.key}', value = text that might appear in this field (e.g. location name, job title).`
        );
      }
    });
  }
  return parts.length ? parts.join("\n") : "No filters available.";
}

async function generateWithGemini(apiKey, prompt) {
  const ai = genkit({
    plugins: [googleAI({ apiKey })],
  });
  const result = await ai.generate({
    model: googleAI.model("gemini-2.5-flash"),
    prompt,
  });
  return (result?.text || result?.output?.[0]?.text || "").trim();
}

/** Shared logic: given trimmed query and filterSchema, returns { filters }. */
async function runSuggestSearchFilters(trimmed, filterSchema) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("suggestSearchFilters: GOOGLE_GENAI_API_KEY not set, returning keyword only");
    return { filters: { keyword: trimmed } };
  }

  const schema = filterSchema && typeof filterSchema === "object" ? filterSchema : {};
  const schemaPrompt = buildFilterSchemaPrompt(schema);

  const systemPrompt = `You are a search assistant. Given a user's natural language question about finding people/profiles, return a JSON object of filter key-value pairs to apply.
Rules:
- For "keyword": extract the main search term. Examples: "A man named Chris" -> include keyword "Chris"; "someone called Sarah" -> keyword "Sarah". Always include "keyword" with the most relevant short phrase (name, topic, or role).
- When the user implies gender (e.g. "a man", "man", "male", "a woman", "woman", "female"), include the corresponding gender filter. Use the exact field key and option id from the available filters (e.g. if there is a gender/lookup field with options like Male, Female, use the id for "Male" when the user says man/male, and for "Female" when they say woman/female).
- Use only the exact filter keys and values described in the available filters. For select/lookup filters always use the exact option id as the value.
- Only include filters that are clearly implied by the question.
- Return ONLY valid JSON, no markdown, no code block, no explanation. Example for "A man named Chris" (when a gender filter with a male option exists): {"keyword":"Chris","<genderFieldKey>":"<maleOptionId>"}`;

  const userPrompt = `User question: "${trimmed}"

Available filters:
${schemaPrompt}

Return JSON object of filters to apply:`;

  const fullPrompt = systemPrompt + "\n\n" + userPrompt;

  try {
    const text = await generateWithGemini(apiKey, fullPrompt);
    if (!text) {
      return { filters: { keyword: trimmed } };
    }

    let jsonStr = text;
    const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) jsonStr = codeMatch[1].trim();
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }

    const filters = JSON.parse(jsonStr);
    if (typeof filters !== "object" || filters === null) {
      return { filters: { keyword: trimmed } };
    }

    const out = { ...filters };
    if (typeof out.keyword !== "string" || !out.keyword.trim()) {
      out.keyword = trimmed;
    }
    return { filters: out };
  } catch (err) {
    console.error("suggestSearchFilters:", err);
    return { filters: { keyword: trimmed } };
  }
}

exports.suggestSearchFilters = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in to suggest filters.");
  }

  const { query, filterSchema } = request.data || {};
  const trimmed = typeof query === "string" ? query.trim() : "";
  if (!trimmed) {
    throw new HttpsError("invalid-argument", "query is required and must be a non-empty string.");
  }

  return runSuggestSearchFilters(trimmed, request.data?.filterSchema);
});

/** HTTP endpoint with CORS for browsers. Send POST with Authorization: Bearer <firebaseIdToken> and JSON body { query, filterSchema }. */
exports.suggestSearchFiltersHttp = onRequest({ cors: true }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).set("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

  const authHeader = req.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  const idToken = match ? match[1].trim() : "";
  if (!idToken) {
    res.status(401).json({ error: "Missing or invalid Authorization header (Bearer token required)" });
    return;
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    console.warn("suggestSearchFiltersHttp: invalid token", err?.message);
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  let body;
  try {
    body = typeof req.body === "object" && req.body !== null ? req.body : JSON.parse(req.body || "{}");
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  const query = body.query;
  const trimmed = typeof query === "string" ? query.trim() : "";
  if (!trimmed) {
    res.status(400).json({ error: "query is required and must be a non-empty string" });
    return;
  }

  const filterSchema = body.filterSchema;
  try {
    const result = await runSuggestSearchFilters(trimmed, filterSchema);
    res.status(200).json(result);
  } catch (err) {
    console.error("suggestSearchFiltersHttp:", err);
    res.status(500).json({ error: "Internal error" });
  }
});
