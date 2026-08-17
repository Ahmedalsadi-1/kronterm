import crypto from "crypto"
import { execFile } from "child_process"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { promisify } from "util"
import { fileURLToPath } from "url"
import { WebSocket } from "ws"

const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEFAULT_VENDOR_REPO_DIR = path.resolve(__dirname, "../../../../../../third_party/upstream/sandbox-mcp-server")

const DEFAULT_PROVIDER_IMAGE = process.env.OPENCHAMBER_SANDBOX_MCP_IMAGE || "openchamber-sandbox-mcp-server:local"
const DEFAULT_PROVIDER_REPO_DIR =
  process.env.OPENCHAMBER_SANDBOX_MCP_REPO_DIR
  || DEFAULT_VENDOR_REPO_DIR
const DEFAULT_PROVIDER_DOCKERFILE =
  process.env.OPENCHAMBER_SANDBOX_MCP_DOCKERFILE
  || path.join(DEFAULT_PROVIDER_REPO_DIR, "Dockerfile.openchamber")
const DEFAULT_WORKSPACE_ROOT =
  process.env.OPENCHAMBER_SANDBOX_MCP_WORKSPACE_ROOT
  || path.join(os.tmpdir(), "openchamber-sandbox-mcp")
const DEFAULT_DISPLAY = process.env.OPENCHAMBER_SANDBOX_MCP_DISPLAY || ":1"
const DEFAULT_RESOLUTION = process.env.OPENCHAMBER_SANDBOX_MCP_RESOLUTION || "1920x1080"
const BUILD_IF_MISSING = process.env.OPENCHAMBER_SANDBOX_MCP_BUILD_IF_MISSING === "true"
const AUTO_INSTALL_ON_START = process.env.OPENCHAMBER_SANDBOX_MCP_AUTO_INSTALL !== "false"
const LOCAL_HOST = process.env.OPENCHAMBER_SANDBOX_MCP_LOCAL_HOST || "127.0.0.1"
const BASE_IMAGE_FALLBACK = process.env.OPENCHAMBER_SANDBOX_MCP_BASE_IMAGE || "ai-manus-sandbox:latest"
const MOUNTED_SOURCE_FALLBACK = process.env.OPENCHAMBER_SANDBOX_MCP_MOUNTED_SOURCE_FALLBACK !== "false"
let installPromise = null

const keyMap = {
  Return: "Return",
  enter: "Return",
  tab: "Tab",
  space: "space",
  backspace: "BackSpace",
  delete: "Delete",
  escape: "Escape",
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  home: "Home",
  end: "End",
  pageup: "Prior",
  pagedown: "Next",
  shift: "Shift_L",
  control: "Control_L",
  ctrl: "Control_L",
  alt: "Alt_L",
  super: "Super_L",
  meta: "Super_L",
}

const shellEscape = (value) => `'${String(value).replace(/'/g, `'\"'\"'`)}'`

const mapKey = (key) => {
  if (key.includes("+")) {
    return key
      .split("+")
      .map((part) => keyMap[part.toLowerCase()] || part)
      .join("+")
  }
  return keyMap[key.toLowerCase()] || keyMap[key] || key
}

const parsePortOutput = (stdout) => {
  const match = String(stdout).match(/:(\d+)\s*$/m)
  if (!match) {
    throw new Error(`Unable to parse docker port output: ${stdout}`)
  }
  return Number(match[1])
}

const parseToolContent = (result) => {
  const content = Array.isArray(result?.content) ? result.content : []
  const text = content
    .filter((entry) => entry && entry.type === "text" && typeof entry.text === "string")
    .map((entry) => entry.text)
    .join("\n")
    .trim()

  if (result?.isError) {
    throw new Error(text || "Sandbox MCP tool call failed")
  }

  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const runDocker = async (args, options = {}) => {
  const result = await execFileAsync("docker", args, {
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  })
  return {
    stdout: result.stdout?.trim?.() || "",
    stderr: result.stderr?.trim?.() || "",
  }
}

const ensureDockerAvailable = async () => {
  await runDocker(["version", "--format", "{{.Server.Version}}"])
}

const ensureRepoAvailable = async () => {
  const stat = await fs.stat(DEFAULT_PROVIDER_REPO_DIR).catch(() => null)
  if (!stat?.isDirectory()) {
    throw new Error(
      `sandbox-mcp-server source not found at ${DEFAULT_PROVIDER_REPO_DIR}. Vendor the repo there or set OPENCHAMBER_SANDBOX_MCP_REPO_DIR.`,
    )
  }
}

const imageExists = async () => {
  try {
    await runDocker(["image", "inspect", DEFAULT_PROVIDER_IMAGE])
    return true
  } catch {
    return false
  }
}

const ensureImageBuilt = async () => {
  if (await imageExists()) return
  if (!BUILD_IF_MISSING) {
    throw new Error(
      `Docker image ${DEFAULT_PROVIDER_IMAGE} is missing and auto-build is disabled. Build it manually or set OPENCHAMBER_SANDBOX_MCP_BUILD_IF_MISSING=true.`,
    )
  }
  await ensureRepoAvailable()
  const dockerArgs = ["build", "-t", DEFAULT_PROVIDER_IMAGE]
  try {
    await fs.access(DEFAULT_PROVIDER_DOCKERFILE)
    dockerArgs.push("-f", DEFAULT_PROVIDER_DOCKERFILE)
  } catch {
    // Fall back to upstream Dockerfile when no OpenChamber override is present.
  }
  dockerArgs.push(DEFAULT_PROVIDER_REPO_DIR)
  await runDocker(dockerArgs, {
    cwd: DEFAULT_PROVIDER_REPO_DIR,
  })
}

export const getSandboxMcpImageName = () => DEFAULT_PROVIDER_IMAGE

export const hasSandboxMcpRepoSource = async () => {
  const stat = await fs.stat(DEFAULT_PROVIDER_REPO_DIR).catch(() => null)
  return Boolean(stat?.isDirectory())
}

export const hasSandboxMcpImageInstalled = async () => imageExists()

export const ensureSandboxMcpImageInstalled = async ({ force = false, logger = console } = {}) => {
  if (!force && await imageExists()) {
    return { ok: true, image: DEFAULT_PROVIDER_IMAGE, built: false, reason: "already-installed" }
  }

  if (!force && !AUTO_INSTALL_ON_START && !BUILD_IF_MISSING) {
    return { ok: false, image: DEFAULT_PROVIDER_IMAGE, built: false, reason: "auto-install-disabled" }
  }

  if (!installPromise) {
    installPromise = (async () => {
      await ensureDockerAvailable()
      await ensureRepoAvailable()
      logger?.log?.(`[desktop-sandbox] building local image ${DEFAULT_PROVIDER_IMAGE}`)
      await ensureImageBuilt()
      logger?.log?.(`[desktop-sandbox] local image ready: ${DEFAULT_PROVIDER_IMAGE}`)
      return { ok: true, image: DEFAULT_PROVIDER_IMAGE, built: true, reason: "built" }
    })().finally(() => {
      installPromise = null
    })
  }

  return installPromise
}

const buildPublicHttpUrl = (req, port, pathname = "") => {
  const protocol = req.protocol || "http"
  const hostHeader = req.get("host") || "127.0.0.1"
  const hostname = hostHeader.replace(/:\d+$/, "")
  const basePath = pathname.startsWith("/") ? pathname : `/${pathname}`
  return `${protocol}://${hostname}:${port}${basePath}`
}

const buildLocalHttpUrl = (port, pathname = "") => {
  const basePath = pathname.startsWith("/") ? pathname : `/${pathname}`
  return `http://${LOCAL_HOST}:${port}${basePath}`
}

const resolveMappedPorts = async (containerId) => {
  const desktop = await runDocker(["port", containerId, "6080/tcp"])
  const terminal = await runDocker(["port", containerId, "7681/tcp"])
  const mcp = await runDocker(["port", containerId, "8765/tcp"])

  return {
    desktopPort: parsePortOutput(desktop.stdout),
    terminalPort: parsePortOutput(terminal.stdout),
    mcpPort: parsePortOutput(mcp.stdout),
  }
}

const waitForHttp = async (url, timeoutMs = 180_000) => {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

const callToolOverWebSocket = async (mcpUrl, name, argumentsObject = {}) => {
  const wsUrl = mcpUrl.replace(/^http/i, "ws")

  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let nextId = 1
    let initialized = false

    const send = (payload) => ws.send(JSON.stringify(payload))

    const cleanup = (error, value) => {
      try {
        ws.close()
      } catch {}
      if (error) reject(error)
      else resolve(value)
    }

    ws.on("open", () => {
      send({
        jsonrpc: "2.0",
        id: nextId++,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          clientInfo: {
            name: "openchamber-sandbox-mcp-bridge",
            version: "0.1.0",
          },
          capabilities: {},
        },
      })
    })

    ws.on("message", (raw) => {
      try {
        const message = JSON.parse(String(raw))
        if (message.error) {
          cleanup(new Error(message.error.message || "Sandbox MCP request failed"))
          return
        }

        if (!initialized) {
          initialized = true
          send({
            jsonrpc: "2.0",
            method: "notifications/initialized",
            params: {},
          })
          send({
            jsonrpc: "2.0",
            id: nextId++,
            method: "tools/call",
            params: {
              name,
              arguments: argumentsObject,
            },
          })
          return
        }

        cleanup(null, parseToolContent(message.result))
      } catch (error) {
        cleanup(error)
      }
    })

    ws.on("error", (error) => cleanup(error))
    ws.on("close", (code) => {
      if (!initialized) {
        cleanup(new Error(`Sandbox MCP WebSocket closed before initialization (${code})`))
      }
    })
  })
}

const buildActionCommand = (params, display = DEFAULT_DISPLAY) => {
  const { action, coordinate, text, scroll_amount, scroll_direction, start_coordinate, command } = params || {}
  const prefix = `export DISPLAY=${shellEscape(display)}; `

  switch (action) {
    case "bash":
      if (typeof command !== "string" || command.trim().length === 0) {
        throw new Error("Command is required")
      }
      return command.trim()
    case "screenshot":
      return `${prefix}import -window root /tmp/openchamber-screenshot.png >/dev/null 2>&1 || spectacle -b -n -o /tmp/openchamber-screenshot.png >/dev/null 2>&1; base64 -w0 /tmp/openchamber-screenshot.png`
    case "left_click": {
      if (!Array.isArray(coordinate)) {
        throw new Error("coordinate is required")
      }
      const [x, y] = coordinate.map((value) => Math.round(Number(value)))
      return `${prefix}xdotool mousemove --sync ${x} ${y} click 1`
    }
    case "double_click": {
      if (!Array.isArray(coordinate)) {
        throw new Error("coordinate is required")
      }
      const [x, y] = coordinate.map((value) => Math.round(Number(value)))
      return `${prefix}xdotool mousemove --sync ${x} ${y} click --repeat 2 1`
    }
    case "right_click": {
      if (!Array.isArray(coordinate)) {
        throw new Error("coordinate is required")
      }
      const [x, y] = coordinate.map((value) => Math.round(Number(value)))
      return `${prefix}xdotool mousemove --sync ${x} ${y} click 3`
    }
    case "mouse_move": {
      if (!Array.isArray(coordinate)) {
        throw new Error("coordinate is required")
      }
      const [x, y] = coordinate.map((value) => Math.round(Number(value)))
      return `${prefix}xdotool mousemove --sync ${x} ${y}`
    }
    case "type":
      if (typeof text !== "string" || text.length === 0) {
        throw new Error("Text required for type action")
      }
      return `${prefix}xdotool type --clearmodifiers -- ${shellEscape(text)}`
    case "key":
      if (typeof text !== "string" || text.length === 0) {
        throw new Error("Key required for key action")
      }
      return `${prefix}xdotool key ${shellEscape(mapKey(text))}`
    case "scroll": {
      const amount = Number.isFinite(scroll_amount) ? Math.max(1, Math.round(Number(scroll_amount))) : 1
      const button = scroll_direction === "up" ? 4 : 5
      return `${prefix}xdotool click --repeat ${amount} ${button}`
    }
    case "left_click_drag": {
      if (!Array.isArray(start_coordinate) || !Array.isArray(coordinate)) {
        throw new Error("start_coordinate and coordinate are required")
      }
      const [startX, startY] = start_coordinate.map((value) => Math.round(Number(value)))
      const [endX, endY] = coordinate.map((value) => Math.round(Number(value)))
      return `${prefix}xdotool mousemove ${startX} ${startY} mousedown 1 mousemove --sync ${endX} ${endY} mouseup 1`
    }
    default:
      throw new Error(`Unsupported sandbox-mcp action: ${action}`)
  }
}

export const isSandboxMcpProvider = (provider) => provider === "sandbox-mcp"

export async function createSandboxMcpRecord(req, { id, resolution = DEFAULT_RESOLUTION }) {
  await ensureDockerAvailable()
  await fs.mkdir(DEFAULT_WORKSPACE_ROOT, { recursive: true })

  const workspaceHostPath = path.join(DEFAULT_WORKSPACE_ROOT, id, "workspace")
  await fs.mkdir(workspaceHostPath, { recursive: true })

  const containerName = `openchamber-sandbox-${id.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 40)}`
  let imageName = DEFAULT_PROVIDER_IMAGE
  let runArgs = [
    "run",
    "-d",
    "--rm",
    "--name",
    containerName,
    "-e",
    "DESKTOP_ENABLED=true",
    "-e",
    `DESKTOP_RESOLUTION=${resolution}`,
    "-p",
    "127.0.0.1::6080",
    "-p",
    "127.0.0.1::7681",
    "-p",
    "127.0.0.1::8765",
    "-v",
    `${workspaceHostPath}:/workspace`,
  ]

  try {
    await ensureImageBuilt()
    runArgs.push(imageName)
  } catch (error) {
    if (!MOUNTED_SOURCE_FALLBACK) throw error
    imageName = BASE_IMAGE_FALLBACK
    runArgs.push(
      "-v",
      `${DEFAULT_PROVIDER_REPO_DIR}:/app`,
      imageName,
      "/bin/bash",
      "-lc",
      "bash /app/docker/openchamber-runtime-bootstrap.sh",
    )
  }

  const { stdout: containerId } = await runDocker(runArgs)

  const ports = await resolveMappedPorts(containerId)
  const mcpUrl = buildLocalHttpUrl(ports.mcpPort)
  await waitForHttp(`${mcpUrl}/health`)

  return {
    id,
    provider: "sandbox-mcp",
    status: "running",
    createdAt: Date.now(),
    connectionUrl: buildPublicHttpUrl(req, ports.desktopPort),
    streamUrl: buildPublicHttpUrl(req, ports.desktopPort),
    terminalUrl: buildPublicHttpUrl(req, ports.terminalPort),
    mcpUrl,
    containerId,
    containerName,
    workspaceHostPath,
    imageName,
    display: DEFAULT_DISPLAY,
    resolution,
    sandbox: null,
  }
}

export async function refreshSandboxMcpRecord(record) {
  try {
    const { stdout } = await runDocker(["inspect", "-f", "{{.State.Status}}", record.containerId])
    if (stdout === "running") {
      return {
        ...record,
        status: "running",
      }
    }
    return {
      ...record,
      status: stdout === "exited" ? "stopped" : "error",
      destroyedAt: stdout === "exited" ? Date.now() : record.destroyedAt,
    }
  } catch (error) {
    return {
      ...record,
      status: "stopped",
      destroyedAt: record.destroyedAt || Date.now(),
      lastError: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function destroySandboxMcpRecord(record) {
  try {
    await runDocker(["stop", "-t", "5", record.containerId])
  } catch {}

  return {
    ...record,
    status: "stopped",
    destroyedAt: Date.now(),
  }
}

export async function executeSandboxMcpAction(record, params) {
  const refreshed = await refreshSandboxMcpRecord(record)
  if (refreshed.status !== "running") {
    throw new Error("Sandbox MCP container is not running")
  }

  const action = typeof params?.action === "string" ? params.action : "bash"

  if (action === "wait") {
    const seconds = Number.isFinite(params?.duration) ? Math.max(0, Number(params.duration)) : 1
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
    return {
      type: "text",
      text: `Waited for ${seconds} seconds`,
    }
  }

  const command = buildActionCommand(params, refreshed.display || DEFAULT_DISPLAY)
  const result = await callToolOverWebSocket(refreshed.mcpUrl, "bash", { command })

  if (action === "screenshot") {
    const data = typeof result === "string" ? result.trim() : ""
    if (!data) {
      throw new Error("Sandbox MCP screenshot returned no data")
    }
    return {
      type: "image",
      mimeType: "image/png",
      data: `data:image/png;base64,${data}`,
      width: 0,
      height: 0,
    }
  }

  if (action === "bash") {
    return {
      type: "text",
      text: typeof result === "string" ? result : JSON.stringify(result),
    }
  }

  return {
    type: "text",
    text: `Action ${action} complete`,
  }
}
