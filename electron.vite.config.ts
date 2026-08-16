// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "electron-vite";
import path from "node:path";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";

// from our electron build
const CHROME = "chrome140";
const NODE = "node22";
const ProductionSourceMaps = process.env.KRONTERM_SOURCEMAP === "true" ? ("hidden" as const) : false;
const VscodeJsonRpcCommonPath = path.resolve(process.cwd(), "node_modules/vscode-jsonrpc/lib/common");

export default defineConfig({
    main: {
        root: ".",
        build: {
            target: NODE,
            rollupOptions: {
                input: {
                    index: "emain/emain.ts",
                },
            },
            outDir: "dist/main",
            externalizeDeps: false,
        },
        plugins: [tsconfigPaths({ ignoreConfigErrors: true })],
        resolve: {
            alias: {
                "@": "frontend",
            },
        },
        server: {
            open: false,
        },
        define: {
            "process.env.WS_NO_BUFFER_UTIL": "true",
            "process.env.WS_NO_UTF_8_VALIDATE": "true",
        },
    },
    preload: {
        root: ".",
        build: {
            target: NODE,
            sourcemap: ProductionSourceMaps,
            rollupOptions: {
                input: {
                    index: "emain/preload.ts",
                    "preload-webview": "emain/preload-webview.ts",
                    "preload-pet": "emain/preload-pet.ts",
                    "preload-overlay": "emain/preload-overlay.ts",
                },
                output: {
                    format: "cjs",
                },
            },
            outDir: "dist/preload",
            externalizeDeps: false,
        },
        server: {
            open: false,
        },
        plugins: [tsconfigPaths({ ignoreConfigErrors: true })],
    },
    renderer: {
        root: ".",
        build: {
            target: CHROME,
            sourcemap: ProductionSourceMaps,
            outDir: "dist/frontend",
            rollupOptions: {
                input: {
                    index: "index.html",
                    pet: "pet.html",
                    overlay: "overlay.html",
                },
                output: {
                    manualChunks(id) {
                        const p = id.replace(/\\/g, "/");
                        if (p.includes("node_modules/monaco") || p.includes("node_modules/@monaco")) return "monaco";
                        if (p.includes("node_modules/mermaid") || p.includes("node_modules/@mermaid")) return "mermaid";
                        if (p.includes("node_modules/katex") || p.includes("node_modules/@katex")) return "katex";
                        if (p.includes("node_modules/shiki") || p.includes("node_modules/@shiki")) {
                            return "shiki";
                        }
                        if (p.includes("node_modules/cytoscape") || p.includes("node_modules/@cytoscape"))
                            return "cytoscape";
                        return undefined;
                    },
                },
            },
        },
        optimizeDeps: {
            include: ["monaco-yaml/yaml.worker.js"],
            exclude: ["langium"],
            esbuildOptions: {
                target: CHROME,
            },
        },
        resolve: {
            alias: [
                { find: /^@hermes\/shared\/(.*)/, replacement: path.resolve(process.cwd(), "frontend/hermes-shared/$1") },
                { find: /^@hermes\/plugin-sdk$/, replacement: path.resolve(process.cwd(), "frontend/hermes/plugins/plugin-sdk.d.ts") },
                { find: /^@hermes\/(.*)/, replacement: path.resolve(process.cwd(), "frontend/hermes/$1") },
                { find: /^@hermes$/, replacement: path.resolve(process.cwd(), "frontend/hermes/index.ts") },
                { find: /^bippy$/, replacement: path.resolve(process.cwd(), "frontend/hermes/debug/bippy.d.ts") },
                { find: "vscode-jsonrpc/lib/common/cancellation.js", replacement: path.join(VscodeJsonRpcCommonPath, "cancellation.js") },
                { find: "vscode-jsonrpc/lib/common/events.js", replacement: path.join(VscodeJsonRpcCommonPath, "events.js") },
            ],
        },
        server: {
            open: false,
            port: 9124,
            watch: {
                ignored: [
                    "dist/**",
                    "**/*.go",
                    "**/go.mod",
                    "**/go.sum",
                    "**/*.md",
                    "**/*.mdx",
                    "**/*.json",
                    "emain/**",
                    "**/*.txt",
                    "**/*.log",
                ],
            },
        },
        css: {
            preprocessorOptions: {
                scss: {
                    silenceDeprecations: ["mixed-decls"],
                },
            },
        },
        plugins: [
            tsconfigPaths({ ignoreConfigErrors: true }),
            { ...ViteImageOptimizer(), apply: "build" },
            svgr({
                svgrOptions: { exportType: "default", ref: true, svgo: false, titleProp: true },
                include: "**/*.svg",
            }),
            react({}),
            tailwindcss(),
        ],
    },
});
