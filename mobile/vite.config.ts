import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const ProductionSourceMaps = process.env.KRONOSCHAMBER_MOBILE_SOURCEMAP === "true" ? ("hidden" as const) : false;

const config = defineConfig({
    plugins: [react()],
    build: {
        target: "es2022",
        sourcemap: ProductionSourceMaps,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes("node_modules/@xterm/")) {
                        return "terminal";
                    }
                    if (id.includes("node_modules/react") || id.includes("node_modules/scheduler/")) {
                        return "react";
                    }
                },
            },
        },
    },
    server: {
        host: "0.0.0.0",
        port: 4174,
        proxy: {
            "/_kronhost": {
                target: process.env.VITE_KRONTERM_LOCAL_URL?.trim() || "http://127.0.0.1:3107",
                changeOrigin: true,
                ws: true,
                rewrite: (path) => path.replace(/^\/_kronhost/, ""),
            },
        },
    },
});

export { config as default };
