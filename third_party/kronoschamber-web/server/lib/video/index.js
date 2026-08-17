import express from "express"
import { createUpstreamComponentManifest } from "../adapters/upstream-components.js"

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

const clampLimit = (value, fallback = 24, max = 100) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return fallback
  }
  return Math.max(1, Math.min(max, Math.round(numeric)))
}

const DEFAULT_JOBS = [
  {
    id: "job-2001",
    sourceUrl: "https://www.youtube.com/watch?v=demo-kronos-launch",
    sourceTitle: "Kronos launch walkthrough",
    status: "completed",
    platforms: ["tiktok", "youtube-shorts", "instagram-reels"],
    brandKitId: "brand-kronos-main",
    createdAt: Date.now() - 1000 * 60 * 60 * 8,
    updatedAt: Date.now() - 1000 * 60 * 45,
    clips: [
      {
        id: "clip-3001",
        jobId: "job-2001",
        title: "Hook: browser QA before publish",
        text: "Validate the page, CTA, and analytics tags before you schedule the post.",
        startTime: "00:00:18",
        endTime: "00:00:42",
        duration: 24,
        score: 0.92,
        status: "ready",
      },
      {
        id: "clip-3002",
        jobId: "job-2001",
        title: "Workflow: draft to approval",
        text: "Turn a long-form launch video into approved clips and push them straight into the social queue.",
        startTime: "00:01:08",
        endTime: "00:01:36",
        duration: 28,
        score: 0.88,
        status: "ready",
      },
    ],
  },
]

export const createVideoState = () => {
  let jobCounter = 2001
  let clipCounter = 3002

  const jobs = DEFAULT_JOBS.map((job) => ({
    ...job,
    platforms: [...job.platforms],
    clips: job.clips.map((clip) => ({ ...clip })),
  }))

  const listJobs = ({ limit } = {}) => {
    return jobs
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, clampLimit(limit, 24, 200))
  }

  const getJob = (jobId) => {
    return jobs.find((entry) => entry.id === jobId) ?? null
  }

  const createJob = ({
    sourceUrl,
    platforms,
    brandKitId,
    language = "en",
    caption = "",
  }) => {
    const normalizedSourceUrl = normalizeString(sourceUrl)
    if (!normalizedSourceUrl) {
      throw new Error("sourceUrl is required")
    }

    jobCounter += 1
    clipCounter += 1
    const now = Date.now()
    const nextJob = {
      id: `job-${jobCounter}`,
      sourceUrl: normalizedSourceUrl,
      sourceTitle: normalizeString(caption, "Pending source title"),
      status: "queued",
      platforms: normalizeStringArray(platforms),
      brandKitId: normalizeString(brandKitId, ""),
      language: normalizeString(language, "en"),
      createdAt: now,
      updatedAt: now,
      clips: [
        {
          id: `clip-${clipCounter}`,
          jobId: `job-${jobCounter}`,
          title: "Candidate clip 1",
          text: "Generated clip candidate ready for review and social adaptation.",
          startTime: "00:00:00",
          endTime: "00:00:20",
          duration: 20,
          score: 0.74,
          status: "queued",
        },
      ],
    }
    jobs.unshift(nextJob)
    return nextJob
  }

  const sendClipToSocial = ({ clipId, platforms, caption, onCreateSocialDraft }) => {
    const job = jobs.find((entry) => entry.clips.some((clip) => clip.id === clipId))
    const clip = job?.clips.find((entry) => entry.id === clipId) ?? null
    if (!clip || !job) {
      throw new Error("Clip not found")
    }

    if (typeof onCreateSocialDraft !== "function") {
      return {
        clip,
        forwarded: false,
        reason: "Social draft handler unavailable",
      }
    }

    const draft = onCreateSocialDraft({
      title: clip.title,
      text: normalizeString(caption, clip.text),
      platforms: normalizeStringArray(platforms),
      mediaUrls: [`clip://${clip.id}`],
      campaignId: null,
      brandKitId: job.brandKitId || null,
      provenance: "video-pipeline",
    })

    clip.status = "queued-for-social"
    job.updatedAt = Date.now()

    return {
      clip,
      forwarded: true,
      draft,
    }
  }

  const getSnapshot = () => {
    const allJobs = listJobs({ limit: 12 })
    const allClips = allJobs.flatMap((job) => job.clips.map((clip) => ({ ...clip, sourceTitle: job.sourceTitle })))
    const activeJobs = allJobs.filter((job) => job.status === "queued" || job.status === "processing").length
    const readyClips = allClips.filter((clip) => clip.status === "ready" || clip.status === "queued-for-social").length
    return {
      metrics: {
        totalJobs: allJobs.length,
        activeJobs,
        readyClips,
      },
      jobs: allJobs,
      clips: allClips.slice(0, 12),
    }
  }

  return {
    listJobs,
    getJob,
    createJob,
    sendClipToSocial,
    getSnapshot,
  }
}

export const createVideoRouter = ({ state, getSupoClipOrigin, onCreateSocialDraft } = {}) => {
  const api = express.Router()

  const getUpstreamOrigin = () => (typeof getSupoClipOrigin === "function" ? getSupoClipOrigin() : null)

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
    res.json(manifest.supoclip)
  })

  api.get("/jobs", (req, res) => {
    const jobs = state.listJobs({ limit: req.query?.limit })
    res.json({ jobs, total: jobs.length })
  })

  api.get("/jobs/:id", (req, res) => {
    const job = state.getJob(normalizeString(req.params?.id))
    if (!job) {
      return res.status(404).json({ error: "Job not found" })
    }
    return res.json({ job })
  })

  api.post("/jobs", (req, res) => {
    try {
      const job = state.createJob(req.body || {})
      return res.status(201).json({ job })
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create video job" })
    }
  })

  api.post("/clips/:clipId/send-to-social", (req, res) => {
    try {
      const result = state.sendClipToSocial({
        clipId: normalizeString(req.params?.clipId),
        platforms: req.body?.platforms,
        caption: req.body?.caption,
        onCreateSocialDraft,
      })
      return res.json(result)
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to send clip to social" })
    }
  })

  return api
}
