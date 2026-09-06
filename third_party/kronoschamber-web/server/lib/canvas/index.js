import fs from "fs"
import path from "path"
import { spawnSync } from "child_process"

const DEFAULT_WORKSPACE_ID = "canvas_workspace_main"

const CANVAS_ACTION_COMPATIBILITY_MAP = new Map([
  ["create-node", "createNode"],
  ["create-node-block", "createNode"],
  ["update-node", "updateNode"],
  ["delete-node", "deleteNode"],
  ["connect-nodes", "connectNodes"],
  ["delete-edge", "deleteEdge"],
  ["create-branch", "createBranch"],
  ["update-branch", "updateBranch"],
  ["delete-branch", "deleteBranch"],
  ["select-node", "selectNode"],
  ["update-workspace", "updateWorkspace"],
  ["spawn-browser-block", "createNode"],
  ["spawn-terminal-block", "createNode"],
  ["create-ai-branch", "createBranch"],
  ["attach-artifact", "updateNode"],
])

const toCanvasActionLookupKey = (value) =>
  typeof value === "string" && value.trim().length > 0
    ? value
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[_\s]+/g, "-")
        .toLowerCase()
    : ""

const normalizeCanvasActionName = (value) => {
  const lookupKey = toCanvasActionLookupKey(value)
  if (!lookupKey) {
    return ""
  }
  return CANVAS_ACTION_COMPATIBILITY_MAP.get(lookupKey) || value.trim()
}

const readNormalizedString = (helpers, ...candidates) => {
  for (const candidate of candidates) {
    const normalized = helpers.normalizeOptionalString(candidate)
    if (normalized) {
      return normalized
    }
  }
  return ""
}

const readNormalizedNumber = (...candidates) => {
  for (const candidate of candidates) {
    if (Number.isFinite(candidate)) {
      return Number(candidate)
    }
  }
  return undefined
}

const readOptionalPayloadObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {})

const normalizeCanvasActionRequest = (input, helpers) => {
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {}
  const firstAction =
    Array.isArray(body.actions) && body.actions.length > 0 && body.actions[0] && typeof body.actions[0] === "object"
      ? body.actions[0]
      : null
  const nestedAction = readOptionalPayloadObject(body.action)
  const nestedFirstAction = readOptionalPayloadObject(firstAction?.action)

  const payloadObject = readOptionalPayloadObject(
    firstAction?.payload || nestedFirstAction.payload || nestedAction.payload || body.payload,
  )
  const source = {
    ...payloadObject,
    ...body,
    ...nestedAction,
    ...(firstAction && typeof firstAction === "object" ? firstAction : {}),
    ...nestedFirstAction,
  }

  const action = normalizeCanvasActionName(
    typeof source.action === "string"
      ? source.action
      : typeof firstAction?.action === "string"
        ? firstAction.action
        : typeof body.action === "string"
          ? body.action
          : source.type,
  )
  const workspaceId = readNormalizedString(
    helpers,
    source.workspaceId,
    source.workspace_id,
    source.workspace?.id,
    source.workspace?.workspaceId,
  )

  const normalized = {
    ...source,
    action,
    workspaceId: workspaceId || DEFAULT_WORKSPACE_ID,
  }

  if (action === "createNode") {
    const nodePayload = readOptionalPayloadObject(source.node)
    const legacyAction = toCanvasActionLookupKey(source.action || source.type)
    const inferredNodeType =
      legacyAction === "spawn-browser-block"
        ? "browser"
        : legacyAction === "spawn-terminal-block"
          ? "terminal"
          : undefined
    const nodeType = readNormalizedString(
      helpers,
      nodePayload.nodeType,
      nodePayload.node_type,
      nodePayload.type,
      source.nodeType,
      source.node_type,
      inferredNodeType,
    )
    const title = readNormalizedString(helpers, nodePayload.title, source.title)
    return {
      action: "createNode",
      workspaceId: normalized.workspaceId,
      nodeType: nodeType || "note",
      title:
        title ||
        (toCanvasActionLookupKey(source.action || source.type) === "spawn-browser-block"
          ? "Browser Node"
          : toCanvasActionLookupKey(source.action || source.type) === "spawn-terminal-block"
            ? "Terminal Node"
            : "Untitled block"),
      x: readNormalizedNumber(nodePayload.x, source.x),
      y: readNormalizedNumber(nodePayload.y, source.y),
      width: readNormalizedNumber(nodePayload.width, source.width),
      height: readNormalizedNumber(nodePayload.height, source.height),
      content:
        typeof nodePayload.content === "string"
          ? nodePayload.content
          : typeof source.content === "string"
            ? source.content
            : "",
      metadata: {
        ...readOptionalPayloadObject(nodePayload.metadata),
        ...readOptionalPayloadObject(source.metadata),
      },
      branchId:
        source.branchId === null || nodePayload.branchId === null
          ? null
          : readNormalizedString(helpers, nodePayload.branchId, source.branchId) || null,
    }
  }

  if (action === "updateNode") {
    const nodeId = readNormalizedString(helpers, source.nodeId, source.node_id, source.id)
    const patchSource = readOptionalPayloadObject(source.patch)
    const compatibilityPatch = {
      title: source.title,
      content: source.content,
      x: source.x,
      y: source.y,
      width: source.width,
      height: source.height,
      metadata: source.metadata,
      branchId: source.branchId,
    }
    const patch = Object.keys(patchSource).length > 0 ? patchSource : compatibilityPatch
    const legacyAction = toCanvasActionLookupKey(source.action || source.type)
    if (legacyAction === "attach-artifact") {
      const artifactId = readNormalizedString(helpers, source.artifactId, source.artifact_id)
      return {
        action: "updateNode",
        workspaceId: normalized.workspaceId,
        nodeId,
        patch: {
          metadata: {
            ...readOptionalPayloadObject(source.metadata),
            attachedArtifactId: artifactId || undefined,
          },
        },
      }
    }
    return {
      action: "updateNode",
      workspaceId: normalized.workspaceId,
      nodeId,
      patch,
    }
  }

  if (action === "deleteNode") {
    return {
      action: "deleteNode",
      workspaceId: normalized.workspaceId,
      nodeId: readNormalizedString(helpers, source.nodeId, source.node_id, source.id),
    }
  }

  if (action === "connectNodes") {
    return {
      action: "connectNodes",
      workspaceId: normalized.workspaceId,
      sourceNodeId: readNormalizedString(
        helpers,
        source.sourceNodeId,
        source.source_node_id,
        source.sourceId,
        source.fromNodeId,
      ),
      targetNodeId: readNormalizedString(
        helpers,
        source.targetNodeId,
        source.target_node_id,
        source.targetId,
        source.toNodeId,
      ),
      label: readNormalizedString(helpers, source.label) || undefined,
    }
  }

  if (action === "deleteEdge") {
    return {
      action: "deleteEdge",
      workspaceId: normalized.workspaceId,
      edgeId: readNormalizedString(helpers, source.edgeId, source.edge_id, source.id),
    }
  }

  if (action === "createBranch") {
    return {
      action: "createBranch",
      workspaceId: normalized.workspaceId,
      rootNodeId: readNormalizedString(
        helpers,
        source.rootNodeId,
        source.root_node_id,
        source.sourceNodeId,
        source.nodeId,
      ),
      parentBranchId:
        source.parentBranchId === null
          ? null
          : readNormalizedString(helpers, source.parentBranchId, source.parent_branch_id) || null,
      label: readNormalizedString(helpers, source.label) || undefined,
    }
  }

  if (action === "updateBranch") {
    const patchSource = readOptionalPayloadObject(source.patch)
    const compatibilityPatch = {
      label: source.label,
      parentBranchId: source.parentBranchId,
    }
    return {
      action: "updateBranch",
      workspaceId: normalized.workspaceId,
      branchId: readNormalizedString(helpers, source.branchId, source.branch_id, source.id),
      patch: Object.keys(patchSource).length > 0 ? patchSource : compatibilityPatch,
    }
  }

  if (action === "deleteBranch") {
    return {
      action: "deleteBranch",
      workspaceId: normalized.workspaceId,
      branchId: readNormalizedString(helpers, source.branchId, source.branch_id, source.id),
    }
  }

  if (action === "selectNode") {
    const nodeIdCandidate = source.nodeId ?? source.node_id ?? source.selectedNodeId
    return {
      action: "selectNode",
      workspaceId: normalized.workspaceId,
      nodeId: nodeIdCandidate === null ? null : readNormalizedString(helpers, nodeIdCandidate) || null,
    }
  }

  if (action === "updateWorkspace") {
    const patchSource = readOptionalPayloadObject(source.patch)
    const compatibilityPatch = {
      focusedNodeId: source.focusedNodeId,
      recentlyActiveNodeIds: source.recentlyActiveNodeIds,
      canvasDisplayMode: source.canvasDisplayMode,
      canvasViewport: source.canvasViewport,
    }
    return {
      action: "updateWorkspace",
      workspaceId: normalized.workspaceId,
      patch: Object.keys(patchSource).length > 0 ? patchSource : compatibilityPatch,
    }
  }

  return normalized
}

const canvasErrorCodeForStatus = (statusCode) => {
  if (statusCode === 400) return "CANVAS_BAD_REQUEST"
  if (statusCode === 404) return "CANVAS_NOT_FOUND"
  if (statusCode >= 500) return "CANVAS_SERVER_ERROR"
  return "CANVAS_ERROR"
}

const normalizeCanvasErrorBody = (statusCode, body, fallbackCode) => {
  const code = fallbackCode || canvasErrorCodeForStatus(statusCode)
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return {
      ...body,
      code: typeof body.code === "string" && body.code.trim().length > 0 ? body.code : code,
    }
  }
  return {
    code,
    error: typeof body === "string" && body.trim().length > 0 ? body : "Canvas request failed",
  }
}

const createCanvasHistoryEntry = (helpers, workspaceId, entry) => ({
  id: helpers.createId("canvas_history"),
  workspaceId,
  actor: "user",
  timestamp: helpers.nowTimestamp(),
  ...entry,
})

const appendCanvasHistory = (helpers, workspace, entry) => {
  if (!Array.isArray(workspace.history)) {
    workspace.history = []
  }
  workspace.history.unshift(createCanvasHistoryEntry(helpers, workspace.id, entry))
  workspace.history = workspace.history.slice(0, 100)
}

const touchCanvasWorkspace = (helpers, workspace) => {
  workspace.updatedAt = helpers.nowTimestamp()
  return workspace.updatedAt
}

const readRequiredString = (helpers, value, fieldName) => {
  const normalized = helpers.normalizeOptionalString(value)
  if (!normalized) {
    const error = new Error(`${fieldName} is required`)
    error.statusCode = 400
    throw error
  }
  return normalized
}

const readOptionalNumber = (value, fallback) => (Number.isFinite(value) ? Number(value) : fallback)

const readOptionalObject = (value, fallback = {}) => (value && typeof value === "object" ? value : fallback)
const normalizeCanvasViewport = (value) => {
  const viewport = readOptionalObject(value, {})
  const x = readOptionalNumber(viewport.x, 0)
  const y = readOptionalNumber(viewport.y, 0)
  const zoom = Math.min(2, Math.max(0.1, readOptionalNumber(viewport.zoom, 1)))
  return { x, y, zoom }
}
const dedupeStringArray = (value, limit = 5) => {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const items = []
  for (const entry of value) {
    if (typeof entry !== "string" || !entry.trim()) continue
    const normalized = entry.trim()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    items.push(normalized)
    if (items.length >= limit) break
  }
  return items
}

const ensureWorkspaceShape = (workspace) => {
  if (!workspace || typeof workspace !== "object") return workspace
  if (!Array.isArray(workspace.nodes)) workspace.nodes = []
  if (!Array.isArray(workspace.edges)) workspace.edges = []
  if (!Array.isArray(workspace.branches)) workspace.branches = []
  if (!Array.isArray(workspace.history)) workspace.history = []
  if (typeof workspace.activeNodeId === "undefined") workspace.activeNodeId = null
  if (typeof workspace.focusedNodeId === "undefined") workspace.focusedNodeId = workspace.activeNodeId || null
  if (!Array.isArray(workspace.recentlyActiveNodeIds)) workspace.recentlyActiveNodeIds = []
  workspace.recentlyActiveNodeIds = dedupeStringArray(workspace.recentlyActiveNodeIds, 5)
  if (workspace.canvasDisplayMode !== "widget" && workspace.canvasDisplayMode !== "spatial") {
    workspace.canvasDisplayMode = "spatial"
  }
  workspace.canvasViewport = normalizeCanvasViewport(workspace.canvasViewport)
  return workspace
}

export const createCanvasState = ({ nowTimestamp }) => ({
  workspaces: [
    {
      id: DEFAULT_WORKSPACE_ID,
      name: "Chamber Canvas",
      nodes: [],
      edges: [],
      branches: [],
      activeNodeId: null,
      focusedNodeId: null,
      recentlyActiveNodeIds: [],
      canvasDisplayMode: "spatial",
      canvasViewport: { x: 0, y: 0, zoom: 1 },
      history: [],
      createdAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
    },
  ],
})

export const registerCanvasRoutes = ({ app, state, helpers }) => {
  const createWorkspaceRecord = (workspaceId = DEFAULT_WORKSPACE_ID, name = "Chamber Canvas") => ({
    id: workspaceId,
    name,
    nodes: [],
    edges: [],
    branches: [],
    activeNodeId: null,
    focusedNodeId: null,
    recentlyActiveNodeIds: [],
    canvasDisplayMode: "spatial",
    canvasViewport: { x: 0, y: 0, zoom: 1 },
    history: [],
    createdAt: helpers.nowTimestamp(),
    updatedAt: helpers.nowTimestamp(),
  })

  const ensureWorkspacesState = () => {
    if (!Array.isArray(state.workspaces)) {
      state.workspaces = [createWorkspaceRecord(DEFAULT_WORKSPACE_ID)]
      return
    }

    state.workspaces = state.workspaces
      .filter(
        (entry) => entry && typeof entry === "object" && typeof entry.id === "string" && entry.id.trim().length > 0,
      )
      .map((entry) => ensureWorkspaceShape(entry))

    if (state.workspaces.length === 0) {
      state.workspaces = [createWorkspaceRecord(DEFAULT_WORKSPACE_ID)]
    }
  }

  ensureWorkspacesState()

  const getCanvasWorkspace = (workspaceId = DEFAULT_WORKSPACE_ID) => {
    ensureWorkspacesState()
    let workspace = state.workspaces.find((entry) => entry.id === workspaceId)
    if (!workspace) {
      workspace = createWorkspaceRecord(workspaceId)
      state.workspaces.unshift(workspace)
    }
    return ensureWorkspaceShape(workspace)
  }

  const canvasActionHandlers = {
    createNode(req, workspace, workspaceId) {
      const node = {
        id: helpers.createId("canvas_node"),
        workspaceId,
        type: helpers.normalizeOptionalString(req.body?.nodeType) || "note",
        title: helpers.normalizeOptionalString(req.body?.title) || "Untitled block",
        x: readOptionalNumber(req.body?.x, 80),
        y: readOptionalNumber(req.body?.y, 80),
        width: readOptionalNumber(req.body?.width, 280),
        height: readOptionalNumber(req.body?.height, 180),
        content: typeof req.body?.content === "string" ? req.body.content : "",
        metadata: {
          ...readOptionalObject(req.body?.metadata),
          provenance: "native",
        },
        branchId: helpers.normalizeOptionalString(req.body?.branchId) || null,
        createdAt: helpers.nowTimestamp(),
        updatedAt: helpers.nowTimestamp(),
      }
      workspace.nodes.push(node)
      workspace.activeNodeId = node.id
      workspace.focusedNodeId = node.id
      workspace.recentlyActiveNodeIds = dedupeStringArray([node.id, ...(workspace.recentlyActiveNodeIds || [])], 5)
      touchCanvasWorkspace(helpers, workspace)
      appendCanvasHistory(helpers, workspace, {
        action: "node-created",
        entityType: "node",
        entityId: node.id,
        summary: `Created ${node.type} node ${node.title}`,
      })
      return { status: 201, body: node }
    },

    updateNode(req, workspace) {
      const nodeId = readRequiredString(helpers, req.body?.nodeId, "nodeId")
      const node = workspace.nodes.find((entry) => entry.id === nodeId)
      if (!node) {
        return { status: 404, body: { error: "Canvas node not found" } }
      }
      const patch = readOptionalObject(req.body?.patch)
      const nextNode = {
        ...node,
        title: helpers.normalizeOptionalString(patch.title) || node.title,
        content: typeof patch.content === "string" ? patch.content : node.content,
        x: readOptionalNumber(patch.x, node.x),
        y: readOptionalNumber(patch.y, node.y),
        width: readOptionalNumber(patch.width, node.width),
        height: readOptionalNumber(patch.height, node.height),
        metadata: patch.metadata && typeof patch.metadata === "object" ? patch.metadata : node.metadata,
        branchId:
          patch.branchId === null ? null : helpers.normalizeOptionalString(patch.branchId) || node.branchId || null,
        updatedAt: helpers.nowTimestamp(),
      }
      Object.assign(node, nextNode)
      touchCanvasWorkspace(helpers, workspace)
      appendCanvasHistory(helpers, workspace, {
        action: "node-updated",
        entityType: "node",
        entityId: node.id,
        summary: `Updated node ${node.title}`,
      })
      return { status: 200, body: node }
    },

    deleteNode(req, workspace) {
      const nodeId = readRequiredString(helpers, req.body?.nodeId, "nodeId")
      const nodeIndex = workspace.nodes.findIndex((entry) => entry.id === nodeId)
      if (nodeIndex === -1) {
        return { status: 404, body: { error: "Canvas node not found" } }
      }
      const [deletedNode] = workspace.nodes.splice(nodeIndex, 1)
      workspace.edges = workspace.edges.filter((edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId)
      workspace.branches = workspace.branches.filter((branch) => branch.rootNodeId !== nodeId)
      if (workspace.activeNodeId === nodeId) {
        workspace.activeNodeId = workspace.nodes[0]?.id || null
      }
      if (workspace.focusedNodeId === nodeId) {
        workspace.focusedNodeId = workspace.activeNodeId
      }
      workspace.recentlyActiveNodeIds = dedupeStringArray(
        (workspace.recentlyActiveNodeIds || []).filter((id) => id !== nodeId),
        5,
      )
      touchCanvasWorkspace(helpers, workspace)
      appendCanvasHistory(helpers, workspace, {
        action: "node-deleted",
        entityType: "node",
        entityId: deletedNode.id,
        summary: `Deleted node ${deletedNode.title}`,
      })
      return { status: 200, body: { ok: true, deletedNodeId: deletedNode.id } }
    },

    connectNodes(req, workspace, workspaceId) {
      const sourceNodeId = readRequiredString(helpers, req.body?.sourceNodeId, "sourceNodeId")
      const targetNodeId = readRequiredString(helpers, req.body?.targetNodeId, "targetNodeId")
      const edge = {
        id: helpers.createId("canvas_edge"),
        workspaceId,
        sourceNodeId,
        targetNodeId,
        label: helpers.normalizeOptionalString(req.body?.label) || null,
        createdAt: helpers.nowTimestamp(),
      }
      workspace.edges.push(edge)
      touchCanvasWorkspace(helpers, workspace)
      appendCanvasHistory(helpers, workspace, {
        action: "edge-created",
        entityType: "edge",
        entityId: edge.id,
        summary: `Connected ${sourceNodeId} to ${targetNodeId}`,
      })
      return { status: 201, body: edge }
    },

    deleteEdge(req, workspace) {
      const edgeId = readRequiredString(helpers, req.body?.edgeId, "edgeId")
      const edgeIndex = workspace.edges.findIndex((entry) => entry.id === edgeId)
      if (edgeIndex === -1) {
        return { status: 404, body: { error: "Canvas edge not found" } }
      }
      const [deletedEdge] = workspace.edges.splice(edgeIndex, 1)
      touchCanvasWorkspace(helpers, workspace)
      appendCanvasHistory(helpers, workspace, {
        action: "edge-deleted",
        entityType: "edge",
        entityId: deletedEdge.id,
        summary: `Deleted edge ${deletedEdge.label || deletedEdge.id}`,
      })
      return { status: 200, body: { ok: true, deletedEdgeId: deletedEdge.id } }
    },

    createBranch(req, workspace, workspaceId) {
      const rootNodeId = readRequiredString(helpers, req.body?.rootNodeId, "rootNodeId")
      const branch = {
        id: helpers.createId("canvas_branch"),
        workspaceId,
        rootNodeId,
        parentBranchId: helpers.normalizeOptionalString(req.body?.parentBranchId) || null,
        label: helpers.normalizeOptionalString(req.body?.label) || "AI Branch",
        createdAt: helpers.nowTimestamp(),
        updatedAt: helpers.nowTimestamp(),
      }
      workspace.branches.push(branch)
      touchCanvasWorkspace(helpers, workspace)
      appendCanvasHistory(helpers, workspace, {
        action: "branch-created",
        entityType: "branch",
        entityId: branch.id,
        summary: `Created branch ${branch.label}`,
      })
      return { status: 201, body: branch }
    },

    updateBranch(req, workspace) {
      const branchId = readRequiredString(helpers, req.body?.branchId, "branchId")
      const branch = workspace.branches.find((entry) => entry.id === branchId)
      if (!branch) {
        return { status: 404, body: { error: "Canvas branch not found" } }
      }
      const patch = readOptionalObject(req.body?.patch)
      branch.label = helpers.normalizeOptionalString(patch.label) || branch.label
      if (patch.parentBranchId === null) {
        branch.parentBranchId = null
      } else if (helpers.normalizeOptionalString(patch.parentBranchId)) {
        branch.parentBranchId = helpers.normalizeOptionalString(patch.parentBranchId)
      }
      branch.updatedAt = helpers.nowTimestamp()
      touchCanvasWorkspace(helpers, workspace)
      appendCanvasHistory(helpers, workspace, {
        action: "branch-updated",
        entityType: "branch",
        entityId: branch.id,
        summary: `Updated branch ${branch.label}`,
      })
      return { status: 200, body: branch }
    },

    deleteBranch(req, workspace) {
      const branchId = readRequiredString(helpers, req.body?.branchId, "branchId")
      const branchIndex = workspace.branches.findIndex((entry) => entry.id === branchId)
      if (branchIndex === -1) {
        return { status: 404, body: { error: "Canvas branch not found" } }
      }
      const [deletedBranch] = workspace.branches.splice(branchIndex, 1)
      workspace.nodes = workspace.nodes.map((node) => (node.branchId === branchId ? { ...node, branchId: null } : node))
      touchCanvasWorkspace(helpers, workspace)
      appendCanvasHistory(helpers, workspace, {
        action: "branch-deleted",
        entityType: "branch",
        entityId: deletedBranch.id,
        summary: `Deleted branch ${deletedBranch.label}`,
      })
      return { status: 200, body: { ok: true, deletedBranchId: deletedBranch.id } }
    },

    selectNode(req, workspace) {
      const nodeId = req.body?.nodeId === null ? null : helpers.normalizeOptionalString(req.body?.nodeId)
      workspace.activeNodeId = nodeId
      workspace.focusedNodeId = nodeId
      if (nodeId) {
        workspace.recentlyActiveNodeIds = dedupeStringArray([nodeId, ...(workspace.recentlyActiveNodeIds || [])], 5)
      }
      touchCanvasWorkspace(helpers, workspace)
      appendCanvasHistory(helpers, workspace, {
        action: "selection-updated",
        entityType: "selection",
        entityId: nodeId || "none",
        summary: nodeId ? `Selected node ${nodeId}` : "Cleared selection",
      })
      return { status: 200, body: workspace }
    },

    updateWorkspace(req, workspace) {
      const patch = readOptionalObject(req.body?.patch)
      if (Object.prototype.hasOwnProperty.call(patch, "focusedNodeId")) {
        workspace.focusedNodeId =
          patch.focusedNodeId === null
            ? null
            : helpers.normalizeOptionalString(patch.focusedNodeId) || workspace.focusedNodeId || null
      }
      if (Object.prototype.hasOwnProperty.call(patch, "recentlyActiveNodeIds")) {
        workspace.recentlyActiveNodeIds = dedupeStringArray(patch.recentlyActiveNodeIds, 5)
      }
      if (Object.prototype.hasOwnProperty.call(patch, "canvasDisplayMode")) {
        const displayMode = helpers.normalizeOptionalString(patch.canvasDisplayMode)
        if (displayMode === "spatial" || displayMode === "widget") {
          workspace.canvasDisplayMode = displayMode
        }
      }
      if (Object.prototype.hasOwnProperty.call(patch, "canvasViewport")) {
        workspace.canvasViewport = normalizeCanvasViewport(patch.canvasViewport)
      }
      touchCanvasWorkspace(helpers, workspace)
      appendCanvasHistory(helpers, workspace, {
        action: "selection-updated",
        entityType: "selection",
        entityId: workspace.focusedNodeId || "none",
        summary: "Updated canvas workspace display/context state",
      })
      return { status: 200, body: workspace }
    },
  }

  app.get("/api/canvas/workspaces", async (_req, res) => {
    try {
      ensureWorkspacesState()
      return res.json({ workspaces: state.workspaces })
    } catch (error) {
      const fallback = createWorkspaceRecord(DEFAULT_WORKSPACE_ID)
      state.workspaces = [fallback]
      return res.json({
        workspaces: state.workspaces,
        degraded: true,
        error: error instanceof Error ? error.message : "Failed to read canvas workspaces",
      })
    }
  })

  app.get("/api/canvas/history", async (req, res) => {
    const workspaceId = helpers.normalizeOptionalString(req.query?.workspaceId) || DEFAULT_WORKSPACE_ID
    try {
      const workspace = getCanvasWorkspace(workspaceId)
      return res.json({ history: Array.isArray(workspace.history) ? workspace.history : [] })
    } catch (error) {
      const fallback = createWorkspaceRecord(workspaceId)
      state.workspaces = [fallback]
      return res.json({
        history: [],
        degraded: true,
        error: error instanceof Error ? error.message : "Failed to read canvas history",
      })
    }
  })

  app.get("/api/canvas/resources/file", async (req, res) => {
    const requestedPath = helpers.normalizeOptionalString(req.query?.path)
    if (!requestedPath) {
      return res.status(400).json({ error: "path is required" })
    }

    const absolutePath = path.resolve(helpers.repoRootPath, requestedPath)
    const relativePath = path.relative(helpers.repoRootPath, absolutePath)
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      return res.status(400).json({ error: "path must stay within the repository root" })
    }

    try {
      const stats = await fs.promises.stat(absolutePath)
      if (!stats.isFile()) {
        return res.status(400).json({ error: "path must point to a file" })
      }
      const content = await fs.promises.readFile(absolutePath, "utf8")
      return res.json({
        path: relativePath,
        absolutePath,
        content,
        size: stats.size,
        updatedAt: stats.mtimeMs,
      })
    } catch (error) {
      return res.status(404).json({
        error: error instanceof Error ? error.message : "Failed to read file resource",
      })
    }
  })

  app.get("/api/canvas/resources/diff", async (req, res) => {
    const requestedPath = helpers.normalizeOptionalString(req.query?.path)
    if (!requestedPath) {
      return res.status(400).json({ error: "path is required" })
    }

    const result = spawnSync("git", ["diff", "--", requestedPath], {
      cwd: helpers.repoRootPath,
      encoding: "utf8",
    })

    if (result.error) {
      return res.status(500).json({ error: result.error.message })
    }

    if (result.status !== 0) {
      const errorMsg = result.stderr?.trim() || `Git diff exited with code ${result.status}`
      return res.status(500).json({ error: errorMsg })
    }

    const diff = typeof result.stdout === "string" ? result.stdout : ""
    return res.json({
      path: requestedPath,
      diff,
      hasChanges: diff.trim().length > 0,
    })
  })

  app.post("/api/canvas/import/canvasmcp", async (req, res) => {
    try {
      const { canvasMcpAdapter } = await import("../adapters/canvasmcp-adapter.js")
      const workspaceId = helpers.normalizeOptionalString(req.body?.workspaceId) || DEFAULT_WORKSPACE_ID
      const workspace = getCanvasWorkspace(workspaceId)
      if (!workspace) {
        return res.status(404).json({ error: "Canvas workspace not found" })
      }

      const importedNodes = Array.isArray(req.body?.nodes)
        ? req.body.nodes.map((entry) => canvasMcpAdapter.normalizeNode(entry, workspaceId)).filter(Boolean)
        : []
      const importedEdges = Array.isArray(req.body?.edges)
        ? req.body.edges.map((entry) => canvasMcpAdapter.normalizeEdge(entry, workspaceId)).filter(Boolean)
        : []
      const importedBranches = Array.isArray(req.body?.branches)
        ? req.body.branches.map((entry) => canvasMcpAdapter.normalizeBranch(entry, workspaceId)).filter(Boolean)
        : []

      const importedAt = helpers.nowTimestamp()
      workspace.nodes.push(
        ...importedNodes.map((entry) => ({
          ...entry,
          metadata: {
            ...(entry.metadata && typeof entry.metadata === "object" ? entry.metadata : {}),
            provenance: "canvasmcp-import",
          },
          createdAt: importedAt,
          updatedAt: importedAt,
        })),
      )
      workspace.edges.push(
        ...importedEdges.map((entry) => ({
          ...entry,
          createdAt: importedAt,
        })),
      )
      workspace.branches.push(
        ...importedBranches.map((entry) => ({
          ...entry,
          createdAt: importedAt,
          updatedAt: importedAt,
        })),
      )
      touchCanvasWorkspace(helpers, workspace)
      appendCanvasHistory(helpers, workspace, {
        action: "node-created",
        entityType: "workspace",
        entityId: workspace.id,
        summary: `Imported CanvasMCP payload into ${workspace.name}`,
      })

      return res.status(201).json({
        source: "canvasmcp",
        imported: {
          nodes: importedNodes.length,
          edges: importedEdges.length,
          branches: importedBranches.length,
        },
      })
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to import CanvasMCP payload",
      })
    }
  })

  app.post("/api/canvas/workspaces", async (req, res) => {
    const workspace = createWorkspaceRecord(
      helpers.createId("canvas_workspace"),
      helpers.normalizeOptionalString(req.body?.name) || "Canvas Workspace",
    )
    appendCanvasHistory(helpers, workspace, {
      action: "workspace-created",
      entityType: "workspace",
      entityId: workspace.id,
      summary: `Created workspace ${workspace.name}`,
    })
    state.workspaces.unshift(workspace)
    return res.status(201).json(workspace)
  })

  app.post("/api/canvas/actions", async (req, res) => {
    ensureWorkspacesState()
    const normalizedRequest = normalizeCanvasActionRequest(req.body, helpers)
    const workspaceId = helpers.normalizeOptionalString(normalizedRequest?.workspaceId) || DEFAULT_WORKSPACE_ID
    const action = helpers.normalizeOptionalString(normalizedRequest?.action)
    const workspace = getCanvasWorkspace(workspaceId)
    if (!workspace) {
      return res.status(404).json({
        code: "CANVAS_WORKSPACE_NOT_FOUND",
        error: "Canvas workspace not found",
      })
    }
    if (!action) {
      return res.status(400).json({
        code: "CANVAS_ACTION_REQUIRED",
        error: "action is required",
      })
    }
    const handler = canvasActionHandlers[action]
    if (!handler) {
      return res.status(400).json({
        code: "CANVAS_ACTION_UNSUPPORTED",
        error: `Unsupported canvas action: ${action}`,
      })
    }

    try {
      const handlerReq = {
        ...req,
        body: normalizedRequest,
      }
      const result = handler(handlerReq, workspace, workspaceId)
      const statusCode = Number.isFinite(result?.status) ? Number(result.status) : 200
      const responseBody = statusCode >= 400 ? normalizeCanvasErrorBody(statusCode, result?.body) : result?.body
      return res.status(statusCode).json(responseBody)
    } catch (error) {
      const statusCode = typeof error?.statusCode === "number" ? error.statusCode : 500
      return res.status(statusCode).json({
        code: statusCode >= 500 ? "CANVAS_ACTION_FAILED" : "CANVAS_ACTION_REJECTED",
        error: error instanceof Error ? error.message : "Canvas action failed",
      })
    }
  })
}

export const __canvasCompat = {
  normalizeCanvasActionName,
  normalizeCanvasActionRequest,
  normalizeCanvasErrorBody,
}
