import { spawn } from "child_process"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"
import net from "net"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const findRepoRootPath = () => {
  const candidates = [
    path.resolve(__dirname, "..", "..", "..", ".."),
    path.resolve(__dirname, "..", "..", "..", "..", ".."),
    path.resolve(process.cwd()),
    path.resolve(process.cwd(), ".."),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "third_party", "upstream"))) {
      return candidate
    }
  }

  return candidates[0]
}

const PROJECT_ROOT = findRepoRootPath()
const CHAMBER_ROOT = fs.existsSync(path.join(PROJECT_ROOT, "kronosChamber"))
  ? path.join(PROJECT_ROOT, "kronosChamber")
  : PROJECT_ROOT

// Service configurations
const SERVICES = {
  jaaz: {
    name: "Jaaz",
    ports: { server: 8001, web: 5173 },
    paths: {
      server: path.join(PROJECT_ROOT, "third_party", "upstream", "jaaz", "server"),
      web: path.join(PROJECT_ROOT, "third_party", "upstream", "jaaz", "react"),
    },
    commands: {
      server: ["python", ["main.py"]],
      web: ["npm", ["run", "dev"]],
    },
    healthEndpoint: "http://127.0.0.1:8001/api/health",
    envVars: {
      OPENCHAMBER_JAAZ_APP_ORIGIN: "http://localhost:5173",
      OPENCHAMBER_JAAZ_API_URL: "http://localhost:8001",
    },
  },
  nocobase: {
    name: "NocoBase",
    ports: { server: 13000 },
    paths: {
      server: path.join(PROJECT_ROOT, "third_party", "upstream", "nocobase"),
    },
    commands: {
      server: ["yarn", ["start"]],
    },
    healthEndpoint: "http://127.0.0.1:13000/api/health",
    envVars: {
      OPENCHAMBER_NOCOBASE_ORIGIN: "http://localhost:13000",
    },
    // Nocobase requires manual setup first (DB config)
    requiresSetup: true,
  },
  postiz: {
    name: "Postiz",
    ports: { app: 4007 },
    paths: {
      app: path.join(PROJECT_ROOT, "third_party", "upstream", "postiz-app"),
    },
    commands: {
      app: ["docker", ["compose", "-f", "docker-compose.yaml", "up"]],
    },
    healthEndpoint: "http://127.0.0.1:4007",
    envVars: {
      OPENCHAMBER_POSTIZ_ORIGIN: "http://localhost:4007",
    },
    requiresDocker: true,
  },
  supoclip: {
    name: "SupoClip",
    ports: { frontend: 4310, backend: 8000 },
    paths: {
      app: path.join(PROJECT_ROOT, "third_party", "upstream", "supoclip"),
    },
    commands: {
      app: ["docker", ["compose", "-f", "docker-compose.yml", "up"]],
    },
    healthEndpoint: "http://127.0.0.1:4310",
    envVars: {
      OPENCHAMBER_SUPOCLIP_ORIGIN: "http://localhost:4310",
      SUPOCLIP_FRONTEND_PORT: "4310",
      NEXT_PUBLIC_APP_URL: "http://localhost:4310",
      BETTER_AUTH_URL: "http://localhost:4310",
      CORS_ORIGINS: "http://localhost:4310,http://sp.localhost:4310",
    },
    requiresDocker: true,
  },
}

const runningProcesses = new Map()
const serviceLogs = new Map()

/**
 * Check if a port is in use
 */
async function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => resolve(true))
      .once("listening", () => {
        tester.once("close", () => resolve(false)).close()
      })
      .listen(port)
  })
}

function hasDockerCompose() {
  const dockerSocket = process.platform === "win32" ? null : "/var/run/docker.sock"
  if (dockerSocket && !fs.existsSync(dockerSocket)) {
    // Docker Desktop on macOS may not expose this path, so still try the CLI.
  }
  return true
}

/**
 * Check service health
 */
async function checkServiceHealth(endpoint, timeout = 5000) {
  try {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(timeout),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Start a service process
 */
function startServiceProcess(serviceId, type, command, cwd, env = {}) {
  const [cmd, args] = command
  const logKey = `${serviceId}-${type}`

  console.log(`[AutoStart] Starting ${SERVICES[serviceId].name} ${type}...`)

  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    detached: false,
    stdio: ["ignore", "pipe", "pipe"],
  })

  // Collect logs
  let logs = ""
  child.stdout?.on("data", (data) => {
    logs += data.toString()
    serviceLogs.set(logKey, logs.slice(-5000)) // Keep last 5000 chars
  })
  child.stderr?.on("data", (data) => {
    logs += `[ERR] ${data.toString()}`
    serviceLogs.set(logKey, logs.slice(-5000))
  })

  child.on("error", (error) => {
    console.error(`[AutoStart] ${serviceId} ${type} error:`, error.message)
  })

  child.on("exit", (code) => {
    console.log(`[AutoStart] ${serviceId} ${type} exited with code ${code}`)
    runningProcesses.delete(`${serviceId}-${type}`)
  })

  runningProcesses.set(`${serviceId}-${type}`, child)
  return child
}

function setServiceEnv(serviceId) {
  const service = SERVICES[serviceId]
  for (const [key, value] of Object.entries(service.envVars || {})) {
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

/**
 * Check if dependencies are installed
 */
function checkDependencies(serviceId) {
  const service = SERVICES[serviceId]
  if (service.requiresDocker) {
    return fs.existsSync(service.paths.app)
  }
  const checks = []

  if (service.paths.web) {
    const nodeModules = path.join(service.paths.web, "node_modules")
    checks.push(fs.existsSync(nodeModules))
  }
  if (service.paths.server) {
    // Check for Python requirements or package files
    const hasRequirements = fs.existsSync(path.join(service.paths.server, "requirements.txt"))
    const hasPackage = fs.existsSync(path.join(service.paths.server, "package.json"))
    checks.push(hasRequirements || hasPackage)
  }

  return checks.every(Boolean)
}

async function startDockerStack(serviceId) {
  const service = SERVICES[serviceId]
  setServiceEnv(serviceId)

  const portChecks = await Promise.all(Object.values(service.ports).map((port) => isPortInUse(port)))
  if (portChecks.some(Boolean)) {
    console.log(`[AutoStart] ${service.name} already has an expected port in use`)
    return { success: true, alreadyRunning: true }
  }

  if (!checkDependencies(serviceId)) {
    return { success: false, error: `${service.name} upstream checkout is missing` }
  }

  if (!hasDockerCompose()) {
    return { success: false, error: "Docker Compose is not available" }
  }

  const process = startServiceProcess(serviceId, "app", service.commands.app, service.paths.app, service.envVars)

  const maxAttempts = 90
  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    const healthy = await checkServiceHealth(service.healthEndpoint, 2000)
    if (healthy) {
      console.log(`[AutoStart] ${service.name} is healthy and ready`)
      return { success: true, processes: [process] }
    }
    await new Promise((r) => setTimeout(r, 1000))
  }

  console.warn(`[AutoStart] ${service.name} health check timeout - stack may still be starting`)
  return { success: true, processes: [process], warning: "Health check timeout" }
}

/**
 * Start Jaaz services
 */
export async function startJaaz() {
  const service = SERVICES.jaaz
  const processes = []

  // Check if already running
  const serverRunning = await isPortInUse(service.ports.server)
  const webRunning = await isPortInUse(service.ports.web)

  if (serverRunning && webRunning) {
    console.log("[AutoStart] Jaaz already running")
    return { success: true, alreadyRunning: true }
  }

  // Check dependencies
  if (!checkDependencies("jaaz")) {
    console.error("[AutoStart] Jaaz dependencies not installed. Run: cd jaaz/react && npm install --force")
    return { success: false, error: "Dependencies not installed" }
  }

  // Start server if not running
  if (!serverRunning) {
    processes.push(startServiceProcess("jaaz", "server", service.commands.server, service.paths.server))
    await new Promise((r) => setTimeout(r, 2000)) // Give server time to start
  }

  // Start web UI if not running
  if (!webRunning) {
    processes.push(startServiceProcess("jaaz", "web", service.commands.web, service.paths.web))
    await new Promise((r) => setTimeout(r, 3000))
  }

  // Wait for health check
  let attempts = 0
  const maxAttempts = 30
  while (attempts < maxAttempts) {
    const healthy = await checkServiceHealth(service.healthEndpoint)
    if (healthy) {
      console.log("[AutoStart] Jaaz is healthy and ready")
      return { success: true, processes }
    }
    await new Promise((r) => setTimeout(r, 1000))
    attempts++
  }

  console.warn("[AutoStart] Jaaz health check timeout - may still be starting")
  return { success: true, processes, warning: "Health check timeout" }
}

/**
 * Start NocoBase services
 */
export async function startNocobase() {
  const service = SERVICES.nocobase

  // Check if already running
  const running = await isPortInUse(service.ports.server)
  if (running) {
    console.log("[AutoStart] NocoBase already running")
    return { success: true, alreadyRunning: true }
  }

  // Check if configured
  if (service.requiresSetup) {
    const envFile = path.join(service.paths.server, ".env")
    if (!fs.existsSync(envFile)) {
      console.warn("[AutoStart] NocoBase not configured. Create .env file first.")
      return { success: false, error: "Not configured - create .env with DB settings" }
    }
  }

  // Check dependencies
  if (!checkDependencies("nocobase")) {
    console.error("[AutoStart] NocoBase dependencies not installed. Run: cd nocobase && yarn install")
    return { success: false, error: "Dependencies not installed" }
  }

  // Start server
  const process = startServiceProcess("nocobase", "server", service.commands.server, service.paths.server)

  // Wait for start
  await new Promise((r) => setTimeout(r, 10000))

  return { success: true, processes: [process] }
}

export async function startPostiz() {
  return startDockerStack("postiz")
}

export async function startSupoClip() {
  return startDockerStack("supoclip")
}

/**
 * Stop all auto-started services
 */
export function stopAllServices() {
  console.log("[AutoStart] Stopping all services...")

  for (const [key, process] of runningProcesses) {
    try {
      process.kill("SIGTERM")
      setTimeout(() => {
        if (!process.killed) {
          process.kill("SIGKILL")
        }
      }, 5000)
    } catch (error) {
      console.error(`[AutoStart] Failed to stop ${key}:`, error.message)
    }
  }

  runningProcesses.clear()
}

/**
 * Get service status
 */
export async function getServiceStatus() {
  const status = {}

  for (const [id, service] of Object.entries(SERVICES)) {
    const ports = Object.values(service.ports)
    const portChecks = await Promise.all(ports.map((port) => isPortInUse(port)))
    const running = portChecks.some(Boolean) // At least one port active

    let healthy = false
    if (running && service.healthEndpoint) {
      healthy = await checkServiceHealth(service.healthEndpoint, 2000)
    }

    status[id] = {
      name: service.name,
      running,
      healthy,
      ports: service.ports,
      processes: Array.from(runningProcesses.keys()).filter((k) => k.startsWith(id)),
    }
  }

  return status
}

/**
 * Get service logs
 */
export function getServiceLogs(serviceId, type = "server") {
  return serviceLogs.get(`${serviceId}-${type}`) || ""
}

/**
 * Auto-start all enabled services
 */
export async function autoStartServices() {
  const results = {}

  // Check environment variable to enable auto-start
  const autoStartJaaz = process.env.OPENCHAMBER_AUTOSTART_JAAZ === "1"
  const autoStartNocobase = process.env.OPENCHAMBER_AUTOSTART_NOCOBASE === "1"
  const autoStartPostiz = process.env.OPENCHAMBER_AUTOSTART_POSTIZ === "1" || process.env.OPENCHAMBER_AUTOSTART_SOCIAL === "1"
  const autoStartSupoClip =
    process.env.OPENCHAMBER_AUTOSTART_SUPOCLIP === "1" || process.env.OPENCHAMBER_AUTOSTART_VIDEO === "1"

  if (autoStartJaaz) {
    try {
      results.jaaz = await startJaaz()
    } catch (error) {
      results.jaaz = { success: false, error: error.message }
    }
  }

  if (autoStartNocobase) {
    try {
      results.nocobase = await startNocobase()
    } catch (error) {
      results.nocobase = { success: false, error: error.message }
    }
  }

  if (autoStartPostiz) {
    try {
      results.postiz = await startPostiz()
    } catch (error) {
      results.postiz = { success: false, error: error.message }
    }
  }

  if (autoStartSupoClip) {
    try {
      results.supoclip = await startSupoClip()
    } catch (error) {
      results.supoclip = { success: false, error: error.message }
    }
  }

  return results
}

export { SERVICES }
