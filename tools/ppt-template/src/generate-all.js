#!/usr/bin/env node

import path from "node:path";
import { spawnSync } from "node:child_process";
import { URL, fileURLToPath } from "node:url";
import http from "node:http";
import https from "node:https";

import { readJson, resolveOutputPath } from "./ppt-theme.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolRoot = path.resolve(__dirname, "..");
const outputDir = resolveOutputPath(toolRoot);
const manifestPath = resolveOutputPath(toolRoot, "screenshots", "manifest.json");

const defaults = {
  baseUrl: process.env.ROUTA_PPT_BASE_URL || "http://127.0.0.1:3000",
  workspaceId: process.env.ROUTA_PPT_WORKSPACE_ID || "default",
  capture: true,
};

function parseArgs(argv) {
  const options = { ...defaults };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url") options.baseUrl = argv[++index];
    else if (arg === "--workspace-id") options.workspaceId = argv[++index];
    else if (arg === "--skip-capture") options.capture = false;
    else if (arg === "--help") options.help = true;
  }
  return options;
}

function printHelp() {
  console.log("Usage: node src/generate-all.js [--base-url http://127.0.0.1:3000] [--workspace-id default] [--skip-capture]");
}

function commandExists(command) {
  const result = spawnSync("/bin/zsh", ["-lc", `command -v ${command}`], {
    encoding: "utf8",
    cwd: toolRoot,
  });
  return result.status === 0;
}

function runNodeScript(scriptName, args = []) {
  const result = spawnSync("node", [path.join("src", scriptName), ...args], {
    encoding: "utf8",
    cwd: toolRoot,
  });

  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
    throw new Error(`${scriptName} failed: ${detail}`);
  }

  if (result.stdout.trim()) {
    console.log(result.stdout.trim());
  }
}

function checkUrlReachable(targetUrl) {
  return new Promise((resolve) => {
    const url = new URL(targetUrl);
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      {
        method: "HEAD",
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname || "/",
        timeout: 2000,
      },
      (res) => {
        resolve(Boolean(res.statusCode && res.statusCode < 500));
      },
    );

    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function maybeCaptureScreenshots(options) {
  if (!options.capture) {
    console.log("Skipping screenshots: --skip-capture provided.");
    return;
  }

  if (!commandExists("agent-browser")) {
    console.log("Skipping screenshots: agent-browser is not installed.");
    return;
  }

  const reachable = await checkUrlReachable(options.baseUrl);
  if (!reachable) {
    console.log(`Skipping screenshots: ${options.baseUrl} is not reachable.`);
    return;
  }

  console.log(`Capturing screenshots from ${options.baseUrl} ...`);
  runNodeScript("capture-app-screenshots.js", ["--base-url", options.baseUrl, "--workspace-id", options.workspaceId]);
}

function printArtifactSummary() {
  const artifacts = [
    "routa-color-template.pptx",
    "routa-v0.2.7-release-notes.pptx",
    "routa-architecture-deck.pptx",
    "routa-product-showcase-deck.pptx",
  ].map((file) => path.join(outputDir, file));

  console.log("Generated artifacts:");
  artifacts.forEach((artifact) => console.log(`- ${artifact}`));

  const manifest = readJson(manifestPath, []);
  if (manifest.length > 0) {
    console.log(`Screenshot manifest: ${manifestPath}`);
    console.log(`Captured screens: ${manifest.map((entry) => entry.id).join(", ")}`);
  } else {
    console.log("Screenshot manifest: not available");
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  await maybeCaptureScreenshots(options);
  runNodeScript("generate-template.mjs");
  runNodeScript("release-notes-to-ppt.js");
  runNodeScript("generate-architecture-deck.js");
  runNodeScript("generate-product-showcase-deck.js");
  printArtifactSummary();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
