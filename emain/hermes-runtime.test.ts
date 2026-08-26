// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
    makeHermesApiUrl,
    makeHermesManagedConfig,
    makeHermesRuntimeEnvironment,
    makeKronTermToolEnvironment,
    parseHermesReadyPort,
    resolveKronTermSharedSkillDirs,
} from "./hermes-runtime";

describe("Hermes API routing", () => {
    test("keeps renderer requests on the managed backend and adds profile scope", () => {
        expect(makeHermesApiUrl("http://127.0.0.1:62554", "/api/config?explicit=1", "research").toString()).toBe(
            "http://127.0.0.1:62554/api/config?explicit=1&profile=research"
        );
    });

    test.each(["https://example.com/api/config", "//example.com/api/config", "api/config"])(
        "rejects a request that could escape the managed backend: %s",
        (requestPath) => {
            expect(() => makeHermesApiUrl("http://127.0.0.1:62554", requestPath)).toThrow(
                "Hermes API paths must be absolute backend paths."
            );
        }
    );
});

describe("parseHermesReadyPort", () => {
    test.each([
        ["HERMES_BACKEND_READY port=43127\n", 43127],
        ["booting\nHERMES_DASHBOARD_READY port=9119\r\nready", 9119],
    ])("reads a supported readiness sentinel", (output, expected) => {
        expect(parseHermesReadyPort(output)).toBe(expected);
    });

    test.each(["HERMES_BACKEND_READY port=0", "HERMES_BACKEND_READY port=70000", "ready port=9119"])(
        "rejects an invalid readiness sentinel",
        (output) => {
            expect(parseHermesReadyPort(output)).toBeUndefined();
        }
    );
});

describe("Hermes KronTerm runtime environment", () => {
    test("injects presentation-aware tool guidance without persisting it to the user profile", () => {
        const env = makeHermesRuntimeEnvironment("/opt/hermes/bin/hermes", "session-token", {
            managedDir: "/tmp/kronterm-hermes-managed",
            kronosCodeBinary: "/opt/kronterm/bin/kronoscode",
            toolBridgeCommand: ["/opt/electron", "/opt/kronterm/mcp-kron-term/native-bridge.js"],
            enableKronTermTools: true,
            toolEnvironment: makeKronTermToolEnvironment(
                "/tmp/kronos-capability.json",
                "/opt/kronterm/bin/wsh",
                "/workspace",
                ["/workspace/.agents/skills"]
            ),
        });

        expect(env.HERMES_EPHEMERAL_SYSTEM_PROMPT).toContain("workspace_snapshot");
        expect(env.HERMES_EPHEMERAL_SYSTEM_PROMPT).toContain("You are Kronos");
        expect(env.HERMES_EPHEMERAL_SYSTEM_PROMPT).toContain("widget_snapshot");
        expect(env.HERMES_EPHEMERAL_SYSTEM_PROMPT).toContain("canvas_snapshot");
        expect(env.HERMES_EPHEMERAL_SYSTEM_PROMPT).toContain("workspace_canvas_add_note");
        expect(env.HERMES_EPHEMERAL_SYSTEM_PROMPT).toContain("browser_open_tab");
        expect(env.HERMES_EPHEMERAL_SYSTEM_PROMPT).toContain("create a new browser widget only as the final fallback");
        expect(env.HERMES_EPHEMERAL_SYSTEM_PROMPT).toContain("never intentionally overlap canvas items");
        expect(env.HERMES_EPHEMERAL_SYSTEM_PROMPT).toContain("kron_computer_get_app_state");
        expect(env.HERMES_EPHEMERAL_SYSTEM_PROMPT).toContain(
            "KronTerm tools are native Hermes function tools, not MCP tools"
        );
        expect(env.HERMES_EPHEMERAL_SYSTEM_PROMPT).toContain(
            "call surface_status before answering from memory or conversation history"
        );
        expect(env.HERMES_DASHBOARD_SESSION_TOKEN).toBe("session-token");
        expect(env.HERMES_MANAGED_DIR).toBe("/tmp/kronterm-hermes-managed");
        expect(env.HERMES_COPILOT_ACP_COMMAND).toBe("/opt/kronterm/bin/kronoscode");
        expect(env.HERMES_COPILOT_ACP_ARGS).toBe("acp");
        expect(JSON.parse(env.HERMES_KRONTERM_TOOL_BRIDGE_COMMAND!)).toEqual([
            "/opt/electron",
            "/opt/kronterm/mcp-kron-term/native-bridge.js",
        ]);
        expect(env.HERMES_TUI_TOOLSETS).toBe("hermes-cli,kronterm");
        expect(env.KRONTERM_SURFACE_CAPABILITY_FILE).toBe("/tmp/kronos-capability.json");
    });

    test("pins KronosCoder without configuring Hermes' optional Python MCP client", () => {
        const config = makeHermesManagedConfig() as any;

        expect(config.delegation).toEqual({ provider: "copilot-acp", model: "copilot-acp" });
        expect(config.tools).toEqual({ tool_search: { enabled: "off" } });
        expect(config.agent.system_prompt).toContain("KronTerm tools are native Hermes function tools, not MCP tools");
        expect(config.display).toEqual({ personality: "" });
        expect(config).not.toHaveProperty("mcp_servers");
    });

    test("exposes packaged, project, and user skill roots to the shared MCP catalog", () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "kronos-skill-roots-"));
        const cwd = path.join(root, "workspace");
        const homeDir = path.join(root, "home");
        const resourcesPath = path.join(root, "resources");
        const configured = path.join(root, "configured");
        const expected = [
            path.join(cwd, ".agents", "skills"),
            path.join(homeDir, ".codex", "skills"),
            path.join(homeDir, ".hermes", "skills"),
            path.join(resourcesPath, "kronterm-skills"),
            configured,
        ];
        for (const directory of expected) {
            fs.mkdirSync(directory, { recursive: true });
        }

        expect(resolveKronTermSharedSkillDirs({ cwd, homeDir, resourcesPath, configured })).toEqual(
            expect.arrayContaining(expected)
        );
    });

    test("gives native TypeScript tools a rotating capability file instead of copying a JWT", () => {
        const env = makeKronTermToolEnvironment("/tmp/kronos-capability.json", "/opt/kronterm/bin/wsh", "/workspace", [
            "/workspace/.agents/skills",
            "/resources/kronterm-skills",
        ]);

        expect(env).toMatchObject({
            KRONTERM_SURFACE_CAPABILITY_FILE: "/tmp/kronos-capability.json",
            KRONTERM_WSH: "/opt/kronterm/bin/wsh",
            WAVETERM_WSH: "/opt/kronterm/bin/wsh",
            KRONTERM_WORKSPACE: "/workspace",
        });
        expect(env.KRONTERM_SHARED_SKILL_DIRS.split(path.delimiter)).toEqual([
            "/workspace/.agents/skills",
            "/resources/kronterm-skills",
        ]);
        expect(env).not.toHaveProperty("KRONTERM_JWT");
        expect(env).not.toHaveProperty("WAVETERM_JWT");
    });
});
