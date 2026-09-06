import crypto from "crypto"
import express from "express"
import { createAnthropic } from "@ai-sdk/anthropic"
import { generateText, tool } from "ai"
import {
  createSandboxMcpRecord,
  destroySandboxMcpRecord,
  executeSandboxMcpAction,
  isSandboxMcpProvider,
  refreshSandboxMcpRecord,
} from "./sandbox-mcp-provider.js"

const router = express.Router()

const RESOLUTION = [1024, 768]
const DEFAULT_MODEL = "claude-sonnet-4-20250514"
const MAX_COMMAND_OUTPUT = 20_000
const DEFAULT_SANDBOX_PROVIDER = "sandbox-mcp"

const BROKER_ENABLED_BY_DEFAULT = process.env.OPENCHAMBER_DESKTOP_SANDBOX_USE_BROKER !== "false"
const BROKER_FALLBACK_ENABLED = process.env.OPENCHAMBER_DESKTOP_SANDBOX_BROKER_FALLBACK !== "false"
const BROKER_POLL_INTERVAL_MS = (() => {
  const raw = Number(process.env.OPENCHAMBER_DESKTOP_SANDBOX_BROKER_POLL_INTERVAL_MS)
  if (!Number.isFinite(raw) || raw <= 0) return 500
  return Math.max(200, Math.min(5000, Math.round(raw)))
})()
const BROKER_POLL_TIMEOUT_MS = (() => {
  const raw = Number(process.env.OPENCHAMBER_DESKTOP_SANDBOX_BROKER_POLL_TIMEOUT_MS)
  if (!Number.isFinite(raw) || raw <= 0) return 45_000
  return Math.max(5000, Math.min(180_000, Math.round(raw)))
})()
const OPENCHAMBER_SESSION_COOKIE = process.env.OPENCHAMBER_UI_SESSION_COOKIE || "oc_ui_session"

/** @type {Map<string, {
 * id: string
 * provider: "sandbox-mcp"
 * status: "starting" | "running" | "stopping" | "stopped" | "error"
 * createdAt: number
 * destroyedAt?: number
 * connectionUrl?: string
 * streamUrl?: string
 * terminalUrl?: string
 * streamAuthKey?: string
 * lastError?: string
 * sandbox: unknown | null
 * }>} */
const sandboxes = new Map()

const getSandbox = (id) => sandboxes.get(id) || null

const serializeSandbox = (sandbox) => ({
  id: sandbox.id,
  provider: sandbox.provider,
  status: sandbox.status,
  createdAt: sandbox.createdAt,
  destroyedAt: sandbox.destroyedAt,
  connectionUrl: sandbox.connectionUrl,
  streamUrl: sandbox.streamUrl,
  terminalUrl: sandbox.terminalUrl,
  resolution: sandbox.resolution,
  capabilities: {
    browser: true,
    desktop: true,
    terminal: true,
    computer: true,
    bash: true,
    screenshots: true,
  },
  lastError: sandbox.lastError,
})

const parseCoordinate = (coordinate, label = "coordinate") => {
  if (!Array.isArray(coordinate) || coordinate.length < 2) {
    throw new Error(`${label} requires [x, y]`)
  }

  const [x, y] = coordinate
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} must contain finite numeric values`)
  }

  return [Math.round(x), Math.round(y)]
}

const resolveSandboxProvider = (value) => {
  if (typeof value !== "string") return DEFAULT_SANDBOX_PROVIDER
  return value.trim().toLowerCase() === "sandbox-mcp" ? "sandbox-mcp" : DEFAULT_SANDBOX_PROVIDER
}

const requireRunningSandbox = (sandboxId) => {
  const record = getSandbox(sandboxId)
  if (!record) {
    return { error: { status: 404, message: "Sandbox not found" }, sandbox: null }
  }

  if (record.status !== "running") {
    return { error: { status: 404, message: "Sandbox not running" }, sandbox: null }
  }

  if (!isSandboxMcpProvider(record.provider) && !record.sandbox) {
    return { error: { status: 404, message: "Sandbox not running" }, sandbox: null }
  }

  return { error: null, sandbox: record }
}

const truncateOutput = (text) => {
  if (typeof text !== "string") return ""
  if (text.length <= MAX_COMMAND_OUTPUT) return text
  return `${text.slice(0, MAX_COMMAND_OUTPUT)}\n\n...[truncated]`
}

const captureScreenshot = async (sandboxRecord) => {
  const screenshot = await executeSandboxMcpAction(sandboxRecord, { action: "screenshot" })
  return {
    image: screenshot.data,
    width: Number.isFinite(screenshot.width) && screenshot.width > 0 ? screenshot.width : RESOLUTION[0],
    height: Number.isFinite(screenshot.height) && screenshot.height > 0 ? screenshot.height : RESOLUTION[1],
  }
}

const executeComputerAction = async (sandboxRecord, params) => {
  return executeSandboxMcpAction(sandboxRecord, params)
}

const createComputerTool = (sandboxRecord) =>
  tool({
    description:
      "Computer use tool for interacting with a desktop environment. Use for clicking, typing, scrolling, and taking screenshots.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "screenshot",
            "wait",
            "left_click",
            "double_click",
            "right_click",
            "mouse_move",
            "type",
            "key",
            "scroll",
            "left_click_drag",
          ],
          description: "The action to perform",
        },
        coordinate: {
          type: "array",
          items: { type: "number" },
          description: "X, Y coordinates for mouse actions",
        },
        text: {
          type: "string",
          description: "Text for type or key actions",
        },
        duration: {
          type: "number",
          description: "Duration in seconds for wait action",
        },
        scroll_amount: {
          type: "number",
          description: "Amount to scroll",
        },
        scroll_direction: {
          type: "string",
          enum: ["up", "down"],
          description: "Scroll direction",
        },
        start_coordinate: {
          type: "array",
          items: { type: "number" },
          description: "Starting coordinates for drag action",
        },
      },
      required: ["action"],
    },
    execute: async (args) => executeComputerAction(sandboxRecord, args),
  })

const createBashTool = (sandboxRecord) =>
  tool({
    description: "Execute bash commands in the sandbox environment",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The bash command to execute" },
      },
      required: ["command"],
    },
    execute: async ({ command }) => {
      if (isSandboxMcpProvider(sandboxRecord.provider)) {
        return executeSandboxMcpAction(sandboxRecord, { action: "bash", command })
      }

      if (typeof command !== "string" || command.trim().length === 0) {
        throw new Error("Command is required")
      }

      const result = await sandboxRecord.sandbox.commands.run(command)
      const stdout = truncateOutput(result.stdout)
      const stderr = truncateOutput(result.stderr)
      const exitCode = Number.isFinite(result.exitCode) ? result.exitCode : null

      const output = [`exitCode: ${exitCode ?? "unknown"}`]
      if (stdout) output.push(`stdout:\n${stdout}`)
      if (stderr) output.push(`stderr:\n${stderr}`)

      return {
        type: "text",
        text: output.join("\n\n"),
        exitCode,
        stdout,
        stderr,
      }
    },
  })

const resolveLanguageModel = ({ provider, model, apiKey }) => {
  const normalizedProvider = typeof provider === "string" ? provider.toLowerCase() : "anthropic"
  const modelName = typeof model === "string" && model.trim().length > 0 ? model : DEFAULT_MODEL

  if (normalizedProvider !== "anthropic") {
    throw new Error(`Unsupported provider: ${provider}. Only anthropic is currently supported.`)
  }

  const resolvedApiKey =
    (typeof apiKey === "string" && apiKey.trim().length > 0 ? apiKey.trim() : null)
    || process.env.ANTHROPIC_API_KEY

  if (!resolvedApiKey) {
    throw new Error("Missing Anthropic API key. Set ANTHROPIC_API_KEY or pass apiKey in the request body.")
  }

  const anthropic = createAnthropic({ apiKey: resolvedApiKey })
  return anthropic(modelName)
}

const DEFAULT_DESKTOP_SANDBOX_AGENT_NAME =
  (typeof process.env.OPENCHAMBER_DESKTOP_AGENT_NAME === "string" && process.env.OPENCHAMBER_DESKTOP_AGENT_NAME.trim())
  || "hephaestus"

const buildSandboxAgentSystemPrompt = ({ agentName, liveMode = "sandbox-session" } = {}) => {
  const resolvedAgentName =
    typeof agentName === "string" && agentName.trim().length > 0 ? agentName.trim() : DEFAULT_DESKTOP_SANDBOX_AGENT_NAME

  return [
    `You are ${resolvedAgentName}, the desktop automation agent for OpenChamber.`,
    "You are operating inside the local XFCE sandbox, not on the user's host desktop.",
    `Execution surface: ${liveMode}.`,
    "Available tools:",
    "- computer: control the sandbox GUI with screenshots, clicks, typing, key presses, scrolling, drags, and waits.",
    "- bash: execute shell commands inside the sandbox container.",
    "Rules:",
    "- Use only the sandbox tools available in this session.",
    "- Do not assume access to host-native desktop tools.",
    "- Prefer direct tool use over narration. Keep actions deterministic and verify outcomes with screenshots when helpful.",
  ].join("\n")
}

const parseCookies = (headerValue) => {
  if (typeof headerValue !== "string" || !headerValue.trim()) return {}
  return headerValue.split(";").reduce((acc, entry) => {
    const index = entry.indexOf("=")
    if (index <= 0) return acc
    const key = entry.slice(0, index).trim()
    const value = entry.slice(index + 1).trim()
    if (key) {
      acc[key] = decodeURIComponent(value)
    }
    return acc
  }, {})
}

const resolveBrokerRequesterContext = (req) => {
  const cookies = parseCookies(req.headers?.cookie)
  const sessionToken = cookies[OPENCHAMBER_SESSION_COOKIE] || ""
  const fallbackFingerprint = `${req.ip || ""}:${String(req.headers?.["user-agent"] || "")}`
  const seed = sessionToken || fallbackFingerprint || crypto.randomUUID()
  const digest = crypto.createHash("sha256").update(seed).digest("hex")

  return {
    userId: `openchamber-${digest.slice(0, 24)}`,
    orgId: process.env.OPENCHAMBER_DESKTOP_SANDBOX_ORG_ID?.trim() || "openchamber-local",
    role: process.env.OPENCHAMBER_DESKTOP_SANDBOX_ROLE?.trim() || "owner",
    email: process.env.OPENCHAMBER_DESKTOP_SANDBOX_EMAIL?.trim() || "openchamber@local",
  }
}

const resolveBrokerBackendPreference = (req) => {
  const queryValue = typeof req.query?.backend === "string" ? req.query.backend.trim().toLowerCase() : ""
  if (queryValue === "legacy" || queryValue === "broker") {
    return queryValue
  }

  const headerValue = typeof req.headers?.["x-openchamber-sandbox-backend"] === "string"
    ? req.headers["x-openchamber-sandbox-backend"].trim().toLowerCase()
    : ""
  if (headerValue === "legacy" || headerValue === "broker") {
    return headerValue
  }

  return BROKER_ENABLED_BY_DEFAULT ? "broker" : "legacy"
}

const shouldUseBrokerForRequest = (req) => resolveBrokerBackendPreference(req) === "broker"

const mapBrokerStateToLegacyStatus = (state, status) => {
  const normalizedState = typeof state === "string" ? state.toLowerCase() : ""
  const normalizedStatus = typeof status === "string" ? status.toLowerCase() : ""

  if (normalizedState === "failed" || normalizedStatus === "failed") return "error"
  if (normalizedState === "expired" || normalizedStatus === "stopped") return "stopped"
  if (normalizedState === "provisioning" || normalizedStatus === "pending" || normalizedStatus === "starting") {
    return "starting"
  }
  if (normalizedState === "paused") return "stopped"
  return "running"
}

const serializeBrokerSession = (sessionLike) => {
  const session = sessionLike && typeof sessionLike === "object" ? sessionLike : {}
  const status = mapBrokerStateToLegacyStatus(session.sessionState, session.status)
  return {
    id: typeof session.id === "string" ? session.id : "",
    provider: "sandbox-mcp",
    status,
    createdAt:
      (Number.isFinite(session.startedAt) && session.startedAt)
      || (Number.isFinite(session.timeCreated) && session.timeCreated)
      || Date.now(),
    destroyedAt:
      (Number.isFinite(session.stoppedAt) && session.stoppedAt)
      || (status === "stopped" ? Date.now() : undefined),
    connectionUrl: null,
    streamUrl: null,
    lastError: status === "error" ? "Broker session failed" : null,
    sessionState: typeof session.sessionState === "string" ? session.sessionState : null,
    sessionStatus: typeof session.status === "string" ? session.status : null,
  }
}

const buildBrokerMarketplaceUrl = (req, path) => {
  const host = req.get("host") || `127.0.0.1:${process.env.OPENCHAMBER_PORT || 3000}`
  const protocol = req.protocol || "http"
  return `${protocol}://${host}/api/marketplace${path}`
}

const parseJsonSafely = (text) => {
  if (typeof text !== "string" || !text.trim()) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const brokerMarketplaceRequest = async (req, path, options = {}) => {
  const { method = "GET", body } = options
  const requester = resolveBrokerRequesterContext(req)
  const headers = {
    Accept: "application/json",
    Authorization:
      typeof req.headers?.authorization === "string" && req.headers.authorization.trim().length > 0
        ? req.headers.authorization
        : "Bearer openchamber-local-dev",
    "x-openchamber-user-id": requester.userId,
    "x-openchamber-org-id": requester.orgId,
    "x-openchamber-user-role": requester.role,
    "x-openchamber-user-email": requester.email,
    "x-openchamber-internal": "desktop-sandbox",
  }

  if (typeof req.headers?.cookie === "string" && req.headers.cookie.length > 0) {
    headers.cookie = req.headers.cookie
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json"
  }

  const response = await fetch(buildBrokerMarketplaceUrl(req, path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const raw = await response.text().catch(() => "")
  const json = parseJsonSafely(raw)

  if (!response.ok) {
    const errorMessage =
      (json && typeof json.error === "string" && json.error)
      || (json && typeof json.message === "string" && json.message)
      || raw
      || `Broker request failed with status ${response.status}`
    const error = new Error(errorMessage)
    error.status = response.status
    throw error
  }

  return json && typeof json === "object" ? json : {}
}

const isBrokerSessionReady = (session) => {
  const state = typeof session?.sessionState === "string" ? session.sessionState.toLowerCase() : ""
  const status = typeof session?.status === "string" ? session.status.toLowerCase() : ""
  if (state === "active" || state === "controlled_by_agent" || state === "controlled_by_user") return true
  if (status === "active") return true
  return false
}

const pollBrokerSession = async (req, sessionId) => {
  const startedAt = Date.now()
  let lastSession = null

  while (Date.now() - startedAt < BROKER_POLL_TIMEOUT_MS) {
    const payload = await brokerMarketplaceRequest(req, `/desktop/sessions/${encodeURIComponent(sessionId)}`)
    const session = payload?.session || null
    if (session) {
      lastSession = session
      const state = typeof session.sessionState === "string" ? session.sessionState.toLowerCase() : ""
      if (state === "failed" || state === "expired") {
        return session
      }
      if (isBrokerSessionReady(session)) {
        return session
      }
    }

    await new Promise((resolve) => setTimeout(resolve, BROKER_POLL_INTERVAL_MS))
  }

  return lastSession
}

const mapLegacyActionToBroker = (params = {}) => {
  const action = typeof params.action === "string" ? params.action.trim() : ""

  if (!action) {
    throw new Error("Action is required")
  }

  switch (action) {
    case "left_click": {
      const [x, y] = parseCoordinate(params.coordinate)
      return { action: "left_click", args: { x, y } }
    }
    case "double_click": {
      const [x, y] = parseCoordinate(params.coordinate)
      return { action: "double_click", args: { x, y } }
    }
    case "right_click": {
      const [x, y] = parseCoordinate(params.coordinate)
      return { action: "right_click", args: { x, y } }
    }
    case "mouse_move": {
      const [x, y] = parseCoordinate(params.coordinate)
      return { action: "mouse_move", args: { x, y } }
    }
    case "scroll": {
      return {
        action: "scroll",
        args: {
          direction: params.scroll_direction === "up" ? "up" : "down",
          amount: Number.isFinite(params.scroll_amount) ? Math.max(1, Math.round(Number(params.scroll_amount))) : 1,
          x: Array.isArray(params.coordinate) ? Number(params.coordinate[0] || 0) : 0,
          y: Array.isArray(params.coordinate) ? Number(params.coordinate[1] || 0) : 0,
        },
      }
    }
    case "left_click_drag": {
      const [startX, startY] = parseCoordinate(params.start_coordinate, "start_coordinate")
      const [endX, endY] = parseCoordinate(params.coordinate)
      return {
        action: "left_click_drag",
        args: {
          startX,
          startY,
          endX,
          endY,
        },
      }
    }
    case "wait": {
      const seconds = Number.isFinite(params.duration) ? Math.max(0, Number(params.duration)) : 1
      return { action: "wait", args: { ms: Math.round(seconds * 1000) } }
    }
    case "type": {
      if (typeof params.text !== "string" || params.text.length === 0) {
        throw new Error("Text required for type action")
      }
      return { action: "type", args: { text: params.text } }
    }
    case "key": {
      if (typeof params.text !== "string" || params.text.length === 0) {
        throw new Error("Key required for key action")
      }
      return { action: "key", args: { text: params.text } }
    }
    case "bash": {
      if (typeof params.command !== "string" || params.command.trim().length === 0) {
        throw new Error("Command is required")
      }
      return { action: "bash", args: { command: params.command.trim() } }
    }
    case "screenshot":
      return { action: "screenshot", args: {} }
    default:
      return {
        action,
        args: typeof params.args === "object" && params.args ? params.args : {},
      }
  }
}

const callBrokerAction = async (req, sandboxId, params = {}) => {
  const mapped = mapLegacyActionToBroker(params)
  const payload = await brokerMarketplaceRequest(
    req,
    `/desktop/sessions/${encodeURIComponent(sandboxId)}/action`,
    {
      method: "POST",
      body: {
        action: mapped.action,
        args: mapped.args,
      },
    },
  )

  const result = payload?.result?.result ?? payload?.result ?? null
  return {
    action: mapped.action,
    result,
    raw: payload,
  }
}

const normalizeImageDataUri = (candidate) => {
  if (typeof candidate !== "string" || candidate.length === 0) {
    return ""
  }
  if (candidate.startsWith("data:image")) {
    return candidate
  }
  return `data:image/png;base64,${candidate}`
}

const extractBrokerScreenshot = (result) => {
  if (!result || typeof result !== "object") {
    return null
  }

  const imageCandidate =
    (typeof result.image === "string" && result.image)
    || (typeof result.data === "string" && result.data)
    || (typeof result.raw?.image === "string" && result.raw.image)
    || (typeof result.raw?.base64 === "string" && result.raw.base64)
    || null

  if (!imageCandidate) {
    return null
  }

  return {
    image: normalizeImageDataUri(imageCandidate),
    width: Number.isFinite(result.width) ? result.width : RESOLUTION[0],
    height: Number.isFinite(result.height) ? result.height : RESOLUTION[1],
  }
}

const executeBrokerComputerAction = async (req, sandboxId, params) => {
  const { action } = params || {}
  const { result } = await callBrokerAction(req, sandboxId, params)

  if (action === "screenshot") {
    const screenshot = extractBrokerScreenshot(result)
    if (!screenshot) {
      throw new Error("Screenshot unavailable from broker")
    }
    return {
      type: "image",
      mimeType: "image/png",
      data: screenshot.image,
      width: screenshot.width,
      height: screenshot.height,
    }
  }

  const text =
    (typeof result?.text === "string" && result.text)
    || (typeof result?.stdout === "string" && result.stdout)
    || (typeof result?.status === "string" && result.status)
    || `Action ${action} complete`

  return {
    type: "text",
    text,
    raw: result,
  }
}

const createBrokerComputerTool = (req, sandboxId) =>
  tool({
    description:
      "Computer use tool for interacting with a desktop environment. Use for clicking, typing, scrolling, and taking screenshots.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "screenshot",
            "wait",
            "left_click",
            "double_click",
            "right_click",
            "mouse_move",
            "type",
            "key",
            "scroll",
            "left_click_drag",
          ],
          description: "The action to perform",
        },
        coordinate: {
          type: "array",
          items: { type: "number" },
          description: "X, Y coordinates for mouse actions",
        },
        text: {
          type: "string",
          description: "Text for type or key actions",
        },
        duration: {
          type: "number",
          description: "Duration in seconds for wait action",
        },
        scroll_amount: {
          type: "number",
          description: "Amount to scroll",
        },
        scroll_direction: {
          type: "string",
          enum: ["up", "down"],
          description: "Scroll direction",
        },
        start_coordinate: {
          type: "array",
          items: { type: "number" },
          description: "Starting coordinates for drag action",
        },
      },
      required: ["action"],
    },
    execute: async (args) => executeBrokerComputerAction(req, sandboxId, args),
  })

const createBrokerBashTool = (req, sandboxId) =>
  tool({
    description: "Execute bash commands in the sandbox environment",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The bash command to execute" },
      },
      required: ["command"],
    },
    execute: async ({ command }) => {
      if (typeof command !== "string" || command.trim().length === 0) {
        throw new Error("Command is required")
      }

      const { result } = await callBrokerAction(req, sandboxId, {
        action: "bash",
        command,
      })

      const stdout = truncateOutput(typeof result?.stdout === "string" ? result.stdout : "")
      const stderr = truncateOutput(typeof result?.stderr === "string" ? result.stderr : "")
      const exitCode = Number.isFinite(result?.exitCode) ? result.exitCode : null

      const output = [`exitCode: ${exitCode ?? "unknown"}`]
      if (stdout) output.push(`stdout:\n${stdout}`)
      if (stderr) output.push(`stderr:\n${stderr}`)

      return {
        type: "text",
        text: output.join("\n\n"),
        exitCode,
        stdout,
        stderr,
      }
    },
  })

const maybeHandleBrokerCreate = async (req, res) => {
  const provider = resolveSandboxProvider(req.body?.provider)

  const payload = await brokerMarketplaceRequest(req, "/desktop/sessions", {
    method: "POST",
    body: {
      sessionType: "desktop",
      provider: "sandbox-mcp",
      config: {
        resolution: RESOLUTION,
        snapshotId: typeof req.body?.snapshotId === "string" ? req.body.snapshotId.trim() : undefined,
      },
      metadata: {
        source: "openchamber.desktop-sandbox.adapter",
      },
    },
  })

  const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId : ""
  if (!sessionId) {
    throw new Error("Broker did not return session ID")
  }

  const session = (await pollBrokerSession(req, sessionId)) || {
    id: sessionId,
    sandboxProvider: provider,
    sessionState: "provisioning",
    status: payload?.status || "pending",
    timeCreated: Date.now(),
  }

  return res.json({
    success: true,
    sandbox: serializeBrokerSession(session),
  })
}

const maybeHandleBrokerDestroy = async (req, res) => {
  const { id } = req.params
  await brokerMarketplaceRequest(req, `/desktop/sessions/${encodeURIComponent(id)}/destroy`, {
    method: "POST",
  })

  let session = null
  try {
    const payload = await brokerMarketplaceRequest(req, `/desktop/sessions/${encodeURIComponent(id)}`)
    session = payload?.session || null
  } catch {
    session = {
      id,
      sessionState: "expired",
      status: "stopped",
      sandboxProvider: "sandbox-mcp",
      stoppedAt: Date.now(),
      timeCreated: Date.now(),
    }
  }

  return res.json({ success: true, sandbox: serializeBrokerSession(session) })
}

const maybeHandleBrokerGet = async (req, res) => {
  const { id } = req.params
  const payload = await brokerMarketplaceRequest(req, `/desktop/sessions/${encodeURIComponent(id)}`)
  const session = payload?.session
  if (!session) {
    return res.status(404).json({ success: false, error: "Sandbox not found" })
  }
  return res.json({ success: true, sandbox: serializeBrokerSession(session) })
}

const maybeHandleBrokerList = async (req, res) => {
  const payload = await brokerMarketplaceRequest(req, "/desktop/sessions")
  const sessions = Array.isArray(payload?.sessions) ? payload.sessions : []
  return res.json({
    success: true,
    sandboxes: sessions.map((session) => serializeBrokerSession(session)),
  })
}

const maybeHandleBrokerExecute = async (req, res) => {
  const { id } = req.params
  const { result } = await callBrokerAction(req, id, req.body || {})
  return res.json({ success: true, result: result || { type: "text", text: "Action complete" } })
}

const maybeHandleBrokerScreenshot = async (req, res) => {
  const { id } = req.params
  const { result } = await callBrokerAction(req, id, { action: "screenshot" })
  const screenshot = extractBrokerScreenshot(result)
  if (!screenshot) {
    return res.status(502).json({ success: false, error: "Broker screenshot unavailable" })
  }

  return res.json({
    success: true,
    image: screenshot.image,
    width: screenshot.width,
    height: screenshot.height,
  })
}

const maybeHandleBrokerChat = async (req, res) => {
  const { id } = req.params
  const { message, provider = "anthropic", model = DEFAULT_MODEL, apiKey } = req.body || {}
  const agentName = typeof req.body?.agentName === "string" ? req.body.agentName : undefined

  if (typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ success: false, error: "Message is required" })
  }

  const sessionPayload = await brokerMarketplaceRequest(req, `/desktop/sessions/${encodeURIComponent(id)}`)
  if (!sessionPayload?.session) {
    return res.status(404).json({ success: false, error: "Sandbox not found" })
  }

  const session = sessionPayload.session
  const legacyStatus = mapBrokerStateToLegacyStatus(session.sessionState, session.status)
  if (legacyStatus !== "running") {
    return res.status(404).json({ success: false, error: "Sandbox not running" })
  }

  const languageModel = resolveLanguageModel({ provider, model, apiKey })

  const result = await generateText({
    model: languageModel,
    system: buildSandboxAgentSystemPrompt({ agentName, liveMode: "sandbox-session-chat" }),
    prompt: message,
    tools: {
      computer: createBrokerComputerTool(req, id),
      bash: createBrokerBashTool(req, id),
    },
    maxSteps: 10,
  })

  const toolResultsById = new Map(result.toolResults.map((entry) => [entry.toolCallId, entry]))

  return res.json({
    success: true,
    response: result.text,
    finishReason: result.finishReason,
    usage: result.usage,
    toolCalls: result.toolCalls.map((toolCall) => ({
      toolName: toolCall.toolName,
      args: toolCall.args,
      result: toolResultsById.get(toolCall.toolCallId)?.result ?? null,
    })),
  })
}

router.post("/create", async (req, res) => {
  try {
    if (shouldUseBrokerForRequest(req)) {
      try {
        return await maybeHandleBrokerCreate(req, res)
      } catch (error) {
        if (!BROKER_FALLBACK_ENABLED) {
          throw error
        }
        console.warn("Desktop sandbox broker create failed, falling back to legacy provider:", error?.message || error)
      }
    }

    const provider = resolveSandboxProvider(req.body?.provider)
    const sandboxId = crypto.randomUUID()
    const record = await createSandboxMcpRecord(req, {
      id: sandboxId,
      resolution:
        typeof req.body?.resolution === "string" && req.body.resolution.trim().length > 0
          ? req.body.resolution.trim()
          : undefined,
    })
    sandboxes.set(record.id, record)
    res.json({ success: true, sandbox: serializeSandbox(record) })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Failed to create sandbox:", message)
    res.status(500).json({ success: false, error: message })
  }
})

router.post("/:id/destroy", async (req, res) => {
  try {
    if (shouldUseBrokerForRequest(req)) {
      try {
        return await maybeHandleBrokerDestroy(req, res)
      } catch (error) {
        if (!BROKER_FALLBACK_ENABLED) {
          throw error
        }
        console.warn("Desktop sandbox broker destroy failed, falling back to legacy provider:", error?.message || error)
      }
    }

    const { id } = req.params
    const sandbox = getSandbox(id)

    if (!sandbox) {
      return res.status(404).json({ success: false, error: "Sandbox not found" })
    }

    if (sandbox.status === "stopped") {
      return res.json({ success: true, sandbox: serializeSandbox(sandbox) })
    }

    if (isSandboxMcpProvider(sandbox.provider)) {
      const updated = await destroySandboxMcpRecord(sandbox)
      sandboxes.set(id, updated)
      return res.json({ success: true, sandbox: serializeSandbox(updated) })
    }

    sandbox.status = "stopping"

    try {
      if (sandbox.sandbox) {
        await Promise.allSettled([
          sandbox.sandbox.stream.stop(),
          sandbox.sandbox.kill(),
        ])
      }
      sandbox.status = "stopped"
      sandbox.destroyedAt = Date.now()
      sandbox.streamAuthKey = undefined
      sandbox.streamUrl = undefined
      sandbox.connectionUrl = undefined
      sandbox.sandbox = null
      return res.json({ success: true, sandbox: serializeSandbox(sandbox) })
    } catch (error) {
      sandbox.status = "error"
      sandbox.lastError = error instanceof Error ? error.message : String(error)
      throw error
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Failed to destroy sandbox:", message)
    res.status(500).json({ success: false, error: message })
  }
})

router.get("/:id", async (req, res) => {
  try {
    if (shouldUseBrokerForRequest(req)) {
      try {
        return await maybeHandleBrokerGet(req, res)
      } catch (error) {
        if (!BROKER_FALLBACK_ENABLED) {
          throw error
        }
        console.warn("Desktop sandbox broker get failed, falling back to legacy provider:", error?.message || error)
      }
    }

    const { id } = req.params
    let sandbox = getSandbox(id)

    if (!sandbox) {
      return res.status(404).json({ success: false, error: "Sandbox not found" })
    }

    if (isSandboxMcpProvider(sandbox.provider)) {
      sandbox = await refreshSandboxMcpRecord(sandbox)
      sandboxes.set(id, sandbox)
    }

    res.json({ success: true, sandbox: serializeSandbox(sandbox) })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    res.status(500).json({ success: false, error: message })
  }
})

router.get("/", async (req, res) => {
  try {
    if (shouldUseBrokerForRequest(req)) {
      try {
        return await maybeHandleBrokerList(req, res)
      } catch (error) {
        if (!BROKER_FALLBACK_ENABLED) {
          throw error
        }
        console.warn("Desktop sandbox broker list failed, falling back to legacy provider:", error?.message || error)
      }
    }

    const allSandboxes = await Promise.all(
      Array.from(sandboxes.values()).map(async (sandbox) => {
        if (!isSandboxMcpProvider(sandbox.provider)) return sandbox
        const refreshed = await refreshSandboxMcpRecord(sandbox)
        sandboxes.set(sandbox.id, refreshed)
        return refreshed
      }),
    )

    res.json({ success: true, sandboxes: allSandboxes.map(serializeSandbox) })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    res.status(500).json({ success: false, error: message })
  }
})

router.post("/task", async (req, res) => {
  try {
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : ""
    const provider = typeof req.body?.providerID === "string" && req.body.providerID.trim().length > 0
      ? req.body.providerID.trim()
      : "anthropic"
    const model = typeof req.body?.modelID === "string" && req.body.modelID.trim().length > 0
      ? req.body.modelID.trim()
      : DEFAULT_MODEL
    const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey : undefined
    const agentName = typeof req.body?.agentName === "string" ? req.body.agentName : undefined

    if (!prompt) {
      return res.status(400).json({ success: false, error: "Prompt is required" })
    }

    const sandboxId = crypto.randomUUID()
    const sandbox = await createSandboxMcpRecord(req, {
      id: sandboxId,
      resolution:
        typeof req.body?.resolution === "string" && req.body.resolution.trim().length > 0
          ? req.body.resolution.trim()
          : undefined,
    })
    sandboxes.set(sandbox.id, sandbox)

    const languageModel = resolveLanguageModel({ provider, model, apiKey })
    const result = await generateText({
      model: languageModel,
      system: buildSandboxAgentSystemPrompt({ agentName, liveMode: "background-sandbox-task" }),
      prompt,
      tools: {
        computer: createComputerTool(sandbox),
        bash: createBashTool(sandbox),
      },
      maxSteps: 10,
    })

    const toolResultsById = new Map(result.toolResults.map((entry) => [entry.toolCallId, entry]))

    return res.json({
      success: true,
      runtimeSessionID: sandbox.id,
      liveUrl: sandbox.streamUrl || sandbox.connectionUrl || null,
      result: {
        response: result.text,
        finishReason: result.finishReason,
        usage: result.usage,
        toolCalls: result.toolCalls.map((toolCall) => ({
          toolName: toolCall.toolName,
          args: toolCall.args,
          result: toolResultsById.get(toolCall.toolCallId)?.result ?? null,
        })),
      },
      logs: [],
      artifacts: [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Desktop sandbox task error:", message)
    return res.status(500).json({ success: false, error: message })
  }
})

router.post("/:id/chat", async (req, res) => {
  try {
    if (shouldUseBrokerForRequest(req)) {
      try {
        return await maybeHandleBrokerChat(req, res)
      } catch (error) {
        if (!BROKER_FALLBACK_ENABLED) {
          throw error
        }
        console.warn("Desktop sandbox broker chat failed, falling back to legacy provider:", error?.message || error)
      }
    }

    const { id } = req.params
    const { message, provider = "anthropic", model = DEFAULT_MODEL, apiKey } = req.body || {}
    const agentName = typeof req.body?.agentName === "string" ? req.body.agentName : undefined

    if (typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Message is required" })
    }

    const { error, sandbox } = requireRunningSandbox(id)
    if (error) {
      return res.status(error.status).json({ success: false, error: error.message })
    }

    const languageModel = resolveLanguageModel({ provider, model, apiKey })

    const result = await generateText({
      model: languageModel,
      system: buildSandboxAgentSystemPrompt({ agentName, liveMode: "sandbox-session-chat" }),
      prompt: message,
      tools: {
        computer: createComputerTool(sandbox),
        bash: createBashTool(sandbox),
      },
      maxSteps: 10,
    })

    const toolResultsById = new Map(result.toolResults.map((entry) => [entry.toolCallId, entry]))

    res.json({
      success: true,
      response: result.text,
      finishReason: result.finishReason,
      usage: result.usage,
      toolCalls: result.toolCalls.map((toolCall) => ({
        toolName: toolCall.toolName,
        args: toolCall.args,
        result: toolResultsById.get(toolCall.toolCallId)?.result ?? null,
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Desktop chat error:", message)
    res.status(500).json({ success: false, error: message })
  }
})

router.post("/:id/screenshot", async (req, res) => {
  try {
    if (shouldUseBrokerForRequest(req)) {
      try {
        return await maybeHandleBrokerScreenshot(req, res)
      } catch (error) {
        if (!BROKER_FALLBACK_ENABLED) {
          throw error
        }
        console.warn("Desktop sandbox broker screenshot failed, falling back to legacy provider:", error?.message || error)
      }
    }

    const { id } = req.params
    const { error, sandbox } = requireRunningSandbox(id)

    if (error) {
      return res.status(error.status).json({ success: false, error: error.message })
    }

    const screenshot = await captureScreenshot(sandbox)

    res.json({
      success: true,
      image: screenshot.image,
      width: screenshot.width,
      height: screenshot.height,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Screenshot error:", message)
    res.status(500).json({ success: false, error: message })
  }
})

router.post("/:id/execute", async (req, res) => {
  try {
    if (shouldUseBrokerForRequest(req)) {
      try {
        return await maybeHandleBrokerExecute(req, res)
      } catch (error) {
        if (!BROKER_FALLBACK_ENABLED) {
          throw error
        }
        console.warn("Desktop sandbox broker execute failed, falling back to legacy provider:", error?.message || error)
      }
    }

    const { id } = req.params
    const { error, sandbox } = requireRunningSandbox(id)

    if (error) {
      return res.status(error.status).json({ success: false, error: error.message })
    }

    const result = await executeComputerAction(sandbox, req.body || {})

    res.json({ success: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Execute error:", message)
    res.status(500).json({ success: false, error: message })
  }
})

export default router
