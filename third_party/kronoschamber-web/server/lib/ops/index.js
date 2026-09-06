const cloneField = (field, fallbackId) => ({
  id: typeof field?.id === "string" && field.id.trim().length > 0 ? field.id.trim() : fallbackId,
  name: typeof field?.name === "string" && field.name.trim().length > 0 ? field.name.trim() : fallbackId,
  type:
    field?.type === "number" ||
    field?.type === "boolean" ||
    field?.type === "date" ||
    field?.type === "json"
      ? field.type
      : "text",
  required: field?.required === true,
})

const cloneLayout = (layout = []) =>
  Array.isArray(layout)
    ? layout.map((entry) => ({
        fieldId: typeof entry?.fieldId === "string" ? entry.fieldId : "",
        label: typeof entry?.label === "string" ? entry.label : "",
        widget:
          entry?.widget === "textarea" ||
          entry?.widget === "select" ||
          entry?.widget === "checkbox" ||
          entry?.widget === "date"
            ? entry.widget
            : "input",
      }))
    : []

const readText = (value, fallback = null) => {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

const readObject = (value, fallback = {}) => (value && typeof value === "object" && !Array.isArray(value) ? value : fallback)

export const createOpsState = ({ nowTimestamp }) => {
  const now = nowTimestamp()
  return {
    collections: [
      {
        id: "ops_collection_tasks",
        name: "Tasks",
        description: "Native Chamber task records inspired by NocoBase collection patterns",
        provenance: "native",
        fields: [
          { id: "title", name: "title", type: "text", required: true },
          { id: "status", name: "status", type: "text", required: true },
          { id: "owner", name: "owner", type: "text", required: false },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ],
    records: [
      {
        id: "ops_record_task_seed",
        collectionId: "ops_collection_tasks",
        provenance: "native",
        values: { title: "Ship Chamber browser unification", status: "in-progress", owner: "kronos-agent" },
        createdAt: now,
        updatedAt: now,
      },
    ],
    forms: [
      {
        id: "ops_form_task_default",
        collectionId: "ops_collection_tasks",
        name: "Task intake",
        provenance: "native",
        layout: [
          { fieldId: "title", label: "Title", widget: "input" },
          { fieldId: "status", label: "Status", widget: "select" },
          { fieldId: "owner", label: "Owner", widget: "input" },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ],
    actions: [
      {
        id: "ops_action_assign_agent",
        name: "Assign Chamber agent",
        description: "Attach an AI agent to the current Ops record",
        provenance: "native",
        kind: "agent",
        createdAt: now,
        updatedAt: now,
      },
    ],
    workflows: [
      {
        id: "ops_workflow_record_review",
        name: "Record review",
        description: "Review and approve a changed record",
        provenance: "native",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
    agents: [
      {
        id: "ops_agent_operator",
        name: "Ops Operator",
        description: "Chamber-managed operations agent",
        provenance: "native",
        status: "available",
        capabilities: ["records.read", "records.write", "workflow.run"],
        createdAt: now,
        updatedAt: now,
      },
    ],
    activity: [],
    selectedCollectionId: "ops_collection_tasks",
    selectedRecordId: "ops_record_task_seed",
  }
}

export const registerOpsRoutes = ({ app, state, helpers }) => {
  const { createId, nowTimestamp } = helpers

  const appendActivity = (action, entityType, entityId, summary, actor = "user") => {
    state.activity.unshift({
      id: createId("ops_activity"),
      action,
      entityType,
      entityId,
      summary,
      actor,
      timestamp: nowTimestamp(),
    })
    state.activity = state.activity.slice(0, 60)
  }

  const getCollection = (collectionId) => state.collections.find((entry) => entry.id === collectionId) || null
  const getRecord = (recordId) => state.records.find((entry) => entry.id === recordId) || null

  app.get("/api/ops/bootstrap", async (_req, res) => {
    res.json(state)
  })

  app.post("/api/ops/import/nocobase", async (req, res) => {
    try {
      const { nocobaseAdapter } = await import("../adapters/nocobase-adapter.js")
      const importedCollections = Array.isArray(req.body?.collections)
        ? req.body.collections.map((entry) => nocobaseAdapter.normalizeCollection(entry)).filter(Boolean)
        : []
      const importedWorkflows = Array.isArray(req.body?.workflows)
        ? req.body.workflows.map((entry) => nocobaseAdapter.normalizeWorkflow(entry)).filter(Boolean)
        : []
      const importedAgents = Array.isArray(req.body?.agents)
        ? req.body.agents.map((entry) => nocobaseAdapter.normalizeAgent(entry)).filter(Boolean)
        : []

      const importedAt = nowTimestamp()
      for (const collection of importedCollections) {
        state.collections.unshift({
          ...collection,
          provenance: "nocobase-import",
          createdAt: importedAt,
          updatedAt: importedAt,
        })
      }
      for (const workflow of importedWorkflows) {
        state.workflows.unshift({
          ...workflow,
          provenance: "nocobase-import",
          createdAt: importedAt,
          updatedAt: importedAt,
        })
      }
      for (const agent of importedAgents) {
        state.agents.unshift({
          ...agent,
          provenance: "nocobase-import",
          createdAt: importedAt,
          updatedAt: importedAt,
        })
      }

      appendActivity(
        "imported",
        "import",
        "nocobase",
        `Imported ${importedCollections.length} collections, ${importedWorkflows.length} workflows, and ${importedAgents.length} agents from NocoBase`,
        "system",
      )

      return res.status(201).json({
        source: "nocobase",
        imported: {
          collections: importedCollections.length,
          workflows: importedWorkflows.length,
          agents: importedAgents.length,
        },
      })
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to import NocoBase payload",
      })
    }
  })

  app.get("/api/ops/collections", async (_req, res) => {
    res.json({ collections: state.collections })
  })

  app.post("/api/ops/collections", async (req, res) => {
    const name = readText(req.body?.name)
    if (!name) {
      return res.status(400).json({ error: "name is required" })
    }
    const createdAt = nowTimestamp()
    const fields = Array.isArray(req.body?.fields)
      ? req.body.fields.map((field, index) => cloneField(field, `field_${index + 1}`))
      : []
    const collection = {
      id: createId("ops_collection"),
      name,
      description: readText(req.body?.description),
      provenance: "native",
      fields,
      createdAt,
      updatedAt: createdAt,
    }
    state.collections.unshift(collection)
    state.selectedCollectionId = collection.id
    appendActivity("collection-created", "collection", collection.id, `Created collection "${collection.name}"`)
    return res.status(201).json(collection)
  })

  app.patch("/api/ops/collections/:collectionId", async (req, res) => {
    const collection = getCollection(req.params.collectionId)
    if (!collection) {
      return res.status(404).json({ error: "collection not found" })
    }
    const nextFields = Array.isArray(req.body?.fields)
      ? req.body.fields.map((field, index) => cloneField(field, `field_${index + 1}`))
      : collection.fields
    collection.name = readText(req.body?.name, collection.name)
    collection.description = readText(req.body?.description, collection.description ?? null)
    collection.fields = nextFields
    collection.updatedAt = nowTimestamp()
    appendActivity("collection-updated", "collection", collection.id, `Updated collection "${collection.name}"`)
    return res.json(collection)
  })

  app.delete("/api/ops/collections/:collectionId", async (req, res) => {
    const index = state.collections.findIndex((entry) => entry.id === req.params.collectionId)
    if (index === -1) {
      return res.status(404).json({ error: "collection not found" })
    }
    const [deleted] = state.collections.splice(index, 1)
    state.records = state.records.filter((record) => record.collectionId !== deleted.id)
    if (state.selectedCollectionId === deleted.id) {
      state.selectedCollectionId = state.collections[0]?.id ?? null
      state.selectedRecordId = state.records.find((record) => record.collectionId === state.selectedCollectionId)?.id ?? null
    }
    appendActivity("collection-deleted", "collection", deleted.id, `Deleted collection "${deleted.name}"`)
    return res.json({ ok: true, deletedCollectionId: deleted.id })
  })

  app.get("/api/ops/records", async (req, res) => {
    const collectionId = readText(req.query?.collectionId)
    const records = collectionId ? state.records.filter((record) => record.collectionId === collectionId) : state.records
    res.json({ records })
  })

  app.post("/api/ops/records", async (req, res) => {
    const collectionId = readText(req.body?.collectionId)
    if (!collectionId) {
      return res.status(400).json({ error: "collectionId is required" })
    }
    if (!getCollection(collectionId)) {
      return res.status(404).json({ error: "collection not found" })
    }
    const createdAt = nowTimestamp()
    const record = {
      id: createId("ops_record"),
      collectionId,
      provenance: "native",
      values: readObject(req.body?.values, {}),
      createdAt,
      updatedAt: createdAt,
    }
    state.records.unshift(record)
    state.selectedCollectionId = collectionId
    state.selectedRecordId = record.id
    appendActivity(
      "record-created",
      "record",
      record.id,
      `Created record "${String(record.values?.title || record.id)}" in ${collectionId}`,
    )
    return res.status(201).json(record)
  })

  app.patch("/api/ops/records/:recordId", async (req, res) => {
    const record = getRecord(req.params.recordId)
    if (!record) {
      return res.status(404).json({ error: "record not found" })
    }
    const values = readObject(req.body?.values, record.values)
    record.values = { ...record.values, ...values }
    record.updatedAt = nowTimestamp()
    state.selectedCollectionId = record.collectionId
    state.selectedRecordId = record.id
    appendActivity(
      "record-updated",
      "record",
      record.id,
      `Updated record "${String(record.values?.title || record.id)}"`,
    )
    return res.json(record)
  })

  app.delete("/api/ops/records/:recordId", async (req, res) => {
    const index = state.records.findIndex((entry) => entry.id === req.params.recordId)
    if (index === -1) {
      return res.status(404).json({ error: "record not found" })
    }
    const [deleted] = state.records.splice(index, 1)
    if (state.selectedRecordId === deleted.id) {
      state.selectedRecordId = state.records.find((record) => record.collectionId === deleted.collectionId)?.id ?? null
    }
    appendActivity("record-deleted", "record", deleted.id, `Deleted record "${String(deleted.values?.title || deleted.id)}"`)
    return res.json({ ok: true, deletedRecordId: deleted.id })
  })

  app.post("/api/ops/selection", async (req, res) => {
    const collectionId = req.body?.collectionId === null ? null : readText(req.body?.collectionId, state.selectedCollectionId)
    const recordId = req.body?.recordId === null ? null : readText(req.body?.recordId, state.selectedRecordId)

    state.selectedCollectionId = collectionId
    state.selectedRecordId = recordId
    appendActivity("selection-updated", "selection", recordId || collectionId || "ops", "Updated active Ops selection")
    return res.json({
      selectedCollectionId: state.selectedCollectionId,
      selectedRecordId: state.selectedRecordId,
      activity: state.activity,
    })
  })

  app.get("/api/ops/forms", async (_req, res) => {
    res.json({ forms: state.forms })
  })

  app.get("/api/ops/actions", async (_req, res) => {
    res.json({ actions: state.actions })
  })

  app.get("/api/ops/workflows", async (_req, res) => {
    res.json({ workflows: state.workflows })
  })

  app.post("/api/ops/workflows", async (req, res) => {
    const name = readText(req.body?.name)
    if (!name) {
      return res.status(400).json({ error: "name is required" })
    }
    const createdAt = nowTimestamp()
    const workflow = {
      id: createId("ops_workflow"),
      name,
      description: readText(req.body?.description),
      provenance: "native",
      status: req.body?.status === "active" || req.body?.status === "paused" ? req.body.status : "draft",
      createdAt,
      updatedAt: createdAt,
    }
    state.workflows.unshift(workflow)
    appendActivity("workflow-created", "workflow", workflow.id, `Created workflow "${workflow.name}"`)
    return res.status(201).json(workflow)
  })

  app.get("/api/ops/agents", async (_req, res) => {
    res.json({ agents: state.agents })
  })

  app.post("/api/ops/agents", async (req, res) => {
    const name = readText(req.body?.name)
    if (!name) {
      return res.status(400).json({ error: "name is required" })
    }
    const createdAt = nowTimestamp()
    const agent = {
      id: createId("ops_agent"),
      name,
      description: readText(req.body?.description),
      provenance: "native",
      status: req.body?.status === "disabled" ? "disabled" : "available",
      capabilities: Array.isArray(req.body?.capabilities)
        ? req.body.capabilities.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
        : [],
      createdAt,
      updatedAt: createdAt,
    }
    state.agents.unshift(agent)
    appendActivity("agent-created", "agent", agent.id, `Created agent "${agent.name}"`)
    return res.status(201).json(agent)
  })
}

export default {
  createOpsState,
  registerOpsRoutes,
}
