# 10x Analysis: Wave Terminal
Session 2 | Date: 2026-03-25

## Current Value
Wave Terminal already combines five things most developer tools keep separate:

- Terminal execution and durable remote access (`README.md`, `docs/docs/wsh.mdx`)
- Workspace layout with tabs, widgets, and saved state (`docs/docs/workspaces.mdx`, `docs/docs/widgets.mdx`)
- Inline previews and editing for files, media, markdown, and directories (`README.md`, `docs/docs/widgets.mdx`)
- AI assistance with terminal, widget, and file context (`README.md`, `docs/docs/waveai.mdx`)
- A programmable CLI surface through `wsh`, including `run`, `ssh`, `web`, `file`, `ai`, `notify`, and metadata control (`docs/docs/wsh-reference.mdx`)

That means Wave is not "just a terminal." It is already a local operating layer for developer work.

The problem is that the product still exposes this mostly as separate powers:

- AI is a sidebar, not yet a full workflow runtime (`docs/docs/waveai.mdx`, `frontend/app/workspace/workspace-layout-model.ts`)
- Workspaces persist layout/history, but new workspaces are still ephemeral until explicitly saved (`docs/docs/workspaces.mdx`)
- Custom widgets exist, but they are still hand-authored JSON and the docs explicitly say the system will be "greatly expanding" in the future (`docs/docs/customwidgets.mdx`)
- Wave AI still lists key gaps as coming soon: remote file access, command execution, and web text extraction (`docs/docs/waveai.mdx`, `README.md`)

## The Question
What would make Wave Terminal 10x more valuable?

Not "more terminal features." The highest-leverage move is to make Wave the default place where a developer initiates, delegates, and resumes work across local, remote, and AI-assisted flows.

---

## Massive Opportunities

### 1. Goal-Driven Runbooks
**What**: Let users launch a named goal like "fix failing CI", "prepare release", or "debug staging latency", and have Wave assemble a live runbook across terminals, SSH sessions, web views, AI context, files, and approvals.

**Why 10x**: This moves Wave from "smart interface" to "execution environment for engineering work." The user stops manually stitching together tabs, commands, logs, docs, and chat.

**Unlocks**:
- Delegated debugging and deploy workflows
- Repeatable incident playbooks
- Shared team rituals that are executable, not just documented

**Evidence**:
- `wsh` already spans `run`, `ssh`, `web`, `file`, `ai`, `notify`, and block metadata in one command surface (`docs/docs/wsh-reference.mdx`)
- Wave AI already has workspace-aware context and approvals, but command execution is still marked coming soon (`docs/docs/waveai.mdx`, `README.md`)
- Workspaces already persist terminal and AI histories once saved (`docs/docs/workspaces.mdx`)

**Effort**: Very High

**Risk**: Safety model gets more complex fast. If execution and editing are bundled into a single "goal" flow, approval UX has to stay legible.

**Score**: 🔥

### 2. Living Workspaces
**What**: Turn workspaces into portable, replayable project memory: state, recent commands, AI threads, pinned files, runbooks, connection targets, and "what changed since last open."

**Why 10x**: The killer user experience is not opening a terminal. It is resuming a project instantly, with full operational context and an AI that remembers the job to be done.

**Unlocks**:
- Seamless resume after restarts or handoffs
- Team onboarding into an existing workspace state
- Cross-machine continuity later, if sync is added

**Evidence**:
- New workspaces are ephemeral until saved (`docs/docs/workspaces.mdx`)
- Saved workspaces persist tabs, layout, terminal history, and AI history, but unsaved editor/web state can still be lost (`docs/docs/workspaces.mdx`)
- Layout persistence is already wired through tab/workspace metadata such as `waveai:panelopen`, `waveai:panelwidth`, and `layout:vtabbarwidth` (`frontend/app/workspace/workspace-layout-model.ts`)

**Effort**: High

**Risk**: Scope creep into sync, conflict resolution, and privacy choices if this is pushed too quickly toward cloud sync.

**Score**: 🔥

### 3. Wave as a Developer App Platform
**What**: Evolve custom widgets from config-file customization into installable, discoverable, composable mini-products: internal dashboards, local tools, repo consoles, deployment views, data inspectors, and AI-assisted task panes.

**Why 10x**: This is the move that changes Wave from a destination app into a platform. The best version of Wave is one where every team turns its repeated terminal rituals into native interfaces.

**Unlocks**:
- Internal tool distribution without a browser-heavy stack
- Community ecosystem around widgets/runbooks
- A moat based on workflows, not just terminal polish

**Evidence**:
- Custom widgets are already configurable via `widgets.json`, with launch behavior, commands, remote connections, and view metadata (`docs/docs/customwidgets.mdx`)
- The docs explicitly frame custom widgets as an early version of a much larger system (`docs/docs/customwidgets.mdx`)
- `wsh` block primitives already provide the control plane needed for a platform (`docs/docs/wsh.mdx`, `docs/docs/wsh-reference.mdx`)

**Effort**: High

**Risk**: If packaging/discovery are weak, this becomes a power-user niche instead of a platform.

**Score**: 👍

---

## Medium Opportunities

### 1. AI Mode Router
**What**: Make Wave choose the right model automatically based on task type, privacy level, latency budget, and attachment type.

**Why 10x**: Wave already supports OpenAI, Anthropic, Google, Perplexity, Ollama, LM Studio, vLLM, and OpenAI-compatible endpoints. Right now that is mostly configuration power. Routing would turn it into user value.

**Impact**:
- Fast model for quick terminal help
- Local model for private code
- Vision-capable model when a widget screenshot matters
- Best reasoning model for multi-file debugging

**Evidence**:
- Multi-provider and BYOK/local model support is already a headline capability (`README.md`, `docs/docs/waveai-modes.mdx`)
- Users can hide cloud modes and set custom defaults today, but selection is still largely manual (`docs/docs/waveai-modes.mdx`, `frontend/app/aipanel/waveai-model.tsx`)

**Effort**: Medium

**Score**: 🔥

### 2. Structured Output Lenses
**What**: Detect when terminal output is actually data and offer instant transformations into tables, charts, diffs, timelines, or inspectable logs.

**Why 10x**: Developers do not want more panes. They want less parsing. Turning stdout into an interactive view can save minutes on every debugging session.

**Impact**:
- Faster diagnosis of logs, JSON, CSV, test failures, and process output
- Lower barrier for non-expert users of complex CLIs

**Evidence**:
- Wave already has preview/editor/web widgets and command blocks (`README.md`, `docs/docs/widgets.mdx`)
- `wsh run`, `wsh view`, and preview file types make the rendering substrate real today (`docs/docs/wsh-reference.mdx`, `docs/docs/widgets.mdx`)

**Effort**: Medium

**Score**: 👍

### 3. Remote-First AI Parity
**What**: Close the gap between local and remote AI assistance so remote SSH workflows feel first-class, not partially visible.

**Why 10x**: Remote development is one of Wave's strongest differentiators. If AI is weaker on remote work than local work, the product breaks exactly where it should dominate.

**Impact**:
- Better remote debugging
- AI-assisted config and infra work without copy-paste
- Stronger value for ops-heavy and infra-heavy users

**Evidence**:
- Durable SSH and connected file workflows are core product promises (`README.md`, `docs/docs/wsh.mdx`)
- Wave AI still calls out remote file access as coming soon (`docs/docs/waveai.mdx`)

**Effort**: Medium

**Score**: 🔥

---

## Small Gems

### 1. Save My Workspace Before I Lose It
**What**: Detect when an unsaved workspace has meaningful state and prompt to save with a smart default name.

**Why powerful**: Workspaces are valuable, but the current model still allows accidental loss for unsaved states. This is a tiny UX fix with outsized retention impact.

**Effort**: Low

**Score**: 🔥

### 2. One-Click "Attach Last Failure"
**What**: Add a terminal/header action that sends the last failed command, recent scrollback, cwd, git branch, and relevant files into Wave AI in one shot.

**Why powerful**: This removes the highest-frequency friction in the product: manually assembling debugging context.

**Effort**: Low

**Score**: 🔥

### 3. Suggested View for This Output
**What**: When a command emits JSON, CSV, test results, or a URL, offer "Open as Table", "Open in Preview", "Ask AI", or "Open Web View".

**Why powerful**: It teaches the product through use. Users discover Wave's multi-widget model exactly when it is useful.

**Effort**: Low

**Score**: 👍

### 4. Privacy Confidence Strip
**What**: Show a clear, persistent indicator of where the current AI request is going: Wave cloud, BYOK provider, or local model.

**Why powerful**: Wave already has unusually strong model flexibility. Surfacing privacy status at decision time reduces hesitation and increases trust.

**Effort**: Low

**Score**: 👍

---

## Recommended Priority

### Do Now
1. Remote-First AI Parity — It reinforces an existing flagship promise and removes a visible product inconsistency.
2. One-Click "Attach Last Failure" — High-frequency debugging win with minimal surface area.
3. Save My Workspace Before I Lose It — Small change, strong retention and trust payoff.
4. Privacy Confidence Strip — Converts existing BYOK/local-model power into visible confidence.

### Do Next
1. AI Mode Router — Uses a real strength Wave already has, but today feels like manual configuration.
2. Structured Output Lenses — Makes Wave's multi-widget model materially faster, not just richer.
3. Goal-Driven Runbooks — Start with a narrow slice such as incident response or release prep rather than a general agent runtime.

### Explore
1. Living Workspaces — Strong long-term moat, but needs careful scoping before sync/share ambitions take over.
2. Wave as a Developer App Platform — Worth pursuing only after there is a dead-simple path from user workflow to reusable widget/runbook.

### Backlog
1. Full marketplace/distribution layer — Good platform upside, but premature before authoring and discovery are simple.

---

## Questions

### Answered
- **Q**: Does Wave already have enough primitives to support a bigger workflow layer? **A**: Yes. The combination of `wsh`, widgets, workspaces, previews, and AI context is already strong enough to support runbooks and reusable workflow products.
- **Q**: Is model flexibility a real differentiator or just config noise? **A**: It is a real differentiator, but only if routing and privacy signaling make it visible in normal use.
- **Q**: Is the custom widget system a strategic asset? **A**: Yes. It is early and manual, but it is the clearest path from "tool" to "platform."

### Blockers
- **Q**: How often do users lose unsaved workspace state in practice? Need product telemetry or user interviews.
- **Q**: Which remote AI gap hurts most: file access, command execution, or web/text extraction? Need support and feedback data.
- **Q**: Do users want reusable runbooks more for solo automation or team standardization? Need segmentation.

## Next Steps
- [ ] Validate the top user pain in remote workflows from issues, Discord, or support threads.
- [ ] Define a narrow MVP for Goal-Driven Runbooks around one high-value use case.
- [ ] Prototype One-Click "Attach Last Failure" and measure repeat usage.
- [ ] Design a workspace-save prompt that triggers only when state is clearly worth preserving.
- [ ] Spec an AI Mode Router that uses privacy, attachment type, and task intent as first inputs.
