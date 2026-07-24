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
const VscodeJsonRpcCommonPath = path.resolve(process.cwd(), "node_modules/vscode-jsonrpc/lib/common");

// for debugging
// target is like -- path.resolve(__dirname, "frontend/app/workspace/workspace-layout-model.ts");
function whoImportsTarget(target: string) {
    return {
        name: "who-imports-target",
        buildEnd() {
            // Build reverse graph: child -> [importers...]
            const parents = new Map<string, string[]>();
            for (const id of (this as any).getModuleIds()) {
                const info = (this as any).getModuleInfo(id);
                if (!info) continue;
                for (const child of [...info.importedIds, ...info.dynamicallyImportedIds]) {
                    const arr = parents.get(child) ?? [];
                    arr.push(id);
                    parents.set(child, arr);
                }
            }

            // Walk upward from TARGET and print paths to entries
            const entries = [...parents.keys()].filter((id) => {
                const m = (this as any).getModuleInfo(id);
                return m?.isEntry;
            });

            const seen = new Set<string>();
            const stack: string[] = [];
            const dfs = (node: string) => {
                if (seen.has(node)) return;
                seen.add(node);
                stack.push(node);
                const ps = parents.get(node) || [];
                if (ps.length === 0) {
                    // hit a root (likely main entry or plugin virtual)
                    console.log("\nImporter chain:");
                    stack
                        .slice()
                        .reverse()
                        .forEach((s) => console.log("  ↳", s));
                } else {
                    for (const p of ps) dfs(p);
                }
                stack.pop();
            };

            if (!parents.has(target)) {
                console.log(`[who-imports] TARGET not in MAIN graph: ${target}`);
            } else {
                dfs(target);
            }
        },
        async resolveId(id: any, importer: any) {
            const r = await (this as any).resolve(id, importer, { skipSelf: true });
            if (r?.id === target) {
                console.log(`[resolve] ${importer} -> ${id} -> ${r.id}`);
            }
            return null;
        },
    };
}

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
            sourcemap: true,
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
            sourcemap: true,
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
            alias: {
                "vscode-jsonrpc/lib/common/cancellation.js": path.join(VscodeJsonRpcCommonPath, "cancellation.js"),
                "vscode-jsonrpc/lib/common/events.js": path.join(VscodeJsonRpcCommonPath, "events.js"),
            },
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
