#!/usr/bin/env node

import { readFileSync } from "node:fs";

const MaxRendererChunkKb = 22000;
const LargeRendererChunkKb = 8000;

function readInput() {
  const path = process.argv[2];
  if (path) {
    return readFileSync(path, "utf8");
  }
  return readFileSync(0, "utf8");
}

const log = readInput();
const failures = [];
const notices = [];

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
