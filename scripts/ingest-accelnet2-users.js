#!/usr/bin/env node
/**
 * Ingest users from ./data/accelnet2-members.json using the existing ingest-users pipeline.
 *
 * Usage:
 *   node scripts/ingest-accelnet2-users.js [options]
 *   pnpm ingest:users:accelnet2 -- --dry-run --limit 20
 *
 * Options are the same as scripts/ingest-users.js, for example:
 *   --dry-run
 *   --limit N
 *   --password P
 *   --include-duplicates
 *   --file PATH   (optional override; defaults to ./data/accelnet2-members.json)
 */

import { spawnSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const defaultFile = resolve(rootDir, "data", "accelnet2-members.json");
const ingestScript = resolve(rootDir, "scripts", "ingest-users.js");

const userArgs = process.argv.slice(2);
const hasFileArg = userArgs.some((arg) => arg === "--file" || arg.startsWith("--file="));
const args = hasFileArg ? userArgs : ["--file", defaultFile, ...userArgs];

const result = spawnSync(process.execPath, [ingestScript, ...args], {
  stdio: "inherit",
  cwd: rootDir,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
