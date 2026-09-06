# 10x Analysis: KronTerm and KronosCode Agent Reliability
Session 11 | Date: 2026-06-19

## Current Value

KronTerm is a desktop command center that merges terminal, browser, preview, sandbox, native desktop control, AI chat, and block/widget automation into one workspace. KronosCode is the agent layer: it can read workspace state, call tools, ask for approval, control blocks, run terminal/file actions, and persist ACP sessions.

The current product promise is strong: a developer should be able to ask an agent to understand the live workspace and act across terminal, browser, files, sandbox, and desktop surfaces without manual context passing.

Evidence from this repo:

- `README.md` positions KronTerm as "Terminal · Browser · Editor · Sandboxes · AI Agents · Desktop Control" in one surface.
- `pkg/aiusechat/kronos-backend.go` bridges Kronos sessions, streams events, converts tool calls/results, and synchronizes Wave tool results back into chat state.
- `pkg/aiusechat/usechat.go` runs the tool loop, approval flow, metrics, fallback, and stop-reason handling.
- `pkg/aiusechat/capabilities.go` classifies tools by source, risk, pack, availability, and verification mode.
- `frontend/app/aipanel/use-acp-session.ts` persists ACP runtime state, hydrates stored/live sessions, tracks agent status, confirmations, model info, capabilities, and usage.
- `frontend/types/agent-activity.ts` already models activity phases, surfaces, risk, target points, screenshots, and timeline storage.
- `frontend/app/aipanel/agent-run-strip.tsx` exposes a compact live run indicator, but not yet a full reliability cockpit.
- `mcp-kron-term/src/index.ts` exposes a broad MCP surface for workspace, widgets, sandbox, terminal, files, native desktop, secrets, notifications, and block control.
- `mcp-kron-term/src/wsh-bridge.ts` resolves `wsh`, calls the CLI, and provides diagnostics for JWT/tab/block availability.
- `ROADMAP.md` already names provider flexibility, local agents, widget context, direct command execution, multi-file editing, safe file modifications, remote operations, and custom AI widgets as strategic AI areas.

## The Question

What would make KronTerm and KronosCode feel fully accurate, fast loading, and error-free?

Answer: stop treating accuracy, speed, and errors as general quality goals. Make them first-class product systems with visible service-level targets:

- Accuracy: the agent proves what it saw, what it changed, and how it verified success.
- Speed: every agent path has a cold-start and warm-start budget, with lazy loading and cached readiness.
- Errors: every failure is classified, recoverable where possible, and tied to a user-visible fix or fallback.

The realistic target is not "zero errors." The 10x target is "no mystery errors": failures should be rare, bounded, explained, recoverable, and replayable.

---

## Massive Opportunities

### 1. Agent Reliability Cockpit

**What**: Replace the small run strip with a full reliability cockpit: live plan, tool calls, pending approvals, current surface, observed evidence, verification checks, retries, degraded services, cost/tokens/time, and final pass/fail proof.

**Why 10x**: Users will not trust a powerful agent because it sounds confident. They will trust it because it shows the work, exposes uncertainty, and verifies outcomes. This turns KronosCode from a chat panel into an accountable work system.

**Unlocks**: trust, debugging, team handoff, faster issue reports, agent run replay, approval confidence.

**Effort**: High

**Risk**: Could become noisy. It needs progressive disclosure: a compact strip by default, full details on inspect.

**Score**: 🔥

### 2. Deterministic Surface Truth Layer

**What**: Make widget/desktop/browser/terminal state a deterministic contract. Every action should include before snapshot, target reference, action result, after snapshot, and verification predicate. Element refs should declare freshness, source, bounds, role/name/value, and invalidation rules.

**Why 10x**: Most agent inaccuracy comes from stale or weak state. If KronosCode can always answer "what did I see before acting?" and "did the surface actually change?", it becomes dramatically more reliable.

**Unlocks**: fewer wrong clicks, better browser automation, better sandbox control, replayable desktop actions, surface conformance tests.

**Effort**: Very High

**Risk**: Requires contracts across multiple surfaces, not just UI polish.

**Score**: 🔥

### 3. Startup Hot Path Budget

**What**: Define and enforce startup budgets for app shell, AI panel visible, agent ready, MCP ready, first prompt accepted, first tool executed, and first verified action. Move heavyweight systems behind lazy readiness and prewarm only the most likely path.

**Why 10x**: "Fast loading" is not one metric. KronTerm has Electron, Go, `wsh`, ACP runtime, MCP, sandbox, native desktop control, and provider configuration. Users need the first useful interaction quickly, even if advanced tools continue warming in the background.

**Unlocks**: perceived speed, fewer startup race bugs, reliable beta onboarding, targeted performance work.

**Effort**: High

**Risk**: Lazy loading can hide errors if the doctor system does not surface delayed failures.

**Score**: 🔥

### 4. Self-Healing Agent Doctor

**What**: Expand diagnostics from `surface_status` and runtime detection into a continuous doctor that checks `wsh`, JWT/tab scope, ACP agent binaries, model/provider auth, local endpoints, MCP servers, sandbox runtime, native desktop permissions, LSP availability, ports, build resources, and version compatibility. Every check should have a fix action or a clear fallback.

**Why 10x**: KronTerm has many moving parts. A user should never debug "agent not working" by reading logs. The product should say "KronTerm can run file and terminal tools now; desktop control is unavailable because accessibility permission is missing."

**Unlocks**: fewer support loops, safer onboarding, visible degraded mode, actionable startup errors.

**Effort**: Medium/High

**Risk**: Needs to avoid destructive auto-fixes and respect user permissions.

**Score**: 🔥

---

## Medium Opportunities

### 1. Accuracy Scorecard Per Agent Run

**What**: At the end of every run, show a compact scorecard: requested outcome, files/surfaces touched, verification commands, screenshots/snapshots used, unresolved assumptions, failed tool calls, and confidence level.

**Why 10x**: It makes quality explicit. The user sees whether the agent actually verified the work or only completed a narrative.

**Impact**: Reduces false confidence, creates a habit of verification, and gives developers a quick review artifact.

**Effort**: Medium

**Score**: 🔥

### 2. Tool Capability Gating

**What**: Before a model sees tools, filter them by actual live readiness, risk, scope, and current workspace. If sandbox is unavailable, do not advertise sandbox tools as ready. If widget refs are stale, force snapshot first. If a model lacks image/tool capability, route around it.

**Why 10x**: The repo already classifies tools in `pkg/aiusechat/capabilities.go`; use that classification to prevent impossible or low-confidence actions before they happen.

**Impact**: Fewer failed tool calls, shorter prompts, faster model decisions, clearer permissions.

**Effort**: Medium

**Score**: 🔥

### 3. Run Replay and Failure Bundles

**What**: Save a minimal replay bundle for each failed or degraded agent run: prompt, plan, tool list, tool inputs/outputs, surface snapshots, final error, environment doctor state, and version/build info.

**Why 10x**: "It failed" becomes reproducible. This is useful for local debugging, beta support, and automated regression tests.

**Impact**: Faster fixes, better reliability trends, fewer ambiguous bug reports.

**Effort**: Medium

**Score**: 👍

### 4. Agent Readiness Cache

**What**: Cache expensive readiness checks and tool manifests by app version, workspace, agent backend, and env hash. Revalidate incrementally instead of re-detecting everything on each panel/session load.

**Why 10x**: `use-acp-session.ts` hydrates stored and live sessions with retry logic, and MCP/wsh diagnostics exist. Caching readiness lets the UI become usable quickly while still detecting drift.

**Impact**: Faster AI panel load, fewer duplicate startup checks, less user-visible churn.

**Effort**: Medium

**Score**: 👍

### 5. Error Taxonomy and Recovery Routing

**What**: Replace generic error strings with structured classes: provider/auth, model capability, tool validation, approval timeout, stale surface, command failure, missing runtime, network, permission, bug/panic, and user cancellation. Each class maps to UI copy, retry policy, fallback, and telemetry.

**Why 10x**: `usechat.go` and `kronos-backend.go` already pass errors through multiple layers. Structure lets KronTerm recover instead of only reporting.

**Impact**: Fewer dead ends; more automatic retry only where safe; clearer user trust boundary.

**Effort**: Medium

**Score**: 🔥

### 6. Fast Prompt Path

**What**: Let users type and submit immediately while deeper context warms. The first response should say which capabilities are ready now and stream upgrades as tools come online.

**Why 10x**: Users experience speed as "I can start working." The agent does not need every capability ready before it can accept a request.

**Impact**: Better perceived startup, especially with local agents, MCP, sandbox, and desktop permissions.

**Effort**: Medium

**Score**: 👍

---

## Small Gems

### 1. "What I Can Do Right Now" Button

**What**: One button in the AI panel that summarizes live available capabilities, degraded systems, and next fixes.

**Why powerful**: It removes uncertainty before the user asks the agent to do something.

**Effort**: Low

**Score**: 🔥

### 2. Stale Reference Warning

**What**: When a widget or desktop action uses an old snapshot/ref, warn or force a fresh snapshot.

**Why powerful**: Prevents a common source of wrong clicks and bad reads.

**Effort**: Low/Medium

**Score**: 🔥

### 3. First-Run Health Badge

**What**: Show a small status badge for AI ready, tools ready, desktop ready, sandbox ready, and provider ready.

**Why powerful**: Users stop guessing whether the agent is slow, broken, or waiting on setup.

**Effort**: Low

**Score**: 👍

### 4. Error Copy With Next Action

**What**: Every agent error includes one next action: retry, reconnect, install, grant permission, choose model, open doctor, or report bundle.

**Why powerful**: Turns errors into decisions.

**Effort**: Low

**Score**: 🔥

### 5. Verification Required Toggle

**What**: Add a per-run toggle: "Require verification before final answer." When enabled, KronosCode cannot finish coding or surface automation tasks without an explicit check.

**Why powerful**: Small UI control, large trust gain for serious work.

**Effort**: Low/Medium

**Score**: 🔥

### 6. Warm Start Last Agent

**What**: On app launch, prewarm the last-used ACP backend and workspace context only after the shell is interactive.

**Why powerful**: Optimizes the most common path without blocking first paint.

**Effort**: Low/Medium

**Score**: 👍

---

## Recommended Priority

### Do Now

1. Define reliability metrics — Why: "fully accurate, fast, no errors" must become measurable. Track startup milestones, tool success rate, stale-ref rate, provider errors, approval timeouts, and verified-run rate.
2. Add the "What I Can Do Right Now" capability summary — Why: the repo already has tool capability classification and `surface_status`; expose it in the AI panel.
3. Add structured error classes — Why: current generic error propagation makes recovery hard. Start with provider/auth, missing runtime, permission, stale surface, tool validation, and command failure.
4. Require fresh snapshots before high-risk widget/desktop actions — Why: this directly attacks accuracy failures.
5. Add per-run verification scorecard — Why: users need proof, not confidence theater.

### Do Next

1. Build the Agent Reliability Cockpit — Why: it unifies existing ACP state, activity timeline, approvals, tool calls, errors, and verification into one inspectable run view.
2. Implement readiness caching — Why: makes the AI panel fast without pretending every subsystem is ready.
3. Gate tools by actual live availability — Why: reduces failures and prompt bloat.
4. Create failure bundles for degraded/failed runs — Why: support and debugging become evidence-driven.
5. Add startup budget instrumentation — Why: performance work needs per-milestone timings, not a vague "app feels slow" metric.

### Explore

1. Deterministic Surface Truth Layer — Why: this is the biggest accuracy bet. Risk: broad contract work across terminal, browser, sandbox, native desktop, and widgets. Upside: KronosCode becomes meaningfully more reliable than coordinate-first agents.
2. Replayable Agent Runs — Why: replay creates a moat: debugging, audit, QA, handoff, and trust. Risk: storage/privacy. Upside: a product-defining reliability layer.
3. Verified Autonomy Modes — Why: users could choose "fast draft", "careful", or "strict verified" agent behavior. Risk: mode complexity. Upside: agent behavior matches user risk tolerance.

### Backlog

1. Multi-agent consensus for high-risk edits — Why later: potentially useful, but expensive until single-agent evidence and verification are solid.
2. Marketplace for reliability profiles — Why later: tool/workflow sharing matters after core reliability is dependable.
3. Full visual workflow builder — Why later: powerful, but it should sit on top of the truth layer, not substitute for it.

---

## Questions

### Answered

- **Q**: What does the agent need most to feel fully accurate? **A**: Proof loops: live state, action result, after-state, and verification.
- **Q**: What does fast loading mean here? **A**: Time to first useful agent interaction, not time until every optional subsystem is ready.
- **Q**: What does no errors mean in practice? **A**: No mystery errors. Failures need classification, recovery, fallback, and replay evidence.
- **Q**: What existing repo pieces can support this? **A**: ACP runtime state, tool capability classification, surface activity timeline, MCP diagnostics, `wsh` bridge diagnostics, tool approval flow, and Kronos session conversion.

### Blockers

- **Q**: What are the target startup budgets? Proposed defaults: app shell visible under 1.5s, AI panel usable under 2.5s, first prompt accepted under 3s, common tools ready under 5s, optional sandbox/desktop readiness async.
- **Q**: What user risk profile should be default? Proposed default: "balanced verified" for code changes and surface automation, "fast" for read-only Q&A.

## Next Steps

- [ ] Add an `AgentRunMetrics` schema covering milestone timings, tool outcomes, errors, verification, and degraded services.
- [ ] Add a capability summary endpoint/UI using existing capability and diagnostics data.
- [ ] Introduce structured error classes across Kronos backend, Wave tool loop, ACP session state, and MCP bridge responses.
- [ ] Add stale-ref detection and forced fresh snapshots for widget/desktop actions.
- [ ] Add a run scorecard in the AI panel using existing ACP messages, activity events, tool status, and verification outcomes.
- [ ] Set cold-start and warm-start budgets, then instrument each milestone before optimizing.
