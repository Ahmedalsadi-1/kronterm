import express from "express"
import { createUpstreamComponentManifest } from "../adapters/upstream-components.js"

const clampLimit = (value, fallback = 50, max = 200) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return fallback
  }
  return Math.max(1, Math.min(max, Math.round(numeric)))
}

const normalizeString = (value, fallback = "") => {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

const normalizeStringArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeString(entry)).filter(Boolean)
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => normalizeString(entry))
      .filter(Boolean)
  }
  return []
}

const coerceIsoString = (value, fallback = null) => {
  const normalized = normalizeString(value, "")
  if (!normalized) return fallback
  const parsed = Date.parse(normalized)
  if (!Number.isFinite(parsed)) return fallback
  return new Date(parsed).toISOString()
}

const DEFAULT_CAMPAIGNS = [
  {
    id: "campaign-spring-launch",
    name: "Spring Launch",
    objective: "Announce the browser QA push and drive waitlist signups.",
    channels: ["x", "linkedin", "youtube"],
    status: "active",
  },
  {
    id: "campaign-founder-brand",
    name: "Founder Brand",
    objective: "Repurpose founder updates into high-signal posts and clips.",
    channels: ["x", "linkedin", "tiktok"],
    status: "active",
  },
]

const DEFAULT_BRAND_KITS = [
  {
    id: "brand-kronos-main",
    name: "Kronos Main",
    tone: "direct, technical, high-signal",
    bannedPhrases: ["revolutionary", "game changing", "synergy"],
    requiredPhrases: ["inspectable", "agent", "workflow"],
  },
  {
    id: "brand-founder-voice",
    name: "Founder Voice",
    tone: "first-person, opinionated, concise",
    bannedPhrases: ["thought leader", "10x", "disruptive"],
    requiredPhrases: ["operator", "shipping"],
  },
]

const DEFAULT_DRAFTS = [
  {
    id: "draft-1001",
    title: "Browser QA before publish",
    text: "Ship the draft, then verify the landing page, CTA, and analytics tags in the browser before scheduling.",
    platforms: ["x", "linkedin"],
    mediaUrls: [],
    campaignId: "campaign-spring-launch",
    brandKitId: "brand-kronos-main",
    status: "in-review",
    scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 26).toISOString(),
    approvalStatus: "needs-review",
    provenance: "native",
  },
  {
    id: "draft-1002",
    title: "Founder note",
    text: "We are turning Chamber into an operator runtime for social, video, and browser-driven launch workflows.",
    platforms: ["x"],
    mediaUrls: [],
    campaignId: "campaign-founder-brand",
    brandKitId: "brand-founder-voice",
    status: "scheduled",
    scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 50).toISOString(),
    approvalStatus: "approved",
    provenance: "native",
  },
]

export const createSocialState = () => {
  let draftCounter = 1002
  const campaigns = DEFAULT_CAMPAIGNS.map((campaign) => ({ ...campaign }))
  const brandKits = DEFAULT_BRAND_KITS.map((kit) => ({ ...kit, bannedPhrases: [...kit.bannedPhrases], requiredPhrases: [...kit.requiredPhrases] }))
  const drafts = DEFAULT_DRAFTS.map((draft) => ({
    ...draft,
    platforms: [...draft.platforms],
    mediaUrls: [...draft.mediaUrls],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }))

  const findBrandKit = (brandKitId) => {
    return brandKits.find((kit) => kit.id === brandKitId) ?? brandKits[0] ?? null
  }

  const listCalendar = ({ status, from, to, limit } = {}) => {
    const fromTimestamp = from ? Date.parse(from) : null
    const toTimestamp = to ? Date.parse(to) : null
    return drafts
      .filter((draft) => {
        if (status && draft.status !== status) return false
        if (!draft.scheduledAt) return !status || status === "draft" || status === "in-review"
        const scheduledTimestamp = Date.parse(draft.scheduledAt)
        if (Number.isFinite(fromTimestamp) && scheduledTimestamp < fromTimestamp) return false
        if (Number.isFinite(toTimestamp) && scheduledTimestamp > toTimestamp) return false
        return true
      })
      .sort((a, b) => {
        const aTime = a.scheduledAt ? Date.parse(a.scheduledAt) : a.updatedAt
        const bTime = b.scheduledAt ? Date.parse(b.scheduledAt) : b.updatedAt
        return aTime - bTime
      })
      .slice(0, clampLimit(limit, 50, 500))
  }

  const createDraft = ({
    title,
    text,
    platforms,
    mediaUrls,
    scheduledAt,
    campaignId,
    brandKitId,
    provenance = "agent",
  }) => {
    const normalizedText = normalizeString(text)
    if (!normalizedText) {
      throw new Error("text is required")
    }

    draftCounter += 1
    const now = Date.now()
    const resolvedCampaignId = normalizeString(campaignId, campaigns[0]?.id || "")
    const resolvedBrandKitId = normalizeString(brandKitId, brandKits[0]?.id || "")
    const nextDraft = {
      id: `draft-${draftCounter}`,
      title: normalizeString(title, normalizedText.slice(0, 72)),
      text: normalizedText,
      platforms: normalizeStringArray(platforms),
      mediaUrls: normalizeStringArray(mediaUrls),
      campaignId: resolvedCampaignId || null,
      brandKitId: resolvedBrandKitId || null,
      status: scheduledAt ? "scheduled" : "draft",
      scheduledAt: coerceIsoString(scheduledAt, null),
      approvalStatus: scheduledAt ? "approved" : "needs-review",
      provenance,
      createdAt: now,
      updatedAt: now,
    }
    drafts.unshift(nextDraft)
    return nextDraft
  }

  const scheduleDraft = (draftId, scheduledAt) => {
    const draft = drafts.find((entry) => entry.id === draftId)
    if (!draft) {
      throw new Error("Draft not found")
    }

    const normalizedScheduledAt = coerceIsoString(scheduledAt)
    if (!normalizedScheduledAt) {
      throw new Error("scheduledAt must be a valid ISO timestamp")
    }

    draft.status = "scheduled"
    draft.approvalStatus = "approved"
    draft.scheduledAt = normalizedScheduledAt
    draft.updatedAt = Date.now()
    return draft
  }

  const reviewDraft = (draftId, approved, comment = "") => {
    const draft = drafts.find((entry) => entry.id === draftId)
    if (!draft) {
      throw new Error("Draft not found")
    }

    draft.approvalStatus = approved ? "approved" : "rejected"
    draft.status = approved ? draft.status === "scheduled" ? "scheduled" : "approved" : "changes-requested"
    draft.reviewComment = normalizeString(comment, "")
    draft.updatedAt = Date.now()
    return draft
  }

  const brandCheck = ({ brandKitId, text, mediaUrls = [] } = {}) => {
    const kit = findBrandKit(brandKitId)
    const normalizedText = normalizeString(text)
    const normalizedMedia = normalizeStringArray(mediaUrls)
    if (!kit) {
      return {
        result: "review",
        score: 0.5,
        reason: "No brand kit configured",
      }
    }

    const haystack = normalizedText.toLowerCase()
    const violations = kit.bannedPhrases.filter((phrase) => haystack.includes(phrase.toLowerCase()))
    const missingRequired = kit.requiredPhrases.filter((phrase) => !haystack.includes(phrase.toLowerCase()))

    const score = Math.max(0, 1 - violations.length * 0.25 - missingRequired.length * 0.15)
    let result = "approved"
    if (violations.length > 0) {
      result = "rejected"
    } else if (missingRequired.length > 0 || normalizedMedia.length === 0) {
      result = "review"
    }

    return {
      brandKitId: kit.id,
      result,
      score,
      violations,
      missingRequired,
      reason:
        result === "approved"
          ? "Copy matches the active tone and required keywords."
          : result === "review"
            ? "Needs human review before scheduling."
            : "Contains banned brand language.",
    }
  }

  const getSnapshot = () => {
    const scheduled = drafts.filter((draft) => draft.status === "scheduled").length
    const pendingApprovals = drafts.filter((draft) => draft.approvalStatus === "needs-review").length
    const draftCount = drafts.filter((draft) => draft.status === "draft" || draft.status === "in-review").length
    return {
      metrics: {
        draftCount,
        pendingApprovals,
        scheduledCount: scheduled,
      },
      campaigns: campaigns.slice(),
      brandKits: brandKits.slice(),
      drafts: drafts.slice(0, 24),
      calendar: listCalendar({ limit: 12 }),
    }
  }

  return {
    listCalendar,
    createDraft,
    scheduleDraft,
    reviewDraft,
    brandCheck,
    getSnapshot,
  }
}

export const createSocialRouter = ({ state, getPostizOrigin } = {}) => {
  const api = express.Router()

  const getUpstreamOrigin = () => (typeof getPostizOrigin === "function" ? getPostizOrigin() : null)

  const buildHealthPayload = () => ({
    ok: true,
    mode: "native",
    upstreamFallbackAvailable: Boolean(getUpstreamOrigin()),
    upstreamOrigin: getUpstreamOrigin(),
    timestamp: Date.now(),
  })

  api.get("/health", (_req, res) => {
    res.json(buildHealthPayload())
  })

  api.get("/status", (_req, res) => {
    res.json(buildHealthPayload())
  })

  api.get("/snapshot", (_req, res) => {
    res.json(state.getSnapshot())
  })

  api.get("/upstream-components", (_req, res) => {
    const manifest = createUpstreamComponentManifest()
    res.json(manifest.postiz)
  })

  api.get("/calendar", (req, res) => {
    const items = state.listCalendar({
      status: normalizeString(req.query?.status, ""),
      from: normalizeString(req.query?.from, ""),
      to: normalizeString(req.query?.to, ""),
      limit: req.query?.limit,
    })
    res.json({ items, total: items.length })
  })

  api.post("/drafts", (req, res) => {
    try {
      const draft = state.createDraft(req.body || {})
      return res.status(201).json({ draft })
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create social draft" })
    }
  })

  api.post("/schedule", (req, res) => {
    try {
      const draft = state.scheduleDraft(normalizeString(req.body?.draftId), req.body?.scheduledAt)
      return res.json({ draft })
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to schedule draft" })
    }
  })

  api.post("/approve", (req, res) => {
    try {
      const approved = req.body?.approved !== false
      const draft = state.reviewDraft(normalizeString(req.body?.draftId), approved, req.body?.comment)
      return res.json({ draft })
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to review draft" })
    }
  })

  api.post("/brand-check", (req, res) => {
    const result = state.brandCheck(req.body || {})
    res.json(result)
  })

  return api
}
