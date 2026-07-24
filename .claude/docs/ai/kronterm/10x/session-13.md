# 10x Analysis: KronTerm Lessons from Omi and CopilotOne
Session 13 | Date: 2026-07-01

## Current Value

KronTerm already has an unusually strong foundation: terminal, browser, editor, previews, sandboxes, desktop control, widget protocol, AI panel, ACP agent management, MCP settings, voice-related UI, and durable remote sessions. The current product value is a unified developer command center where surfaces are visible to AI agents and can be controlled from one workspace.

Evidence from KronTerm:

- `README.md` positions KronTerm as "Terminal - Browser - Sandboxes - AI - fused" and describes blocks, widget snapshots, desktop control, sandbox VMs, and KronosCode specialist agents.
- `docs/docs/waveai.mdx` documents AI access to terminal output, widget screenshots, files/directories, web widgets, and command-line AI entry through `wsh ai`.
- `docs/docs/widgets.mdx` and `docs/docs/customwidgets.mdx` show an extensible widget model with terminal, preview, code edit, browser, and custom command widgets.
- `docs/docs/durable-sessions.mdx` shows durable SSH session state, which is already a primitive for preserving developer work over time.

Evidence from Omi:

- `BasedHardware/omi` describes itself as a second brain that captures screen and conversations, transcribes in real time, generates summaries/action items, and chats over everything the user has seen and heard.
- Omi's core product loop is explicit in `ISSUE_TRIAGE_GUIDE.MD`: Capture -> Understand -> Remember -> Retrieve -> Act.
- Omi has a canonical memory model in `docs/memory/domain_model.md`: conversations are upstream records, memories are extracted facts, short-term memories can decay or promote to long-term, workflow/action items are separate, and memory records carry provenance/evidence.
- Omi exposes memory, conversation, and action-item tools through MCP in `mcp/README.md`.
- Omi has a broad app/plugin ecosystem under `plugins/`, including GitHub, Slack, Notion, Linear, Google Calendar, Twitter, ClickUp, Dropbox, Stack Overflow, arXiv, PubMed, Zapier, and Composio examples.

Evidence from CopilotOne:

- `SugarAI-HQ/CopilotOne` is built around adding a Siri-like assistant to existing apps.
- Its README centers on voice-to-action, text-to-action, current-screen context embeddings, API-to-natural-language actions, navigation agents, and form agents.
- The SDK exposes `registerAction`, `unregisterAction`, and `useStateEmbedding` in `sdks/core/src/copilot_context.tsx` and `sdks/core/src/hooks.ts`.
- Its backend/factory uses embeddings and lookup flows for current screen/state context.

## The Question

What can KronTerm take from Omi and CopilotOne that would make it 10x more valuable?

Answer: take Omi's memory-first operating loop and CopilotOne's explicit app action model, then apply both to KronTerm's widget workspace. KronTerm should become the developer second brain that sees every terminal/browser/editor/sandbox event, understands what happened, remembers useful project facts, exposes typed actions for every surface, and lets the user act through text, voice, widgets, commands, and MCP.

The key move is not copying Omi's life-recorder or CopilotOne's web SDK. The key move is adapting their core patterns to developer work:

- Omi pattern: capture everything important, extract durable memories, preserve provenance, retrieve it later, and act through integrations.
- CopilotOne pattern: make app state embeddable, make UI/API actions explicit, and let voice/text route to typed actions.
- KronTerm adaptation: every block becomes a memory source and an action provider.

---

## Massive Opportunities

### 1. Developer Memory OS

**What**: Build a first-class memory layer for developer work. KronTerm captures terminal commands, exits, errors, shell directories, opened files, browser URLs, docs pages, sandbox sessions, AI actions, diffs, tests, PR checks, and user decisions. It extracts short-term facts, promotes useful facts to long-term project memory, creates action items, and preserves evidence links back to blocks/sessions.

**Why 10x**: Developers constantly lose context: why a command failed, which doc solved the issue, what changed in a long debugging session, which workaround worked, what the agent already tried, and what still needs doing. Omi's "second brain" loop maps almost perfectly to developer workflows if KronTerm treats workspace activity as conversations with provenance.

**Unlocks**: "What did we try yesterday?", "Why is this env var set?", "Summarize this debugging session", "Resume the app work from last night", "Show commands that fixed the failing build", "Create a runbook from this incident", "Remember this repo's deploy quirks."

**Effort**: Very High

**Risk**: Privacy and trust. Developer work contains secrets, customer data, credentials, proprietary source code, and local paths. The memory system needs local-first defaults, redaction, provenance, user controls, deletion, and clear visibility into what was captured.

**Score**: Must do

### 2. Widget Action Registry

**What**: Give every widget a CopilotOne-style action contract: typed action name, description, parameters, permissions, examples, current state scope, and validation. Terminal widgets register actions like run command, explain output, stop process, open cwd, search scrollback. Browser widgets register navigate, click, fill, extract page, inspect console. Preview/editor widgets register edit, diff, save, search, run related tests. Sandbox widgets register click, type, screenshot, install, reset.

**Why 10x**: KronTerm already has many control surfaces, but a typed action registry makes them legible to agents, command palettes, voice, MCP, automations, and future plugins. CopilotOne's `registerAction` pattern is the simplest high-leverage abstraction: make capabilities explicit instead of inferred from UI chrome.

**Unlocks**: contextual commands, voice-to-action, plugin automation, safer approvals, testable agent capabilities, generated UI controls, action discovery, and consistent permission prompts.

**Effort**: High

**Risk**: If action schemas are too generic, agents still guess. If too specific, the registry becomes maintenance-heavy. Start with 20 core actions across terminal/browser/editor/sandbox and expand only from usage.

**Score**: Must do

### 3. KronTerm App Store for Developer Agents

**What**: Turn custom widgets, MCP servers, skills, integrations, and workflow automations into an app ecosystem. Apps can contribute widgets, actions, memory extractors, context providers, triggers, and permissions. First-party apps should cover GitHub, Jira/Linear, Slack, Notion, Datadog, Supabase, Vercel, Docker, Kubernetes, AWS/GCP/Azure, Playwright, and local repo intelligence.

**Why 10x**: Omi's plugin directory shows a broad integration strategy: memory becomes more useful when apps can react to conversations and contribute tools. KronTerm's equivalent is developer workflow apps that react to build failures, terminal events, PRs, browser pages, sandbox states, and project memories.

**Unlocks**: ecosystem growth, third-party contributions, integration marketplace, enterprise workflows, repeatable task packs, revenue surface, and defensibility beyond "AI terminal."

**Effort**: Very High

**Risk**: App stores create security and quality problems. Permissions, sandboxing, signing, review, and clear user consent are not optional.

**Score**: Strong

### 4. Voice-to-Workspace Command Layer

**What**: Build a Siri-like voice/text control layer for KronTerm, using the widget action registry and current workspace embeddings. The user can say "rerun the failing test", "open the preview and check the console", "summarize this terminal", "start a durable SSH session", "fill this config from the README", or "create a clean debug layout."

**Why 10x**: CopilotOne's key bet is hands-free app operation. For KronTerm, voice is not a gimmick if it controls real developer actions across terminal, browser, editor, and sandbox. It becomes the fastest command palette for a workspace with many surfaces.

**Unlocks**: accessibility, faster multitasking, demo magic, agent supervision while coding, and lower learning curve for a complex product.

**Effort**: High

**Risk**: Voice actions can be dangerous in a terminal. Require action previews, approval policies, and a "read-only voice mode" before command execution.

**Score**: Strong

### 5. KronTerm Memory MCP

**What**: Expose KronTerm's project memories, workspace sessions, terminal histories, action items, saved layouts, and widget snapshots through a local MCP server. External agents can ask KronTerm what happened, retrieve evidence, create memories, update action items, or resume a workspace.

**Why 10x**: Omi's MCP server turns personal memory into a tool other agents can use. KronTerm should do the same for developer memory. This makes KronTerm the local source of truth for workspace context, even when users also use Claude Desktop, ChatGPT, Cursor, Codex, or other agents.

**Unlocks**: interop, agent handoffs, local context bridge, durable project memory across tools, and a moat around captured workspace data.

**Effort**: Medium/High

**Risk**: MCP memory access needs scope controls per repo/workspace. A global "read everything" API would be unacceptable for enterprise users.

**Score**: Must do

---

## Medium Opportunities

### 1. Current Workspace Embeddings

**What**: Adapt CopilotOne's `useStateEmbedding` idea to blocks and workspaces. Embed scoped snapshots such as `workspace:kronterm`, `block:terminal:cwd`, `block:browser:url`, `repo:branch`, `task:debug-session`, and `agent:run`.

**Why 10x**: KronosCode should retrieve relevant workspace state without requiring users to paste context. This is the missing retrieval layer between raw widget snapshots and high-quality agent answers.

**Impact**: Better context selection, fewer hallucinated assumptions, faster resume, smarter suggestions.

**Effort**: Medium/High

**Score**: Must do

### 2. Session Summaries and Action Items

**What**: When a user finishes a work session, KronTerm generates a concise summary, decisions made, commands run, files touched, links used, failures, resolved blockers, and open action items. Users can pin, edit, or delete the output.

**Why 10x**: Omi's summaries/action items are a direct fit for developer work. The terminal session is the conversation.

**Impact**: Fewer lost threads, better handoffs, easier status updates, faster next-day resume.

**Effort**: Medium

**Score**: Must do

### 3. Provenance-First Memory Cards

**What**: Every extracted memory links back to the exact terminal output, command, file diff, browser page, screenshot, or AI message that produced it. Show memory cards with evidence, confidence, layer, source block, created time, and controls to promote/delete/archive.

**Why 10x**: Omi's memory model emphasizes evidence and source separation. For developers, trust depends on being able to inspect where a fact came from.

**Impact**: Higher trust, easier correction, fewer stale project facts.

**Effort**: Medium

**Score**: Strong

### 4. Trigger-Based Developer Apps

**What**: Let apps subscribe to events: terminal command failed, process started, branch changed, PR opened, test passed, browser page matched docs, sandbox crashed, file changed, memory created, action item due. Apps can respond with cards, actions, or background automation.

**Why 10x**: Omi apps trigger on conversation creation/transcript events. KronTerm apps should trigger on developer workflow events.

**Impact**: Automations become native, not prompt-driven. Examples: auto-create Linear issue from failing test, attach terminal evidence to GitHub comment, create Datadog incident note from logs.

**Effort**: Medium/High

**Score**: Strong

### 5. Navigation Agent for KronTerm

**What**: A built-in agent that helps users find commands, settings, widgets, layouts, docs, sessions, and integrations. It can answer "where do I configure MCP?", "show AI provider settings", "open yesterday's sandbox", or "where is the terminal font setting?"

**Why 10x**: CopilotOne's navigation agent is designed to reduce learning curve in complex apps. KronTerm is powerful enough that feature discovery will become a real barrier.

**Impact**: Faster onboarding, lower support burden, better feature discovery.

**Effort**: Medium

**Score**: Strong

### 6. Form and Config Agent

**What**: A focused agent for filling configuration forms and structured files: settings panels, provider keys, MCP server configs, SSH connection profiles, `.env` files, deployment configs, package metadata, and JSON/YAML/TOML.

**Why 10x**: CopilotOne's form agent maps cleanly to developer configuration. A lot of developer friction is not coding, it is filling precise settings from scattered docs.

**Impact**: Faster setup, fewer syntax errors, easier BYOK/MCP/plugin onboarding.

**Effort**: Medium

**Score**: Strong

### 7. Memory-First Triage Rubric

**What**: Adopt an internal product priority loop for KronTerm analogous to Omi's. Suggested loop: Observe -> Understand -> Act -> Verify -> Remember. Prioritize bugs that break observation, action, verification, or memory above cosmetic work.

**Why 10x**: Omi's triage guide is a strategic asset because it keeps the team aligned around the product's core promise. KronTerm needs the same discipline for agent trust.

**Impact**: Better roadmap decisions, fewer shiny distractions, clearer quality bar.

**Effort**: Low/Medium

**Score**: Strong

### 8. Daily/Weekly Developer Recap

**What**: Generate timeline recaps from workspace activity: repos touched, commands run, issues investigated, decisions made, failures fixed, time spent, open tasks, and suggested next actions.

**Why 10x**: Omi's "remember everything" value can become "never write a status update manually again" for developers.

**Impact**: Great for solo builders, teams, managers, consultants, and enterprise audit trails.

**Effort**: Medium

**Score**: Strong

---

## Small Gems

### 1. "Remember This" Button

**What**: Add a button to terminal selections, browser pages, AI messages, diffs, and previews that saves a scoped memory with evidence.

**Why powerful**: Gives users control before automatic memory is mature.

**Effort**: Low

**Score**: Must do

### 2. "What Happened Here?"

**What**: A one-click summary for any block's recent activity.

**Why powerful**: Turns scrollback and browser history into useful context instantly.

**Effort**: Low/Medium

**Score**: Must do

### 3. Action Inspector

**What**: Show the actions registered by the focused widget, with parameter schemas and examples.

**Why powerful**: Makes the hidden agent capability model visible to users and developers.

**Effort**: Low

**Score**: Strong

### 4. "Promote to Project Memory"

**What**: In any AI response or session summary, let users promote a sentence into long-term project memory.

**Why powerful**: Builds trust through explicit curation.

**Effort**: Low

**Score**: Must do

### 5. "Create Action Item"

**What**: Turn selected terminal output, AI text, or browser content into an action item linked to evidence.

**Why powerful**: Omi separates workflow from memory; KronTerm should do the same.

**Effort**: Low

**Score**: Strong

### 6. Voice Command Preview

**What**: Voice input resolves to a typed action card before execution.

**Why powerful**: Makes voice safe enough for terminal workflows.

**Effort**: Low/Medium

**Score**: Strong

### 7. Session Resume Card

**What**: On opening a workspace, show the last session summary, open tasks, active processes, changed files, and suggested next action.

**Why powerful**: This is the simplest visible form of the developer second brain.

**Effort**: Medium

**Score**: Must do

### 8. Memory Privacy Ledger

**What**: A settings view that shows what was captured, embedded, remembered, synced, or shared, with delete controls.

**Why powerful**: Memory products win or lose on trust.

**Effort**: Medium

**Score**: Must do

---

## Recommended Priority

### Do Now

1. **Widget Action Registry v0** - Define typed action schemas for terminal, browser, editor/preview, sandbox, and workspace layout. This is the CopilotOne pattern with immediate KronTerm leverage.
2. **"Remember This" + manual project memories** - Ship user-curated memory before automatic capture. Store content, scope, source block, timestamp, and evidence.
3. **"What Happened Here?" block summary** - Summarize recent terminal/browser/editor activity and make it saveable as a memory or action item.
4. **Voice/text action preview** - Route voice or text to registered actions, but require preview/approval for anything that mutates state.
5. **Session Resume Card** - On workspace open, show last summary, recent commands, changed files, and open action items.

### Do Next

1. **Current Workspace Embeddings** - Embed scoped block/workspace snapshots and retrieve them for KronosCode context.
2. **Session summaries and action items** - Generate end-of-session notes with evidence and user-editable tasks.
3. **Provenance-first memory cards** - Show source, confidence, layer, and promote/archive/delete controls.
4. **KronTerm Memory MCP** - Expose memories, sessions, action items, and workspace summaries to external agents with strict repo/workspace scope.
5. **Navigation/config agents** - Help users find settings, fill configs, and operate complex product surfaces.

### Explore

1. **App marketplace** - Strategic upside is large, but it needs a permission model, signing story, and a small first-party app set first.
2. **Automatic capture and promotion** - Huge value, but risky without privacy controls, redaction, and correction flows.
3. **Cross-device companion** - Omi's phone/wearable lesson is valuable, but for KronTerm the first cross-device use case should probably be mobile session review, alerts, and approvals, not always-on recording.
4. **Developer recap analytics** - Useful for teams and consultants, but depends on trustworthy memory capture.

### Backlog

1. **Hardware/wearable integrations** - Omi's hardware strategy is not the right first move for KronTerm. Borrow the always-available capture mindset, not the device roadmap.
2. **Full public app store** - Build internal and signed first-party apps first.
3. **Autonomous form filling everywhere** - Start with settings/config forms where the blast radius is bounded.

---

## What To Take Directly

### From Omi

1. **The loop**: Capture -> Understand -> Remember -> Retrieve -> Act.
2. **Memory layers**: short-term, long-term, archive, with explicit promotion and decay.
3. **Evidence/provenance**: every durable memory should point back to source material.
4. **Workflow separation**: action items are not memories; keep them separate but linked.
5. **MCP exposure**: memory becomes more valuable when other agents can query it safely.
6. **Plugin triggers**: external apps should react to captured events, not only manual prompts.
7. **Trust-first prioritization**: bugs that lose or corrupt memory/context are existential.

### From CopilotOne

1. **Action registration**: widgets and apps declare what they can do.
2. **State embeddings**: current UI/workspace state becomes retrievable context.
3. **Voice/text to action**: natural language routes to typed actions, not vague chat.
4. **Navigation agent**: complex products need an agent that helps users find features.
5. **Form agent**: configuration is a high-value target for AI assistance.
6. **API-to-natural-language layer**: make developer APIs and `wsh` commands callable through natural language with schemas.

## What Not To Copy

1. **Always-on life recording by default** - KronTerm users will reject hidden capture of source code, terminals, and browsers. Make capture explicit, scoped, inspectable, and local-first.
2. **Broad plugin permissions too early** - Developer tools are high-trust. Marketplace permissions need to be more rigorous than consumer app permissions.
3. **Voice as a primary interface before safety** - In terminals, a misunderstood command can be destructive. Voice should preview actions before execution.
4. **Memory without correction UI** - A wrong project memory is worse than no memory. Users need edit/delete/promote controls from day one.

---

## Questions

### Answered

- **Q**: What is the core Omi pattern worth borrowing? **A**: A memory-first loop with provenance: capture, understand, remember, retrieve, act.
- **Q**: What is the core CopilotOne pattern worth borrowing? **A**: Explicit action registration and current-state embeddings that make app control reliable.
- **Q**: How does this map to KronTerm? **A**: Treat every widget as both a context source and an action provider, then add developer memory on top.
- **Q**: What is the highest-leverage first step? **A**: Widget Action Registry v0 plus manual "Remember This" memory cards.

### Blockers

- **Q**: Should project memory be local-only by default, cloud-syncable, or hybrid?
- **Q**: Which scope should ship first: per-workspace memory, per-repo memory, or global user memory?
- **Q**: Should KronTerm memory be part of KronosCode only, or a product-wide primitive available to widgets, MCP, plugins, and `wsh`?

## Next Steps

- [ ] Draft `WidgetAction` schema for terminal, browser, preview/editor, sandbox, and workspace.
- [ ] Define `ProjectMemory` v0 schema with content, source, evidence, scope, timestamps, and user controls.
- [ ] Prototype "Remember This" on terminal selection and AI message.
- [ ] Prototype "What Happened Here?" for terminal scrollback.
- [ ] Design the memory privacy ledger before automatic capture.
- [ ] Decide whether `wsh memory` should exist as the CLI surface.
- [ ] Define the first three trigger-based developer apps: GitHub, Linear/Jira, and Slack.
