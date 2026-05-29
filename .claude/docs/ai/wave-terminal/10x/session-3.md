# 10x Analysis: Wave Terminal — Mission Control for Parallel Work
Session 3 | Date: 2026-03-29

## Current Value
Wave Terminal already combines several layers that most developer tools keep separate:

- Terminal execution, remote access, and durable SSH sessions that survive disconnects and restarts (`README.md`, `docs/docs/durable-sessions.mdx`)
- A composable workspace model with tabs, blocks/widgets, saved histories, and persistent layout metadata (`docs/docs/workspaces.mdx`, `docs/docs/tabs.mdx`, `frontend/app/workspace/workspace-layout-model.ts`)
- A unified command surface through `wsh` for running commands, opening web/views, moving files between local and remote, talking to AI, sending notifications, and setting badges (`docs/docs/wsh.mdx`, `docs/docs/wsh-reference.mdx`)
- AI that already sees terminal output, files, screenshots, and widget state, with more direct execution features still marked as coming soon (`README.md`, `docs/docs/waveai.mdx`, `ROADMAP.md`)
- A growing signal/attention layer: block and tab badges, PID-linked badges, desktop notifications, and Claude Code hook integration for parallel sessions (`docs/docs/claude-code.mdx`, `docs/docs/releasenotes.mdx`, `frontend/app/store/badge.ts`)

That means Wave is already much closer to a work orchestration surface than to a conventional terminal.

The gap is that the product still exposes these powers as separate features:

- AI is still mostly a chat surface instead of a first-class supervisor/runtime (`docs/docs/waveai.mdx`)
- Workspaces persist a lot, but new ones are still ephemeral until explicitly saved (`docs/docs/workspaces.mdx`)
- Remote workflows are a flagship strength, but AI still lacks full remote file/command parity (`docs/docs/waveai.mdx`, `ROADMAP.md`)
- Users can already run many sessions in parallel, but the product mostly helps them notice status, not manage the whole queue (`docs/docs/claude-code.mdx`)

## The Question
What would make Wave Terminal 10x more valuable?

Not more terminal chrome. The highest-leverage move is to make Wave the control plane for parallel human+AI work across local repos, remote hosts, and long-running tasks.

---

## Massive Opportunities

### 1. Agent Fleet Control Plane
**What**: Treat every terminal, AI session, background job, and remote block as a managed worker with goal, status, owner, priority, approval state, and retry/resume controls. Users should be able to supervise ten parallel tasks without tab-hopping.

**Why 10x**: The job is shifting from "type one command" to "manage many active work streams." Wave is already used this way informally. The product should own that pattern explicitly.

**Unlocks**:
- Parallel coding/debugging/deploy work with much less polling
- Clear blocked/waiting/done states across tabs and hosts
- Human-plus-agent workflows where takeover and handoff are native

**Evidence**:
- Claude Code tab badge docs explicitly target users running multiple sessions in parallel and needing attention routing (`docs/docs/claude-code.mdx`)
- `wsh badge`, `wsh notify`, and `wsh run` already provide the primitives for status, completion, and background execution (`docs/docs/wsh-reference.mdx`)
- Badge priority rollup already exists across blocks and tabs (`frontend/app/store/badge.ts`, `docs/docs/releasenotes.mdx`)

**Effort**: High

**Risk**: If the status model is noisy or too abstract, this becomes dashboard theater instead of a daily tool.

**Score**: 🔥

### 2. Searchable Operational Memory
**What**: Turn a workspace into a searchable timeline of commands, outputs, AI exchanges, approvals, diffs, opened files, touched hosts, and notable events. Users should be able to ask "what changed before this broke?" and "what did the agent do on staging?" and get precise answers.

**Why 10x**: This removes the biggest hidden tax in modern dev work: reconstructing context. The more parallel the work becomes, the more valuable memory becomes.

**Unlocks**:
- Fast resume after sleep, restart, or interruption
- AI actions that are auditable instead of opaque
- Better onboarding, incident review, and repeat-work automation

**Evidence**:
- Saved workspaces already persist layouts plus terminal and AI histories (`docs/docs/workspaces.mdx`)
- Wave AI conversation history is already stored per block via `SaveWaveAiData` (`pkg/service/blockservice/blockservice.go`)
- Terminal state is already cached and durable SSH sessions already buffer output over disconnects (`pkg/service/blockservice/blockservice.go`, `docs/docs/durable-sessions.mdx`)

**Effort**: High

**Risk**: Storage, privacy, and retrieval quality all need to be right. Bad memory is worse than no memory.

**Score**: 🔥

### 3. Remote Environment Twins
**What**: When a user connects to a machine, Wave should be able to materialize a structured "twin" for that environment: processes, logs, ports, files, services, common actions, AI notes, and runbooks. The shell remains central, but the environment becomes inspectable and repeatable.

**Why 10x**: Remote work is already one of Wave's clearest differentiators. A host should feel like an operating surface, not just a prompt.

**Unlocks**:
- Safer and faster SSH-heavy debugging
- Better production/staging workflows without leaving the terminal context
- Reusable host-specific workflows for teams and repeated ops tasks

**Evidence**:
- Durable SSH is a headline feature and preserves shell state, jobs, and scrollback (`README.md`, `docs/docs/durable-sessions.mdx`)
- Wave already bridges local and remote files through `wsh file` and connection metadata (`docs/docs/wsh.mdx`, `docs/docs/connections.mdx`)
- Remote info RPC already exists, and remote file operations for AI are already on the roadmap (`pkg/wshrpc/wshremote/wshremote.go`, `ROADMAP.md`, `docs/docs/waveai.mdx`)

**Effort**: High

**Risk**: Linux hosts vary wildly. The first version has to target a narrow set of common environments or it will feel unreliable.

**Score**: 🔥

---

## Medium Opportunities

### 1. Unified Attention Inbox
**What**: Add a single inbox that aggregates the product's transient signals: blocked approvals, finished agent sessions, failed background commands, detached durable sessions, terminal bells, and high-priority badges. Clicking an item should jump directly to the relevant block/tab/host.

**Why 10x**: This is the shortest path from "nice badge system" to "actual orchestration tool."

**Impact**:
- Far less tab scanning
- Faster response to blocked or completed work
- A clear front door for users managing many sessions

**Evidence**:
- Badge priority, PID-linked clearing, notifications, and tab rollups are already implemented (`docs/docs/wsh-reference.mdx`, `frontend/app/store/badge.ts`)
- Durable sessions already expose meaningful session state changes (`docs/docs/durable-sessions.mdx`)

**Effort**: Medium

**Score**: 🔥

### 2. Resume Briefs
**What**: On reopening a workspace or tab, show a concise "since last open" brief: failed commands, unread badges, changed files, recent AI requests, disconnected hosts, and unfinished work.

**Why 10x**: This is likely the highest-frequency memory win and a good wedge into full operational memory.

**Impact**:
- Faster context recovery every morning or after interruption
- Less need to inspect each tab manually
- Stronger feeling that Wave "remembers my work"

**Evidence**:
- Saved workspaces already persist tabs, layout, and histories (`docs/docs/workspaces.mdx`)
- Layout model already stores tab/workspace presentation state like AI panel and tab bar widths (`frontend/app/workspace/workspace-layout-model.ts`)

**Effort**: Medium

**Score**: 🔥

### 3. Goal/Branch Workspace Templates
**What**: Go beyond static tab templates. Let users open an issue, branch, repo, or remote task and have Wave assemble the right initial workspace: terminal blocks, web docs, AI context, test runner, logs, and remote connections.

**Why 10x**: The value is not just persistence. It is eliminating setup time for repeated work.

**Impact**:
- Faster start for common tasks
- Better consistency across repeated workflows
- A bridge from manual workspaces to reusable runbooks

**Evidence**:
- Workspaces, tabs, widgets, and `wsh run/web/view/ai` already provide the composition primitives (`docs/docs/wsh.mdx`, `docs/docs/tabs.mdx`, `docs/docs/widgets.mdx`)
- The roadmap already calls out tab templates as planned, which means the direction is product-compatible (`ROADMAP.md`)

**Effort**: Medium

**Score**: 👍

### 4. Remote AI Parity
**What**: Close the remaining gap so remote SSH work gets the same quality of AI assistance as local work: remote file access, better command/result handling, and richer remote context packaging.

**Why 10x**: If Wave is strongest on remote work, AI cannot remain weakest there.

**Impact**:
- More credible AI-assisted infra and ops workflows
- Less copy/paste between remote shell and AI
- Better alignment between Wave's headline promise and daily use

**Evidence**:
- Remote file operations and command execution are still explicitly called out as coming soon (`docs/docs/waveai.mdx`, `ROADMAP.md`)
- The product already has local/remote bridging through `wsh` and durable session infrastructure (`docs/docs/wsh.mdx`, `docs/docs/durable-sessions.mdx`)

**Effort**: Medium

**Score**: 🔥

---

## Small Gems

### 1. Save This Workspace Before It Disappears
**What**: Detect meaningful unsaved workspace state and prompt to save with a smart default name.

**Why powerful**: The product already creates value before users understand the save model. Preventing accidental loss is a retention move, not just UX polish.

**Effort**: Low

**Score**: 🔥

### 2. One-Click Debug Bundle
**What**: Add a command/header action that packages the last failed command, cwd, recent scrollback, git branch, and selected relevant files into Wave AI automatically.

**Why powerful**: This is the highest-frequency context assembly task in the product.

**Effort**: Low

**Score**: 🔥

### 3. Installable Badge Recipes
**What**: Ship one-click badge recipes for common tools: Claude Code, CI watchers, deploy scripts, test runners, long builds, and remote job monitors.

**Why powerful**: It converts a powerful but somewhat hidden primitive into an immediately useful feature.

**Effort**: Low

**Score**: 👍

### 4. Detached Session Banner
**What**: Show a persistent but lightweight banner or queue item whenever a durable session is detached and accumulating output.

**Why powerful**: Users get less anxious about background work and reconnect faster when it matters.

**Effort**: Low

**Score**: 👍

---

## Recommended Priority

### Do Now
1. Unified Attention Inbox — The primitives already exist, and this makes parallel work dramatically easier without a huge platform bet.
2. One-Click Debug Bundle — High-frequency, obvious value that teaches users why Wave AI is different.
3. Save This Workspace Before It Disappears — Small effort with trust and retention payoff.
4. Resume Briefs — Best near-term wedge into operational memory.

### Do Next
1. Remote AI Parity — Needed to make Wave's strongest workflow fully coherent.
2. Goal/Branch Workspace Templates — Converts reusable setup into a product feature instead of a user habit.
3. Agent Fleet Control Plane — Start with lightweight task/status metadata on top of the inbox instead of building a giant orchestration system at once.

### Explore
1. Searchable Operational Memory — Huge upside, but only if privacy, relevance, and retrieval quality are solid.
2. Remote Environment Twins — Strong differentiation, but should start with a narrow, repeatable set of host patterns.

### Backlog
1. Full team sync or marketplace layer — Worth doing only after individual workflows prove sticky and legible.

---

## Questions

### Answered
- **Q**: Is Wave already being used as a supervision surface for multiple active sessions? **A**: Yes. The Claude Code badge integration docs explicitly describe parallel sessions as an existing user pattern (`docs/docs/claude-code.mdx`).
- **Q**: Does the product already have the control primitives for orchestration? **A**: Yes. `wsh`, badges, notifications, widgets, workspaces, and durable SSH collectively form a real control plane foundation (`docs/docs/wsh.mdx`, `docs/docs/wsh-reference.mdx`, `docs/docs/durable-sessions.mdx`).
- **Q**: Is remote still a core wedge worth doubling down on? **A**: Yes. Durable SSH plus local/remote bridging is one of the clearest ways Wave stands apart from generic AI chat tools and terminal emulators (`README.md`, `docs/docs/connections.mdx`).

### Blockers
- **Q**: Which user segment is more valuable right now: AI-heavy local coders or SSH-heavy infra users? Need telemetry and user interviews.
- **Q**: What should the first-class status model be for the inbox: task, block, job, or agent? Need product definition work before implementation.
- **Q**: How much operational memory can Wave retain locally before privacy or performance becomes a problem? Need retention and indexing constraints.

## Next Steps
- [ ] Audit current telemetry and issue history for signs of parallel-session pain versus remote-work pain.
- [ ] Spec a Unified Attention Inbox using existing badge and notification primitives before inventing new infrastructure.
- [ ] Prototype One-Click Debug Bundle as a narrow, high-frequency AI workflow.
- [ ] Define the smallest useful Resume Brief using existing saved workspace and AI history data.
- [ ] Choose one remote environment archetype for a Remote Environment Twin MVP, such as a Linux app server or deployment box.
