import { WebSocket } from "ws"

export const KRONOS_GATEWAY_WS_PATH = "/api/kronoscode/gateway"

const DEFAULT_MAX_QUEUED_BYTES = 256 * 1024

const getMessageByteLength = (data) => {
  if (Buffer.isBuffer(data)) return data.byteLength
  if (data instanceof ArrayBuffer) return data.byteLength
  if (ArrayBuffer.isView(data)) return data.byteLength
  if (Array.isArray(data)) return data.reduce((total, item) => total + getMessageByteLength(item), 0)
  return Buffer.byteLength(String(data), "utf8")
}

const getCloseReason = (reason) => {
  const value = Buffer.isBuffer(reason) ? reason.toString("utf8") : String(reason || "")
  return value.slice(0, 123)
}

const getCloseCode = (code, fallback = 1011) => {
  if (!Number.isInteger(code) || code < 1000 || code > 4999) return fallback
  if (code === 1004 || code === 1005 || code === 1006 || code === 1015) return fallback
  return code
}

export const buildKronosGatewayBrowserUrl = (ticket) => {
  const url = new URL(KRONOS_GATEWAY_WS_PATH, "http://kronoschamber.local")
  url.searchParams.set("ticket", ticket)
  return `${url.pathname}${url.search}`
}

export const buildKronosGatewayUpstreamUrl = (gatewayUrl, ticket) => {
  const url = new URL(gatewayUrl)
  if (url.protocol !== "http:" && url.protocol !== "https:" && url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error("Unsupported KronosCode gateway protocol")
  }
  if (url.protocol === "http:") url.protocol = "ws:"
  if (url.protocol === "https:") url.protocol = "wss:"
  url.searchParams.set("ticket", ticket)
  return url.toString()
}

export const bridgeKronosGatewaySockets = ({ client, upstream, maxQueuedBytes = DEFAULT_MAX_QUEUED_BYTES }) => {
  const queued = []
  let queuedBytes = 0
  let closed = false

  const closeClient = (code = 1011, reason = "KronosCode gateway unavailable") => {
    if (client.readyState !== WebSocket.OPEN && client.readyState !== WebSocket.CONNECTING) return
    try {
      client.close(getCloseCode(code), getCloseReason(reason))
    } catch {
      client.terminate?.()
    }
  }

  const closeUpstream = (code = 1000, reason = "KronosChamber client closed") => {
    if (upstream.readyState !== WebSocket.OPEN && upstream.readyState !== WebSocket.CONNECTING) return
    try {
      upstream.close(getCloseCode(code, 1000), getCloseReason(reason))
    } catch {
      upstream.terminate?.()
    }
  }

  client.on("message", (data, isBinary) => {
    if (closed) return
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(data, { binary: isBinary })
      return
    }
    if (upstream.readyState !== WebSocket.CONNECTING) {
      closeClient(1011, "KronosCode gateway disconnected")
      return
    }

    const byteLength = getMessageByteLength(data)
    if (queuedBytes + byteLength > maxQueuedBytes) {
      closed = true
      closeClient(1009, "Gateway startup queue exceeded")
      closeUpstream(1009, "Gateway startup queue exceeded")
      return
    }
    queued.push({ data, isBinary })
    queuedBytes += byteLength
  })

  upstream.on("open", () => {
    if (closed) return
    for (const message of queued) {
      if (upstream.readyState !== WebSocket.OPEN) break
      upstream.send(message.data, { binary: message.isBinary })
    }
    queued.length = 0
    queuedBytes = 0
  })

  upstream.on("message", (data, isBinary) => {
    if (closed || client.readyState !== WebSocket.OPEN) return
    client.send(data, { binary: isBinary })
  })

  client.on("close", (code, reason) => {
    if (closed) return
    closed = true
    closeUpstream(code, reason)
  })

  upstream.on("close", (code, reason) => {
    if (closed) return
    closed = true
    closeClient(code, reason || "KronosCode gateway closed")
  })

  client.on("error", () => {
    if (closed) return
    closed = true
    closeUpstream(1011, "KronosChamber client error")
  })

  upstream.on("error", () => {
    if (closed) return
    closed = true
    closeClient(1011, "KronosCode gateway connection failed")
  })
}

export const proxyKronosGatewayConnection = ({
  client,
  requestUrl,
  gatewayUrl,
  createUpstream = (url) => new WebSocket(url, { maxPayload: 8 * 1024 * 1024 }),
  maxQueuedBytes,
}) => {
  const request = new URL(requestUrl || KRONOS_GATEWAY_WS_PATH, "http://kronoschamber.local")
  const ticket = request.searchParams.get("ticket")
  if (!ticket) {
    client.close(1008, "Gateway ticket required")
    return null
  }

  const upstream = createUpstream(buildKronosGatewayUpstreamUrl(gatewayUrl, ticket))
  bridgeKronosGatewaySockets({ client, upstream, maxQueuedBytes })
  return upstream
}
