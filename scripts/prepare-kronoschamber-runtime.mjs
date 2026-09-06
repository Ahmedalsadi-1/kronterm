#!/usr/bin/env node

import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const SourceRoot = path.resolve("third_party/kronoschamber-web");
const OutputRoot = path.resolve("dist/kronoschamber-web");
const McpSourceRoot = path.resolve("mcp-kron-term");
const McpOutputRoot = path.resolve("dist/mcp-kron-term");
const HermesPluginSourceRoot = path.resolve("agents/hermes/plugins");
const HermesPluginOutputRoot = path.resolve("dist/hermes-plugins");

await rm(OutputRoot, { recursive: true, force: true });
await rm(McpOutputRoot, { recursive: true, force: true });
await rm(HermesPluginOutputRoot, { recursive: true, force: true });
await mkdir(path.join(OutputRoot, "server"), { recursive: true });
await mkdir(path.join(McpOutputRoot, "dist"), { recursive: true });
await mkdir(HermesPluginOutputRoot, { recursive: true });

await Promise.all([
  cp(path.join(SourceRoot, "dist"), path.join(OutputRoot, "dist"), { recursive: true }),
  copyRuntimePackage("node-pty"),
  copyRuntimePackage("node-addon-api"),
  cp(HermesPluginSourceRoot, HermesPluginOutputRoot, { recursive: true }),
]);

await build({
  entryPoints: [path.join(SourceRoot, "server/index.js")],
  outfile: path.join(OutputRoot, "server/index.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  external: ["bun-pty", "node-pty"],
  alias: {
    "jsonc-parser": path.join(SourceRoot, "node_modules/jsonc-parser/lib/esm/main.js"),
  },
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
  logLevel: "warning",
});

await build({
  entryPoints: [path.join(McpSourceRoot, "dist/index.js")],
  outfile: path.join(McpOutputRoot, "dist/index.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  logLevel: "warning",
});

await build({
  entryPoints: [path.join(McpSourceRoot, "dist/native-bridge.js")],
  outfile: path.join(McpOutputRoot, "dist/native-bridge.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  logLevel: "warning",
});

await build({
  entryPoints: [path.join(McpSourceRoot, "dist/native-proxy.js")],
  outfile: path.join(McpOutputRoot, "dist/native-proxy.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  logLevel: "warning",
});

const sourcePackage = JSON.parse(await readFile(path.join(SourceRoot, "package.json"), "utf8"));
await writeFile(
  path.join(OutputRoot, "package.json"),
  `${JSON.stringify(
    {
      name: sourcePackage.name,
      version: sourcePackage.version,
      private: true,
      type: "module",
      main: "./server/index.js",
    },
    null,
    2
  )}\n`
);

const mcpPackage = JSON.parse(await readFile(path.join(McpSourceRoot, "package.json"), "utf8"));
await writeFile(
  path.join(McpOutputRoot, "package.json"),
  `${JSON.stringify(
    {
      name: mcpPackage.name,
      version: mcpPackage.version,
      private: true,
      type: "module",
      main: "./dist/index.js",
    },
    null,
    2
  )}\n`
);

async function copyRuntimePackage(packageName) {
  const source = path.join(SourceRoot, "node_modules", packageName);
  const destination = path.join(OutputRoot, "node_modules", packageName);
  await cp(source, destination, {
    recursive: true,
    filter: (entry) => !entry.endsWith(".pdb") && !entry.includes(`${path.sep}.git${path.sep}`),
  });
}
