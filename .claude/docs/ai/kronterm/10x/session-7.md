# 10x Analysis: KronTerm

Session 7 | Date: 2026-06-10

## Current Value

KronTerm is an **AI-native desktop command center** that merges terminal, browser, files, sandboxes, and AI into a single programmable canvas. It targets developers, founders, and power users who currently juggle 5+ tools (terminal + browser tabs + IDE + AI chat + Docker/VM).

**What exists today (from codebase deep-dive):**

- **Block-based workspace** — Drag-and-drop tile layout with terminal, web, preview, editor, sandbox, AI, sysinfo, launcher blocks
- **KronosCode AI engine** — Structured agentic execution: Router → Planner → Executor → Critic → Summarizer. Specialist agents: Hephaestus (terminal/code), Sisyphus (sandbox), Prometheus (macOS desktop), Oracle (browser), Librarian (research)
- **Widget protocol** — Every block exposes a structured accessibility tree via `widget_*` tools. AI can snapshot, click (`@e3` refs), type, scroll, drag, inspect, screenshot any block
- **Browser blocks** — Embedded Chromium with full AI automation (no Playwright/Selenium). `widget_snapshot` returns element tree with refs
- **Sandbox VMs** — E2B-powered Linux desktops (Firefox, VS Code, terminal) that AI controls directly
- **Native macOS control** — `kron_*` tools for accessibility tree inspection, click by element ref, type, press keys, scroll, drag, set values
- **Durable SSH** — Sessions survive sleep, restarts, network drops
- **AI panel** — Side panel with streaming chat, file uploads, tool approval, split view, ACP agent support
- **Terminal model** — xterm.js with shell integration, scrollback capture, WebGL rendering, command status tracking, "Ask KronosCode" button on failures
- **Preview system** — Markdown, images, CSV, PDF, HTML, directory browsing, streaming previews
- **Monaco editor** — Code editing with diff viewer
- **Launcher** — Widget grid with search, keyboard navigation
- **Pet mascot** — Idle/walking animations

**Architecture stack:**

- Electron + TypeScript (desktop shell)
- Go backend (IPC, PTY, SSH, WebSocket bridge via `wsh`)
- React + Jotai (frontend state)
- Vercel AI SDK + Hono (AI engine)
- SQLite via Drizzle ORM (sessions, config)
- Tsunami VDOM (embedded rendering engine)

**Who uses it:** Developers who want AI to operate their actual workspace, not just chat about code.

**Core action:** Working in a terminal/browser/editor while AI operates alongside — seeing and controlling every block via the widget protocol.

**Where users spend most time:** Terminal blocks, AI panel interactions, browser blocks for docs/dashboards.

**What's already good:** The widget protocol is remarkably well-designed. The `@e3` ref system for element targeting is elegant. Shell integration with command status tracking is solid. The block system with drag-and-drop layout is functional. Multi-provider AI support is comprehensive.

**What's incomplete (from codebase):**

- Many widget tool handlers return stub/empty data
- MCP client `Send()` methods return "not implemented"
- Sandbox requires manual QEMU image setup
- No end-to-end agent loop (tool results don't reliably feed back)
- No agent memory across sessions
- No user approval flow for dangerous operations
- Human simulation in webviews sends IPC but no preload handlers

---

## The Question

**What would make KronTerm 10x more valuable?**

The feature set is already extraordinary. The 10x move is making the existing features **work end-to-end** and then **making the loop so reliable it feels like magic.**

---

## Massive Opportunities

### 1. The Closed-Loop Agent

**What**: Make the observe → think → act → verify loop actually close. Today, many tool calls fire into the void (stub handlers, unimplemented MCP, webview IPC with no listener). The single highest-leverage move is making every tool return real, useful data so the AI can make its next decision.

**Why 10x**: The difference between "AI that can theoretically click things" and "AI that clicks things and sees what happened" is the difference between a demo and a product. When the loop closes, users stop babysitting the AI and start delegating to it.

**What needs to happen:**

1. Frontend widget handlers must return real DOM state (implement `handle_widgetsnapshot`, `handle_widgetfind`, `handle_widgetinspect`, `handle_widgetelementat` with actual accessibility tree extraction)
2. Webview preload scripts must listen for `human-sim-*` IPC messages and execute them via CDP or DOM APIs
3. Tool results must include enough context for the AI to decide its next step (screenshots after clicks, updated element lists after actions)
4. The `wait_for_element` / `widget_wait_condition` tools must actually poll and detect changes

**Evidence**: In `term-model.ts:431-444`, the `sendToKronosCode` method already captures terminal scrollback and sends it to AI. This pattern needs to extend to every block type.

**Unlocks:**

- Reliable web automation (fill forms, click buttons, navigate multi-step flows)
- Terminal-driven development workflows (run test → read output → fix code → re-run)
- Sandbox desktop automation that actually works (open apps, edit files in GUI)
- User trust — when the loop works, users delegate more

**Effort**: High
**Risk**: Browser security models resist programmatic DOM inspection; accessibility tree extraction is complex
**Score**: 🔥

---

### 2. Agent Memory & Learning

**What**: Persistent memory across conversations. The AI should remember project context, user preferences, past mistakes, and successful patterns.

**Why 10x**: Today, every chat starts from zero. Users re-explain their project, re-describe their stack, re-state their preferences every session. With memory, KronosCode becomes a team member who knows your codebase, not a stranger you re-onboard each time.

**Implementation concept:**

- Auto-extract project context from codebase (package.json, go.mod, README, .cursorrules)
- Remember successful command sequences ("to deploy this project, run...")
- Recall past errors and their fixes ("last time this test failed, the issue was...")
- User preference learning ("prefer pnpm over npm", "always use --no-cache")
- Session continuity ("you were working on the auth module yesterday, want to continue?")

**Evidence**: The AI panel already stores chat history via `BlockService.SaveWaveAiData` and loads it via `fetchAiData`. The infrastructure for persistence exists; it just needs to be smarter about what it remembers and how it recalls.

**Unlocks:**

- Zero-setup AI — KronosCode already knows your project
- Predictive suggestions — KronosCode anticipates what you need next
- Trust compounding — the more you use it, the better it gets

**Effort**: High
**Risk**: Privacy concerns, memory bloat, incorrect recall
**Score**: 🔥

---

### 3. Workspace as Code (WAC)

**What**: Define entire workspaces in a declarative YAML/JSON file — blocks, positions, sizes, connections, AI context, even running commands. Share workspaces via git. Version control your environment. One command restores your exact setup.

**Why 10x**: Right now every developer re-creates their workspace from muscle memory. "Open terminal here, split that, connect to this server, open that browser tab." WAC eliminates that entirely. It's the difference between configuring a machine manually vs. using Nix/Homebrew.

**Evidence**: The workspace layout is already persisted via `WorkspaceLayoutModel` (panel widths, visibility, side panel mode). Block metadata is stored in WOS. The serialization infrastructure exists; it just needs to be exposed as a user-facing feature.

**Unlocks:**

- Team onboarding (clone workspace, instant productivity)
- CI/CD integration (spawn ephemeral workspaces for testing)
- Reproducible debugging
- "Workspace templates" for common workflows (web dev, data science, DevOps)

**Effort**: High
**Risk**: Over-engineering the declarative format; users may prefer visual layout
**Score**: 👍

---

## Medium Opportunities

### 4. Unified Search Across Everything (Cmd+K)

**What**: One search bar that searches across: terminal history, file contents, browser tabs, AI chat history, command history, SSH sessions. "Find that error I saw 3 hours ago in the staging terminal" — instant results.

**Why 10x**: Developers waste enormous time hunting for things across contexts. Unified search collapses that hunt into one action. The data is already there — terminal scrollback is captured, files are indexed, browser tabs are tracked.

**Evidence**: Terminal scrollback is already captured via `TermWrap.getScrollbackContent()`. File contents are accessible via `RpcApi.FileReadCommand`. Browser tabs are tracked via `list_pages`. The data sources exist; they just need a unified index.

**Impact**: Saves minutes per search, dozens of searches per day.
**Effort**: Medium
**Score**: 🔥

---

### 5. Smart Context Auto-Selection

**What**: Automatically determine what context the AI needs based on the request, instead of relying on the user to configure widget access or manually attach files.

**Why 10x**: Today, KronosCode's context depends on the `waveai:widgetcontext` toggle and manual file attachments. The AI should automatically pull in relevant terminal output, open files, and widget state based on what the user is asking about.

**Examples:**

- User asks "why is this failing?" → Auto-attach terminal scrollback from the focused block
- User asks "fix this component" → Auto-read the file shown in the preview block
- User asks "what's on this page?" → Auto-screenshot the webview block
- User asks about a specific file → Auto-search codebase for it

**Evidence**: The `widgetAccessAtom` in `waveai-model.tsx:115-122` already controls whether the AI can see widgets. The `WaveAIModel.sendMessage` method already handles file attachments. Intent-based context retrieval is the natural next step.

**Impact**: Removes "configure context" friction. Zero-setup AI assistance.
**Effort**: Medium
**Score**: 🔥

---

### 6. Command Orchestration (Multi-Block Pipelines)

**What**: Chain commands across blocks. "Run this in terminal A, when it completes, open the URL in browser block B, take a screenshot, and paste the result into the AI panel." Visual pipeline builder for common automation workflows.

**Why 10x**: Currently each block is independent. Orchestration turns them into a programmable system. This is the "glue" that makes KronTerm greater than the sum of its parts.

**Evidence**: `createBlockSplitHorizontally` and `createBlockSplitVertically` already enable programmatic block creation. The `RpcApi.ControllerInputCommand` enables sending input to terminals. The building blocks for orchestration exist.

**Impact**: Eliminates manual multi-step workflows, enables complex automations.
**Effort**: Medium-High
**Score**: 👍

---

### 7. Live Collaboration Indicators

**What**: Show real-time status of remote systems in the workspace. Green/red indicators on SSH connections. Live preview of running dev servers. Status badges on browser blocks showing "page loaded" / "error" / "404". WebSocket connection health.

**Why 10x**: Developers currently check system health by manually polling terminals and browsers. Passive indicators eliminate that anxiety loop. The workspace becomes a live dashboard without any extra setup.

**Evidence**: `connections-model.ts` already tracks connection status. `shellProcStatus` in `term-model.ts` tracks shell process state. `blockJobStatusAtom` tracks background job status. The status data is flowing; it just needs visual surfacing.

**Impact**: Reduces context-switching, eliminates "is it working?" anxiety.
**Effort**: Low-Medium
**Score**: 🔥

---

## Small Gems

### 8. Quick-Switch Recent Blocks (Cmd+Shift+E)

**What**: Fuzzy-finder of recently active blocks. Arrow keys to navigate, Enter to jump. Like VS Code's recent files but for blocks.

**Why powerful**: Developers switch between 3-5 blocks constantly. Current flow: mouse to tab bar, find tab, click. Quick-switch is 10x faster.

**Evidence**: The `FocusManager` already tracks focus state. The block registry knows all active blocks. This is a UI layer on existing data.

**Effort**: Low
**Score**: 🔥

---

### 9. Error Auto-Diagnosis (Proactive)

**What**: When a command fails (non-zero exit), KronosCode automatically analyzes the output and shows a one-line diagnosis in the terminal status bar. Click to expand full analysis.

**Why powerful**: The "Ask KronosCode" button on failed commands (in `term-model.ts:196-208`) is great but reactive. Auto-diagnosis is proactive — it meets the user where they are.

**Evidence**: The `shellProcFullStatus` atom already tracks exit codes. The `sendToKronosCode` method already captures scrollback. Making it automatic is a small change with large impact.

**Effort**: Low-Medium
**Score**: 🔥

---

### 10. Workspace Health Score

**What**: A single indicator in the status bar showing workspace health: connections OK, dev server running, tests passing, no errors. Click for full dashboard.

**Why powerful**: Developers have multiple systems running and lose track of health. One indicator eliminates the "check everything" ritual.

**Evidence**: Status data already flows through atoms: `connStatus`, `shellProcStatus`, `blockJobStatusAtom`. Just needs aggregation and visualization.

**Effort**: Low
**Score**: 🔥

---

### 11. Smart Paste from Browser

**What**: Copy a URL from any browser (external), paste into KronTerm — it auto-detects and offers to open in a browser block. Copy a code snippet — it offers to create a new file. Copy a terminal command — it offers to run it.

**Why powerful**: The clipboard is the most common integration point between tools. Smart paste turns KronTerm into the universal destination for anything you copy.

**Evidence**: The `getApi().nativePaste()` call in `term-model.ts` already handles paste. Extending it with content detection is straightforward.

**Effort**: Low
**Score**: 🔥

---

### 12. One-Click Environment Cloning

**What**: Right-click a terminal block → "Clone Environment" duplicates the exact session: same directory, same environment variables, same SSH connection.

**Why powerful**: Developers often need a "sandbox" version of their current context. Currently they manually open a new terminal, cd to the same directory, re-source the same env.

**Evidence**: Block metadata (`blockData.meta`) already stores `connection`, `cmd:cwd`, and other session state. Cloning is metadata duplication + controller restart.

**Effort**: Low
**Score**: 👍

---

## Recommended Priority

### Do Now (Quick wins — ship fast, validate fast)

1. **Error Auto-Diagnosis** — Why: The button exists; make it automatic. Impact: Every error becomes a learning moment with zero friction.
2. **Quick-Switch Recent Blocks** — Why: Keyboard-driven workflow is table stakes. Impact: 10x faster navigation, immediate adoption.
3. **Workspace Health Score** — Why: One indicator eliminates the "check everything" ritual. Impact: Reduces anxiety, surfaces problems proactively.
4. **Smart Paste from Browser** — Why: Clipboard is the lowest-friction integration point. Impact: Makes KronTerm the natural destination for copied content.
5. **Tool Call Progress Indicators** — Why: Eliminates "is it stuck?" anxiety. Impact: Trust in agent actions.

### Do Next (Close the agent loop — the single most important work)

1. **The Closed-Loop Agent** — Why: Makes all 25+ tools actually useful. Unlocks: Reliable automation, web interaction, terminal-driven dev workflows.
2. **Smart Context Auto-Selection** — Why: Removes "configure context" friction. Unlocks: Zero-setup AI assistance.
3. **Unified Search (Cmd+K)** — Why: The data is already captured; just needs an index. Impact: Saves dozens of minutes per day.
4. **Live Collaboration Indicators** — Why: Passive health monitoring eliminates anxiety loops. Unlocks: Real-time dashboard use cases.

### Explore (Strategic bets — potentially transformative)

1. **Agent Memory & Learning** — Why: Compounding value is the moat. Risk: Privacy, incorrect recall. Upside: KronosCode becomes irreplaceable.
2. **Workspace as Code** — Why: Defines the environment, not just the tool. Risk: Over-engineering. Upside: Reproducible environments, team collaboration.
3. **Command Orchestration** — Why: Chains blocks into programmable systems. Risk: Complexity. Upside: Complex automations without leaving KronTerm.

### Backlog (Good but not now)

1. **One-Click Environment Cloning** — Why later: Nice polish after core features land.
2. **Multiplayer Workspaces** — Why later: Requires relay server infrastructure, network complexity.
3. **Plugin/Extension Ecosystem** — Why later: Needs API stability and security model first.

---

## The Core Insight

**KronTerm is not a terminal with AI. It is an AI agent that lives in a terminal.**

The 10x move is not adding more tools (there are already 25+). It is making the existing tools **close the loop**: see → think → act → verify → repeat.

When the loop closes:

- Widget tools become web automation
- Terminal tools become dev workflows
- Sandbox tools become desktop automation
- File tools become code modification

Without the loop, each tool is a demo. With the loop, they compose into autonomy.

**Priority order**: Fix the loop → Add memory → Enable workflows → Expand tools via MCP.

---

## Questions

### Answered

- **Q**: What's the core differentiator? **A**: AI that operates the real workspace (not a chat transcript), via the widget protocol with `@e3` refs.
- **Q**: What's the moat? **A**: Vertical integration — blocks + widget protocol + AI engine + desktop control, all in one system. Competitors have pieces; KronTerm has the whole stack.
- **Q**: Can the webview support DOM inspection? **A**: Yes, via Electron's `webview.executeJavaScript()` or CDP. Needs preload script work.
- **Q**: Is there an approval mechanism for tool calls? **A**: Partial — Kronos backend has `permission.asked` events, but Wave-native tools have no approval gate.

### Blockers

- **Q**: What's the target user persona for the next 6 months? (Power developers? Teams? DevOps?) This affects which 10x moves matter most.
- **Q**: Should webview DOM inspection use accessibility tree (slower, reliable) or DOM querySelector (faster, fragile)?
- **Q**: What's the security model for autonomous workflows — blanket approval vs. per-action?
- **Q**: Should agent memory be local-only or cloud-synced?

## Next Steps

- [ ] Validate: Implement `handle_widgetsnapshot` with real DOM data for one view type (term or web)
- [ ] Validate: Add `human-sim-*` IPC handlers in webview preload script for one action (click)
- [ ] Research: Test `webview.executeJavaScript()` for DOM inspection feasibility
- [ ] Decide: Approval model for autonomous workflows
- [ ] Decide: Memory storage model (local vs. cloud)
- [ ] Prototype: Quick-switch recent blocks (1-2 day prototype)
- [ ] Prototype: Error auto-diagnosis (extend existing button to be automatic)
