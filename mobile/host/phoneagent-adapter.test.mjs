import assert from "node:assert/strict";
import { createServer } from "node:net";
import { after, before, test } from "node:test";
import { PhoneAgentBridge } from "./phoneagent-adapter.mjs";

let server;
let port;
const calls = [];

before(async () => {
    server = createServer((socket) => {
        let buffer = "";
        socket.setEncoding("utf8");
        socket.on("data", (chunk) => {
            buffer += chunk;
            const newline = buffer.indexOf("\n");
            if (newline < 0) {
                return;
            }
            const request = JSON.parse(buffer.slice(0, newline));
            calls.push(request);
            const result =
                request.method === "get_context"
                    ? { tree: "Application {{0, 0}, {393, 852}}", screenshot_base64: "cG5n", metadata: { width: 1179, height: 2556 } }
                    : { method: request.method, ok: true };
            socket.end(`${JSON.stringify({ id: request.id, result })}\n`);
        });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = server.address().port;
});

after(async () => {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test("read-only phone context works without a control lease", async () => {
    const bridge = new PhoneAgentBridge({ port });
    const status = await bridge.status();
    const result = await bridge.execute({ method: "get_context", actor: "kronoscode" });

    assert.equal(status.available, true);
    assert.equal(result.result.tree.includes("393"), true);
});

test("mutating actions require a short-lived user control lease and are verified", async () => {
    const bridge = new PhoneAgentBridge({ port });

    await assert.rejects(
        bridge.execute({ method: "tap", params: { x: 20, y: 30 }, actor: "kronoscode" }),
        (error) => error.code === "approval_required"
    );

    bridge.grantLease(60_000, "iphone-user");
    const response = await bridge.execute({
        method: "tap",
        params: { x: 20, y: 30 },
        actor: "kronoscode",
    });

    assert.equal(response.result.method, "tap");
    assert.equal(response.verification.tree.includes("Application"), true);
    assert.equal(calls.at(-1).method, "get_context");
});

test("secrets and duplicate agent brains are not exposed as tools or audit payloads", async () => {
    const bridge = new PhoneAgentBridge({ port });
    bridge.grantLease(60_000, "iphone-user");

    await assert.rejects(
        bridge.execute({ method: "set_api_key", params: { api_key: "secret-value" }, actor: "kronoscode" }),
        (error) => error.code === "unsupported_tool"
    );
    await bridge.execute({
        method: "enter_text",
        params: { coordinate: "{{10, 10}, {20, 20}}", text: "private text" },
        actor: "kronoscode",
    });

    const serializedAudit = JSON.stringify(bridge.auditSnapshot());
    assert.equal(serializedAudit.includes("private text"), false);
    assert.equal(serializedAudit.includes("secret-value"), false);
});
