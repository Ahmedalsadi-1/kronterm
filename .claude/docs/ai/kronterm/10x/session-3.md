# Deep Integration: KronosCode ↔ KronTerm
Session 3 | Date: 2026-05-28

## The Problem

**KronTerm** and **KronosCode** live in the same product but barely talk to each other.

Current integration:
```
User → KronTerm UI (React) → Go Backend → waveai/kronoscodebackend.go
    → HTTP POST /v1/session/chat → KronosCode (Bun on :4096)
    → SSE stream → plain text back to UI
```

This is a **chat pipe**. The UI sends text, gets text back. Every powerful capability of KronosCode is invisible to the user:

- ✅ Agent system (12+ specialized agents) — **hidden**
- ✅ Orchestration engine (goals, tasks, workflows, scheduling) — **hidden**
- ✅ 75+ tools across 9 tool packs — **hidden**
- ✅ MCP integration — **hidden**
- ✅ Skill system with discovery — **hidden**
- ✅ Permission system — **hidden**
- ✅ Workflow engine — **hidden**
- ✅ ACP (Agent Client Protocol) implementation — **hidden**
- ✅ Config API, provider management, project management — **hidden**

Meanwhile, the UI (settings, AI panel, layout) is **file-config-driven** — users edit raw JSON/YAML in a Monaco editor embedded in the settings panel. The AI panel is a chat box with a model selector. That's it.

---

## The Architecture: ACP Bridge

KronosCode already implements **ACP (Agent Client Protocol)** — an open standard for agent-client communication (`/kronoscode/src/acp/`). ACP supports:

- **Agent lifecycle**: initialize, capability negotiation, session create/load/close
- **Structured prompting**: text, resources, images
- **Tool calls**: structured tool definitions, call IDs, result reporting
- **Client capabilities**: file ops, permission requests, terminal
- **Streaming**: session/update notifications for progress

The current chat integration bypasses all of this.

### The Old Way (chat proxy)

```
KronTerm UI              Go Backend               KronosCode
    |                       |                          |
    |--- HTTP text -------->|                          |
    |                       |--- HTTP /chat ---------->|
    |                       |                          |--- agent processes
    |                       |                          |--- tool executes
    |                       |<-- SSE text stream ------|
    |<-- text stream ------|
    |                       |                          |
    [tool calls rendered as formatted text]             |
```

### The New Way (ACP bridge)

```
KronTerm UI              Go Backend               KronosCode (ACP stdio)
    |                       |                          |
    |--- structured RPC -->|                          |
    |                       |--- ACP JSON-RPC -------->|
    |                       |   session/new            |
    |                       |   session/prompt         |
    |                       |   tool_call (structured) |
    |                       |                          |
    |<-- structured RPC ---|<-- tool_call results ----|
    |   native tool UI     |   permission requests    |
    |   permission dialogs |   file ops               |
    |   agent status       |   agent status updates   |
```

**How it works:**

1. KronTerm's Go backend spawns KronosCode as a child process with `kronoscode acp`
2. Communication goes over stdio via JSON-RPC (the ACP stdio transport)
3. ACP gives structured, typed messages instead of raw text
4. The Go backend translates between ACP and KronTerm's wshrpc system
5. The React UI renders native components for tool calls, permissions, agent status

### Why stdio ACP instead of HTTP?

| Approach | Pros | Cons |
|----------|------|------|
| HTTP (current) | Simple to implement | No session management, no structured messages, polling for status |
| WebSocket | Bidirectional streaming | Requires separate port, auth, reconnection logic |
| **ACP over stdio** | **Standard protocol, supports structured messages, bidirectional, process management built-in, security (stdio is local)** | Must manage subprocess lifecycle |
| Embedded (Bun as library) | Tightest coupling, lowest latency | KronosCode is a standalone product too — embedding complicates that |

**Verdict: ACP over stdio** as the primary bridge, with a fallback to HTTP for users who run KronosCode separately.

---

## Phase 1: Native Tool Rendering (Quick Win)

Replace the current text-formatted tool calls with native UI components.

### Current state (`kronoscodebackend.go` line 244-259):
```go
// Tool calls are formatted as text
if streamResp.Content.ToolCall != nil {
    pk.Text = fmt.Sprintf("\n[Tool Call: %s]\n", streamResp.Content.ToolCall.Name)
}
```

### Target: Native tool rendering in the chat

When the AI calls a tool, the UI renders it as an interactive component:

| Tool | Current (text) | Target (native UI) |
|------|---------------|-------------------|
| `file/edit` | `[Tool Call: edit]` | Inline diff preview with accept/reject |
| `bash` | `[Tool Call: bash]` | Terminal output with approval button |
| `websearch` | `[Tool Call: websearch]` | Rendered search results with links |
| `grep` | Plain text results | Highlighted code matches with file links |
| `read` | File contents as text | Syntax-highlighted code viewer |

**Implementation approach — via ACP:**
- ACP sends structured `tool_call` messages with tool name, arguments, call ID
- ACP sends `tool_result` messages with structured results
- The Go backend routes these through wshrpc as structured events
- The React UI renders each tool type with a dedicated component

**Files to change:**
- `pkg/waveai/kronoscodebackend.go` — replace text formatting with structured packets
- `frontend/app/aipanel/aitooluse.tsx` — add tool type-specific renderers
- `frontend/app/aipanel/aitypes.ts` — add structured tool call/result types
- `frontend/app/block/block.tsx` — register tool-specific view components

**Effort**: Medium (2-3 weeks)
**Impact**: Transforms chat from "text stream" to "interactive workspace"

---

## Phase 2: Agent Dashboard (High Impact)

Replace the chat-only AI panel with an **agent mission control**.

### Current AI Panel (`aipanel.tsx`):
```
┌─────────────────────────────────────┐
│ [Model Selector] [Settings] [X]    │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Chat messages (text only)   │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Input box                   │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Target: Agent Dashboard:
```
┌─────────────────────────────────────────────┐
│ [⚡ Agent Dashboard] [💬 Chat] [⚙ Settings] │
├─────────────────────────────────────────────┤
│ ┌─ Active Agents ───────────────────────┐   │
│ │ ○ build    ● running  "fixing tests"  │   │
│ │ ○ explore  ○ idle                     │   │
│ │ ○ plan     ● waiting  permission req  │   │
│ │ [+ New Agent]                         │   │
│ └────────────────────────────────────────┘   │
│ ┌─ Recent Sessions ─────────────────────┐   │
│ │ 📁 database-migration (5m ago)        │   │
│ │ 📁 api-refactor (2h ago)              │   │
│ │ 📁 server-debug (yesterday)           │   │
│ │ [View All]                            │   │
│ └────────────────────────────────────────┘   │
│ ┌─ Scheduled Workflows ────────────────┐   │
│ │ 🔄 Health check every 30m           │   │
│ │ 🔄 Log rotation daily at 2am        │   │
│ │ [+ Schedule]                         │   │
│ └────────────────────────────────────────┘   │
│ ┌─ Quick Actions ─────────────────────┐   │
│ │ [Explain Output] [Fix Error] [SSH]  │   │
│ └────────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**How it works:**
- KronosCode's orchestration engine already tracks `AgentStatus` (IDLE, ACTIVE, RUNNING, WAITING, PAUSED, STOPPED, ERROR)
- The server already has `/agent/`, `/session/`, `/workflow/` HTTP routes
- The ACP protocol supports capability negotiation and session management
- The UI just needs to consume these APIs and render them

**Files to change:**
- `frontend/app/aipanel/aipanel.tsx` — add tab navigation (Dashboard / Chat / Settings)
- `frontend/app/aipanel/agents-panel.tsx` — new agent dashboard component
- `frontend/app/aipanel/providers-panel.tsx` — already exists, enhance
- `pkg/waveai/kronoscodebackend.go` — add agent status subscription via WebSocket or polling
- `kronoscode/src/server/routes/` — the API routes already exist for most of this

**Effort**: Medium-High (4-6 weeks)
**Impact**: Makes the AI feel like a platform, not a chat bot

---

## Phase 3: Settings Revolution (High Impact)

The current settings system is a **file editor** — users edit config files as JSON/YAML in a Monaco editor. This is developer-friendly but user-hostile.

### Current settings (`waveconfig.tsx`):
```
┌──────────────────────────────────────┐
│ Config Files  │  settings.yaml       │
│ ─────────────  ├─────────────────────┤
│ settings.yaml  │                     │
│ keybindings    │  # Raw YAML file    │
│ themes/        │  ai:                │
│ waveai.yaml    │    provider: openai │
│                │    model: gpt-4     │
│                │                     │
│                │  # Monaco editor    │
│                │  with syntax        │
│                │  highlighting       │
└──────────────────────────────────────┘
```

### Target: Structured Settings UI

Instead of editing raw config files, KronTerm should have **dedicated visual settings panels** for each domain:

```
Settings (tabbed interface)
├── General        (theme, font, zoom, tab bar position, reduced motion)
├── AI Providers   (visual provider config: endpoint, API key, model selection)
├── Agents         (enable/disable, configure permissions, temperature, model)
├── MCP Servers    (add/remove, status indicator, auto-discovery)
├── Skills         (browse catalog, enable/disable, configure)
├── Permissions    (granular tool-level permissions per agent)
├── Keybindings    (visual keybinding editor with search)
├── Workspaces     (layout templates, auto-open on SSH)
├── Orchestration  (scheduled tasks, workflow playbooks)
└── Secrets        (credential storage, API keys)
```

**Key insight**: KronosCode's server already has API routes for all of these:

| Route | File | Exists? |
|-------|------|---------|
| `GET/POST /config` | `routes/config.ts` | ✅ |
| `GET /provider` | `routes/provider.ts` | ✅ |
| `GET /mcp` + `POST /mcp` | `routes/mcp.ts` | ✅ |
| `GET /agent` | (via `Config.get().agent`) | ✅ |
| `GET /workflow/playbook` | `routes/workflow.ts` | ✅ |
| `GET /permission` | `routes/permission.ts` | ✅ |
| `GET /marketplace/skills` | `routes/marketplace.ts` | ✅ |

The backend **already exposes structured data** for all these domains. The UI just doesn't consume it.

**Files to create/change:**
- `frontend/app/view/waveconfig/waveconfig.tsx` — add tab navigation for settings categories
- `frontend/app/view/waveconfig/settings-providers.tsx` — visual AI provider config
- `frontend/app/view/waveconfig/settings-agents.tsx` — agent management UI
- `frontend/app/view/waveconfig/settings-mcp.tsx` — MCP server manager
- `frontend/app/view/waveconfig/settings-permissions.tsx` — permission editor
- `frontend/app/view/waveconfig/settings-skills.tsx` — skill browser
- `frontend/app/view/waveconfig/settings-orchestration.tsx` — workflow/schedule UI
- `frontend/app/view/waveconfig/settings-keybindings.tsx` — visual keybinding editor

**Effort**: High (8-12 weeks for all panels)
**Impact**: Transforms KronTerm from "developer tool with config files" to "polished product"

---

## Phase 4: Real-Time Agent Stream (Strategic)

Push agent activity directly into the UI in real-time.

### Current:
```
User asks question → 30s wait → AI responds
```

### Target:
```
User asks question →
  ⚡ build agent spawned
  ⚡ reading project files...
  ⚡ running grep: "database schema"...
  ⚡ found 12 matches in 3 files
  ⚡ editing src/db/migrate.ts...
  ⚡ running npm test...
  ⚡ 2 tests fail, fixing...
  ⚡ tests pass ✓
  → "Here's what I changed: ..."
```

**How:**
- ACP supports `session/update` notifications for streaming partial results
- KronosCode's tool system has `ctx.metadata()` for progress reporting
- The Go backend can forward these as wshrpc events
- The UI renders them as a live activity stream

**Effort**: Medium (3-4 weeks)
**Impact**: Makes the AI feel alive and transparent. Builds trust.

---

## Phase 5: Skill & Workflow UI (Ecosystem Play)

Make skills and workflows a first-class UI concept.

### Skills Browser:
```
┌─ Skills ────────────────────────────┐
│ 🔍 Search skills...                  │
│                                      │
│ ⚡ Deploy to Kubernetes              │
│   Automate kubectl deployments       │ [Enable]
│                                      │
│ 🐛 Debug Memory Leaks                │
│   Heap dump analysis & fix           │ [Enable]
│                                      │
│ 🔒 SSH Safety Check                  │
│   Pre-flight checks before prod SSH  │ [Enable]
│                                      │
│ 📦 Community (24 skills available)   │
│ ─────────────────────────────────     │
│ 🎨 Custom Skills                     │
│   [+ Create New from Template]      │
└──────────────────────────────────────┘
```

### Workflow Builder:
```
┌─ Workflow: "Daily Health Check" ────┐
│                                      │
│ ┌─ Step 1 ─────────────────────┐    │
│ │ 🟢 SSH into production      │    │
│ │    host: prod-01.example    │    │
│ └──────────────────────────────┘    │
│              ↓                      │
│ ┌─ Step 2 ─────────────────────┐    │
│ │ 🟢 Run health check script   │    │
│ └──────────────────────────────┘    │
│              ↓                      │
│ ┌─ Step 3 ─────────────────────┐    │
│ │ 🟢 AI analyze output         │    │
│ │    if errors > threshold:    │    │
│ │      → alert on Discord     │    │
│ └──────────────────────────────┘    │
│                                      │
│ [Run Now] [Schedule...] [Save]       │
└──────────────────────────────────────┘
```

**Effort**: High (8-12 weeks)
**Impact**: Platform play — users create value for each other through skills/workflows

---

## Implementation Roadmap Summary

| Phase | What | Effort | Impact | Dependency |
|-------|------|--------|--------|------------|
| **0** | ACP Bridge: replace HTTP chat proxy with ACP stdio | 2-3 weeks | Foundation | None |
| **1** | Native Tool Rendering in AI chat | 2-3 weeks | High | Phase 0 |
| **2** | Agent Dashboard (tabbed AI panel) | 4-6 weeks | High | Phase 0 |
| **3a** | Settings: AI Providers panel | 2 weeks | Medium | None |
| **3b** | Settings: MCP Servers panel | 1 week | Medium | None |
| **3c** | Settings: Agents panel | 2 weeks | Medium | Phase 0 |
| **3d** | Settings: Permissions panel | 2 weeks | Medium | Phase 0 |
| **3e** | Settings: Keybindings editor | 2 weeks | High | None |
| **3f** | Settings: Skills browser | 3 weeks | Medium | Phase 0 |
| **4** | Real-Time Agent Activity Stream | 3-4 weeks | High | Phase 0 |
| **5a** | Workflow Builder UI | 6-8 weeks | High | Phase 0 + 3 |
| **5b** | Skill Marketplace UI | 4-6 weeks | Medium | Phase 3f |

### Quick Wins (can start immediately, no dependencies):
- **Settings: AI Providers** — visual provider config UI using existing API routes
- **Settings: MCP Servers** — add/remove/status UI using existing `/mcp` routes
- **Settings: Keybindings** — visual keybinding editor (config files only, no backend API needed)
- **AI Command Palette** — ⌘-K that integrates with existing launcher

### Foundation Work (prerequisite for everything else):
- **ACP Bridge** — the single most important architectural change. Replace the HTTP chat proxy with ACP over stdio. Everything else builds on this.

---

## Key Technical Decisions

### 1. ACP Client → Go Backend (not React directly)
ACP runs over stdio. The Go backend is the right place to manage this subprocess:
- Process lifecycle management (spawn, restart, health check)
- Translate ACP JSON-RPC ↔ wshrpc (KronTerm's internal RPC)
- Buffer/queue messages when UI is not ready
- Fallback to HTTP for remote KronosCode instances

### 2. Phase 0 ACP Bridge — Minimum Viable
Don't implement full ACP spec initially. Start with:
```
ACP initialize     → capability negotiation
ACP session/new    → create conversation
ACP session/prompt → send message + get structured tool calls
ACP tool_result    → return tool execution results
```

Skip initially: session/load, session/close, streaming notifications

### 3. Backward Compatibility
The existing HTTP `/v1/session/chat` endpoint should remain functional. Users who run KronosCode as a standalone server should still work. The ACP bridge is opt-in for the deep integration.

### 4. UI Component Architecture
Create a `ToolRenderer` registry pattern (similar to `BlockRegistry`):
```typescript
const ToolRendererRegistry = new Map<string, ToolRenderer>();
ToolRendererRegistry.set("edit", EditToolRenderer);
ToolRendererRegistry.set("bash", BashToolRenderer);
ToolRendererRegistry.set("websearch", WebSearchToolRenderer);
// etc.
```

Each renderer gets the structured tool call data and renders the appropriate UI.

---

## Questions

### Answered
- **Q**: Does KronosCode already have structured APIs for these features? **A**: Yes — the HTTP server has routes for config, mcp, provider, workflow, permission, marketplace, and session. They're just not consumed by the UI.
- **Q**: Does ACP support what we need? **A**: Yes — ACP v1 supports initialization, session management, structured prompting, tool calls with IDs, permission requests, and client capabilities.
- **Q**: Can we run KronosCode as a subprocess? **A**: Yes — it already supports `kronoscode acp` for stdio mode, and `kronoscode serve` for HTTP mode.

### Blockers
- **Q**: How is KronosCode distributed? Is it bundled with KronTerm or installed separately? (Impacts whether ACP over stdio or HTTP is the primary path)
- **Q**: What's the process for spawning KronosCode from the Go backend? (Need to understand the binary location and startup sequence)
- **Q**: Are there any plans to make KronosCode embeddable as a library (Bun) instead of a subprocess?

## Next Steps
- [ ] Decision: ACP stdio vs HTTP WebSocket as the primary bridge
- [ ] Prototype: Build the ACP client in the Go backend
- [ ] Prototype: Render one native tool (e.g., file edit diff preview)
- [ ] Design: AI Provider settings panel mockup
- [ ] Design: Agent dashboard mockup
- [ ] Audit: Map all existing KronosCode API routes to their frontend consumer status
