# KronTerm Data Room — for funding & M&A conversations

**Prepared:** 2026-09-05 | **Repo:** `Ahmedalsadi-1/kronterm` (fork of `wavetermdev/waveterm` 22k★, 1.1k forks) | **Branch:** `feat/kronsettings-from-kronoschamber` | **License:** Apache-2.0 | **Go module:** `github.com/wavetermdev/waveterm` (compat)

## 1. What KronTerm is (one-pager)

KronTerm is Wave Terminal rebased as an AI-native workspace OS: terminal + browser + files + sandbox + desktop control in one Electron+Go desktop, driven by KronosCode — an agentic engine with typed `os.*` surface actions (not coordinate-only). The new KronTerm OS line adds calm window composition (flat grid overview, Cover Flow app switcher, connected dock, no-overshoot springs), Hermes panel (`/files|/terminal|/preview`), grouped file browser with drag-to-canvas, App Stream rails, and Command Center `Cmd+Shift+Space`.

**Proof vs. comps:**
- **Warp:** $6M Seed (Neo/GV, 2021) → $17M Series A (GV+Dylan Field, 2022) → **$50M Series B Sequoia Jun 2023**, $73M total, 1M active devs, Rust, AI-native. Major risk: commoditization by Microsoft/GitHub CLI.
- **Fig:** $2.2M seed → **acquired by Amazon/AWS Aug 28 2023**, hundreds of thousands users, 400 contributors, free Team tier post-close, sunset Sep 2024 into Amazon Q (Fig autocomplete → Q Developer). Acqui-hire into Q = precedent for terminal → cloud IDE.

Your upstream (Wave 22k★) is the venture signal Fig lacked at seed; your `kronterm OS` policy layer is the diligence shield Warp lacks (coordinate-only).

## 2. Where to look (from `AGENTS.md`)

| Need | Location |
|------|----------|
| KronTerm OS shell | `frontend/app/workspace/kronarchy-shell.tsx` + `.kilocode/skills/kronterm-os/SKILL.md` (`os.*` typed actions, Overview, Cover Flow, AppStream rails) |
| Hermes panel | `frontend/hermes/` + `frontend/app/workspace/workspace-hermes-panel.ts` (`/files|/terminal|/preview`) |
| Agent engine | `agents/kronoscode/`, `emain/acp/`, `emain/kronoscode-runtime.ts` |
| MCP bridge | `mcp-kron-term/src/` (`kron-computer-use.ts`, `surface-policy.ts`, `native-bridge.ts`) |
| Policy | `mcp-kron-term/src/surface-policy.ts` + `mcp-kron-term/test/native-bridge-policy.test.ts` |

## 3. Traction needed for credible raise/exit

Today: **0 stars / 0 forks on your fork** (just rebranded Mar 2026). Upstream traction is not yours — you need 90 days of `30-day-launch.md`:

- **Funding gate:** 500 WAU + 200 stars + 50 Discord members → angel/pre-seed ($500k–$1.5M) intro to Neo/BoxGroup/GV/Dylan Field/Elad Gil (Warp backers). YC W26 application with "Warp+Fig+Notion for terminals" pitch.
- **Series A gate:** 5k WAU + 2k stars + 10 design partners + $20k ARR (Pro $20/mo AI-credit model like Warp) → Sequoia/a16z/Kleiner.
- **M&A gate:** Fig sold at *hundreds of thousands users*; Warp valued on 1M devs. Expect $10–15M acquihire at 500+ active users, $30M+ product acquisition at 5k+ WAU.

## 4. Who buys KronTerm (ranked)

1. **Amazon/AWS** — did Fig→Q, now needs workspace OS vs. Cursor. Your `mcp-kron-term` + `pkg/sandbox` + E2B maps to WorkSpaces. Warm via Fig alumni (Brendan Falk) + AWS CodeWhisperer.
2. **Microsoft/GitHub** — owns Terminal+VS Code+Copilot; threatened by Warp. Pitch: "Copilot Workspace that can *drive the desktop* via `kronterm-native-tool-bridge.ts`".
3. **JetBrains** — Fleet needs terminal story; your Monaco + LSP (`emain-lsp.ts`) is their language.
4. **Atlassian/GitLab** — platform play for durable SSH + canvas.
5. **Replit/Sourcegraph/Vercel/Datadog/Cursor** — acquihire for ACP + `kron-computer-use`.

## 5. Valuation drivers to build now

- **Auditable policy:** Keep `surface-policy.ts` + `native-bridge-policy.test.ts` — Fig had no policy, Warp is coordinate-only. This is your enterprise wedge.
- **Paid tier signal:** Ship `KronTerm Pro $20/mo` (Stripe test mode) even before revenue — buyers price ARR signal over code.
- **Clean IP:** Keep Apache-2.0, keep Go module compat, document fork lineage in `NOTICE` (already).

## 6. How to be approached

- Don't list on Acquire.com at 0 users. Spend 90 days on `30-day-launch.md`, then hire boutique (Aream & Co, Vista Point) if exit desired.
- Warm intros > blast: ask 3 upstream contributors for intro to Warp/Fig alumni; then offer design partner pilot ("free Team tier like Fig → AWS").

## 7. Immediate asks (next 7 days)

- Merge PR #2 → tag `v0.14.4-kronterm.1` with `make/kronterm.app` artifact (required for PH verification + data room download).
- Upload social preview at `github.com/.../settings` (1280×640 `kronterm-homepage.png`).
- Enable GitHub Sponsors for `Ahmedalsadi-1` so `SPONSORS.md` tiers render.

Contact: `hello@kronterm.dev` / Discord https://discord.gg/XfvZ334gwU / `SPONSORS.md`
