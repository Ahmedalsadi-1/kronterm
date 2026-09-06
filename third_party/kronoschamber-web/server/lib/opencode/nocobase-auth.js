import crypto from "crypto"

const DEFAULT_TIMEOUT_MS = 12_000
const DEFAULT_AUTHENTICATOR = "basic"
const DEFAULT_APP = "main"

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000
const RATE_LIMIT_MAX_ATTEMPTS = Number(process.env.KRONOSCHAMBER_RATE_LIMIT_MAX_ATTEMPTS) || 10
const RATE_LIMIT_LOCKOUT_MS = 15 * 60 * 1000

const parseCookies = (cookieHeader) => {
  if (!cookieHeader || typeof cookieHeader !== "string") {
    return {}
  }

  return cookieHeader.split(";").reduce((acc, segment) => {
    const [name, ...rest] = segment.split("=")
    if (!name) return acc
    const key = name.trim()
    if (!key) return acc
    const value = rest.join("=").trim()
    acc[key] = decodeURIComponent(value || "")
    return acc
  }, {})
}

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"]
  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0].trim()
  }
  const ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress
  if (typeof ip === "string" && ip.startsWith("::ffff:")) {
    return ip.substring(7)
  }
  return ip || "unknown-client"
}

const normalizeString = (value) => {
  if (typeof value !== "string") return ""
  return value.trim()
}

const normalizeOrigin = (value) => {
  const trimmed = normalizeString(value)
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, "")
}

const firstPresentString = (...candidates) => {
  for (const candidate of candidates) {
    const normalized = normalizeString(candidate)
    if (normalized) return normalized
  }
  return ""
}

const maybeJson = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const collectSetCookies = (headers) => {
  if (!headers) return []
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie()
  }
  const raw = headers.get("set-cookie")
  if (!raw) return []
  return [raw]
}

const forwardSetCookies = (res, upstreamHeaders) => {
  if (!res || typeof res.setHeader !== "function") return
  const setCookies = collectSetCookies(upstreamHeaders)
  if (setCookies.length > 0) {
    res.setHeader("Set-Cookie", setCookies)
  }
}

const getCredentialFields = (body) => {
  const username = firstPresentString(body?.username, body?.account, body?.email, body?.login)
  const password = firstPresentString(body?.password)
  return { username, password }
}

const extractRetryAfterSeconds = (response, payload) => {
  const headerValue = Number(response?.headers?.get?.("retry-after"))
  if (Number.isFinite(headerValue) && headerValue > 0) {
    return Math.ceil(headerValue)
  }
  const payloadValue = Number(payload?.retryAfter)
  if (Number.isFinite(payloadValue) && payloadValue > 0) {
    return Math.ceil(payloadValue)
  }
  return undefined
}

export const createNocobaseUiAuth = ({
  origin,
  authenticator = DEFAULT_AUTHENTICATOR,
  appName = DEFAULT_APP,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) => {
  const upstreamOrigin = normalizeOrigin(origin)

  if (!upstreamOrigin) {
    return {
      enabled: false,
      requireAuth: (_req, _res, next) => next(),
      handleSessionStatus: (_req, res) => {
        res.status(503).json({ authenticated: false, error: "NocoBase origin is not configured" })
      },
      handleSessionCreate: (_req, res) => {
        res.status(503).json({ authenticated: false, error: "NocoBase origin is not configured" })
      },
      handleSessionDestroy: (_req, res) => {
        res.json({ authenticated: false })
      },
      ensureSessionToken: (req) => {
        const cookieHeader = typeof req?.headers?.cookie === "string" ? req.headers.cookie.trim() : ""
        if (!cookieHeader) return null
        return crypto.createHash("sha256").update(cookieHeader).digest("hex")
      },
      dispose: () => {},
    }
  }

  const checkUrl = `${upstreamOrigin}/api/auth:check`
  const signInUrl = `${upstreamOrigin}/api/auth:signIn`
  const signOutUrl = `${upstreamOrigin}/api/auth:signOut`
  const safeTimeoutMs = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS

  const rateLimiter = new Map()

  const getRateLimitState = (req) => {
    const key = getClientIp(req)
    const now = Date.now()
    const current = rateLimiter.get(key)

    if (!current) {
      return { key, allowed: true }
    }

    if (current.lockedUntil && now < current.lockedUntil) {
      return {
        key,
        allowed: false,
        retryAfter: Math.ceil((current.lockedUntil - now) / 1000),
      }
    }

    if (now - current.lastAttempt > RATE_LIMIT_WINDOW_MS) {
      rateLimiter.delete(key)
      return { key, allowed: true }
    }

    if (current.count >= RATE_LIMIT_MAX_ATTEMPTS) {
      const lockedUntil = now + RATE_LIMIT_LOCKOUT_MS
      rateLimiter.set(key, { count: current.count, lastAttempt: now, lockedUntil })
      return { key, allowed: false, retryAfter: Math.ceil(RATE_LIMIT_LOCKOUT_MS / 1000) }
    }

    return { key, allowed: true }
  }

  const recordRateLimitFailure = (key) => {
    const now = Date.now()
    const current = rateLimiter.get(key)
    if (!current || now - current.lastAttempt > RATE_LIMIT_WINDOW_MS) {
      rateLimiter.set(key, { count: 1, lastAttempt: now })
      return
    }
    rateLimiter.set(key, { ...current, count: (current.count || 0) + 1, lastAttempt: now })
  }

  const clearRateLimitKey = (key) => {
    if (!key) return
    rateLimiter.delete(key)
  }

  const buildForwardHeaders = (req) => {
    const headers = {
      Accept: "application/json",
    }

    if (typeof req?.headers?.cookie === "string" && req.headers.cookie.trim().length > 0) {
      headers.Cookie = req.headers.cookie
    }
    if (typeof req?.headers?.["user-agent"] === "string") {
      headers["User-Agent"] = req.headers["user-agent"]
    }
    return headers
  }

  const callUpstreamCheck = async (req, res) => {
    const query = new URLSearchParams()
    if (normalizeString(authenticator)) query.set("authenticator", normalizeString(authenticator))
    if (normalizeString(appName)) query.set("app", normalizeString(appName))
    const target = query.toString().length > 0 ? `${checkUrl}?${query}` : checkUrl

    const response = await fetch(target, {
      method: "GET",
      headers: buildForwardHeaders(req),
      signal: AbortSignal.timeout(safeTimeoutMs),
    })
    forwardSetCookies(res, response.headers)
    const payload = await maybeJson(response)
    return { response, payload }
  }

  const callUpstreamSignIn = async (req, res, username, password) => {
    const attempts = [
      {
        authenticator,
        app: appName,
        values: {
          account: username,
          password,
        },
      },
      {
        authenticator,
        app: appName,
        values: {
          username,
          password,
        },
      },
      {
        authenticator,
        app: appName,
        values: {
          email: username,
          password,
        },
      },
      {
        authenticator,
        app: appName,
        account: username,
        password,
      },
      {
        authenticator,
        app: appName,
        username,
        password,
      },
    ]

    const baseHeaders = buildForwardHeaders(req)

    let last = null
    for (const body of attempts) {
      const response = await fetch(signInUrl, {
        method: "POST",
        headers: {
          ...baseHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(safeTimeoutMs),
      })
      forwardSetCookies(res, response.headers)
      const payload = await maybeJson(response)
      last = { response, payload }
      if (response.ok) {
        return last
      }
      if (response.status === 401 || response.status === 403 || response.status === 429) {
        return last
      }
    }

    return last
  }

  const respondUnauthorized = (req, res, payload) => {
    const acceptsJson = req.headers.accept?.includes("application/json")
    if (acceptsJson || req.path.startsWith("/api")) {
      res.status(401).json({
        authenticated: false,
        locked: true,
        error: typeof payload?.error === "string" ? payload.error : "Authentication required",
      })
      return
    }
    res.status(401).type("text/plain").send("Authentication required")
  }

  const requireAuth = async (req, res, next) => {
    if (req.method === "OPTIONS") {
      return next()
    }
    try {
      const { response, payload } = await callUpstreamCheck(req, res)
      if (response.ok) {
        return next()
      }
      if (response.status === 401 || response.status === 403) {
        return respondUnauthorized(req, res, payload)
      }
      return res.status(503).json({
        authenticated: false,
        error: "NocoBase auth check failed",
      })
    } catch (error) {
      return res.status(503).json({
        authenticated: false,
        error: error instanceof Error ? error.message : "NocoBase auth check failed",
      })
    }
  }

  const handleSessionStatus = async (req, res) => {
    try {
      const { response, payload } = await callUpstreamCheck(req, res)
      if (response.ok) {
        return res.json({
          authenticated: true,
          source: "nocobase",
          user: payload?.data ?? payload?.user ?? null,
        })
      }
      if (response.status === 401 || response.status === 403) {
        return res.status(401).json({ authenticated: false, locked: true })
      }
      const retryAfter = extractRetryAfterSeconds(response, payload)
      if (response.status === 429) {
        if (retryAfter) {
          res.setHeader("Retry-After", String(retryAfter))
        }
        return res.status(429).json({
          authenticated: false,
          error: "Too many attempts",
          retryAfter,
        })
      }
      return res.status(503).json({
        authenticated: false,
        error: "NocoBase auth check unavailable",
      })
    } catch (error) {
      return res.status(503).json({
        authenticated: false,
        error: error instanceof Error ? error.message : "NocoBase auth check unavailable",
      })
    }
  }

  const handleSessionCreate = async (req, res) => {
    const limitState = getRateLimitState(req)
    if (!limitState.allowed) {
      if (limitState.retryAfter) {
        res.setHeader("Retry-After", String(limitState.retryAfter))
      }
      return res.status(429).json({
        authenticated: false,
        error: "Too many login attempts, please try again later.",
        retryAfter: limitState.retryAfter,
      })
    }

    const { username, password } = getCredentialFields(req.body)
    if (!username || !password) {
      return res.status(400).json({ authenticated: false, error: "username and password are required" })
    }

    try {
      const result = await callUpstreamSignIn(req, res, username, password)
      if (!result) {
        return res.status(503).json({ authenticated: false, error: "NocoBase sign-in failed" })
      }

      const { response, payload } = result
      if (response.ok) {
        clearRateLimitKey(limitState.key)
        return res.json({
          authenticated: true,
          source: "nocobase",
          user: payload?.data ?? payload?.user ?? null,
        })
      }

      if (response.status === 401 || response.status === 403) {
        recordRateLimitFailure(limitState.key)
        return res.status(401).json({
          authenticated: false,
          error: typeof payload?.error === "string" ? payload.error : "Invalid credentials",
        })
      }

      const retryAfter = extractRetryAfterSeconds(response, payload)
      if (response.status === 429) {
        if (retryAfter) {
          res.setHeader("Retry-After", String(retryAfter))
        }
        return res.status(429).json({
          authenticated: false,
          error: typeof payload?.error === "string" ? payload.error : "Too many attempts",
          retryAfter,
        })
      }

      return res.status(502).json({
        authenticated: false,
        error: typeof payload?.error === "string" ? payload.error : "NocoBase sign-in failed",
      })
    } catch (error) {
      return res.status(503).json({
        authenticated: false,
        error: error instanceof Error ? error.message : "NocoBase sign-in failed",
      })
    }
  }

  const handleSessionDestroy = async (req, res) => {
    try {
      const response = await fetch(signOutUrl, {
        method: "POST",
        headers: {
          ...buildForwardHeaders(req),
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(safeTimeoutMs),
      })
      forwardSetCookies(res, response.headers)
      if (response.ok) {
        return res.json({ authenticated: false, cleared: true })
      }
      return res.status(200).json({ authenticated: false, cleared: false })
    } catch {
      return res.status(200).json({ authenticated: false, cleared: false })
    }
  }

  const ensureSessionToken = (req) => {
    const cookieHeader = typeof req?.headers?.cookie === "string" ? req.headers.cookie.trim() : ""
    if (!cookieHeader) return null
    const cookies = parseCookies(cookieHeader)
    const targetCookie =
      cookies["NOCOBASE_AUTH_TOKEN"] ||
      cookies["nocobase-auth"] ||
      cookies["nocobase-auth-token"] ||
      cookieHeader
    if (!targetCookie) return null
    return crypto.createHash("sha256").update(String(targetCookie)).digest("hex")
  }

  return {
    enabled: true,
    requireAuth,
    handleSessionStatus,
    handleSessionCreate,
    handleSessionDestroy,
    ensureSessionToken,
    dispose: () => {
      rateLimiter.clear()
    },
  }
}

