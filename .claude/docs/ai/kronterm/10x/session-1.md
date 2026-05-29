# 10x Analysis: Kronterm / Saturn

Session 1 | Date: 2026-06-21

## Current Value

Kronterm is a fork of Wave Terminal (v0.14.3) that has been extended into an **AI agent control platform**. It is no longer just "a terminal with AI chat." It is a workspace where an AI agent can see, think, and act across terminals, browsers, files, and even a full desktop VM.

**What exists today:**

- **Saturn AI panel** — Chat-based AI with multiple backends (Wave cloud, Kronos local engine, OpenAI, Anthropic, Google, Perplexity)
- **Kronos backend** — Routes AI through a local KronosCode server with hybrid tool routing (Wave tools bridge + Kronos native tools), streaming, and permission management
- **Human simulation tools** — 25+ widget interaction primitives: `widget_snapshot`, `widget_click`, `widget_hover`, `keyboard_type`, `keyboard_press`, `mouse_click`, `mouse_scroll`, `mouse_drag`, `widget_find`, `widget_inspect`, `widget_set_value`, `widget_select`, `widget_toggle`, `widget_wait_condition`, `screenshot_annotated`, clipboard get/set, and more
- **Sandbox VM** — QEMU-based Ubuntu desktop with VNC, SSH, screenshot capture, and xdotool-based mouse/keyboard control
- **Terminal tools** — Scrollback reading, command execution, command waiting
- **File tools** — Read, write, edit, delete with diff previews and rollback
- **GUI app creation** — `gui_create_app` tool for creating Tsunami VDOM apps from AI chat
- **Codebase search** — Grep and file structure tools for project understanding
- **MCP client infrastructure** — Stub implementation with server management (local stdio + remote HTTP), not yet functional
- **Block/view system** — Composable workspace with term, web, preview, waveai, sandbox, tsunami, waveconfig, sysinfo, help, tips, launcher blocks

**Who uses it:** Developers who want AI to do more than chat — they want it to operate their computer, run commands, browse websites, and interact with GUIs.

**Core action:** Tell Saturn what to do → Saturn uses tools to observe and act → user approves/rejects → loop.

**Where users spend time:** Terminal blocks, Saturn AI chat, sandbox desktop (VNC).

**What's incomplete:**
- Many widget tool handlers on the frontend return stub/empty data (`handle_widgetsnapshot`, `handle_widgetfind`, `handle_widgetinspect`, etc.)
- MCP client `Send()` methods return `"not implemented"` errors
- Sandbox requires manual QEMU image setup (`setup-sandbox.sh`)
- No end-to-end agent loop (tool results don't reliably feed back into AI decisions)
- No agent memory across sessions
- No user approval flow for dangerous tool operations (terminal commands, file writes)
- Human simulation in webviews sends IPC messages but no preload scripts handle them

## The Question

**What would make Kronterm 10x more valuable?**

Not "more features." The feature set is already extraordinary. The gap is **making the features actually work end-to-end** and then **making the loop so reliable it feels like magic.**

---

## Massive Opportunities

### 1. The Closed-Loop Agent

**What**: Make the observe → think → act → verify loop actually close. Today, many tool calls fire into the void (stub handlers, unimplemented MCP, webview IPC with no listener). The single highest-leverage move is making every tool return real, useful data so the AI can make its next decision.

**Why 10x**: The difference between "AI that can theoretically click things" and "AI that clicks things and sees what happened" is the difference between a demo and a product. When the loop closes, users stop babysitting the AI and start delegating to it.

**What needs to happen**:
1. Frontend widget handlers must return real DOM state (implement `handle_widgetsnapshot`, `handle_widgetfind`, `handle_widgetinspect`, `handle_widgetelementat` with actual accessibility tree extraction)
2. Webview preload scripts must listen for `human-sim-*` IPC messages and execute them via CDP or DOM APIs
3. Tool results must include enough context for the AI to decide its next step (screenshots after clicks, updated element lists after actions)
4. The `wait_for_element` / `widget_wait_condition` tools must actually poll and detect changes

**Unlocks**:
- Reliable web automation (fill forms, click buttons, navigate multi-step flows)
- Terminal-driven development workflows (run test → read output → fix code → re-run)
- Sandbox desktop automation that actually works (open apps, edit files in GUI)
- User trust — when the loop works, users delegate more

**Effort**: High (requires frontend DOM inspection, webview CDP integration, preload script work)
**Risk**: Browser security models resist programmatic DOM inspection; accessibility tree extraction is complex
**Score**: 🔥 **Must do** — this is the entire value proposition

---

### 2. Agent Memory & Learning

**What**: Persistent memory across conversations. The AI should remember project context, user preferences, past mistakes, and successful patterns.

**Why 10x**: Today, every chat starts from zero. Users re-explain their project, re-describe their stack, re-state their preferences every session. With memory, Saturn becomes a team member who knows your codebase, not a stranger you re-onboard each time.

**Implementation**:
```
pkg/aiusechat/agentmemory/
├── memory.go           # Memory store (SQLite-backed)
├── project.go          # Project-level context (stack, conventions, patterns)
├── session.go          # Cross-session recall (past commands, fixes, decisions)
├── preference.go       # User preferences (coding style, tool choices)
└── learning.go         # Pattern extraction from successful interactions
```

**Key features**:
- Auto-extract project context from codebase (package.json, go.mod, README, .cursorrules)
- Remember successful command sequences ("to deploy this project, run...")
- Recall past errors and their fixes ("last time this test failed, the issue was...")
- User preference learning ("prefer pnpm over npm", "always use --no-cache")
- Session continuity ("you were working on the auth module yesterday, want to continue?")

**Unlocks**:
- Zero-setup AI — Saturn already knows your project
- Predictive suggestions — Saturn anticipates what you need next
- Trust compounding — the more you use it, the better it gets

**Effort**: High
**Risk**: Privacy concerns, memory bloat, incorrect recall
**Score**: 🔥 **Must do** — compounding value is the moat

---

### 3. Autonomous Workflows

**What**: Define multi-step agent workflows that run with minimal human oversight. "Fix all failing tests", "Review this PR and suggest changes", "Set up the staging environment."

**Why 10x**: Today, Saturn is reactive — one message, one response. Users must drive every step. With workflows, Saturn becomes proactive. Users describe outcomes, not steps.

**Architecture**:
```
pkg/aiusechat/workflows/
├── workflow.go         # Workflow engine (step orchestration)
├── steps.go           # Step types (observe, act, verify, decide, loop)
├── approval.go        # Human-in-the-loop approval gates
├── checkpoint.go      # Save/resume workflow state
└── templates/
    ├── fix-tests.go    # "Fix all failing tests" workflow
    ├── pr-review.go    # "Review and fix PR issues" workflow
    └── deploy.go       # "Deploy to staging" workflow
```

**Key patterns**:
- **Observe-Act-Verify loop**: AI takes action → captures result → decides next step
- **Approval gates**: "I'm about to run `rm -rf`, approve?" — configurable per-operation-type
- **Checkpoint/resume**: Long workflows survive interruptions
- **Error recovery**: AI sees failure → tries alternative approach → escalates to human if stuck

**Unlocks**:
- "Fix all the lint errors" → Saturn loops through files, fixes each, re-runs linter
- "Deploy to staging" → Saturn runs tests, builds, deploys, verifies health check
- "Investigate this error" → Saturn reads logs, searches codebase, identifies root cause

**Effort**: Very High
**Risk**: Runaway agents, incorrect autonomous actions, trust issues
**Score**: 👍 **Strong** — the ultimate vision but requires the closed-loop foundation first

---

## Medium Opportunities

### 4. Real MCP Integration

**What**: Make the MCP client actually work. Today `Send()` returns "not implemented." Fix it so external tools (GitHub, Jira, databases, custom APIs) become available to the AI.

**Why 10x**: MCP is the standard for tool integration. With working MCP, Saturn instantly gains access to every tool in the ecosystem without building each one. This is a force multiplier.

**What exists**:
- `pkg/mcp/client.go` — Server management scaffold (add, connect, disconnect, list)
- `emain/sandbox/mcp-server.ts` — MCP server for sandbox (uses `@modelcontextprotocol/sdk`)
- Both transports (stdio, HTTP) have stub `Send()` methods

**What's needed**:
1. Implement JSON-RPC 2.0 message framing for stdio transport
2. Implement SSE/streamable HTTP transport for remote servers
3. Discover tools from connected servers via `tools/list`
4. Route MCP tool calls from AI through the existing tool bridge
5. Display MCP tool results in the chat UI alongside native tool results

**Impact**: Instant access to GitHub (create PRs, review code), Jira (manage tickets), databases (query data), custom internal APIs — all from Saturn chat.

**Effort**: Medium
**Score**: 🔥 **Must do** — high leverage, relatively contained effort

---

### 5. Sandbox as a Service

**What**: Make the sandbox one-click instead of multi-step setup. Pre-build VM images, auto-download on first use, and offer multiple sandbox profiles (Ubuntu Desktop, Alpine CLI, Windows).

**Why 10x**: The sandbox is a killer feature — AI controlling a full desktop VM — but it's currently unusable without manual image preparation. Making it instant transforms it from a developer curiosity into a reliable tool.

**What's needed**:
1. Host pre-built QEMU images (or build them on-demand via Tart/Packer)
2. Auto-download on first `sandbox_start` call
3. Cloud-init for instant SSH/VNC readiness
4. Multiple profiles: `ubuntu-desktop`, `alpine-minimal`, `dev-container`
5. Snapshot/restore for resetting to clean state
6. File sharing between host and sandbox (bidirectional)

**Impact**: "Saturn, spin up a clean Ubuntu environment and install PostgreSQL" — and it actually works in 30 seconds.

**Effort**: Medium
**Score**: 👍 **Strong** — unlocks the sandbox's full potential

---

### 6. Visual Agent Replay

**What**: Record and replay AI agent actions with a timeline scrubber. Show every tool call, screenshot, and decision the AI made so users can understand and audit what happened.

**Why 10x**: The biggest barrier to trusting AI agents is opacity. "What did it do while I wasn't watching?" Visual replay makes the AI's actions inspectable, building trust and enabling debugging of failed automations.

**Features**:
- Timeline view of all tool calls with timestamps
- Screenshot thumbnails at each step
- Click/highlight annotations on screenshots showing where AI acted
- Replay playback (step forward/backward through actions)
- Export as GIF/video for sharing
- Diff view for file modifications at each step

**Effort**: Medium
**Score**: 👍 **Strong** — trust builder, especially for autonomous workflows

---

### 7. Smart Context Auto-Selection

**What**: Automatically determine what context the AI needs based on the request, instead of relying on the user to configure widget access or manually attach files.

**Why 10x**: Today, Saturn's context depends on the `waveai:widgetcontext` toggle and manual file attachments. The AI should automatically pull in relevant terminal output, open files, and widget state based on what the user is asking about.

**Examples**:
- User asks "why is this failing?" → Auto-attach terminal scrollback from the focused block
- User asks "fix this component" → Auto-read the file shown in the preview block
- User asks "what's on this page?" → Auto-screenshot the webview block
- User asks about a specific file → Auto-search codebase for it

**Implementation**: Intent classification on the user message → context retrieval plan → automatic tool calls before the main response.

**Effort**: Medium
**Score**: 🔥 **Must do** — reduces friction dramatically

---

## Small Gems

### 8. Command Approval Shortcuts

**What**: One-key approval/rejection for AI tool calls. Instead of clicking a button, press `y` to approve, `n` to reject, `a` to approve-all-for-this-session.

**Why powerful**: The approval flow is the biggest friction point in agent workflows. Making it instant removes the "babysitter" feeling.

**Effort**: Low
**Score**: 🔥 **Must do**

---

### 9. Tool Call Progress Indicators

**What**: Real-time status indicators for tool calls. Show "Reading scrollback...", "Clicking button at (320, 150)...", "Waiting for page load..." with spinning animations.

**Why powerful**: Users currently see tool calls appear and disappear with no sense of progress. Status indicators eliminate anxiety about whether the AI is stuck.

**Effort**: Low
**Score**: 🔥 **Must do**

---

### 10. Workspace State Snapshots

**What**: One command to save/restore the entire workspace state (tab layout, block positions, open files, terminal sessions, Saturn chat history). `wsh workspace save "morning-setup"` / `wsh workspace load "morning-setup"`.

**Why powerful**: Developers spend 5-10 minutes every morning re-creating their workspace. This saves that time daily.

**Effort**: Low (most state is already in Jotai atoms/WOS)
**Score**: 👍 **Strong**

---

### 11. Saturn as Default Input

**What**: Make the Saturn input box the primary command interface. Type `>run tests` to execute in terminal, `>open file.ts` to open preview, `>search auth` to search codebase. Unify all commands through Saturn.

**Why powerful**: Currently users must know which block to focus, which tool to use, which shortcut. Saturn-as-input eliminates the "which tool do I use?" decision.

**Effort**: Low
**Score**: 👍 **Strong**

---

### 12. Error → Saturn Auto-Prompt

**What**: When a terminal command fails (non-zero exit code), automatically prompt Saturn with the error context. Show a subtle "Ask Saturn about this error" toast.

**Why powerful**: The most common AI-terminal interaction pattern is "I got an error, help me fix it." This makes it zero-friction.

**Effort**: Low
**Score**: 🔥 **Must do**

---

## Recommended Priority

### Do Now (Quick wins that unlock the core loop)

1. **Error → Saturn Auto-Prompt** — Why: Zero-friction AI usage, Impact: Every error becomes a learning moment
2. **Command Approval Shortcuts** — Why: Removes babysitter friction, Impact: Users approve 10x faster
3. **Tool Call Progress Indicators** — Why: Eliminates "is it stuck?" anxiety, Impact: Trust in agent actions

### Do Next (Close the agent loop — the single most important work)

1. **The Closed-Loop Agent** — Why: Makes all 25+ tools actually useful, Unlocks: Reliable automation, web interaction, terminal-driven dev
2. **Smart Context Auto-Selection** — Why: Removes "configure context" friction, Unlocks: Zero-setup AI assistance
3. **Real MCP Integration** — Why: Force multiplier on tool access, Unlocks: GitHub, Jira, databases, custom APIs
4. **Sandbox as a Service** — Why: Makes the killer feature actually usable, Unlocks: One-click isolated desktops

### Explore (Strategic bets)

1. **Agent Memory & Learning** — Why: Compounding value — the moat, Risk: Privacy, incorrect recall, Upside: Saturn becomes irreplaceable
2. **Autonomous Workflows** — Why: The ultimate vision, Risk: Runaway agents, trust, Upside: "Fix all tests" actually works
3. **Visual Agent Replay** — Why: Trust through transparency, Risk: UI complexity, Upside: Audit, debug, share agent sessions

### Backlog (Good but not now)

1. **Workspace State Snapshots** — Why later: Nice-to-have, not loop-closing
2. **Saturn as Default Input** — Why later: Requires the loop to work first

---

## The Core Insight

**Kronterm is not a terminal with AI. It is an AI agent that lives in a terminal.**

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
- **Q**: Can the webview support DOM inspection? **A**: Yes, via Electron's `webview.executeJavaScript()` or CDP. Needs preload script work.
- **Q**: Is there an approval mechanism for tool calls? **A**: Partial — Kronos backend has `permission.asked` events, but Wave-native tools have no approval gate.
- **Q**: Can MCP tools be integrated with the existing tool bridge? **A**: Yes, the `buildWaveToolManifest` + tool bridge pattern can be extended to include MCP-discovered tools.

### Blockers
- **Q**: Should webview DOM inspection use accessibility tree (slower, reliable) or DOM querySelector (faster, fragile)? (needs architecture decision)
- **Q**: What's the security model for autonomous workflows — blanket approval vs. per-action? (needs product decision)
- **Q**: Should agent memory be local-only or cloud-synced? (needs privacy/product decision)

## Next Steps
- [ ] Validate: Implement `handle_widgetsnapshot` with real DOM data for one view type (term or web)
- [ ] Validate: Add `human-sim-*` IPC handlers in webview preload script for one action (click)
- [ ] Research: Test `webview.executeJavaScript()` for DOM inspection feasibility
- [ ] Decide: Approval model for autonomous workflows
- [ ] Decide: Memory storage model (local vs. cloud)
