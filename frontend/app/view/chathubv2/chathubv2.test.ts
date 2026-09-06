import { describe, expect, it } from "vitest";
import { resolveBackendStateFromStartResult, resolveBackendStateFromStatus } from "./chathubv2-state";

const health: ChatHubV2RuntimeHealth = {
    runtime: "kronoscode-kronoschamber",
    status: "ready",
    checkedAt: 1,
    candidateRoots: ["/tmp/kronoschamber-web"],
    detectedRoot: "/tmp/kronoschamber-web",
    serverPath: "/tmp/kronoschamber-web/server/index.js",
    distPath: "/tmp/kronoschamber-web/dist",
    kronosCodeBinary: "/Users/test/.bun/bin/kronoscode",
    logExcerpt: ["ready"],
    supportedProviders: ["KronosCode runtime defaults"],
    supportedModels: ["KronosCode runtime defaults"],
    recoveryActions: ["retry", "open-settings", "inspect-logs"],
};

const serverData: ChatHubV2ServerData = {
    url: "http://127.0.0.1:3107",
    port: 3107,
    pid: 123,
    serverPath: "/tmp/kronoschamber-web/server/index.js",
    distPath: "/tmp/kronoschamber-web/dist",
    ready: true,
    health,
};

describe("ChatHub V2 runtime state", () => {
    it("autoloads a ready KronosChamber status into the loaded frame state", () => {
        expect(resolveBackendStateFromStatus({ success: true, data: serverData, health })).toEqual({
            status: "ready",
            url: "http://127.0.0.1:3107",
            health,
        });
    });

    it("automatically loads a running KronosChamber without a start action", () => {
        expect(resolveBackendStateFromStatus({ success: true, data: { ...serverData, ready: false }, health })).toEqual(
            {
                status: "starting",
                url: "http://127.0.0.1:3107",
                health,
            }
        );
    });

    it("preserves repair health when startup fails", () => {
        const repairHealth = { ...health, status: "not-found" as const, startupError: "bundle missing" };
        expect(
            resolveBackendStateFromStartResult({ success: false, error: "bundle missing", health: repairHealth })
        ).toEqual({
            status: "error",
            error: "bundle missing",
            health: repairHealth,
        });
    });
});
