import { describe, expect, it } from "vitest";
import { makeInitialWorkspace, routeRuntimeIntent, runLocalCommand, updateWorkspaceFile } from "./kron-local-workspace";

describe("routeRuntimeIntent", () => {
    it("keeps common editing and web work on the iPhone", () => {
        expect(routeRuntimeIntent("Edit the TypeScript files and preview the HTML").target).toBe("local");
    });

    it("routes heavier infrastructure to Kron Sandbox", () => {
        expect(routeRuntimeIntent("Run PostgreSQL in Docker").target).toBe("sandbox");
        expect(routeRuntimeIntent("Compile the Go service").target).toBe("sandbox");
    });

    it("routes Python to the smallest compatible Linux layer", () => {
        expect(routeRuntimeIntent("Use Python to inspect this CSV").target).toBe("local-linux");
    });

    it("uses a personal computer only for native toolchains", () => {
        expect(routeRuntimeIntent("Create an Xcode archive").target).toBe("remote-device");
    });
});

describe("Kron Local workspace", () => {
    it("updates persistent file content immutably", () => {
        const workspace = makeInitialWorkspace();
        const updated = updateWorkspaceFile(workspace, "README.md", "updated");
        expect(updated.files.find((file) => file.path === "README.md")?.content).toBe("updated");
        expect(workspace.files.find((file) => file.path === "README.md")?.content).not.toBe("updated");
    });

    it("runs the supported virtual shell commands", () => {
        const result = runLocalCommand(makeInitialWorkspace(), "git status");
        expect(result.output.join("\n")).toContain("On branch main");
    });
});
