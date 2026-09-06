# 10x Analysis: KronTerm Widget Usability and KronosCode Capability
Session 12 | Date: 2026-06-19

## Current Value

KronTerm already has the foundation for a unique AI-native workspace: blocks/widgets, layout control, an AI panel, ACP agent sessions, MCP tools, widget automation, sandbox/desktop activity previews, and per-block agent activity overlays.

The user target for this session is more specific than reliability alone:

- More usable control over widgets and their appearance.
- A Kronos AI widget that operates naturally alongside other widgets.
- Better visual design and interaction model for the AI surface.
- Fewer KronosCode bugs.
- KronosCode as a top-tier coding and general-purpose agent for any task.

Evidence from the repo:

- `frontend/app/block/blockframe.tsx` already renders per-block frames, masks, connection overlays, context ribbons, and agent activity overlays.
- `frontend/app/block/blockframe-header.tsx` already exposes block controls, context menus, an agent settings panel, and KronosCode actions.
- `frontend/app/block/agent-widget-settings.ts` stores per-block agent visual settings such as glow, action chip, cursor, screenshot preview, aura, and pointer style.
- `frontend/app/block/agent-action-button.tsx` defines block-specific KronosCode actions like Explain Output, Fix Error, Suggest Command, Summarize, Extract Data, Refactor, and Improve Response.
- `frontend/app/block/block-context-ribbon.tsx` exists but is currently a simple status ribbon and is passed static `idle` state from the block frame.
- `frontend/app/aipanel/acp-chat-panel.tsx` includes agent selection, default commands, live surface strips, sandbox run display, take-over actions, and session UI.
- `frontend/app/aipanel/improved-chat-input.tsx` includes file upload, paste handling, slash commands, agent options, model options, and widget mentions.
- `frontend/app/workspace/widgets.tsx` groups widgets into Terminal, Browser, AI, Sandbox, Design, Apps, and Tools, and redirects older AI widget entries to `chathubv2`.
- `frontend/app/view/waveai/waveai.tsx` still names the view "KronosCode" while other areas call the modern AI surface ChatHub V2 or KronosChamber, creating identity fragmentation.
- `frontend/app/aipanel/kronoscode-v2/components/chat/message/parts/ToolPart.tsx` shows tool calls, but in a minimal raw JSON style that is not yet a top-tier agent activity experience.

## The Question

What would make KronTerm and KronosCode 10x more usable and capable?

Answer: make every widget feel agent-aware, customizable, and composable, while making KronosCode feel like an expert coworker that can sit beside any surface, understand it, act on it, and show its work beautifully.

KronTerm should not feel like "terminal plus sidebar chat." It should feel like a programmable workspace where every widget can be shaped by the user and operated by the agent.

---

## Massive Opportunities

### 1. Widget Appearance Studio

**What**: A first-class appearance editor for every widget: chrome density, header style, icon, title, border, active border, background, opacity, blur, rounded corners, folded preview, status ribbons, agent overlay style, screenshots, cursor style, and per-widget presets. Include workspace-level themes and quick presets such as Focus, Dense Ops, Presentation, Debug, Research, and AI Pairing.

**Why 10x**: The workspace becomes personal and task-specific instead of a fixed shell. Users can make terminals dense, browsers large, AI panels calm, dashboards glanceable, and agent-controlled widgets visually obvious.

**Unlocks**: user ownership, better demos, power-user workflows, visual clarity, theme marketplace later.

**Effort**: High

**Risk**: Too many controls can become clutter. It needs presets first, advanced controls second.

**Score**: 🔥

### 2. KronosCode as a Dockable Sidecar

**What**: Let KronosCode attach to any widget as a sidecar, bottom drawer, floating compact chip, or full panel. The attached AI should inherit that widget's context and expose actions like "watch this," "explain this," "fix this," "extract this," "test this," and "automate this."

**Why 10x**: The agent stops feeling separate from the workspace. Instead of asking a global chat to infer context, users can put the agent directly beside the terminal, browser, preview, sandbox, canvas, or settings view they are working with.

**Unlocks**: local widget copilots, less context-pasting, better multi-widget workflows, faster action discovery.

**Effort**: High

**Risk**: Multiple sidecars can overwhelm the workspace. Need one active agent focus model and clear handoff between widgets.

**Score**: 🔥

### 3. Widget Choreography Engine

**What**: KronosCode can create, arrange, resize, fold, magnify, style, and connect widgets as part of a task. Example: "debug this app" opens terminal, browser, logs, file preview, and AI sidecar in a saved layout. "research this" opens browser, notes canvas, AI summary, and source tracker.

**Why 10x**: The product becomes an agent-operated operating surface, not just a set of blocks. Users ask for outcomes, and KronTerm builds the right workspace around the task.

**Unlocks**: task templates, reusable workspaces, agent-created dashboards, teaching/demo layouts, full-stack debugging flows.

**Effort**: Very High

**Risk**: If layout actions feel unpredictable, users lose trust. Requires preview/undo and layout intent explanations.

**Score**: 🔥

### 4. Top-Tier Agent Workbench

**What**: Turn KronosCode into a full coding/general agent workbench: plan, files, terminal, browser, tools, approvals, tests, diffs, screenshots, memory, MCP, skills, and final evidence in one polished flow. The agent should be equally strong at coding, research, desktop operations, debugging, QA, data extraction, and local automation.

**Why 10x**: Top-tier agents are not only model wrappers. They combine context, tools, UI, verification, memory, and fast iteration. KronTerm has the rare advantage of owning the whole desktop workspace.

**Unlocks**: best-in-class coding workflows, general task automation, developer trust, differentiated positioning against chat-only agents and IDE-only agents.

**Effort**: Very High

**Risk**: Scope creep. Needs a clear capability ladder: coding first, then browser/desktop/sandbox/general workflows.

**Score**: 🔥

---

## Medium Opportunities

### 1. Unified Widget Command Menu

**What**: Replace scattered right-click actions and the small agent action button with a consistent command menu on every widget. It should include widget actions, appearance actions, layout actions, KronosCode actions, and automation actions.

**Why 10x**: Users should not need to discover separate controls in context menus, header icons, settings panels, and the AI panel. One command surface makes every widget feel powerful.

**Impact**: Faster discovery, fewer hidden features, easier onboarding, cleaner control model.

**Effort**: Medium

**Score**: 🔥

### 2. Agent Activity Ribbon That Actually Reflects Activity

**What**: Connect `BlockContextRibbon` to live agent activity. Show states like Watching, Reading, Clicking, Typing, Running, Waiting, Needs Review, Error, Verified. Include the active agent name and a one-click inspect/takeover action.

**Why 10x**: Users need to see which widget the agent is using and what it is doing without opening logs or reading chat.

**Impact**: More trust, better multi-widget awareness, less surprise when the agent acts.

**Effort**: Medium

**Score**: 🔥

### 3. Agent Visual Settings as Real Product Settings

**What**: Move per-block agent visual settings from localStorage-only controls into the actual widget/settings model, with global defaults, per-widget overrides, and workspace presets.

**Why 10x**: The existing settings are promising but feel bolted on. Making them durable and shared makes the agent's presence feel designed.

**Impact**: Better customization, less reset/friction, more consistent demos.

**Effort**: Medium

**Score**: 👍

### 4. AI Widget Identity Cleanup

**What**: Unify names and behavior across WaveAI, KronosCode, ChatHub V2, KronosChamber, and ACP panel. Users should see one coherent AI product with optional modes, not several names for overlapping surfaces.

**Why 10x**: Fragmented naming makes the product feel unfinished. A top-tier agent needs a clear identity and mental model.

**Impact**: Less confusion, better onboarding, cleaner docs, stronger brand.

**Effort**: Medium

**Score**: 🔥

### 5. Context-Aware Agent Actions

**What**: Generate widget actions from actual live context instead of static per-view lists. Terminal with a failed command should show Fix Error and Explain Trace. Browser on docs should show Summarize and Extract API. Preview on a test file should show Run Tests. Sandbox should show Take Over and Diagnose UI.

**Why 10x**: The user sees the right action at the exact moment of need.

**Impact**: Higher agent usage, fewer prompts, faster workflows.

**Effort**: Medium/High

**Score**: 🔥

### 6. Beautiful Tool Call Cards

**What**: Replace raw JSON-oriented tool cards with typed cards: terminal command cards, file diff cards, browser action cards, screenshot cards, sandbox cards, approval cards, test result cards, and error cards.

**Why 10x**: Top-tier agents make their work easy to review. Raw JSON makes powerful actions look unfinished.

**Impact**: More trust, faster review, better demos, fewer missed failures.

**Effort**: Medium

**Score**: 🔥

### 7. Task Modes for Coding and General Work

**What**: Add clear modes: Code, Debug, Review, Research, Browser, Desktop, Data, Design, Write, and General. Each mode changes default tools, verification expectations, UI layout, and suggested commands.

**Why 10x**: A general agent is strongest when it adapts to task shape. Coding and browsing should not use the same UI assumptions.

**Impact**: Better defaults, less prompting, easier for non-experts.

**Effort**: Medium

**Score**: 👍

### 8. Widget Mentions as Live Context Packs

**What**: Make `@widget` mentions attach structured context: current screenshot, text state, URL/file/path, recent activity, available actions, and permission scope.

**Why 10x**: Mentions become more than labels. They are precise, inspectable context bundles for the agent.

**Impact**: Better accuracy, fewer manual screenshots, faster cross-widget tasks.

**Effort**: Medium

**Score**: 🔥

---

## Small Gems

### 1. "Style This Widget" Action

**What**: Right-click any widget and choose "Style This Widget" to open a compact appearance popover with presets and advanced controls.

**Why powerful**: Makes customization discoverable immediately.

**Effort**: Low/Medium

**Score**: 🔥

### 2. "Attach KronosCode Here"

**What**: Every widget header gets an action to attach the AI as a sidecar scoped to that widget.

**Why powerful**: Turns the agent into a contextual coworker in one click.

**Effort**: Low/Medium

**Score**: 🔥

### 3. Live Agent Focus Ring

**What**: Show a clean, configurable ring on the widget the agent is currently reading or controlling.

**Why powerful**: Users instantly know where the agent's attention is.

**Effort**: Low

**Score**: 🔥

### 4. "Make This Layout Reusable"

**What**: Save the current widgets, sizes, styles, and agent mode as a named workspace template.

**Why powerful**: Converts one good setup into a repeatable workflow.

**Effort**: Medium

**Score**: 👍

### 5. Top Actions Row in Empty AI State

**What**: When the AI panel is empty, show high-value actions: Fix active error, Explain terminal, Review changes, Test app, Research docs, Control browser, Style workspace.

**Why powerful**: Users learn what the agent can do without reading docs.

**Effort**: Low

**Score**: 🔥

### 6. Agent Bug Report Button

**What**: Every failed agent run gets a "Report / Save Debug Bundle" action with tool calls, errors, environment state, and screenshots.

**Why powerful**: Makes bug fixing faster and gives beta users a clear recovery path.

**Effort**: Low/Medium

**Score**: 🔥

### 7. One Visual Language for Agent States

**What**: Standardize colors/icons/labels for Thinking, Acting, Waiting, Needs Review, Failed, Verified across the AI panel, ribbons, overlays, tool cards, and widgets.

**Why powerful**: Reduces cognitive friction and makes the product feel mature.

**Effort**: Low/Medium

**Score**: 🔥

---

## Confirmed Bug/Rough-Edge Targets

These are not implementation findings from a full test run, but the code scan surfaced high-signal usability and quality targets:

1. **AI product naming is fragmented**: `waveai`, `KronosCode`, `ChatHub V2`, `KronosChamber`, and ACP panel all appear in related AI surfaces.
2. **Widget view names are inconsistent**: web actions/settings check both `web` and `webview` in different places, which can hide or misroute actions.
3. **Agent visual settings are localStorage-only**: per-block appearance controls are not yet integrated into durable workspace/widget config.
4. **Context ribbon is static**: `BlockContextRibbon` is currently passed `status="idle"` from the block frame, so it does not reflect real agent activity.
5. **Agent action menus are static**: `AgentActionButton` uses hardcoded actions per block type rather than live context.
6. **Tool cards are too raw**: `ToolPart` mostly displays tool name, status, input JSON, and output text, which undersells the agent and makes review harder.
7. **Web widget settings access is inconsistent**: header settings are hidden for `metaView === "web"`, while agent visual settings for web live in the context menu.
8. **Agent overlays are promising but not yet a system**: block overlays, live surface strip, sandbox display, and run strip exist separately and should share one activity model and design language.

---

## Recommended Priority

### Do Now

1. Unify AI naming and entry points — Why: users need one mental model before adding more capability.
2. Fix widget view naming mismatches — Why: hidden/misrouted actions make the workspace feel buggy.
3. Connect `BlockContextRibbon` to live agent activity — Why: immediate usability gain from existing infrastructure.
4. Add "Attach KronosCode Here" to every widget — Why: this directly addresses operating alongside widgets.
5. Add "Style This Widget" with presets — Why: gives users obvious control over widget appearance.
6. Replace raw tool display for the top 5 tools — Why: coding/general agent quality is judged through tool review UX.

### Do Next

1. Build the unified widget command menu — Why: consolidates appearance, layout, and agent actions.
2. Promote agent visual settings into durable settings — Why: makes customization real, not temporary.
3. Add context-aware action suggestions — Why: the right action at the right time is a major usability multiplier.
4. Add workspace layout templates — Why: turns widget control into repeatable workflows.
5. Add task modes — Why: makes KronosCode strong across coding and general tasks without requiring expert prompting.

### Explore

1. Widget Choreography Engine — Why: lets KronosCode create the right workspace for each task. Risk: needs preview/undo to avoid layout surprise.
2. Sidecar AI per widget — Why: could become the signature KronTerm interaction. Risk: needs a clear active-focus model.
3. Agent Workbench — Why: makes KronosCode top-tier for coding and general automation. Risk: large scope; should grow from tool cards, verification, and context packs.

### Backlog

1. Visual theme marketplace — Good later after the appearance model is stable.
2. Shared team workspace templates — Good later after single-user templates work.
3. Multi-agent widget roles — Good later after one agent can reliably operate beside widgets.

---

## Questions

### Answered

- **Q**: Should the next focus be only reliability? **A**: No. Reliability remains necessary, but usability and capability need equal focus: widget control, AI placement, action discovery, and visual polish.
- **Q**: What makes KronosCode feel top-tier? **A**: Context-aware actions, beautiful tool review, strong coding workflows, verification, desktop/browser/sandbox capability, and a coherent UI around agent work.
- **Q**: What is the clearest differentiator? **A**: Agent-aware widgets. Each surface can be styled, inspected, controlled, mentioned, watched, and automated by KronosCode.

### Blockers

- **Q**: Should the primary AI brand shown to users be KronosCode, Kronos, KronosChamber, or ChatHub? This should be decided before more UI polish.
- **Q**: Should widget appearance be workspace-scoped, global, or both? Proposed answer: global defaults plus workspace and per-widget overrides.

## Next Steps

- [ ] Decide the user-facing AI surface name and deprecate aliases in UI labels.
- [ ] Audit view type strings for `web` vs `webview` and other mismatches that affect action visibility.
- [ ] Design the widget command menu with sections: Agent, Appearance, Layout, Data, Debug, Share.
- [ ] Design the "Attach KronosCode Here" sidecar states: compact, side, bottom, floating, full panel.
- [ ] Wire block context ribbons to `agentActivityTimeline` and per-block activity events.
- [ ] Convert top tool cards into typed visual cards: terminal, file diff, browser, screenshot, approval.
- [ ] Move agent widget visual settings from localStorage-only storage into durable widget/workspace configuration.
- [ ] Create first workspace templates: Coding, Debug Web App, Research, Browser Automation, Desktop Control.
