import { randomUUID } from "node:crypto";
import { createConnection } from "node:net";

const DefaultHost = "127.0.0.1";
const DefaultPort = 45678;
const DefaultTimeoutMs = 30_000;
const MaxResponseBytes = 12 * 1024 * 1024;
const MaxAuditEvents = 200;
const MaxLeaseMs = 2 * 60_000;

export const PhoneAgentTools = Object.freeze({
    get_tree: { risk: "read", score: 1, mutating: false, verify: false },
    get_screen_image: { risk: "read", score: 1, mutating: false, verify: false },
    get_context: { risk: "read", score: 1, mutating: false, verify: false },
    open_app: { risk: "navigation", score: 4, mutating: true, verify: true },
    tap: { risk: "interaction", score: 5, mutating: true, verify: true },
    tap_element: { risk: "interaction", score: 5, mutating: true, verify: true },
    enter_text: { risk: "sensitive-input", score: 7, mutating: true, verify: true },
    scroll: { risk: "interaction", score: 3, mutating: true, verify: true },
    swipe: { risk: "interaction", score: 3, mutating: true, verify: true },
    stop: { risk: "critical", score: 9, mutating: true, verify: false, critical: true },
});

export class PhoneControlError extends Error {
    constructor(code, message, statusCode = 400, detail = {}) {
        super(message);
        this.name = "PhoneControlError";
        this.code = code;
        this.statusCode = statusCode;
        this.detail = detail;
    }
}

export class PhoneAgentBridge {
    constructor({ host = DefaultHost, port = DefaultPort, timeoutMs = DefaultTimeoutMs } = {}) {
        this.host = host;
        this.port = port;
        this.timeoutMs = timeoutMs;
        this.nextRequestId = 0;
        this.lease = null;
        this.auditEvents = [];
    }

    async status() {
        const available = await new Promise((resolve) => {
            const socket = createConnection({ host: this.host, port: this.port });
            const timer = setTimeout(() => {
                socket.destroy();
                resolve(false);
            }, Math.min(this.timeoutMs, 2_000));
            socket.once("connect", () => {
                clearTimeout(timer);
                socket.end();
                resolve(true);
            });
            socket.once("error", () => {
                clearTimeout(timer);
                resolve(false);
            });
        });
        return {
            available,
            provider: "PhoneAgent",
            endpoint: `${this.host}:${this.port}`,
            capabilities: Object.keys(PhoneAgentTools),
            lease: this.leaseStatus(),
            foundations: {
                execution: "PhoneAgent JSON-RPC",
                verification: "Qalti-style observe, act, verify",
                policy: "iGentic-inspired local approval and metadata-only audit",
            },
        };
    }

    grantLease(durationMs = MaxLeaseMs, actor = "iphone-user") {
        const duration = Math.max(1_000, Math.min(Number(durationMs) || MaxLeaseMs, MaxLeaseMs));
        this.lease = {
            id: randomUUID(),
            actor,
            grantedAt: Date.now(),
            expiresAt: Date.now() + duration,
        };
        this.recordAudit("lease_granted", { actor, risk: "approval", score: 0, outcome: "allowed" });
        return this.leaseStatus();
    }

    releaseLease(actor = "iphone-user") {
        if (this.lease) {
            this.recordAudit("lease_released", { actor, risk: "approval", score: 0, outcome: "allowed" });
        }
        this.lease = null;
        return this.leaseStatus();
    }

    leaseStatus() {
        if (this.lease?.expiresAt <= Date.now()) {
            this.lease = null;
        }
        return this.lease
            ? { active: true, id: this.lease.id, actor: this.lease.actor, expiresAt: this.lease.expiresAt }
            : { active: false };
    }

    auditSnapshot() {
        return [...this.auditEvents];
    }

    async execute({ method, params = {}, actor = "kronoscode", confirmCritical = false }) {
        const definition = PhoneAgentTools[method];
        if (!definition) {
            this.recordAudit(method, { actor, risk: "unsupported", score: 10, outcome: "blocked" });
            throw new PhoneControlError(
                "unsupported_tool",
                `PhoneAgent method '${method}' is not exposed to KronTerm`,
                400
            );
        }
        const lease = this.leaseStatus();
        if (definition.mutating && !lease.active) {
            this.recordAudit(method, {
                actor,
                risk: definition.risk,
                score: definition.score,
                outcome: "approval_required",
            });
            throw new PhoneControlError(
                "approval_required",
                "Open the phone surface and enable Control for a short-lived approval lease",
                409,
                { risk: definition.risk, riskScore: definition.score }
            );
        }
        if (definition.critical && !confirmCritical) {
            this.recordAudit(method, {
                actor,
                risk: definition.risk,
                score: definition.score,
                outcome: "approval_required",
            });
            throw new PhoneControlError(
                "critical_confirmation_required",
                "Stopping the PhoneAgent bridge requires explicit confirmation",
                409,
                { risk: definition.risk, riskScore: definition.score }
            );
        }

        try {
            const result = await this.call(method, params);
            const verification = definition.verify ? await this.call("get_context", {}) : undefined;
            this.recordAudit(method, {
                actor,
                risk: definition.risk,
                score: definition.score,
                outcome: "completed",
            });
            return {
                result,
                verification,
                policy: {
                    allowed: true,
                    approvalLease: definition.mutating ? this.leaseStatus() : { active: false },
                    risk: definition.risk,
                    riskScore: definition.score,
                },
            };
        } catch (error) {
            this.recordAudit(method, {
                actor,
                risk: definition.risk,
                score: definition.score,
                outcome: "failed",
            });
            throw error;
        }
    }

    call(method, params = {}) {
        const id = ++this.nextRequestId;
        const request = `${JSON.stringify({ id, method, params })}\n`;
        return new Promise((resolve, reject) => {
            const socket = createConnection({ host: this.host, port: this.port });
            let settled = false;
            let response = "";
            const finish = (callback, value) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                socket.destroy();
                callback(value);
            };
            const timer = setTimeout(
                () => finish(reject, new PhoneControlError("rpc_timeout", `${method} timed out`, 504)),
                this.timeoutMs
            );
            socket.setEncoding("utf8");
            socket.once("connect", () => socket.write(request));
            socket.on("data", (chunk) => {
                response += chunk;
                if (Buffer.byteLength(response) > MaxResponseBytes) {
                    finish(reject, new PhoneControlError("response_too_large", "PhoneAgent response is too large", 502));
                    return;
                }
                const newline = response.indexOf("\n");
                if (newline < 0) {
                    return;
                }
                try {
                    const payload = JSON.parse(response.slice(0, newline));
                    if (payload.error) {
                        finish(
                            reject,
                            new PhoneControlError(
                                "phoneagent_rpc_error",
                                payload.error.message || "PhoneAgent action failed",
                                502
                            )
                        );
                        return;
                    }
                    finish(resolve, payload.result ?? {});
                } catch (error) {
                    finish(reject, new PhoneControlError("invalid_rpc_response", error.message, 502));
                }
            });
            socket.once("error", (error) => {
                finish(
                    reject,
                    new PhoneControlError(
                        "phoneagent_unavailable",
                        `PhoneAgent is unavailable at ${this.host}:${this.port}: ${error.message}`,
                        503
                    )
                );
            });
            socket.once("end", () => {
                if (!settled) {
                    finish(reject, new PhoneControlError("empty_rpc_response", "PhoneAgent returned no response", 502));
                }
            });
        });
    }

    recordAudit(method, { actor, risk, score, outcome }) {
        this.auditEvents.push({
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            method,
            actor,
            risk,
            riskScore: score,
            outcome,
        });
        this.auditEvents = this.auditEvents.slice(-MaxAuditEvents);
    }
}
