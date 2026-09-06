// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import console from "node:console";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const extension = process.platform === "win32" ? ".exe" : "";
const binary = path.join(root, "agents", "kronoscode", "bin", `kronoscode${extension}`);
const license = path.join(root, "agents", "kronoscode", "LICENSE");
const missing = [binary, license].filter((file) => !fs.existsSync(file));

if (missing.length > 0) {
  console.error(`KronosCode release artifact validation failed. Missing:\n${missing.join("\n")}`);
  process.exit(1);
}

if (process.platform !== "win32") {
  try {
    fs.accessSync(binary, fs.constants.X_OK);
  } catch {
    console.error(`KronosCode release artifact is not executable: ${binary}`);
    process.exit(1);
  }
}
