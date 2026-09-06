import fs from "node:fs"
import path from "node:path"

const UI_FILE_PATTERN = /\.(tsx|ts|jsx|js)$/
const SKIP_FILE_PATTERN = /\.(test|spec)\.(tsx|ts|jsx|js)$/
const SKIP_DIRS = new Set([".git", ".next", ".turbo", "coverage", "dist", "node_modules", "out"])

const findWorkspaceRoot = () => {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "../.."),
    path.resolve(process.cwd(), "../../.."),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "third_party", "upstream"))) {
      return candidate
    }
  }

  return path.resolve(process.cwd(), "..")
}

const walkFiles = (root, prefix = "", seen = new Set()) => {
  if (!fs.existsSync(root)) return []
  const currentDirectory = path.join(root, prefix)
  const currentRealPath = fs.realpathSync(currentDirectory)
  if (seen.has(currentRealPath)) return []
  seen.add(currentRealPath)

  const entries = fs.readdirSync(currentDirectory, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const relativePath = path.join(prefix, entry.name)
    const absolutePath = path.join(root, relativePath)

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) return []
      return walkFiles(root, relativePath, seen)
    }

    if (!entry.isFile() || !UI_FILE_PATTERN.test(entry.name) || SKIP_FILE_PATTERN.test(entry.name)) {
      return []
    }

    return relativePath.split(path.sep).join("/")
  })
}

const classifyPostizComponent = (relativePath) => {
  if (relativePath.startsWith("media/")) return "media"
  if (relativePath.startsWith("launches/") || relativePath.startsWith("new-launch/")) return "composer-calendar"
  if (relativePath.startsWith("analytics/") || relativePath.startsWith("platform-analytics/")) return "analytics"
  if (relativePath.startsWith("settings/")) return "settings"
  if (relativePath.startsWith("third-parties/")) return "integrations-media"
  if (relativePath.startsWith("videos/")) return "video"
  if (relativePath.startsWith("ui/")) return "ui-atom"
  if (relativePath.startsWith("layout/") || relativePath.startsWith("new-layout/")) return "layout-shell"
  return "other"
}

const classifySupoClipComponent = (relativePath) => {
  if (relativePath.startsWith("components/ui/")) return "ui-atom"
  if (relativePath.startsWith("components/auth/")) return "auth-ui"
  if (relativePath.startsWith("components/admin/")) return "admin-ui"
  if (relativePath.startsWith("components/")) return "component"
  if (relativePath.startsWith("app/api/")) return "backend-route"
  if (relativePath.startsWith("app/tasks/")) return "task-page"
  if (relativePath.startsWith("app/")) return "app-page"
  if (relativePath.startsWith("server/")) return "server-backend"
  if (relativePath.startsWith("lib/")) return "backend-lib"
  return "other"
}

const buildSummary = (components) => {
  const byCategory = components.reduce((acc, component) => {
    acc[component.category] = (acc[component.category] || 0) + 1
    return acc
  }, {})

  const runnable = components.filter((component) => component.status === "direct-imported").length
  const shimmed = components.filter((component) => component.status === "registered-needs-shim").length
  const backend = components.filter((component) => component.status === "conjoined-backend-route").length

  return {
    total: components.length,
    directImported: runnable,
    registeredNeedsShim: shimmed,
    conjoinedBackendRoutes: backend,
    byCategory,
  }
}

export const createUpstreamComponentManifest = () => {
  const workspaceRoot = findWorkspaceRoot()
  const postizRoot = path.join(workspaceRoot, "third_party/upstream/postiz-app/apps/frontend/src/components")
  const supoclipRoot = path.join(workspaceRoot, "third_party/upstream/supoclip/frontend/src")

  const postizComponents = walkFiles(postizRoot).map((relativePath) => ({
    app: "postiz",
    name: relativePath.replace(/\.(tsx|ts|jsx|js)$/, ""),
    path: `third_party/upstream/postiz-app/apps/frontend/src/components/${relativePath}`,
    importPath: `@postiz-upstream/components/${relativePath.replace(/\.(tsx|ts|jsx|js)$/, "")}`,
    category: classifyPostizComponent(relativePath),
    status: relativePath.startsWith("ui/") ? "direct-imported" : "registered-needs-shim",
  }))

  const supoclipComponents = walkFiles(supoclipRoot).map((relativePath) => {
    const category = classifySupoClipComponent(relativePath)
    const direct =
      relativePath.startsWith("components/ui/") ||
      relativePath === "components/dynamic-video-player.tsx" ||
      relativePath === "components/feedback-button.tsx"

    return {
      app: "supoclip",
      name: relativePath.replace(/\.(tsx|ts|jsx|js)$/, ""),
      path: `third_party/upstream/supoclip/frontend/src/${relativePath}`,
      importPath: `@supoclip-upstream/${relativePath.replace(/\.(tsx|ts|jsx|js)$/, "")}`,
      category,
      status: category === "backend-route" || category === "server-backend" || category === "backend-lib"
        ? "conjoined-backend-route"
        : direct
          ? "direct-imported"
          : "registered-needs-shim",
    }
  })

  return {
    workspaceRoot,
    generatedAt: Date.now(),
    postiz: {
      root: postizRoot,
      summary: buildSummary(postizComponents),
      components: postizComponents,
    },
    supoclip: {
      root: supoclipRoot,
      summary: buildSummary(supoclipComponents),
      components: supoclipComponents,
    },
  }
}
