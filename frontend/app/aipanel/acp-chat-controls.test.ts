import { describe, expect, it } from "vitest";
import { getComposerSuggestions } from "./acp-chat-controls";
import type { AcpBackendInfo } from "./use-acp-session";

const agents: AcpBackendInfo[] = [
    { backend: "kronoscode", name: "KronosCode", cliPath: "kronoscode", available: true },
    { backend: "opencode", name: "OpenCode", cliPath: "opencode", available: false },
];

describe("ACP composer suggestions", () => {
    it("filters saved commands and skills using their persisted definitions", () => {
        const commands = getComposerSuggestions(
            "commands",
            "review",
            {
                review: { name: "review-project", description: "Review current work", template: "$ARGUMENTS" },
                fix: { name: "fix", description: "Repair a failure" },
            },
            {},
            agents,
            [],
            "agents"
        );
        const skills = getComposerSuggestions(
            "skills",
            "typescript",
            {},
            {
                typed: { name: "typescript-quality", description: "TypeScript changes", instructions: "Check types." },
            },
            agents,
            [],
            "agents"
        );

        expect(commands.map((item) => item.label)).toEqual(["review-project"]);
        expect(skills.map((item) => item.label)).toEqual(["typescript-quality"]);
    });

    it("separates runtime and referenced-file mentions", () => {
        const runtimeSuggestions = getComposerSuggestions("mentions", "code", {}, {}, agents, [], "agents");
        const fileSuggestions = getComposerSuggestions(
            "mentions",
            "session",
            {},
            {},
            agents,
            ["/work/src/session.ts", "/work/README.md"],
            "files"
        );

        expect(runtimeSuggestions.map((item) => item.label)).toEqual(["KronosCode", "OpenCode"]);
        expect(runtimeSuggestions[1].available).toBe(false);
        expect(fileSuggestions.map((item) => item.label)).toEqual(["session.ts"]);
    });
});
