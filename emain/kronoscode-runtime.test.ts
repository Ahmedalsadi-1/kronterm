import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
    getKronosCodeBinaryCandidates,
    isKronosCodeLoopbackUrl,
    KronosCodeRuntimeManager,
    validateKronosCodeEndpoint,
    withKronosCodeAttachArgs,
} from "./kronoscode-runtime";

const servers: http.Server[] = [];
const managers: KronosCodeRuntimeManager[] = [];

function healthPayload(protocolVersion = "1.0") {
    return {
        healthy: true,
        version: "test",
        protocolVersion,
        serverInstanceId: "test-instance",
        capabilities: {
            gateway: true,
            replay: true,
            asyncPrompt: true,
            promptIdempotency: true,
            pagedHistory: true,
        },
    };
}

async function startHealthServer(
    handler: (request: http.IncomingMessage) => { status?: number; body?: unknown } = () => ({
        body: healthPayload(),
    })
): Promise<string> {
    const server = http.createServer((request, response) => {
        const result = handler(request);
        response.writeHead(result.status ?? 200, { "content-type": "application/json" });
        response.end(JSON.stringify(result.body ?? healthPayload()));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
    for (const manager of managers.splice(0)) {
        manager.stop();
    }
    await Promise.all(
        servers.splice(0).map(
            (server) =>
                new Promise<void>((resolve) => {
                    server.close(() => resolve());
                })
        )
    );
});

describe("KronosCode runtime manager", () => {
    it("enforces endpoint transport policy", () => {
        expect(validateKronosCodeEndpoint("http://127.0.0.1:4096").hostname).toBe("127.0.0.1");
        expect(validateKronosCodeEndpoint("https://backend.example.com").protocol).toBe("https:");
        expect(() => validateKronosCodeEndpoint("http://backend.example.com")).toThrow(
            "Non-loopback KronosCode endpoints require TLS"
        );
        expect(() => validateKronosCodeEndpoint("ws://127.0.0.1:4096")).toThrow(
            "KronosCode endpoint must use http or https"
        );
        expect(isKronosCodeLoopbackUrl("http://127.0.0.1:4096")).toBe(true);
        expect(isKronosCodeLoopbackUrl("https://backend.example.com")).toBe(false);
    });

    it("keeps binary override precedence and replaces stale ACP attach arguments", () => {
        const candidates = getKronosCodeBinaryCandidates("/tmp/kronoscode-override");
        expect(candidates[0]).toBe("/tmp/kronoscode-override");
        expect(new Set(candidates).size).toBe(candidates.length);
        expect(withKronosCodeAttachArgs(["acp", "--attach", "http://old", "--verbose"], "http://new")).toEqual([
            "acp",
            "--verbose",
            "--attach",
            "http://new",
        ]);
    });

    it("single-flights external validation and never owns the external process", async () => {
        let healthRequests = 0;
        const endpoint = await startHealthServer(() => {
            healthRequests += 1;
            return { body: healthPayload() };
        });
        const manager = new KronosCodeRuntimeManager();
        managers.push(manager);
        const config = {
            settings: {
                "kronoscode:endpoint": endpoint,
                "kronoscode:username": "kronoscode",
            },
        } as FullConfigType;

        const [first, second] = await Promise.all([manager.ensure(config), manager.ensure(config)]);

        expect(first).toEqual(second);
        expect(first.managed).toBe(false);
        expect(healthRequests).toBe(1);
        manager.stop();
        expect((await fetch(`${endpoint}/global/health`)).ok).toBe(true);
    });

    it("authenticates health checks and retains a working connection after failed re-homing", async () => {
        const authorization = `Basic ${Buffer.from("alice:secret").toString("base64")}`;
        const endpoint = await startHealthServer((request) => ({
            status: request.headers.authorization === authorization ? 200 : 401,
            body: request.headers.authorization === authorization ? healthPayload() : { error: "unauthorized" },
        }));
        const invalidEndpoint = await startHealthServer(() => ({ body: healthPayload("0.9") }));
        const manager = new KronosCodeRuntimeManager();
        managers.push(manager);

        const working = await manager.applyConnection({
            endpoint,
            username: "alice",
            password: "secret",
        });
        await expect(
            manager.applyConnection({
                endpoint: invalidEndpoint,
                username: "alice",
                password: "secret",
            })
        ).rejects.toThrow("required KronosCode desktop protocol");

        expect(manager.descriptor).toEqual(working);
    });

    it("times out stalled API requests", async () => {
        const server = http.createServer((request, response) => {
            if (request.url === "/global/health") {
                response.writeHead(200, { "content-type": "application/json" });
                response.end(JSON.stringify(healthPayload()));
            }
        });
        servers.push(server);
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
        const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        const manager = new KronosCodeRuntimeManager(25);
        managers.push(manager);
        await manager.applyConnection({ endpoint, username: "kronoscode" });

        await expect(manager.api({ path: "/stalled" })).rejects.toThrow(/timeout|aborted/i);
    });
});
