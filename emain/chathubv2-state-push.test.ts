import { describe, expect, it } from "vitest";
import {
    chathubV2StatePushKey,
    classifyChathubLogLine,
    makeChathubLogLine,
    redactSecrets,
    shouldEmitStatePush,
} from "./chathubv2-state-push";

describe("chathubv2 log classification", () => {
    it("marks explicit failures as errors on either stream", () => {
        expect(classifyChathubLogLine("backend exited with error code 1", "out")).toBe("error");
        expect(classifyChathubLogLine("Unhandled promise rejection", "err")).toBe("error");
        expect(classifyChathubLogLine("FATAL: cannot bind port", "out")).toBe("error");
    });

    it("treats warnings as warnings on stdout but escalates them on stderr", () => {
        expect(classifyChathubLogLine("deprecated API used", "out")).toBe("warn");
        expect(classifyChathubLogLine("warning: retrying", "out")).toBe("warn");
        expect(classifyChathubLogLine("warning: retrying", "err")).toBe("error");
    });

    it("defaults plain stdout lines to info and stderr lines to warn", () => {
        expect(classifyChathubLogLine("listening on port 3107", "out")).toBe("info");
        expect(classifyChathubLogLine("something went to stderr", "err")).toBe("warn");
    });

    it("redacts JWT-shaped secrets and trims the line", () => {
        const token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c";
        const result = makeChathubLogLine(`  auth failed for ${token}  `, "out", 123);
        expect(result.line).toBe("auth failed for [redacted-jwt]");
        expect(result.level).toBe("error");
        expect(result.ts).toBe(123);
    });
});

describe("chathubv2 state push dedupe", () => {
    it("emits the first push always", () => {
        expect(shouldEmitStatePush(null, { status: "starting" })).toBe(true);
    });

    it("suppresses identical transitions even when health timestamps move", () => {
        const first = { status: "ready" as const, url: "http://127.0.0.1:3107", health: { status: "ready" } };
        const second = { status: "ready" as const, url: "http://127.0.0.1:3107", health: { status: "ready" } };
        expect(chathubV2StatePushKey(first)).toEqual(chathubV2StatePushKey(second));
        expect(shouldEmitStatePush(first, second)).toBe(false);
    });

    it("emits when the transition actually changes", () => {
        const ready = { status: "ready" as const, url: "http://127.0.0.1:3107" };
        const errored = { status: "error" as const, error: "port busy" };
        expect(shouldEmitStatePush(ready, errored)).toBe(true);
        expect(shouldEmitStatePush({ status: "starting" }, { status: "starting", url: undefined })).toBe(false);
    });
});
