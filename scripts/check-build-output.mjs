#!/usr/bin/env node

import console from "node:console";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import process from "node:process";

const MaxRendererChunkKb = 22000;
const LargeRendererChunkKb = 8000;

function globHasSourceMap(directory) {
  return readdirSync(directory, { recursive: true }).some((entry) => String(entry).endsWith(".map"));
}

function readInput() {
  const path = process.argv[2];
  if (path) {
    return readFileSync(path, "utf8");
  }
  if (process.stdin.isTTY) {
    return "";
  }
  return readFileSync(0, "utf8");
}

const log = readInput();
const failures = [];
const notices = [];

for (const requiredPath of [
  "dist/kronoschamber-web/dist/index.html",
  "dist/kronoschamber-web/server/index.js",
  "dist/kronoschamber-web/node_modules/node-pty/package.json",
  "dist/mcp-kron-term/dist/index.js",
  "dist/mcp-kron-term/dist/native-bridge.js",
  "dist/hermes-plugins/kronterm-tools/plugin.yaml",
]) {
  if (!existsSync(requiredPath)) {
    failures.push(`Required packaged runtime artifact is missing: ${requiredPath}`);
  }
}

if (!process.env.KRONTERM_SOURCEMAP) {
  const sourceMapPaths = ["dist/main", "dist/frontend", "dist/preload"];
  for (const sourceMapPath of sourceMapPaths) {
    if (existsSync(sourceMapPath) && globHasSourceMap(sourceMapPath)) {
      failures.push(`${sourceMapPath} contains production source maps without KRONTERM_SOURCEMAP=true.`);
    }
  }
}

if (/circular dependency between chunks|broken execution order/i.test(log)) {
  failures.push("Rollup reported circular chunks that may break execution order.");
}

const chunkPattern = /dist\/frontend\/assets\/([^\s]+\.js)\s+([\d,.]+)\s+kB/g;
for (const match of log.matchAll(chunkPattern)) {
  const [, fileName, sizeText] = match;
  const sizeKb = Number(sizeText.replaceAll(",", ""));
  if (!Number.isFinite(sizeKb)) {
    continue;
  }
  if (sizeKb > MaxRendererChunkKb) {
    failures.push(`${fileName} is ${sizeKb.toFixed(2)} kB, above the ${MaxRendererChunkKb} kB beta budget.`);
  } else if (sizeKb > LargeRendererChunkKb) {
    notices.push(`${fileName} is ${sizeKb.toFixed(2)} kB; keep it lazy-loaded or justify the startup cost.`);
  }
}

if (notices.length) {
  console.log("Build output notices:");
  for (const notice of notices) {
    console.log(`- ${notice}`);
  }
}

if (failures.length) {
  console.error("Build output failed release-readiness checks:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Build output passed release-readiness checks.");
