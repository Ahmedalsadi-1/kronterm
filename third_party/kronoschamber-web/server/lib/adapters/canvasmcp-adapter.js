const normalizeText = (value, fallback = null) => {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

export const canvasMcpAdapter = {
  source: "canvasmcp",

  normalizeNode(input, workspaceId) {
    if (!input || typeof input !== "object") {
      return null
    }

    return {
      id: normalizeText(input.id) || `canvas_node_${Math.random().toString(36).slice(2, 8)}`,
      workspaceId,
      type: normalizeText(input.type) || "note",
      title: normalizeText(input.title) || "Untitled block",
      x: Number.isFinite(input.x) ? Number(input.x) : 80,
      y: Number.isFinite(input.y) ? Number(input.y) : 80,
      width: Number.isFinite(input.width) ? Number(input.width) : 280,
      height: Number.isFinite(input.height) ? Number(input.height) : 180,
      content: normalizeText(input.content, ""),
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
      branchId: normalizeText(input.branchId),
    }
  },

  normalizeEdge(input, workspaceId) {
    if (!input || typeof input !== "object") {
      return null
    }

    const sourceNodeId = normalizeText(input.sourceNodeId) || normalizeText(input.source)
    const targetNodeId = normalizeText(input.targetNodeId) || normalizeText(input.target)
    if (!sourceNodeId || !targetNodeId) {
      return null
    }

    return {
      id: normalizeText(input.id) || `canvas_edge_${Math.random().toString(36).slice(2, 8)}`,
      workspaceId,
      sourceNodeId,
      targetNodeId,
      label: normalizeText(input.label),
    }
  },

  normalizeBranch(input, workspaceId) {
    if (!input || typeof input !== "object") {
      return null
    }

    const rootNodeId = normalizeText(input.rootNodeId) || normalizeText(input.root_node_id)
    if (!rootNodeId) {
      return null
    }

    return {
      id: normalizeText(input.id) || `canvas_branch_${Math.random().toString(36).slice(2, 8)}`,
      workspaceId,
      rootNodeId,
      parentBranchId: normalizeText(input.parentBranchId) || normalizeText(input.parent_branch_id),
      label: normalizeText(input.label) || "AI Branch",
    }
  },
}

export default canvasMcpAdapter
