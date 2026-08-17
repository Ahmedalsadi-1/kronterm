const normalizeText = (value, fallback = null) => {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

export const nocobaseAdapter = {
  source: "nocobase",

  normalizeCollection(input) {
    if (!input || typeof input !== "object") {
      return null
    }

    return {
      id: normalizeText(input.id) || normalizeText(input.name) || null,
      name: normalizeText(input.title) || normalizeText(input.name) || "Untitled collection",
      description: normalizeText(input.description),
      fields: Array.isArray(input.fields)
        ? input.fields.map((field) => ({
            id: normalizeText(field.id) || normalizeText(field.name) || `field_${Math.random().toString(36).slice(2, 8)}`,
            name: normalizeText(field.name) || "field",
            type: normalizeText(field.interface) || normalizeText(field.type) || "text",
            required: field.required === true,
          }))
        : [],
    }
  },

  normalizeWorkflow(input) {
    if (!input || typeof input !== "object") {
      return null
    }

    return {
      id: normalizeText(input.id) || `workflow_${Math.random().toString(36).slice(2, 8)}`,
      name: normalizeText(input.title) || normalizeText(input.name) || "Untitled workflow",
      description: normalizeText(input.description),
      status: normalizeText(input.status) || "draft",
    }
  },

  normalizeAgent(input) {
    if (!input || typeof input !== "object") {
      return null
    }

    return {
      id: normalizeText(input.id) || `agent_${Math.random().toString(36).slice(2, 8)}`,
      name: normalizeText(input.title) || normalizeText(input.name) || "Untitled agent",
      description: normalizeText(input.description),
      status: input.disabled === true ? "disabled" : "available",
      capabilities: Array.isArray(input.capabilities)
        ? input.capabilities.filter((value) => typeof value === "string" && value.trim().length > 0)
        : [],
    }
  },
}

export default nocobaseAdapter
