#!/usr/bin/env node
/**
 * Writes Firebase Functions params from functions-config.json to functions/.env.{projectId}
 * Uses the new params API (not deprecated functions.config).
 *
 * 1. Copy functions-config.example.json to functions-config.json
 * 2. Fill in your values (functions-config.json is gitignored)
 * 3. Run: node scripts/set-functions-config.js
 *    Or: pnpm run deploy:functions (runs this then deploy)
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const configPath = resolve(rootDir, "functions-config.json");
const functionsDir = resolve(rootDir, "functions");

// Map functions-config.json keys to param env var names
const PARAM_MAP = {
  mailgun: {
    api_key: "MAILGUN_API_KEY",
    domain: "MAILGUN_DOMAIN",
    from_email: "MAILGUN_FROM_EMAIL",
    base_url: "MAILGUN_BASE_URL",
  },
};

function flattenToParams(obj, prefix = "") {
  const result = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("_")) continue;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result.push(...flattenToParams(value, fullKey));
    } else {
      const paramName = resolveParamName(fullKey);
      if (paramName) {
        result.push({ name: paramName, value: String(value ?? "") });
      }
    }
  }
  return result;
}

function resolveParamName(dotKey) {
  const parts = dotKey.split(".");
  let map = PARAM_MAP;
  for (const p of parts) {
    if (map && typeof map[p] === "string") return map[p];
    if (map && typeof map[p] === "object") map = map[p];
    else return null;
  }
  return null;
}

function getProjectId() {
  const firebasercPath = resolve(rootDir, ".firebaserc");
  if (existsSync(firebasercPath)) {
    try {
      const rc = JSON.parse(readFileSync(firebasercPath, "utf8"));
      return rc?.projects?.default || null;
    } catch {
      // ignore
    }
  }
  // Fallback: allow projectId in functions-config.json
  try {
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    return config?.projectId || config?.firebase?.projectId || null;
  } catch {
    return null;
  }
}

function main() {
  if (!existsSync(configPath)) {
    console.error("❌ functions-config.json not found.");
    console.error("   Copy functions-config.example.json to functions-config.json and fill in your values.");
    console.error("   cp functions-config.example.json functions-config.json");
    process.exit(1);
  }

  let config;
  try {
    config = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (e) {
    console.error("❌ Invalid JSON in functions-config.json:", e.message);
    process.exit(1);
  }

  const params = flattenToParams(config);
  if (params.length === 0) {
    console.warn("⚠ No mapped params found. Add entries to PARAM_MAP in this script for new config keys.");
    process.exit(0);
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.error("❌ Could not determine Firebase project ID. Create .firebaserc or run: firebase use");
    process.exit(1);
  }

  const envPath = resolve(functionsDir, `.env.${projectId}`);
  const lines = params.map(({ name, value }) => {
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return value.includes(" ") || value.includes("=") ? `${name}="${escaped}"` : `${name}=${value}`;
  });

  if (!existsSync(functionsDir)) {
    mkdirSync(functionsDir, { recursive: true });
  }
  writeFileSync(envPath, lines.join("\n") + "\n", "utf8");

  console.log(`✅ Wrote ${params.length} params to functions/.env.${projectId}`);
  console.log("   Run: firebase deploy --only functions");
}

main();
