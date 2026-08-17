import { describe, expect, it } from "bun:test";
import { makeKronTermWorkspaceSettings } from "./workspace-settings.js";

describe("KronTerm workspace settings", () => {
    it("adds and activates the embedded workspace without removing saved projects", () => {
        const current = {
            projects: [{ id: "saved", path: "/tmp/saved", addedAt: 1 }],
            activeProjectId: "saved",
        };

        const result = makeKronTermWorkspaceSettings(current, "/tmp/kronterm", 10);

        expect(result.projects).toHaveLength(2);
        expect(result.projects[0]).toEqual(current.projects[0]);
        expect(result.projects[1]).toMatchObject({ path: "/tmp/kronterm", lastOpenedAt: 10 });
        expect(result.activeProjectId).toBe(result.projects[1].id);
        expect(result.lastDirectory).toBe("/tmp/kronterm");
    });

    it("reuses an existing workspace project", () => {
        const current = {
            projects: [{ id: "workspace", path: "/tmp/kronterm", addedAt: 1, lastOpenedAt: 2 }],
        };

        const result = makeKronTermWorkspaceSettings(current, "/tmp/kronterm", 10);

        expect(result.projects).toEqual([
            { id: "workspace", path: "/tmp/kronterm", addedAt: 1, lastOpenedAt: 10 },
        ]);
        expect(result.activeProjectId).toBe("workspace");
    });
});
