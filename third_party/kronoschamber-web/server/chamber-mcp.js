/**
 * KronosChamber MCP Server
 *
 * Exposes the desktop app's Tauri capabilities as MCP tools so the core
 * engine can call them like any other MCP server.
 *
 * The core engine connects via SSE at GET /mcp and sends messages via
 * POST /mcp/message.  Each tool call is forwarded to the existing
 * /api/desktop-browser/action bridge — no shared state needed.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { z } from "zod"

let _chamberBaseUrl = "http://127.0.0.1:3000"
const KronLinkInternalUrl = (process.env.KRONLINK_INTERNAL_URL || "http://127.0.0.1:4119").replace(/\/$/, "")
let _workspaceToolHandlers = {}
export function setChamberBaseUrl(url) {
  _chamberBaseUrl = url
}

export function setWorkspaceToolHandlers(handlers = {}) {
  _workspaceToolHandlers = {
    ..._workspaceToolHandlers,
    ...handlers,
  }
}

async function dispatch(action, payload = {}) {
  const res = await fetch(`${_chamberBaseUrl}/api/desktop-browser/action`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, payload }),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error ?? "Chamber dispatch failed")
  return json.result
}

async function requestJson(routePath, { method = "GET", body } = {}) {
  const response = await fetch(`${_chamberBaseUrl}${routePath}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const raw = await response.text()
  let payload = null
  if (raw) {
    try {
      payload = JSON.parse(raw)
    } catch {
      payload = { raw }
    }
  }
  if (!response.ok) {
    throw new Error(payload?.error || payload?.detail || `Request failed (${response.status})`)
  }
  return payload
}

async function requestKronLink(routePath, { method = "GET", body } = {}) {
  const response = await fetch(`${KronLinkInternalUrl}${routePath}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.error || payload?.detail || `KronTerm phone control failed (${response.status})`
    throw new Error(
      response.status === 409
        ? `${message}. The user must open Surfaces, choose This iPhone, and enable Control.`
        : message,
    )
  }
  return payload
}

const phoneAction = (method, params = {}) =>
  requestKronLink("/internal/phone/action", {
    method: "POST",
    body: { method, params },
  })

async function invokeWorkspaceTool(toolName, args, fallback) {
  const handler = _workspaceToolHandlers[toolName]
  if (typeof handler === "function") {
    return handler(args)
  }
  return fallback()
}

// ── MCP server ────────────────────────────────────────────────────────────────
const server = new McpServer({ name: "kronoschamber", version: "1.0.0" })

const tool = (name, desc, shape, fn) =>
  server.tool(name, desc, shape, async (args) => ({
    content: [{ type: "text", text: JSON.stringify(await fn(args)) }],
  }))

tool("browser_navigate", "Navigate the visible in-app browser to a URL", { url: z.string() }, ({ url }) =>
  dispatch("navigate", { url }),
)
tool("browser_snapshot", "Get the accessibility tree of the current page", {}, () => dispatch("snapshot", {}))
tool("browser_screenshot", "Screenshot the current page (base64 PNG)", {}, () => dispatch("screenshot", {}))
tool("browser_click", "Click an element", { selector: z.string() }, ({ selector }) =>
  dispatch("click", { selector }),
)
tool(
  "browser_fill",
  "Fill a form field",
  { selector: z.string(), value: z.string() },
  ({ selector, value }) => dispatch("fill", { selector, value }),
)
tool("browser_back", "Navigate back", {}, () => dispatch("back", {}))
tool("browser_forward", "Navigate forward", {}, () => dispatch("forward", {}))
tool("browser_reload", "Reload the current page", {}, () => dispatch("reload", {}))
tool("browser_evaluate", "Run JavaScript in the page", { script: z.string() }, ({ script }) =>
  dispatch("evaluate", { script }),
)
tool(
  "phone_context",
  "Observe the connected iPhone screen, accessibility tree, and foreground app through PhoneAgent",
  {},
  () => requestKronLink("/internal/phone/context"),
)
tool("phone_tree", "Read the connected iPhone accessibility tree", {}, () => phoneAction("get_tree"))
tool("phone_screenshot", "Capture the connected iPhone screen as a base64 image", {}, () =>
  phoneAction("get_screen_image"),
)
tool(
  "phone_open_app",
  "Open an app on the connected iPhone; requires the user's short-lived Control approval",
  { bundleId: z.string() },
  ({ bundleId }) => phoneAction("open_app", { bundle_identifier: bundleId }),
)
tool(
  "phone_tap",
  "Tap a logical x/y coordinate on the connected iPhone; requires the user's short-lived Control approval",
  { x: z.number(), y: z.number() },
  ({ x, y }) => phoneAction("tap", { x, y }),
)
tool(
  "phone_tap_element",
  "Tap an iPhone element by its accessibility-tree frame; requires the user's Control approval",
  { coordinate: z.string(), count: z.number().int().min(1).max(3).optional(), longPress: z.boolean().optional() },
  ({ coordinate, count, longPress }) => phoneAction("tap_element", { coordinate, count, longPress }),
)
tool(
  "phone_enter_text",
  "Enter text at an iPhone coordinate; requires the user's short-lived Control approval",
  { coordinate: z.string(), text: z.string() },
  ({ coordinate, text }) => phoneAction("enter_text", { coordinate, text }),
)
tool(
  "phone_scroll",
  "Scroll the connected iPhone; requires the user's short-lived Control approval",
  { x: z.number(), y: z.number(), distanceX: z.number(), distanceY: z.number() },
  ({ x, y, distanceX, distanceY }) => phoneAction("scroll", { x, y, distanceX, distanceY }),
)
tool(
  "phone_swipe",
  "Swipe from a logical iPhone coordinate in one direction; requires the user's Control approval",
  {
    x: z.number(),
    y: z.number(),
    direction: z.enum(["up", "down", "left", "right"]),
  },
  ({ x, y, direction }) => phoneAction("swipe", { x, y, direction }),
)
tool(
  "chamber_dispatch",
  "Call any KronosChamber Tauri action by name",
  { action: z.string(), payload: z.record(z.unknown()).optional() },
  ({ action, payload }) => dispatch(action, payload ?? {}),
)
tool(
  "social_list_calendar",
  "List social drafts and scheduled posts from the Social Ops workspace",
  {
    from: z.string().optional(),
    to: z.string().optional(),
    status: z.string().optional(),
  },
  ({ from, to, status }) =>
    invokeWorkspaceTool("social_list_calendar", { from, to, status }, () => {
      const params = new URLSearchParams()
      if (from) params.set("from", from)
      if (to) params.set("to", to)
      if (status) params.set("status", status)
      const query = params.size > 0 ? `?${params.toString()}` : ""
      return requestJson(`/api/social/calendar${query}`)
    }),
)
tool(
  "social_create_draft",
  "Create a social draft in KronosChamber Social Ops",
  {
    title: z.string().optional(),
    text: z.string(),
    platforms: z.array(z.string()).optional(),
    mediaUrls: z.array(z.string()).optional(),
    scheduledAt: z.string().optional(),
    campaignId: z.string().optional(),
    brandKitId: z.string().optional(),
  },
  ({ title, text, platforms, mediaUrls, scheduledAt, campaignId, brandKitId }) =>
    invokeWorkspaceTool("social_create_draft", { title, text, platforms, mediaUrls, scheduledAt, campaignId, brandKitId }, () =>
      requestJson("/api/social/drafts", {
        method: "POST",
        body: { title, text, platforms, mediaUrls, scheduledAt, campaignId, brandKitId, provenance: "agent" },
      }),
    ),
)
tool(
  "social_schedule_draft",
  "Schedule a social draft in KronosChamber Social Ops",
  {
    draftId: z.string(),
    scheduledAt: z.string(),
  },
  ({ draftId, scheduledAt }) =>
    invokeWorkspaceTool("social_schedule_draft", { draftId, scheduledAt }, () =>
      requestJson("/api/social/schedule", {
        method: "POST",
        body: { draftId, scheduledAt },
      }),
    ),
)
tool(
  "social_review_draft",
  "Approve or reject a social draft in KronosChamber Social Ops",
  {
    draftId: z.string(),
    approved: z.boolean(),
    comment: z.string().optional(),
  },
  ({ draftId, approved, comment }) =>
    invokeWorkspaceTool("social_review_draft", { draftId, approved, comment }, () =>
      requestJson("/api/social/approve", {
        method: "POST",
        body: { draftId, approved, comment },
      }),
    ),
)
tool(
  "brand_check_content",
  "Run the native brand check against copy and media before publishing",
  {
    brandKitId: z.string().optional(),
    text: z.string(),
    mediaUrls: z.array(z.string()).optional(),
  },
  ({ brandKitId, text, mediaUrls }) =>
    invokeWorkspaceTool("brand_check_content", { brandKitId, text, mediaUrls }, () =>
      requestJson("/api/social/brand-check", {
        method: "POST",
        body: { brandKitId, text, mediaUrls },
      }),
    ),
)
tool(
  "video_create_clip_job",
  "Create a video clipping job in KronosChamber Video Studio",
  {
    sourceUrl: z.string(),
    platforms: z.array(z.string()).optional(),
    brandKitId: z.string().optional(),
    language: z.string().optional(),
    caption: z.string().optional(),
  },
  ({ sourceUrl, platforms, brandKitId, language, caption }) =>
    invokeWorkspaceTool("video_create_clip_job", { sourceUrl, platforms, brandKitId, language, caption }, () =>
      requestJson("/api/video/jobs", {
        method: "POST",
        body: { sourceUrl, platforms, brandKitId, language, caption },
      }),
    ),
)
tool(
  "video_get_clip_job",
  "Get the status and clip list for a Chamber Video Studio job",
  { jobId: z.string() },
  ({ jobId }) =>
    invokeWorkspaceTool("video_get_clip_job", { jobId }, () => requestJson(`/api/video/jobs/${encodeURIComponent(jobId)}`)),
)
tool(
  "video_send_clip_to_social",
  "Turn a reviewed video clip into a social draft in Chamber",
  {
    clipId: z.string(),
    platforms: z.array(z.string()).optional(),
    caption: z.string().optional(),
  },
  ({ clipId, platforms, caption }) =>
    invokeWorkspaceTool("video_send_clip_to_social", { clipId, platforms, caption }, () =>
      requestJson(`/api/video/clips/${encodeURIComponent(clipId)}/send-to-social`, {
        method: "POST",
        body: { platforms, caption },
      }),
    ),
)

// ── Express routes ────────────────────────────────────────────────────────────
const transports = new Map() // sessionId → SSEServerTransport

export function registerMcpRoutes(app) {
  app.get("/mcp", async (req, res) => {
    const transport = new SSEServerTransport("/mcp/message", res)
    transports.set(transport.sessionId, transport)
    res.on("close", () => transports.delete(transport.sessionId))
    await server.connect(transport)
  })

  app.post("/mcp/message", async (req, res) => {
    const transport = transports.get(req.query.sessionId)
    if (!transport) return res.status(400).json({ error: "Unknown session" })
    await transport.handlePostMessage(req, res)
  })
}
