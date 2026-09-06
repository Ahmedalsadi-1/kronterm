# 10x Analysis: KronTerm and KronosCode
Session 10 | Date: 2026-06-15

## Current Value

KronTerm is positioned as an AI-native desktop command center: terminal, browser, editor, sandbox, desktop control, widgets, and KronosCode in one surface. The core product value is not "a better terminal"; it is shared context plus agent control over real working surfaces.

The repo confirms the product is moving toward that: widget interaction APIs are listed in `pkg/wshrpc/wshserver/wshserver.go`, canvas persistence exists in `pkg/wshrpc/wshserver/canvas.go`, Chathub/KronosChamber service bootstrapping is being added in `emain/chathubv2-server.ts`, LSP bootstrapping is present in `emain/emain-lsp.ts`, and the README describes KronosCode as a structured agent engine that sees terminals, browsers, files, sandboxes, and macOS apps.

The product risk right now is integration reliability. The idea is strong, but the current tree is failing TypeScript typecheck, default tests sweep unrelated/symlinked projects, logs show companion service failures, and several new surfaces are present without narrow health gates.

## The Question

What would make KronTerm and KronosCode 10x more valuable?

Answer: make the workspace observable, replayable, self-healing, and programmable by agents as first-class infrastructure. Users should trust KronosCode because they can see what it sees, replay what happened, recover from failures, and compose reliable agent workflows without wiring tools manually.

---

## Audit Evidence

### Commands Run

- `task check:ts` with PATH repaired to include `/opt/homebrew/bin`, repo `node_modules/.bin`, and bundled Node.
- `go test ./pkg/...`.
- `npm test -- --run`.
- `vitest run frontend/app/view/kronoscanvas/kronoscanvas-utils.test.ts frontend/layout/tests`.
- `npx eslint .`.
- Log scans over:
  - `kronoscoder/desktop-dev.log`
  - `kronoscoder/desktop-dev-new.log`
  - `kronoscoder/tui-dev-new.log`
  - `kronoscoder/.service-logs/jaaz-server.log`
- Static scans for TODO/FIXME/BUG markers in first-party `frontend`, `emain`, and `pkg`.
- `git diff --stat` and `git diff --check`.

### Validation Results

- Go backend package tests passed: `go test ./pkg/...`.
- Focused KronTerm frontend slice passed: 7 test files, 39 tests for KronosCanvas and layout.
- TypeScript failed: `task check:ts` exits non-zero with many errors.
- Broad Vitest is not a reliable health gate right now. It enters symlinked/adjacent workspaces (`krondesign`, `open-design`, `kronoscoder`), n8n integration tests that need private `.env`, and tests that require SQLite FTS5.
- ESLint was stopped after no useful signal because the default target is also too broad for the dirty workspace.
- `git diff --check` passed: no whitespace errors in tracked diffs.

---

## Confirmed Issues and Bugs

### 1. TypeScript Typecheck Is Broken

`task check:ts` fails across Electron, frontend globals, KronosCode v2 chat, settings, sandbox, preview mocks, and generated RPC types.

High-signal examples:

- `emain/emain-overlay.ts:61`, `emain/emain-pet.ts:277`, and `emain/emain-tabview.ts:142` set `contentSecurityPolicy` inside `webPreferences`, but Electron's `WebPreferences` type does not support that property.
- `emain/emain-tabview.ts:127`, `emain/emain-window.ts:397`, and `frontend/wave.ts` reference missing global `WaveInitOpts`.
- `frontend/app/aipanel/kronoscode-v2/components/chat/message/parts/AssistantTextPart.tsx:2-3` imports `../../../types/scroll` and `../../../types/sdk`, but the actual files are under `frontend/app/aipanel/kronoscode-v2/types`. From `parts/`, that import needs another `..`.
- `frontend/app/aipanel/kronoscode-v2/components/chat/MarkdownRenderer.tsx` imports missing `@streamdown/code`; `package.json` includes `@streamdown/mermaid` but not `@streamdown/code`.
- `frontend/app/view/term/term.tsx` and preview mocks are missing new `isFolded` / `toggleFold` fields on block/node model types.
- settings panels pass string keys like `desktop:control`, `git:username`, and `notify:desktop` that are not in `SettingsType`.

Impact: the app cannot be trusted as shippable until typecheck is green. This is the highest-priority bug.

### 2. KronosCode TUI Fails to Start

`kronoscoder/tui-dev-new.log` shows:

`Cannot find module '@/storage' from '/Users/albsheralsadi/kronosfinal/kronoscoder/packages/kronoscode/src/marketplace/registry.ts'`

Impact: one of the core KronosCode entry points is broken at module resolution time.

### 3. Default Test Command Is Over-Inclusive

`package.json:25` defines `"test": "vitest"`, and `vitest.config.ts` has no include/exclude boundaries. The broad run enters adjacent/symlinked workspaces and vendored/research paths, producing failures unrelated to core KronTerm:

- n8n tests fail with `no such module: fts5`.
- n8n integration tests fail because `N8N_API_URL` and `N8N_API_KEY` are missing.
- `krondesign` / `open-design` packaged smoke workflow tests fail on unrelated metadata expectations.
- The run was interrupted after enough confirmed failures; it was not converging into a useful KronTerm app signal.

Impact: contributors cannot run one command and know whether KronTerm is healthy.

### 4. Companion Service Startup and Shutdown Are Brittle

Logs show repeated readiness and lifecycle issues:

- `Vite dev server not ready, using local API UI at http://127.0.0.1:3001`
- `Startup model validation failed (non-blocking): Unable to connect`
- `Server close timeout reached, forcing shutdown`
- `KronosCode shutdown` skipped because an external server was detected
- Updater endpoint failures

`emain/chathubv2-server.ts:38-40` hard-codes port and health timeout defaults, and `waitForHealth` treats any status below 500 as healthy. That makes degraded or auth-blocked states look ready.

Impact: users will experience "it opened, but the agent does not actually work" failure modes.

### 5. Chathub/KronosChamber Packaging Path Is Fragile

`package.json:6-10` packages `third_party/kronoschamber-web` as an extra resource. `emain/chathubv2-server.ts:45-63` checks several possible roots and throws if `server/index.js` is missing.

Risk: this is easy to break in dev, packaged builds, and renamed product paths. It needs a doctor check and a visible failure state instead of a late throw.

### 6. LSP Is a Thin Prototype, Not a Production Code Intelligence Layer Yet

`emain/emain-lsp.ts:26-33` hard-codes four language servers and does not resolve GUI-safe PATHs like Chathub does. `startLanguageServer` spawns directly from `process.env`. The LSP parser uses `buffer.length` on JS strings for `Content-Length`; LSP lengths are byte lengths, so non-ASCII payloads can desync.

Impact: code intelligence will fail silently or inconsistently for many users, especially from GUI launches.

### 7. Widget Protocol Has Synthetic Coverage Gaps

`frontend/app/store/tabrpcclient.ts:647-757` returns synthetic elements for terminal/web/sandbox. Terminal dimensions are hard-coded to 800x600, web gets a single `webview` element, and sandbox attempts `http://localhost:9990/computer-use`.

Impact: KronosCode can claim it has widget context but still lack actionable, precise element state. This is the difference between "agent demo" and "agent can reliably operate my workspace."

### 8. KronosCanvas Persistence Is Promising but Needs User-Visible Recovery

Canvas persistence exists: `pkg/wshrpc/wshserver/canvas.go:28-45` loads/saves `.canvas.json`, assets are uploaded in `CanvasAssetUploadCommand`, and the frontend autosaves in `frontend/app/view/kronoscanvas/kronoscanvas.tsx:431-460`.

But load/save failures currently mainly go to `console.error` at `kronoscanvas.tsx:442` and `kronoscanvas.tsx:489`. A user may lose trust without a recovery UI, version history, or conflict strategy.

Impact: canvas can become the product's killer surface, but only if it feels durable.

### 9. Bundle Weight Is Very High

Logs from the KronosChamber build show heavy chunks:

- `vendor-shiki`: about 9.58 MB raw
- `mermaid`: about 3.0 MB raw
- `vendor-mermaid`: about 1.8 MB raw
- `vendor-codemirror`: about 1.58 MB raw
- `vendor-heic2any`: about 1.35 MB raw

`dist` is 48 MB. This may be acceptable for desktop, but it affects startup, update size, and embedded Chathub load time.

### 10. Generated and Source Files Are Dirty Together

Tracked diffs include generated `frontend/types/gotypes.d.ts` plus Go RPC source and canvas implementation. That can be correct, but it increases risk unless `task generate` is part of the verification story.

Also, untracked `session-7.md` through `session-9.md`, Chathub, LSP, and third-party assets exist. The current branch is not in a reviewable state.

---

## Massive Opportunities

### 1. Workspace Flight Recorder

**What**: Record a structured timeline of every meaningful workspace event: terminal commands, outputs, widget snapshots, browser navigations, file diffs, AI tool calls, approvals, errors, process health, screenshots, and model decisions. Make it searchable, replayable, and shareable.

**Why 10x**: This turns KronTerm from "an AI terminal" into the memory layer for software work. Users can ask "what happened?", rewind a failed agent run, reproduce a bug, generate a PR summary, or hand off a task without writing notes.

**Evidence**: Logs already capture fragments of service events, SSE lifecycles, terminal sessions, and errors. The README already claims shared context and Screenpipe-style memory. The missing piece is a first-class replay model.

**Unlocks**: agent accountability, team handoff, bug reports with proof, test replay, onboarding, and "continue from yesterday" workflows.

**Effort**: Very High

**Risk**: Privacy and storage bloat. Needs redaction, retention controls, and opt-in capture levels.

**Score**: Must do

### 2. KronosCanvas as an Agent Workflow OS

**What**: Promote KronosCanvas from a visual surface into the canonical agent workflow builder. Nodes can be terminals, browsers, files, prompts, agents, sandboxes, APIs, MCP tools, test gates, and human approval checkpoints. Edges carry typed context and execution rules.

**Why 10x**: Users do not just chat with KronosCode; they compose repeatable workflows visually. "Investigate bug -> open browser -> run test -> patch -> verify -> draft PR" becomes a reusable canvas, not a one-off chat.

**Evidence**: Canvas RPC already exists (`CanvasLoad`, `CanvasSave`, `CanvasCreateNode`, `CanvasConnectNodes`, `CanvasLaunchNode`), and the frontend already autosaves tldraw state and semantic nodes.

**Unlocks**: agent recipes, team templates, marketplace workflows, visual debugging, repeatable QA flows.

**Effort**: High

**Risk**: Could become a novelty if execution semantics are weak. It needs typed IO, run history, and partial reruns.

**Score**: Must do

### 3. Universal Surface SDK and Inspector

**What**: Turn the widget protocol into a developer-facing SDK and inspector. Every block exposes a standardized state tree, actions, screenshots, element refs, health, and permission model. Include a live "what the agent sees" inspector.

**Why 10x**: KronosCode becomes a platform. Third-party blocks and internal surfaces become agent-operable by default. Users trust the agent because they can inspect the exact surface model.

**Evidence**: BrowserOS capabilities list widget interaction tools. Current `tabrpcclient.ts` handlers are a strong start, but terminal/web/sandbox coverage is still synthetic.

**Unlocks**: plugin ecosystem, reliable desktop/browser automation, fewer brittle coordinate clicks, better debugging.

**Effort**: High

**Risk**: Requires rigorous contracts and conformance tests, not just API shape.

**Score**: Must do

---

## Medium Opportunities

### 4. Self-Healing Runtime Doctor

**What**: A built-in doctor that continuously checks Node/Bun/Go/toolchain PATH, KronosCode binary, Chathub/KronosChamber resources, ports, health endpoints, LSP servers, sandbox broker, ComfyUI, updater, permissions, and config schema. It should explain failures and offer one-click fixes.

**Why 10x**: The current product has many companion services. Users should never debug port conflicts, missing binaries, or broken PATH by reading logs.

**Impact**: Converts "KronosCode is broken" into "Pyright missing - install now" or "KronosChamber resource missing - rebuild package."

**Evidence**: Logs show startup fallback, missing model connectivity, forced shutdown, ComfyUI 500s, and missing module failures.

**Effort**: Medium

**Score**: Must do

### 5. Agent Control Plane

**What**: A live run dashboard for KronosCode: current plan, tool calls, pending approvals, surface being controlled, token/cost/time, retry state, confidence, verification gates, and final evidence.

**Why 10x**: Users need to supervise autonomous work without reading raw logs or chat transcripts.

**Impact**: Makes agents feel controllable and professional. It also creates a debugging spine for internal development.

**Evidence**: README describes Router -> Planner -> Executor -> Critic -> Summarizer, but the repo/logs show service health and execution state are scattered.

**Effort**: Medium

**Score**: Must do

### 6. Code Intelligence and Safe Editing Lane

**What**: Make LSP, tests, diffs, rollback, and generated-file validation a single editing lane. Before applying code changes, KronosCode should know symbols, run targeted tests, typecheck affected packages, detect generated files, and present a risk summary.

**Why 10x**: The app becomes an IDE-quality coding agent without pretending chat is enough.

**Impact**: Faster edits, fewer broken branches, better trust.

**Evidence**: Typecheck is broken, LSP is prototype-level, generated files are dirty, and code editing/diff UX is already a product promise.

**Effort**: Medium

**Score**: Must do

### 7. Test Gate Profiles

**What**: Replace the single broad `vitest` command with explicit gates: `core`, `frontend`, `electron`, `kronoscode`, `third-party`, `integration`, and `release`. Each gate has clear env requirements and excludes symlinks/vendor by default.

**Why 10x**: It makes the repo shippable. Contributors and agents can validate the right thing fast.

**Impact**: Turns noisy failure into actionable failure. Enables KronosCode to run the right checks automatically.

**Evidence**: Default tests entered adjacent projects and private-env integration tests; focused core tests passed.

**Effort**: Medium

**Score**: Strong

---

## Small Gems

### 8. Workspace Health HUD

**What**: A small status strip showing Typecheck, Go tests, KronosCode, Chathub, LSP, sandbox, browser widget, and updater health.

**Why powerful**: Eliminates hidden anxiety. Users know immediately whether the command center is healthy.

**Effort**: Low

**Score**: Must do

### 9. Error-to-Action Buttons

**What**: Every log/runtime error gets a contextual action: open file, rerun health check, install missing dependency, restart service, open settings, copy bug bundle, or ask KronosCode to diagnose.

**Why powerful**: The product turns failures into workflows instead of dead ends.

**Effort**: Low

**Score**: Strong

### 10. "What Can The Agent See?" Button

**What**: One button on every block that opens the exact current widget snapshot: element refs, screenshot, metadata, available actions, and limitations.

**Why powerful**: It builds trust and helps users understand why an agent succeeded or failed.

**Effort**: Low

**Score**: Strong

---

## Recommended Priority

### Do Now

1. Fix `task check:ts` until it is green. This is the release blocker.
2. Fix KronosCode TUI module resolution for `@/storage`.
3. Split test gates so default tests target core KronTerm only.
4. Add runtime doctor checks for Chathub/KronosChamber resource path, port, health, KronosCode binary, and GUI PATH.
5. Add visible error states for KronosCanvas save/load failures.

### Do Next

1. Build the Agent Control Plane run dashboard.
2. Harden widget protocol contracts and add conformance tests for terminal, web, sandbox, canvas, and Chathub blocks.
3. Make LSP production-grade: PATH resolution, install guidance, byte-correct protocol parser, session lifecycle, and per-project config.
4. Add a generated-file verifier around RPC/type generation.

### Explore

1. Workspace Flight Recorder as the durable memory and replay layer.
2. KronosCanvas as the visual agent workflow OS.
3. Universal Surface SDK for third-party agent-operable blocks.

### Backlog

1. Bundle-size optimization for Shiki, Mermaid, CodeMirror, HEIC, and markdown stacks.
2. Update lifecycle hardening for updater failures and forced shutdown.
3. ComfyUI/Jaaz integration doctor and graceful degraded mode.

---

## Questions

### Answered

- **Q**: Does backend package testing currently pass? **A**: Yes, `go test ./pkg/...` passed.
- **Q**: Does focused KronTerm canvas/layout testing pass? **A**: Yes, 7 files and 39 tests passed.
- **Q**: Is the app type-clean? **A**: No, `task check:ts` fails with many concrete errors.
- **Q**: Are runtime logs clean? **A**: No, they show missing modules, readiness fallback, service shutdown timeouts, updater failure, and companion service connection errors.
- **Q**: Is the default frontend test command reliable? **A**: No, it sweeps unrelated/symlinked and env-dependent tests.

### Blockers

- **Q**: Which product surface is the intended first commercial wedge: KronTerm workspace, KronosCode coding agent, KronosCanvas workflows, or Chathub/KronosChamber? This affects sequencing.
- **Q**: Should KronosCode ship as a bundled internal runtime, an external user-managed binary, or both? Current logs show both modes.

## Next Steps

- [ ] Make `task check:ts` green before adding more product surface.
- [ ] Create explicit test profiles and update `vitest.config.ts` include/exclude rules.
- [ ] Add a runtime doctor endpoint and UI panel.
- [ ] Fix KronosCode TUI `@/storage` resolution.
- [ ] Add widget protocol conformance tests.
- [ ] Turn KronosCanvas into the first visible workflow OS prototype after reliability gates are green.
