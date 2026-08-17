import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { waitForManagedServerProcess } from "./managed-process.js";

function makeChild() {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kills = [];
    child.kill = (signal) => {
        child.kills.push(signal);
        return true;
    };
    return child;
}

describe("managed KronosCode process", () => {
    it("continues draining stdout and stderr after the ready line", async () => {
        const child = makeChild();
        const ready = waitForManagedServerProcess(child, { timeoutMs: 100 });

        child.stdout.write("kronoscode server listening on http://127.0.0.1:4096\n");

        expect(await ready).toBe("http://127.0.0.1:4096");
        expect(child.stdout.listenerCount("data")).toBeGreaterThan(0);
        expect(child.stderr.listenerCount("data")).toBeGreaterThan(0);

        child.stdout.write(Buffer.alloc(256 * 1024, "x"));
        child.stderr.write(Buffer.alloc(256 * 1024, "y"));
        expect(child.stdout.writableLength).toBe(0);
        expect(child.stderr.writableLength).toBe(0);
    });

    it("terminates a child that never reaches the ready line", async () => {
        const child = makeChild();

        await expect(waitForManagedServerProcess(child, { timeoutMs: 5 })).rejects.toThrow(
            "Timeout waiting for KronosCode to start after 5ms"
        );
        expect(child.kills).toEqual(["SIGTERM"]);
        expect(child.stdout.listenerCount("data")).toBe(0);
        expect(child.stderr.listenerCount("data")).toBe(0);
    });
});
