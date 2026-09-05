# KronTerm 30-Day Launch — Show HN + content calendar

**Goal:** 2k stars / 500 WAU / 10 design partners. Built from `marketing_strategy.md` + KronTerm OS line `feat/kronsettings-from-kronoschamber`.

## Week 1–2: Ship where devs live

### Day 1: Show HN (template — post Tuesday 08:00 PT)
**Title:** `Show HN: KronTerm – we forked Wave Terminal (22k★) to build an AI-native workspace OS`
**Body (300 words, keep):**
> Wave is a great terminal (22k stars, durable SSH, blocks) but AI lived in a sidebar. We rebased it as KronTerm: terminal + browser + files + sandbox + desktop control in *one* canvas, with an agentic engine (KronosCode) that can see and drive every surface via `os.*` typed actions, not just chat. Demo: KronTerm OS dock → flat grid overview → Cover Flow → drag file to canvas → agent opens App Stream rail → verifies in embedded Chromium with screenshots. BYOK (OpenAI/Claude/Gemini/Ollama), Apache-2.0. Private beta for macOS (Apple Silicon/x64). Windows/Linux under eval. Try: `git clone ... && task dev`. Would love feedback on the `os.*` surface policy — auditable vs. Warp's block model.

Attach: `assets/kronterm-section/kronterm-homepage.png` + 15s GIF of `Cmd+Shift+Space` command center.

HN checklist: reply to every comment <1h, post `BHAG` comment with `video/KronTermPromo` 62s, link `https://github.com/Ahmedalsadi-1/kronterm` (not `kronterm.dev` first).

### Day 3: Reddit
- r/commandline: "KronTerm OS: the terminal that learned to be a desktop"
- r/devops, r/neovim, r/electronjs — one post per sub, tailor title, no cross-post spam
- Include `SPONSORS.md` tier table for indie credibility

### Day 5: Product Hunt (hold until 200 stars)
PH needs 50+ upvotes day-1 — schedule after HN lift.

## Week 2–4: Content (leads to funding conversations)

| Day | Title | Hook | CTA |
|-----|-------|------|-----|
| 7 | Why your terminal needs AI (and how to do it *inside* the workspace) | KronosCode vs. sidebar | GitHub star |
| 14 | Durable SSH: the feature you didn't know you needed (until prod dropped at 2am) | `pkg/remote` reconnect demo | Discord join |
| 21 | KronTerm OS: typed `os.*` actions vs. coordinate-only automation | `kronarchy-shell.tsx` + `surface-policy.ts` | Design partner call |
| 28 | From Warp ($73M) to Fig→AWS: what terminal startups get acquired for | Your upstream 22k★ as leverage | Sponsor / pilot |

Each post: 900 words, 2 GIFs, code block with `task dev` + `task check:ts`.

## Week 4–8: Integrations (enterprise wedge)

- **NPM:** `mcp-kron-term` v0.1 — already in repo, add `npm publish` CI badge to README
- **VS Code extension stub** — "Open in KronTerm" command, keyword `terminal alternative`
- **Docker** — `docker run kronterm/kronterm --sandbox` for CI preview

## Metrics (reuse `marketing_strategy.md`)

- Primary: WAU (opt-in telemetry) → proxy via `gh api repos/.../traffic/clones`
- Secondary: stars (+50/wk), Discord (→1k), 10 contributors/mo, 10 design partners
- Instrument: `gh repo view --json stargazerCount` daily cron in `.github/workflows/traffic.yml` (TODO)

## Assets to ship this week

- [ ] Upload social preview `assets/kronterm-section/kronterm-homepage.png` at `github.com/Ahmedalsadi-1/kronterm/settings` → Social preview (1280×640)
- [ ] Record 15s `os.*` clip: dock scale/glow + Cover Flow (from `docs/os-mode/PHASE_09_COVERFLOW_OVERVIEW.md` refs)
- [ ] Ship `SPONSORS.md` tier $9/$99 — already done, link from HN body

Next: merge PR #2 → tag `v0.14.4-kronterm.1` → attach `make/kronterm.app` to Release for PH verification.
