import { describe, expect, it } from "vitest";

import { formatReviewComments, pickInspectableElement, type DesignReviewComment } from "./model";

describe("Open Design review model", () => {
    it("selects the smallest visible element at a point", () => {
        const selected = pickInspectableElement(
            [
                {
                    ref: "@e1",
                    role: "main",
                    name: "",
                    x: 0,
                    y: 0,
                    width: 800,
                    height: 600,
                    focusable: false,
                    visible: true,
                },
                {
                    ref: "@e2",
                    role: "button",
                    name: "Publish",
                    x: 20,
                    y: 30,
                    width: 100,
                    height: 40,
                    focusable: true,
                    visible: true,
                },
            ],
            50,
            50
        );

        expect(selected?.ref).toBe("@e2");
    });

    it("formats queued comments as source-oriented Hermes context", () => {
        const comment: DesignReviewComment = {
            id: "comment-1",
            surfaceId: "browser-1",
            surfaceTitle: "OpenDesign",
            url: "http://localhost:4321",
            element: {
                ref: "@e7",
                role: "heading",
                name: "Build faster",
                x: 12,
                y: 18,
                width: 240,
                height: 60,
                focusable: false,
                visible: true,
            },
            text: "Make this headline more concise.",
            createdAt: 1,
            status: "queued",
        };

        expect(formatReviewComments([comment])).toContain("Locate the owning source");
        expect(formatReviewComments([comment])).toContain("heading · “Build faster” · @e7");
        expect(formatReviewComments([comment])).toContain("Make this headline more concise.");
    });
});
