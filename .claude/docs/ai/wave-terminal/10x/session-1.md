# 10x Analysis: Wave Terminal — App-to-Widget Control System

**Session 1 | Date: 2026-03-23**

---

## Current Value

Wave Terminal (v0.14.3) is an AI-native cross-platform terminal built on Electron + Go, featuring:

| Capability                | Description                                                           |
| ------------------------- | --------------------------------------------------------------------- |
| **Terminal**              | Full PTY with SSH/WSL support, durable sessions                       |
| **AI Integration**        | Multi-provider (OpenAI, Anthropic, Google, Perplexity) with streaming |
| **Widget System**         | Sidebar widgets that spawn blocks (terminal, AI chat, web, preview)   |
| **Widget Automation RPC** | 20+ commands for DOM-like element queries, mouse/keyboard, clipboard  |
| **Block System**          | 6 block types: term, waveai, preview, web, codeeditor, tsunami        |
| **RPC Infrastructure**    | WebSocket-based Go ↔ TypeScript communication                         |
| **Event System**          | WPS (Wave PubSub) for real-time updates                               |

**Core Users**: Developers who want AI assistance integrated with terminal workflows

**Core Action**: Write terminal commands, interact with AI, manage multiple terminal/AI sessions

---

## The Question

**What would make Wave Terminal 10x more valuable?**

The user wants to add **app-to-widget control** — turning desktop applications into widgets that the AI agent can control using tools like ghost_os, automation-mcp, and the kronoscode toolset.

---

## Massive Opportunities

### 1. Universal Desktop Widget — Control Any App

**What**: Every installed desktop application becomes a Wave Terminal widget. AI can query app state, click buttons, type text, read windows.

**Why 10x**: This transforms Wave Terminal from "terminal that does AI" into "AI that controls your entire desktop." Users could say "open my email, find the last message from Sarah, and draft a reply" — and watch it happen across any app.

**Evidence from Research**:

- Kronoscode has `everywhere` tool: lists apps, inspects UI, controls apps
- Apple Shortcuts has 300+ built-in actions for system apps
- Anthropic Computer Use achieves ~61% success on desktop automation (OSWorld benchmark)
- Wave Terminal ALREADY has widget automation RPC commands (WidgetGetElementsCommand, WidgetMouseClickCommand, etc.) — infrastructure is partially built

**Effort**: Very High — requires:

- App discovery system (enumerate installed apps)
- Per-app automation adapters (AppleScript, accessibility APIs, CLI interfaces)
- Visual AI fallback for un-automatable apps
- Security permission model (user consent, audit logging)

**Risk**: Permission/security concerns (controlling any app = blast radius if compromised), reliability of visual AI fallback

**Score**: 🔥 🔥 🔥 — This is the moonshot. Transforms the product category.

---

### 2. AI-Native Desktop Agent Mode

**What**: A persistent AI agent that monitors screen activity, learns workflows, and proactively assists. Like having a copilot that watches everything you do.

**Why 10x**: Removes the need to explicitly invoke AI. The agent is always there, understanding context, offering suggestions, automating repetitive patterns.

**Evidence from Research**:

- Microsoft UFO "experience learning" — remembers successful action patterns
- Screenpipe (kronoscode) captures screen/audio for AI recall
- Anthropic's screen-aware AI model sees and reasons about visual state

**Effort**: Very High — requires screen capture pipeline, activity indexing, pattern learning, privacy controls

**Risk**: Privacy concerns (continuous screen monitoring), compute cost, potential creepiness factor

**Score**: 🔥 — If done right, creates deep habit formation and defensibility

---

### 3. Cross-Platform Automation Marketplace

**What**: An app store where users share automation "recipes" — packaged workflows for controlling specific apps (Notion, Slack, VS Code, etc.)

**Why 10x**: Network effects. More apps = more users = more recipes = more apps. Turns Wave Terminal into a platform.

**Evidence from Research**:

- Raycast Extension Store drives Raycast adoption
- Power Automate connector ecosystem is key differentiator
- Apple Shortcuts gallery drives discovery

**Effort**: High — requires marketplace infrastructure, recipe format/schema, community features, moderation

**Risk**: Low adoption if no apps; security concerns with untrusted recipes

**Score**: 👍 — Platform plays are high-value but hard to get started

---

## Medium Opportunities

### 4. One-Click App Widget Creation

**What**: Point Wave Terminal at any running app → it automatically creates a widget with discovered controls (buttons, inputs, actions).

**Why 10x**: Solves the "discoverability" problem. Users don't need to configure anything — just click "Add to Wave" on any app.

**Evidence from Research**:

- Power Automate recorder captures flows automatically
- Kronoscode `everywhere list_apps` / `inspect_ui` already does app enumeration
- Wave Terminal's `WidgetGetElementsCommand` provides DOM-like access

**Effort**: Medium — requires:

- App enumeration via accessibility APIs
- Element introspection to build widget UI
- Widget config generation

**Score**: 🔥 — Low friction, high impact. Addresses "why would I use this?"

---

### 5. Natural Language Automation Builder

**What**: "Show me how to..." → Wave Terminal records your actions as a reusable automation.

**Why 10x**: Transforms every workflow into a shareable asset. Power users become contributors.

**Evidence from Research**:

- Microsoft Copilot Studio: natural language → automation flow
- Power Automate "record desktop flow" captures UI interactions

**Effort**: Medium — requires action recording, NL-to-steps translation, replay engine

**Score**: 👍 — Complements the marketplace (users create, marketplace distributes)

---

### 6. Visual AI Desktop Control (Opt-in)

**What**: For apps that can't be automated via APIs/accessibility, enable screenshot + AI vision control. User clicks "Enable AI Control" on any app.

**Why 10x**: Universal coverage. Even legacy apps with no automation support become controllable.

**Evidence from Research**:

- Anthropic Computer Use: screenshot → action loop
- OpenAI CUA achieves 87% browser success rate
- Wave Terminal already has `WidgetSnapshotCommand`

**Effort**: Medium — requires screenshot capture, AI model integration, action execution loop, user confirmation flow

**Score**: 🔥 — Solves the long tail of un-automatable apps

---

### 7. Terminal-Aware Context Injection

**What**: AI automatically understands your terminal context (current directory, git branch, running processes, recent commands) and uses it to provide relevant assistance.

**Why 10x**: AI responses become dramatically more relevant without manual context dumping.

**Evidence from Research**:

- Kronoscode `screenpipe_context` builds context from activity
- Wave Terminal's block system already captures terminal output

**Effort**: Low-Medium — existing infrastructure, needs context extraction and injection

**Score**: 🔥 — Quick win with immediate value

---

### 8. Persistent Session Memory

**What**: Wave Terminal remembers your session across restarts — what you were working on, AI conversation history, automation context.

**Why 10x**: Eliminates friction of re-explaining context. AI becomes a true partner, not a stateless chatbot.

**Evidence from Research**:

- Screenpipe memory/recall system
- Kronoscode `snapshot_save` / `snapshot_restore`

**Effort**: Medium — requires persistence layer, context indexing, search

**Score**: 👍 — Strong retention play

---

## Small Gems

### 9. Widget Quick-Add Bar

**What**: A floating command bar (⌘K style) that shows all available widgets/actions as you type.

**Why powerful**: Zero-friction discovery. Users see what's possible without digging through menus.

**Effort**: Low — existing widget system, needs search UI

**Score**: 🔥

---

### 10. Automation Status Indicator

**What**: When AI is controlling an app, show a subtle indicator (border glow, icon) so users know something is happening.

**Why powerful**: Eliminates anxiety. Users don't wonder "is it working?" or "is it doing something I didn't ask for?"

**Effort**: Low — UI polish, already have widget rendering

**Score**: 🔥

---

### 11. One-Click Permission Grant

**What**: When AI needs app control permission, show a single "Allow" button with clear explanation of what will happen.

**Why powerful**: Current permission systems (TCC, UAC) are confusing. One clear explanation = higher consent rate.

**Effort**: Low — UI for permission prompts, explanation copy

**Score**: 👍

---

### 12. Automation Replay Controls

**What**: Play/pause/stop/speed controls for running automations. Step-through mode for debugging.

**Why powerful**: Confidence in automation. Users can intervene if something goes wrong.

**Effort**: Low-Medium — execution state tracking, UI controls

**Score**: 👍

---

## Recommended Priority

### Do Now (Quick wins with outsized impact)

1. **Widget Quick-Add Bar** — Effort: Low, Impact: High discovery
2. **Automation Status Indicator** — Effort: Low, Impact: User confidence
3. **Terminal-Aware Context Injection** — Effort: Medium, Impact: AI quality
4. **Natural Language Automation Builder** — Effort: Medium, Impact: Platform flywheel

### Do Next (High leverage)

1. **One-Click App Widget Creation** — Effort: Medium, Impact: Zero-friction adoption
2. **Visual AI Desktop Control (Opt-in)** — Effort: Medium, Impact: Universal app coverage
3. **Persistent Session Memory** — Effort: Medium, Impact: Retention

### Explore (Strategic bets)

1. **Universal Desktop Widget** — Effort: Very High, Impact: Transforms product
2. **AI-Native Desktop Agent Mode** — Effort: Very High, Impact: Habit formation
3. **Cross-Platform Automation Marketplace** — Effort: High, Impact: Network effects

### Backlog (Good but not now)

1. **One-Click Permission Grant** — Important but can be iterated
2. **Automation Replay Controls** — Nice to have later
3. **Cross-Platform Automation Marketplace** — Requires user base first

---

## Technical Architecture Recommendation

Based on the kronoscode toolset analysis and Wave Terminal's existing infrastructure:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Wave Terminal Architecture                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Frontend (React 19)                       │   │
│   │  ┌─────────┐  ┌─────────┐  ┌──────────────────────┐  │   │
│   │  │ Widgets │  │ AI Chat │  │ Command Palette     │  │   │
│   │  └────┬────┘  └────┬────┘  └──────────┬─────────┘  │   │
│   └───────┼────────────┼───────────────────┼──────────────┘   │
│           │            │                   │                   │
│           │     ┌──────┴───────────────────┴──────┐            │
│           │     │  Jotai Store (State)           │            │
│           │     └──────┬───────────────────┬──────┘            │
│           │            │                   │                   │
│           │     ┌──────┴──────┐     ┌──────┴──────┐          │
│           │     │ wshclient   │     │  WPS Events │          │
│           │     │ (RPC Call)  │     │  (Subscribe)│          │
│           │     └──────┬──────┘     └─────────────┘          │
│           └────────────┼───────────────────────────────────┘   │
│                        │                                        │
│  ┌─────────────────────┼───────────────────────────────────┐   │
│  │                     │        Go Backend                  │   │
│  │  ┌─────────────────┴─────────────────────────────────┐ │   │
│  │  │              RPC Router                            │ │   │
│  │  │  waveapp → App Builder                           │ │   │
│  │  │  blocks/* → Block Execution                      │ │   │
│  │  │  widget/* → Widget Automation                    │ │   │
│  │  │  desktop/* → Desktop Control (NEW)               │ │   │
│  │  └─────────────────┬─────────────────────────────────┘ │   │
│  │                    │                                     │   │
│  │  ┌─────────────────┴─────────────────────────────────┐ │   │
│  │  │            Desktop Control Layer                    │ │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │ │   │
│  │  │  │ AppleScript│ │ AXUIElement│ │ Visual AI (NEW) │  │ │   │
│  │  │  │ (macOS)   │ │ (macOS)   │ │ (Screenshots)   │  │ │   │
│  │  │  └──────────┘ └──────────┘ └──────────────────┘  │ │   │
│  │  │  ┌──────────┐ ┌──────────┐                       │ │   │
│  │  │  │ UI Auto. │ │ E2B (NEW)│                       │ │   │
│  │  │  │ (Windows)│ │ Sandbox  │                       │ │   │
│  │  │  └──────────┘ └──────────┘                       │ │   │
│  │  └──────────────────────────────────────────────────┘ │   │
│  │                     │                                  │   │
│  │  ┌─────────────────┴─────────────────────────────────┐ │   │
│  │  │              MCP Client (NEW)                       │ │   │
│  │  │  ghost-os, automation-mcp, browseros, etc.         │ │   │
│  │  └───────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Technical Decisions

| Component               | Recommendation                           | Rationale                                                 |
| ----------------------- | ---------------------------------------- | --------------------------------------------------------- |
| **MCP Client**          | Copy kronoscode's `src/mcp/index.ts`     | Production-ready, handles local/remote servers with OAuth |
| **MCP Policy**          | Allowlist from `src/mcp/policy.ts`       | Security-first approach                                   |
| **Desktop Control**     | AXUIElement (macOS) + Visual AI fallback | Universal coverage                                        |
| **E2B Integration**     | Optional sandbox mode                    | For untrusted automations                                 |
| **Automation Registry** | Extend `WidgetConfigType`                | Schema already exists                                     |

---

## Questions

### Answered

- **Q**: What existing infrastructure supports this? **A**: Wave Terminal has 20+ widget automation RPC commands, WPS event system, widget configuration schema
- **Q**: What does kronoscode provide? **A**: MCP client, 75+ tools, E2B desktop sandbox, ghost-os/automation-mcp, browser automation
- **Q**: How do other apps do this? **A**: Apple Shortcuts (visual builder), Power Automate (recorder), AI Computer Use (visual AI)
- **Q**: What security model? **A**: TCC (macOS), explicit permission prompts, audit logging, least-privilege defaults

### Blockers

- **Q**: What platforms to support first? (macOS only, or Windows too?) — need user decision
- **Q**: Build MCP client from scratch or integrate existing (e.g., cursor's MCP implementation)? — need technical investigation
- **Q**: Which specific MCP servers to support initially? — need product decision

---

## Next Steps

- [ ] **Validate**: Get user confirmation on priority ranking
- [ ] **Decide**: macOS-only vs. cross-platform scope
- [ ] **Prototype**: One-Click App Widget Creation (lowest effort, highest learning)
- [ ] **Design**: Permission model UX (how users understand/control AI actions)
- [ ] **Investigate**: Existing MCP client implementations (cursor, kronoscode, claude-desktop)
- [ ] **Plan**: Universal Desktop Widget — break into phases (MVP → v2 → v3)
