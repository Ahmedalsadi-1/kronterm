import type { BrowserRuntimeState, HostProfile, KronosSession, SandboxRecord } from "../types";
import { buildSurfaces, findPreferredSurface, makePreviewDataUrl, surfaceMatchesQuery } from "./surface-model";

const host: HostProfile = {
    id: "host-a",
    label: "Kron Cloud",
    baseUrl: "https://kron.example",
    kind: "managed",
    color: "#2367ff",
    capabilities: ["browser", "sandbox"],
    createdAt: 1,
};

describe("buildSurfaces", () => {
    it("keeps the host identity on every heterogeneous surface", () => {
        const sessions: KronosSession[] = [{ id: "session-a", title: "Research", time: { updated: 10 } }];
        const browserStates: BrowserRuntimeState[] = [
            {
                enabled: true,
                sessionID: "session-a",
                provider: "kronoscode-relay",
                backend: "playwright",
                capabilities: {
                    tabs: true,
                    history: true,
                    selection: true,
                    highFidelityScreenshot: true,
                    downloads: true,
                },
                pages: [
                    {
                        id: "page-a",
                        index: 0,
                        title: "KronTerm",
                        url: "https://kronterm.dev",
                        active: true,
                        createdAt: 11,
                    },
                ],
                activePageID: "page-a",
            },
        ];
        const sandboxes: SandboxRecord[] = [
            {
                id: "sandbox-a",
                status: "running",
                terminalUrl: "https://kron.example/terminal/a",
            },
        ];

        const surfaces = buildSurfaces(host, sessions, {}, browserStates, sandboxes);

        expect(surfaces.map((surface) => surface.kind).sort()).toEqual(["app", "browser", "run", "terminal"]);
        expect(surfaces.every((surface) => surface.hostId === host.id)).toBe(true);
    });

    it("prioritizes failed and working runs", () => {
        const sessions: KronosSession[] = [
            { id: "idle", title: "Idle", time: { updated: 20 } },
            { id: "busy", title: "Busy", time: { updated: 10 } },
            { id: "failed", title: "Failed", time: { updated: 5 } },
        ];
        const surfaces = buildSurfaces(
            host,
            sessions,
            {
                busy: { type: "busy", activeTool: "browser" },
                failed: { type: "busy", runHealth: { status: "error", suggested_next_action: "Retry" } },
            },
            [],
            []
        );

        expect(surfaces.map((surface) => surface.title)).toEqual(["Failed", "Busy", "Idle"]);
    });

    it("places an available PhoneAgent target behind the shared app surface", () => {
        const surfaces = buildSurfaces(host, [], {}, [], [], {
            available: true,
            provider: "PhoneAgent",
            capabilities: ["get_context", "tap", "enter_text"],
        });

        expect(surfaces).toHaveLength(1);
        expect(surfaces[0]).toMatchObject({
            kind: "app",
            title: "This iPhone",
            phoneControl: true,
        });
        expect(surfaces[0].capabilities).toContain("takeover");
    });
});

describe("surface helpers", () => {
    it("routes a widget to the requested surface on the active host", () => {
        const hostB = { ...host, id: "host-b", label: "Paired Mac" };
        const surfaces = [
            ...buildSurfaces(
                host,
                [],
                {},
                [],
                [{ id: "sandbox-a", status: "running", terminalUrl: "https://kron.example/a" }]
            ),
            ...buildSurfaces(
                hostB,
                [],
                {},
                [],
                [{ id: "sandbox-b", status: "running", terminalUrl: "https://kron.example/b" }]
            ),
        ];

        expect(findPreferredSurface(surfaces, "terminal", hostB.id)?.hostId).toBe(hostB.id);
        expect(findPreferredSurface(surfaces, "file", hostB.id)).toBeUndefined();
    });

    it("searches title, host, type, and URL", () => {
        const [surface] = buildSurfaces(host, [{ id: "run", title: "Release review" }], {}, [], []);
        expect(surfaceMatchesQuery(surface, "release")).toBe(true);
        expect(surfaceMatchesQuery(surface, "kron cloud")).toBe(true);
        expect(surfaceMatchesQuery(surface, "browser")).toBe(false);
    });

    it("normalizes raw screenshot bytes", () => {
        expect(makePreviewDataUrl("image/jpeg", "abc")).toBe("data:image/jpeg;base64,abc");
        expect(makePreviewDataUrl(undefined, "data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
    });
});
