import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, hostname } from "node:os";
import { dirname, join } from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import { PhoneAgentBridge, PhoneControlError } from "./phoneagent-adapter.mjs";

const DefaultPort = 4119;
const DefaultUpstream = "http://127.0.0.1:3107";
const PairingWindowMs = 60_000;
const PairingCodeTtlMs = 15 * 60_000;
const TokenTtlMs = 30 * 24 * 60 * 60_000;
const UiTicketTtlMs = 12 * 60 * 60_000;
const MaxBodyBytes = 50 * 1024 * 1024;
const AllowedOrigins = new Set([
  "capacitor://localhost",
  "kronterm://localhost",
  "http://localhost:4174",
  "http://127.0.0.1:4174",
]);

const args = process.argv.slice(2);
const valueAfter = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const hasFlag = (flag) => args.includes(flag);

const listenHost = hasFlag("--lan") ? "0.0.0.0" : "127.0.0.1";
const developmentOpen = hasFlag("--dev-open");
const listenPort = Number.parseInt(valueAfter("--port", process.env.KRONLINK_PORT ?? String(DefaultPort)), 10);
const upstreamOrigin = valueAfter("--upstream", process.env.KRONTERM_CHAMBER_URL ?? DefaultUpstream).replace(/\/$/, "");
const phoneAgentHost = valueAfter("--phoneagent-host", process.env.PHONEAGENT_HOST ?? "127.0.0.1");
const phoneAgentPort = Number.parseInt(valueAfter("--phoneagent-port", process.env.PHONEAGENT_PORT ?? "45678"), 10);
const phoneAgentEnabled = !hasFlag("--disable-phoneagent");
const tokenStorePath = valueAfter(
  "--token-store",
  process.env.KRONLINK_TOKEN_STORE ?? join(homedir(), ".kronterm", "kronlink-tokens.json")
);
const pairingCode = valueAfter(
  "--code",
  process.env.KRONLINK_PAIR_CODE ?? String(randomInt(0, 1_000_000)).padStart(6, "0")
);
const pairingExpiresAt = Date.now() + PairingCodeTtlMs;

if (!Number.isFinite(listenPort) || listenPort < 1024 || listenPort > 65535) {
  throw new Error("--port must be between 1024 and 65535");
}
if (!Number.isFinite(phoneAgentPort) || phoneAgentPort < 1024 || phoneAgentPort > 65535) {
  throw new Error("--phoneagent-port must be between 1024 and 65535");
}
if (!/^\d{6}$/.test(pairingCode)) {
  throw new Error("--code must contain exactly six digits");
}
if (developmentOpen && listenHost !== "127.0.0.1") {
  throw new Error("--dev-open can only listen on 127.0.0.1");
}

const readTokenHashes = () => {
  try {
    const entries = JSON.parse(readFileSync(tokenStorePath, "utf8"));
    const now = Date.now();
    return new Map(
      Array.isArray(entries)
        ? entries.filter(
            (entry) =>
              Array.isArray(entry) && typeof entry[0] === "string" && Number.isFinite(entry[1]) && entry[1] > now
          )
        : []
    );
  } catch {
    return new Map();
  }
};

const tokenHashes = readTokenHashes();
const pairAttempts = new Map();
const gatewayTargets = new Map();
const uiTickets = new Map();
const phoneAgent = phoneAgentEnabled ? new PhoneAgentBridge({ host: phoneAgentHost, port: phoneAgentPort }) : null;
const hash = (value) => createHash("sha256").update(value).digest();
const safeEqual = (left, right) => timingSafeEqual(hash(left), hash(right));

const saveTokenHashes = () => {
  mkdirSync(dirname(tokenStorePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${tokenStorePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify([...tokenHashes.entries()]), { mode: 0o600 });
  renameSync(temporaryPath, tokenStorePath);
  chmodSync(tokenStorePath, 0o600);
};

const responseHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

const json = (response, statusCode, payload) => {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    ...responseHeaders,
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
};

const setCors = (request, response) => {
  const origin = request.headers.origin;
  if (!origin) {
    return true;
  }
  if (!AllowedOrigins.has(origin)) {
    return false;
  }
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  return true;
};

const readBody = async (request) => {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MaxBodyBytes) {
      throw new Error("Request body is too large");
    }
    chunks.push(chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
};

const readJson = async (request) => {
  const body = await readBody(request);
  return body?.length ? JSON.parse(body.toString("utf8")) : {};
};

const issueToken = () => {
  const token = randomBytes(32).toString("base64url");
  tokenHashes.set(hash(token).toString("hex"), Date.now() + TokenTtlMs);
  saveTokenHashes();
  return token;
};

const issueUiTicket = () => {
  const ticket = randomBytes(24).toString("base64url");
  const expiresAt = Date.now() + UiTicketTtlMs;
  uiTickets.set(ticket, expiresAt);
  return { ticket, expiresAt };
};

const isValidUiTicket = (ticket) => {
  const expiresAt = uiTickets.get(ticket);
  if (!expiresAt || expiresAt < Date.now()) {
    uiTickets.delete(ticket);
    return false;
  }
  return true;
};

const isAuthorized = (request) => {
  if (developmentOpen && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress)) {
    return true;
  }
  const authorization = request.headers.authorization ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return false;
  }
  const token = authorization.slice("Bearer ".length);
  const key = hash(token).toString("hex");
  const expiresAt = tokenHashes.get(key);
  if (!expiresAt) {
    return false;
  }
  if (expiresAt < Date.now()) {
    tokenHashes.delete(key);
    saveTokenHashes();
    return false;
  }
  return true;
};

const isLoopbackRequest = (request) =>
  ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress);

const hostCapabilities = async () => {
  const capabilities = ["kronoscode", "browser", "sandbox", "terminal", "files", "apps"];
  if (phoneAgent && (await phoneAgent.status()).available) {
    capabilities.push("phone-control");
  }
  return capabilities;
};

const canAttemptPair = (request) => {
  const address = request.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const recent = (pairAttempts.get(address) ?? []).filter((timestamp) => now - timestamp < PairingWindowMs);
  recent.push(now);
  pairAttempts.set(address, recent);
  return recent.length <= 5;
};

const upstreamHeaders = (request, body) => ({
  Accept: typeof request.headers.accept === "string" ? request.headers.accept : "application/json",
  ...(body
    ? {
        "Content-Type":
          typeof request.headers["content-type"] === "string" ? request.headers["content-type"] : "application/json",
      }
    : {}),
  ...(process.env.KRONTERM_CHAMBER_AUTH ? { Authorization: process.env.KRONTERM_CHAMBER_AUTH } : {}),
  ...(process.env.KRONTERM_CHAMBER_COOKIE ? { Cookie: process.env.KRONTERM_CHAMBER_COOKIE } : {}),
  ...(process.env.KRONTERM_CHAMBER_X_AUTHKEY ? { "x-authkey": process.env.KRONTERM_CHAMBER_X_AUTHKEY } : {}),
});

const proxyHttp = async (request, response, pathname, routePrefix = "") => {
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await readBody(request);
  const upstreamResponse = await fetch(`${upstreamOrigin}${pathname}`, {
    method: request.method,
    headers: upstreamHeaders(request, body),
    body,
    signal: AbortSignal.timeout(15 * 60_000),
  });
  const contentType = upstreamResponse.headers.get("content-type") ?? "application/octet-stream";
  if (contentType.includes("text/event-stream") && upstreamResponse.body) {
    response.writeHead(upstreamResponse.status, {
      ...responseHeaders,
      "Content-Type": contentType,
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    for await (const chunk of upstreamResponse.body) {
      if (!response.write(Buffer.from(chunk))) {
        await new Promise((resolve) => response.once("drain", resolve));
      }
    }
    response.end();
    return;
  }
  let responseBody = Buffer.from(await upstreamResponse.arrayBuffer());
  if (pathname.startsWith("/api/kronoscode/gateway-ticket") && contentType.includes("application/json")) {
    const ticket = JSON.parse(responseBody.toString("utf8"));
    if (typeof ticket.wsUrl === "string") {
      const upstreamWebSocketUrl = new URL(ticket.wsUrl, upstreamOrigin);
      const gatewayTicket = upstreamWebSocketUrl.searchParams.get("ticket");
      if (gatewayTicket) {
        gatewayTargets.set(gatewayTicket, {
          url: upstreamWebSocketUrl.toString(),
          expiresAt: Number(ticket.expiresAt) || Date.now() + 60_000,
        });
      }
      ticket.wsUrl = `${routePrefix}${upstreamWebSocketUrl.pathname}${upstreamWebSocketUrl.search}`;
      responseBody = Buffer.from(JSON.stringify(ticket));
    }
  }
  response.writeHead(upstreamResponse.status, {
    ...responseHeaders,
    "Content-Type": contentType,
    "Content-Length": responseBody.length,
  });
  response.end(responseBody);
};

const checkUpstream = async () => {
  try {
    const response = await fetch(`${upstreamOrigin}/health`, {
      headers: upstreamHeaders({ headers: {} }, undefined),
      signal: AbortSignal.timeout(3_000),
    });
    return response.ok;
  } catch {
    return false;
  }
};

const server = createServer(async (request, response) => {
  try {
    if (!setCors(request, response)) {
      return json(response, 403, { error: "Origin is not allowed" });
    }
    if (request.method === "OPTIONS") {
      response.writeHead(204, responseHeaders);
      return response.end();
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (request.method === "GET" && url.pathname === "/health") {
      const [connected, phoneControl] = await Promise.all([
        checkUpstream(),
        phoneAgent?.status() ?? Promise.resolve({ available: false, provider: "disabled" }),
      ]);
      return json(response, connected || phoneControl.available ? 200 : 503, {
        connected,
        ready: connected,
        engine: "KronosCode",
        service: "KronLink Host",
        hostName: hostname(),
        detail: connected
          ? "KronosChamber is ready"
          : phoneControl.available
            ? "Phone control is ready; KronosChamber is unavailable"
            : "KronosChamber is unavailable",
        capabilities: await hostCapabilities(),
        phoneControl,
      });
    }

    if (request.method === "POST" && url.pathname === "/v1/pair") {
      if (!canAttemptPair(request)) {
        return json(response, 429, { error: "Too many pairing attempts" });
      }
      if (Date.now() > pairingExpiresAt) {
        return json(response, 410, { error: "Pairing code expired; restart the connector" });
      }
      const body = await readJson(request);
      if (typeof body.code !== "string" || !safeEqual(body.code, pairingCode)) {
        return json(response, 401, { error: "Pairing code is incorrect" });
      }
      return json(response, 200, {
        token: issueToken(),
        hostName: hostname(),
        expiresAt: Date.now() + TokenTtlMs,
        capabilities: await hostCapabilities(),
      });
    }

    const internalPhoneRoute = url.pathname.startsWith("/internal/phone/");
    const mobilePhoneRoute = url.pathname.startsWith("/v1/phone/");
    if (internalPhoneRoute || mobilePhoneRoute) {
      if (!phoneAgent) {
        return json(response, 503, { error: "PhoneAgent integration is disabled", code: "phoneagent_disabled" });
      }
      if (internalPhoneRoute && !isLoopbackRequest(request)) {
        return json(response, 403, { error: "Internal phone tools are loopback-only" });
      }
      if (mobilePhoneRoute && !isAuthorized(request)) {
        return json(response, 401, { error: "Pair this computer again" });
      }
      const route = url.pathname.replace(/^\/(?:internal|v1)\/phone\//, "");
      if (request.method === "GET" && route === "status") {
        return json(response, 200, await phoneAgent.status());
      }
      if (request.method === "GET" && route === "context") {
        const actor = internalPhoneRoute ? "kronoscode" : "iphone-user";
        return json(response, 200, await phoneAgent.execute({ method: "get_context", actor }));
      }
      if (request.method === "GET" && route === "audit") {
        return json(response, 200, { events: phoneAgent.auditSnapshot() });
      }
      if (request.method === "POST" && route === "lease" && mobilePhoneRoute) {
        const body = await readJson(request);
        return json(response, 200, phoneAgent.grantLease(body.durationMs, "iphone-user"));
      }
      if (request.method === "DELETE" && route === "lease" && mobilePhoneRoute) {
        return json(response, 200, phoneAgent.releaseLease("iphone-user"));
      }
      if (request.method === "POST" && route === "action") {
        const body = await readJson(request);
        const actor = internalPhoneRoute ? "kronoscode" : "iphone-user";
        return json(
          response,
          200,
          await phoneAgent.execute({
            method: body.method,
            params: body.params,
            actor,
            confirmCritical: body.confirmCritical === true && mobilePhoneRoute,
          })
        );
      }
      return json(response, 404, { error: "Phone control route not found" });
    }

    if (request.method === "POST" && url.pathname === "/v1/ui-ticket") {
      if (!isAuthorized(request)) {
        return json(response, 401, { error: "Pair this computer again" });
      }
      const body = await readJson(request);
      const { ticket, expiresAt } = issueUiTicket();
      const routePrefix = `/mobile/${ticket}`;
      const params = new URLSearchParams({
        apiBaseUrl: `${routePrefix}/api`,
        embeddedHost: "kronterm",
        mobileShell: "iphone",
        route: "chat",
        surface: "page",
        layoutMode: "full-page",
        profile: "chat-shell",
      });
      if (typeof body.sessionId === "string" && body.sessionId.trim()) {
        params.set("currentSessionId", body.sessionId.trim());
      }
      if (typeof body.surfaceId === "string" && body.surfaceId.trim()) {
        params.set("surfaceId", body.surfaceId.trim());
      }
      return json(response, 200, {
        url: `${routePrefix}/?${params.toString()}`,
        expiresAt,
      });
    }

    const mobileRoute = url.pathname.match(/^\/mobile\/([A-Za-z0-9_-]+)(\/.*)?$/);
    if (mobileRoute) {
      const [, ticket, requestedPath = "/"] = mobileRoute;
      if (!isValidUiTicket(ticket)) {
        return json(response, 401, { error: "Mobile UI session expired" });
      }
      const routePrefix = `/mobile/${ticket}`;
      await proxyHttp(request, response, `${requestedPath}${url.search}`, routePrefix);
      return;
    }

    const publicUiAsset =
      (request.method === "GET" || request.method === "HEAD") &&
      (/^\/(?:assets|branding)\//.test(url.pathname) ||
        /^\/(?:apple-touch-icon|favicon|logo-|pwa-|site\.webmanifest|manifest\.webmanifest|sw\.js)/.test(url.pathname));
    if (publicUiAsset) {
      await proxyHttp(request, response, `${url.pathname}${url.search}`);
      return;
    }

    if (!url.pathname.startsWith("/api/")) {
      return json(response, 404, { error: "Route not found" });
    }
    if (!isAuthorized(request)) {
      return json(response, 401, { error: "Pair this computer again" });
    }
    await proxyHttp(request, response, `${url.pathname}${url.search}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!response.headersSent) {
      if (error instanceof PhoneControlError) {
        json(response, error.statusCode, { error: message, code: error.code, ...error.detail });
      } else {
        json(response, /too large/i.test(message) ? 413 : 502, { error: message });
      }
    } else {
      response.destroy();
    }
  }
});

const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024 });
const safeCloseCode = (code, fallback) =>
  Number.isInteger(code) && code >= 1000 && code <= 4999 && ![1004, 1005, 1006, 1015].includes(code) ? code : fallback;

server.on("upgrade", (request, socket, head) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const mobileRoute = requestUrl.pathname.match(
    /^\/mobile\/([A-Za-z0-9_-]+)(\/(?:global\/gateway|api\/kronoscode\/gateway))$/
  );
  const mobileTicketValid = mobileRoute ? isValidUiTicket(mobileRoute[1]) : false;
  const gatewayPath = mobileRoute
    ? mobileTicketValid
    : requestUrl.pathname === "/global/gateway" || requestUrl.pathname === "/api/kronoscode/gateway";
  const gatewayTicket = requestUrl.searchParams.get("ticket");
  const target = gatewayTicket ? gatewayTargets.get(gatewayTicket) : undefined;
  if (!gatewayPath || !target || target.expiresAt < Date.now()) {
    if (gatewayTicket) {
      gatewayTargets.delete(gatewayTicket);
    }
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  webSocketServer.handleUpgrade(request, socket, head, (client) => {
    const upstream = new WebSocket(target.url, { maxPayload: 8 * 1024 * 1024 });
    const queued = [];

    client.on("message", (data, binary) => {
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(data, { binary });
      } else if (upstream.readyState === WebSocket.CONNECTING) {
        queued.push({ data, binary });
      }
    });
    upstream.on("open", () => {
      for (const message of queued.splice(0)) {
        upstream.send(message.data, { binary: message.binary });
      }
    });
    upstream.on("message", (data, binary) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data, { binary });
      }
    });
    client.on("close", (code, reason) => {
      if (upstream.readyState < WebSocket.CLOSING) {
        upstream.close(safeCloseCode(code, 1000), reason.toString().slice(0, 120));
      }
    });
    upstream.on("close", (code, reason) => {
      if (client.readyState < WebSocket.CLOSING) {
        client.close(safeCloseCode(code, 1011), reason.toString().slice(0, 120));
      }
    });
    client.on("error", () => upstream.close(1011, "Phone gateway failed"));
    upstream.on("error", (error) => {
      console.warn(`KronLink gateway failed: ${error.message}`);
      client.close(1011, "KronosCode gateway failed");
    });
  });
});

server.listen(listenPort, listenHost, () => {
  const displayHost = listenHost === "0.0.0.0" ? "<this-computer-ip>" : listenHost;
  console.log(`KronLink Host: http://${displayHost}:${listenPort}`);
  console.log(
    developmentOpen ? "Authorization: loopback development mode" : `Pairing code: ${pairingCode} (expires in 15 minutes)`
  );
  console.log(`KronosChamber: ${upstreamOrigin}`);
  console.log(
    phoneAgent
      ? `PhoneAgent: auto-detecting ${phoneAgentHost}:${phoneAgentPort}`
      : "PhoneAgent: disabled"
  );
});
