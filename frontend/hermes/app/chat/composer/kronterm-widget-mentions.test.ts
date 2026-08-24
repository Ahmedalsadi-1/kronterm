import { hermesDirectiveFormatter } from "@hermes/components/assistant-ui/directive-text";
import { describe, expect, it } from "vitest";
import { detectTrigger } from "./text-utils";

describe("Hermes KronTerm widget mentions", () => {
    it("keeps widget references in the live @ completion scope", () => {
        expect(detectTrigger("inspect @widget:block-7")).toMatchObject({
            kind: "@",
            scope: "widget",
            value: "block-7",
        });
    });

    it("renders sent widget references as typed mention segments", () => {
        expect(hermesDirectiveFormatter.parse("Inspect @widget:block-7 next")).toEqual([
            { kind: "text", text: "Inspect " },
            { kind: "mention", type: "widget", label: "block-7", id: "block-7" },
            { kind: "text", text: " next" },
        ]);
    });
});
