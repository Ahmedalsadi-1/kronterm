import express from "express"

const DEFAULT_RECORDS = [
  { id: "ACCT-1001", account: "Northwind", owner: "Sam", stage: "Negotiation", amount: "$42,000" },
  { id: "ACCT-1002", account: "Aurelia Labs", owner: "Dana", stage: "Discovery", amount: "$18,500" },
  { id: "ACCT-1003", account: "Pinecrest", owner: "Alex", stage: "Proposal", amount: "$27,400" },
  { id: "ACCT-1004", account: "Kronex Group", owner: "Yara", stage: "Qualified", amount: "$11,900" },
]

const DEFAULT_WORKFLOW_STEPS = [
  { id: "wf-1", name: "Trigger: lead created", order: 1 },
  { id: "wf-2", name: "Validate required fields", order: 2 },
  { id: "wf-3", name: "Assign owner by territory", order: 3 },
  { id: "wf-4", name: "Notify Slack channel", order: 4 },
]

const DEFAULT_PLUGINS = [
  { id: "plugin-email", name: "Email connector", status: "active", managedBy: "kronos" },
  { id: "plugin-slack", name: "Slack connector", status: "active", managedBy: "kronos" },
  { id: "plugin-audit", name: "Audit log", status: "active", managedBy: "kronos" },
  { id: "plugin-approval", name: "Approval gates", status: "active", managedBy: "kronos" },
]

const DEFAULT_ADMIN = {
  roles: [
    { id: "owner", label: "Owner", users: 1 },
    { id: "admin", label: "Admin", users: 2 },
    { id: "operator", label: "Operator", users: 4 },
    { id: "member", label: "Member", users: 11 },
  ],
  settings: [
    { key: "retentionDays", value: "90" },
    { key: "workflowRetries", value: "3" },
    { key: "approvalMode", value: "strict" },
  ],
}

const leadIntakeFields = [
  { id: "account", label: "Account name", required: true, type: "text" },
  { id: "owner", label: "Owner", required: true, type: "text" },
  { id: "stage", label: "Stage", required: true, type: "text" },
  { id: "amount", label: "Expected amount", required: true, type: "text" },
]

const parseAmountNumber = (value) => {
  if (typeof value !== "string") return 0
  const numeric = Number(value.replace(/[^\d.-]/g, ""))
  if (!Number.isFinite(numeric)) return 0
  return numeric
}

const formatCurrency = (value) => {
  const numeric = parseAmountNumber(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return "$0"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(numeric)
}

const derivePipelineMetrics = (records, workflows) => {
  const openPipelineValue = records.reduce((sum, record) => sum + parseAmountNumber(record.amount), 0)
  const pendingApprovals = records.filter((record) => {
    const stage = typeof record.stage === "string" ? record.stage.toLowerCase() : ""
    return stage.includes("proposal") || stage.includes("negotiation")
  }).length

  return {
    openPipelineValue,
    activeWorkflows: workflows.length,
    pendingApprovals,
  }
}

const createStore = () => {
  /** @type {Array<{ id: string, account: string, owner: string, stage: string, amount: string, createdAt: number, updatedAt: number }>} */
  const records = DEFAULT_RECORDS.map((record) => ({
    ...record,
    amount: formatCurrency(record.amount),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }))

  /** @type {Array<{ id: string, name: string, order: number }>} */
  const workflowSteps = DEFAULT_WORKFLOW_STEPS.map((step) => ({ ...step }))

  /** @type {Array<{ id: string, name: string, status: string, managedBy: string }>} */
  const plugins = DEFAULT_PLUGINS.map((plugin) => ({ ...plugin }))

  const admin = {
    roles: DEFAULT_ADMIN.roles.map((role) => ({ ...role })),
    settings: DEFAULT_ADMIN.settings.map((setting) => ({ ...setting })),
  }

  let recordCounter = records
    .map((record) => {
      const parts = String(record.id).split("-")
      const maybe = Number(parts[1])
      return Number.isFinite(maybe) ? maybe : 0
    })
    .reduce((max, value) => Math.max(max, value), 1000)

  return {
    listRecords(query, limit = 200) {
      const q = typeof query === "string" ? query.trim().toLowerCase() : ""
      const filtered = q
        ? records.filter((record) =>
            [record.id, record.account, record.owner, record.stage, record.amount].join(" ").toLowerCase().includes(q),
          )
        : records
      return filtered.slice(0, Math.max(1, Math.min(1000, limit)))
    },

    getRecord(id) {
      return records.find((record) => record.id === id) || null
    },

    createRecord(payload) {
      recordCounter += 1
      const id = `ACCT-${recordCounter}`
      const now = Date.now()
      const created = {
        id,
        account: typeof payload.account === "string" ? payload.account.trim() : "",
        owner: typeof payload.owner === "string" ? payload.owner.trim() : "",
        stage: typeof payload.stage === "string" ? payload.stage.trim() : "Discovery",
        amount: formatCurrency(typeof payload.amount === "string" ? payload.amount : "$0"),
        createdAt: now,
        updatedAt: now,
      }
      records.unshift(created)
      return created
    },

    updateRecord(id, updates) {
      const record = records.find((entry) => entry.id === id)
      if (!record) return null

      if (typeof updates.account === "string") record.account = updates.account.trim()
      if (typeof updates.owner === "string") record.owner = updates.owner.trim()
      if (typeof updates.stage === "string") record.stage = updates.stage.trim()
      if (typeof updates.amount === "string") record.amount = formatCurrency(updates.amount)
      record.updatedAt = Date.now()
      return record
    },

    getWorkflowSteps() {
      return workflowSteps.slice().sort((a, b) => a.order - b.order)
    },

    getPlugins() {
      return plugins.slice()
    },

    getAdmin() {
      return {
        roles: admin.roles.slice(),
        settings: admin.settings.slice(),
      }
    },

    getShellSummary() {
      const metrics = derivePipelineMetrics(records, workflowSteps)
      return {
        openPipelineValue: metrics.openPipelineValue,
        activeWorkflows: metrics.activeWorkflows,
        pendingApprovals: metrics.pendingApprovals,
      }
    },
  }
}

const store = createStore()

const buildWorkflowsPayload = () => [
  {
    id: "default-sales-pipeline",
    name: "Default sales pipeline",
    steps: store.getWorkflowSteps(),
  },
]

const validateRecordPayload = (payload) => {
  const account = typeof payload?.account === "string" ? payload.account.trim() : ""
  const owner = typeof payload?.owner === "string" ? payload.owner.trim() : ""
  const stage = typeof payload?.stage === "string" ? payload.stage.trim() : ""
  const amount = typeof payload?.amount === "string" ? payload.amount.trim() : ""

  if (!account || !owner || !stage || !amount) {
    return {
      valid: false,
      error: "account, owner, stage, and amount are required",
    }
  }

  return {
    valid: true,
    value: { account, owner, stage, amount },
  }
}

export const createBusinessRouter = ({ getNocobaseOrigin } = {}) => {
  const api = express.Router()

  api.get("/health", (req, res) => {
    const nocobaseOrigin = typeof getNocobaseOrigin === "function" ? getNocobaseOrigin() : null
    res.json({
      ok: true,
      mode: "native",
      upstreamFallbackAvailable: Boolean(nocobaseOrigin),
      upstreamOrigin: nocobaseOrigin,
      timestamp: Date.now(),
    })
  })

  api.get("/shell", (_req, res) => {
    const summary = store.getShellSummary()
    res.json({
      metrics: {
        openPipelineValue: summary.openPipelineValue,
        activeWorkflows: summary.activeWorkflows,
        pendingApprovals: summary.pendingApprovals,
      },
    })
  })

  api.get("/records", (req, res) => {
    const query = typeof req.query?.q === "string" ? req.query.q : ""
    const rawLimit = Number(req.query?.limit)
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(1000, Math.round(rawLimit))) : 200
    const records = store.listRecords(query, limit)
    res.json({ records, total: records.length })
  })

  api.post("/records", (req, res) => {
    const validation = validateRecordPayload(req.body)
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error })
    }

    const record = store.createRecord(validation.value)
    return res.status(201).json({ record })
  })

  api.patch("/records/:id", (req, res) => {
    const id = typeof req.params?.id === "string" ? req.params.id.trim() : ""
    if (!id) {
      return res.status(400).json({ error: "Record id is required" })
    }

    const record = store.updateRecord(id, req.body || {})
    if (!record) {
      return res.status(404).json({ error: "Record not found" })
    }

    return res.json({ record })
  })

  api.get("/forms/lead-intake", (_req, res) => {
    res.json({
      id: "lead-intake",
      title: "Lead intake form",
      fields: leadIntakeFields,
    })
  })

  api.post("/forms/lead-intake/submit", (req, res) => {
    const validation = validateRecordPayload(req.body)
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error })
    }

    const record = store.createRecord(validation.value)
    return res.status(201).json({
      success: true,
      record,
    })
  })

  api.get("/workflows", (_req, res) => {
    res.json({ workflows: buildWorkflowsPayload() })
  })

  api.get("/plugins", (_req, res) => {
    res.json({ plugins: store.getPlugins() })
  })

  api.get("/admin", (_req, res) => {
    res.json(store.getAdmin())
  })

  api.get("/snapshot", (_req, res) => {
    const summary = store.getShellSummary()
    res.json({
      metrics: {
        openPipelineValue: summary.openPipelineValue,
        activeWorkflows: summary.activeWorkflows,
        pendingApprovals: summary.pendingApprovals,
      },
      records: store.listRecords("", 500),
      workflows: buildWorkflowsPayload(),
      plugins: store.getPlugins(),
      admin: store.getAdmin(),
    })
  })

  return api
}

export default createBusinessRouter
