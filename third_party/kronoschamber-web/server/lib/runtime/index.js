import fs from "fs"
import path from "path"
import { spawnSync } from "child_process"

const MAX_EVENT_HISTORY = 150
const MAX_OUTPUT_CHARS = 8000

const clampOutput = (value) => {
  if (typeof value !== "string") return ""
  if (value.length <= MAX_OUTPUT_CHARS) return value
  return `${value.slice(0, MAX_OUTPUT_CHARS)}\n...output truncated...`
}

const readOptionalObject = (value, fallback = {}) => (value && typeof value === "object" && !Array.isArray(value) ? value : fallback)

const resolveSafeCwd = (candidate, repoRootPath) => {
  const base = path.resolve(repoRootPath)
  const requested = typeof candidate === "string" && candidate.trim().length > 0 ? path.resolve(candidate) : base
  const withinRepo = requested === base || requested.startsWith(`${base}${path.sep}`)
  if (!withinRepo) return base
  return requested
}

const safeListFiles = (cwd) => {
  const entries = fs.readdirSync(cwd, { withFileTypes: true })
    .slice(0, 200)
    .map((entry) => ({
      name: entry.name,
      kind: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other",
    }))
  return entries
}

const runCommand = (command, args, cwd) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  })
  return {
    ok: result.status === 0,
    exitCode: typeof result.status === "number" ? result.status : 1,
    stdout: clampOutput(result.stdout || ""),
    stderr: clampOutput(result.stderr || ""),
  }
}

const executeTool = ({ toolName, input, cwd, sessionID }) => {
  switch (toolName) {
    case "workspace.pwd": {
      return {
        ok: true,
        output: { cwd },
        render: { kind: "terminal", title: "Working Directory", status: "completed", data: { text: cwd } },
      }
    }
    case "workspace.list-files": {
      const entries = safeListFiles(cwd)
      return {
        ok: true,
        output: { entries },
        render: { kind: "preview", title: "Workspace Files", status: "completed", data: { entries } },
      }
    }
    case "git.status": {
      const result = runCommand("git", ["status", "--short"], cwd)
      return {
        ok: result.ok,
        output: result,
        render: {
          kind: "diff",
          title: "Git Status",
          status: result.ok ? "completed" : "failed",
          data: { text: result.ok ? result.stdout || "Working tree clean." : result.stderr || result.stdout },
        },
      }
    }
    case "git.branch": {
      const result = runCommand("git", ["branch", "--show-current"], cwd)
      return {
        ok: result.ok,
        output: result,
        render: {
          kind: "terminal",
          title: "Current Branch",
          status: result.ok ? "completed" : "failed",
          data: { text: result.ok ? result.stdout.trim() || "(detached HEAD)" : result.stderr || result.stdout },
        },
      }
    }
    case "runtime.browser.open": {
      const url = typeof input?.url === "string" ? input.url.trim() : ""
      if (!url) {
        return {
          ok: false,
          output: { error: "input.url is required for runtime.browser.open" },
          render: { kind: "browser", title: "Browser", status: "failed", data: { error: "Missing URL" } },
        }
      }
      return {
        ok: true,
        output: { url },
        render: { kind: "browser", title: "Runtime Browser", status: "completed", data: { url } },
      }
    }
    default:
      // Signal the route handler to proxy this call to the kronoscode core engine.
      return { _proxy: true, toolName, input, sessionID }
  }
}

const findInstance = (state, instanceId) => state.instances.find((entry) => entry.id === instanceId) || null

const appendEvent = (instance, event) => {
  instance.events.unshift(event)
  instance.events = instance.events.slice(0, MAX_EVENT_HISTORY)
  instance.updatedAt = event.timestamp
}

const addEvent = ({ helpers, instance, type, status, payload = {} }) => {
  const event = {
    id: helpers.createId("runtime_event"),
    type,
    status,
    timestamp: helpers.nowTimestamp(),
    ...payload,
  }
  appendEvent(instance, event)
  return event
}

export const createRuntimeState = ({ nowTimestamp }) => ({
  instances: [
    {
      id: "runtime_instance_seed",
      name: "Primary Runtime",
      surface: "runtime",
      status: "idle",
      cwd: null,
      createdAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
      events: [],
    },
  ],
})

export const registerRuntimeRoutes = ({ app, state, helpers }) => {
  app.get("/api/runtime/bootstrap", async (_req, res) => {
    res.json({
      instances: state.instances,
      supportedTools: [
        "workspace.pwd",
        "workspace.list-files",
        "git.status",
        "git.branch",
        "runtime.browser.open",
      ],
    })
  })

  app.get("/api/runtime/instances", async (_req, res) => {
    res.json({ instances: state.instances })
  })

  app.get("/api/runtime/instances/:instanceId", async (req, res) => {
    const instance = findInstance(state, req.params.instanceId)
    if (!instance) {
      return res.status(404).json({ error: "runtime instance not found" })
    }
    return res.json(instance)
  })

  app.post("/api/runtime/instances", async (req, res) => {
    const name = helpers.normalizeOptionalString(req.body?.name) || "Runtime Instance"
    const surface = helpers.normalizeOptionalString(req.body?.surface) || "runtime"
    const cwd = resolveSafeCwd(req.body?.cwd, helpers.repoRootPath)
    const createdAt = helpers.nowTimestamp()
    const instance = {
      id: helpers.createId("runtime_instance"),
      name,
      surface,
      status: "running",
      cwd,
      createdAt,
      updatedAt: createdAt,
      events: [],
    }
    addEvent({
      helpers,
      instance,
      type: "instance.created",
      status: "completed",
      payload: { summary: `Runtime instance ${name} created` },
    })
    state.instances.unshift(instance)
    return res.status(201).json(instance)
  })

  app.post("/api/runtime/instances/:instanceId/stop", async (req, res) => {
    const instance = findInstance(state, req.params.instanceId)
    if (!instance) {
      return res.status(404).json({ error: "runtime instance not found" })
    }
    instance.status = "stopped"
    const event = addEvent({
      helpers,
      instance,
      type: "instance.stopped",
      status: "completed",
      payload: { summary: "Runtime instance stopped" },
    })
    return res.json({ instance, event })
  })

  app.get("/api/runtime/instances/:instanceId/events", async (req, res) => {
    const instance = findInstance(state, req.params.instanceId)
    if (!instance) {
      return res.status(404).json({ error: "runtime instance not found" })
    }
    return res.json({ events: instance.events })
  })

  app.post("/api/runtime/instances/:instanceId/tool-call", async (req, res) => {
    const instance = findInstance(state, req.params.instanceId)
    if (!instance) {
      return res.status(404).json({ error: "runtime instance not found" })
    }

    const toolName = helpers.normalizeOptionalString(req.body?.toolName)
    if (!toolName) {
      return res.status(400).json({ error: "toolName is required" })
    }

    const input = readOptionalObject(req.body?.input)
    const cwd = resolveSafeCwd(input.cwd || instance.cwd, helpers.repoRootPath)
    const sessionID = helpers.normalizeOptionalString(req.body?.sessionID) || instance.id

    const queuedEvent = addEvent({
      helpers,
      instance,
      type: "tool.queued",
      status: "queued",
      payload: { toolName },
    })

    const executed = executeTool({ toolName, input, cwd, sessionID })

    // ── Proxy to kronoscode core engine if the tool isn't handled locally ──
    if (executed._proxy) {
      const kronosCodeUrl = process.env.KRONOSCODE_API_URL || "http://localhost:3000"
      try {
        const proxyRes = await fetch(`${kronosCodeUrl}/api/tool/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toolName, input, sessionID }),
          signal: AbortSignal.timeout(30000),
        })
        const proxyData = await proxyRes.json().catch(() => ({}))
        const proxyOk = proxyRes.ok && (proxyData.ok !== false)

        const render = proxyData.render ?? {
          kind: "tool-output",
          title: toolName,
          status: proxyOk ? "completed" : "failed",
          data: proxyData.output ?? proxyData,
        }

        const resultEvent = addEvent({
          helpers,
          instance,
          type: "tool.result",
          status: proxyOk ? "completed" : "failed",
          payload: { toolName, output: proxyData.output ?? proxyData, render },
        })

        instance.status = "running"
        return res.status(proxyRes.status).json({
          ok: proxyOk,
          instanceId: instance.id,
          toolName,
          queuedEvent,
          event: resultEvent,
          render,
          output: proxyData.output ?? proxyData,
          proxied: true,
        })
      } catch (proxyError) {
        const errorOutput = { error: `Proxy to core engine failed: ${proxyError.message}` }
        const render = { kind: "tool-output", title: toolName, status: "failed", data: errorOutput }
        const resultEvent = addEvent({
          helpers,
          instance,
          type: "tool.result",
          status: "failed",
          payload: { toolName, output: errorOutput, render },
        })
        instance.status = "running"
        return res.status(502).json({
          ok: false,
          instanceId: instance.id,
          toolName,
          queuedEvent,
          event: resultEvent,
          render,
          output: errorOutput,
          proxied: true,
        })
      }
    }

    // ── Locally-handled tool ──
    const resultEvent = addEvent({
      helpers,
      instance,
      type: "tool.result",
      status: executed.ok ? "completed" : "failed",
      payload: {
        toolName,
        output: executed.output,
        render: executed.render,
      },
    })

    instance.status = "running"

    const statusCode = executed.ok ? 200 : toolName.startsWith("runtime.") ? 400 : 500
    return res.status(statusCode).json({
      ok: executed.ok,
      instanceId: instance.id,
      toolName,
      queuedEvent,
      event: resultEvent,
      render: executed.render,
      output: executed.output,
    })
  })
}
