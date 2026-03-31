#!/usr/bin/env node
/**
 * Deploy Firebase Functions: sets config from functions-config.json, then deploys.
 * Run: node scripts/deploy-functions.js
 * Or: pnpm run deploy:functions
 */

import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

function run(cmd, args = []) {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(cmd, args, {
      stdio: "inherit",
      cwd: rootDir,
      shell: false,
    });
    proc.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${cmd} exited with ${code}`));
    });
  });
}

async function main() {
  console.log("Step 1: Writing params to functions/.env.{projectId}...");
  await run("node", [resolve(__dirname, "set-functions-config.js")]);

  console.log("Step 2: Deploying Firebase Functions...");
  await run("npx", ["firebase", "deploy", "--only", "functions"]);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
