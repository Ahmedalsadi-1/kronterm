const normalizeText = (value, fallback = null) => {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

export const jaazAdapter = {
  source: "jaaz",

  normalizeProject(input) {
    if (!input || typeof input !== "object") {
      return null
    }

    return {
      id: normalizeText(input.id) || `project_${Math.random().toString(36).slice(2, 8)}`,
      name: normalizeText(input.title) || normalizeText(input.name) || "Untitled project",
      description: normalizeText(input.description),
    }
  },

  normalizeDocument(input) {
    if (!input || typeof input !== "object") {
      return null
    }

    return {
      id: normalizeText(input.id) || `document_${Math.random().toString(36).slice(2, 8)}`,
      projectId: normalizeText(input.projectId) || normalizeText(input.project_id) || "unknown-project",
      name: normalizeText(input.title) || normalizeText(input.name) || "Untitled document",
      content: normalizeText(input.content, ""),
    }
  },

  normalizeJob(input) {
    if (!input || typeof input !== "object") {
      return null
    }

    return {
      id: normalizeText(input.id) || `job_${Math.random().toString(36).slice(2, 8)}`,
      projectId: normalizeText(input.projectId) || normalizeText(input.project_id) || "unknown-project",
      prompt: normalizeText(input.prompt) || normalizeText(input.input) || "",
      status: normalizeText(input.status) || "queued",
    }
  },

  normalizeAsset(input) {
    if (!input || typeof input !== "object") {
      return null
    }

    return {
      id: normalizeText(input.id) || `asset_${Math.random().toString(36).slice(2, 8)}`,
      projectId: normalizeText(input.projectId) || normalizeText(input.project_id) || "unknown-project",
      name: normalizeText(input.title) || normalizeText(input.name) || "Untitled asset",
      kind: normalizeText(input.kind) || normalizeText(input.type) || "other",
      url: normalizeText(input.url),
    }
  },
}

export default jaazAdapter
