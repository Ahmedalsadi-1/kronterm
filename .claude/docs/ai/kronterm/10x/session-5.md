# 10x Analysis: KronTerm Enterprise Productization
Session 5 | Date: 2026-06-01

## Current Value

KronTerm is no longer missing ambitious features. It already combines a block workspace, terminal, durable sessions, browser views, sandbox desktops, desktop app streams, AI chat, ACP runtimes, skills, MCP configuration, settings, workspace switching, tab organization, and agent activity overlays.

The product problem has changed:

> KronTerm currently feels like a collection of powerful experiments. It needs to feel like one dependable professional work environment.

The gap is not visual polish alone. Enterprise-grade products communicate a stable mental model:

- What project am I in?
- What is running?
- What can the agent see and control?
- What changed?
- What is healthy, degraded, or unavailable?
- Can I resume, restore, audit, and share my work?

KronTerm exposes too many implementation details and too few product-level guarantees. The user sees tabs, blocks, widgets, agent sessions, providers, MCP servers, sandbox sessions, desktop endpoints, browser blocks, streams, and settings sections, but these do not yet resolve into one clear operating model.

### Codebase Evidence

- The browser widget has a real Electron webview UI with navigation, URL entry, bookmark suggestions, mobile user-agent support, and external browser opening (`frontend/app/view/webview/webview.tsx:47-211`).
- The newer Go browser tool layer is still placeholder-level: its handlers validate a block ID and return strings such as "Clicked element" without controlling or inspecting the browser (`pkg/tool/browser/browser.go:20-112`).
- Sandbox behavior is split between QEMU and a `kronterm-desktop` endpoint, with hardcoded defaults such as `http://localhost:9990` and `wave123` (`pkg/sandbox/manager/sandbox.go:29-34`, `pkg/sandbox/manager/sandbox.go:122-136`).
- App streaming launches macOS apps, starts a per-session local HTTP server, and repeatedly requests screenshots (`pkg/wshrpc/wshserver/appstream.go:31-110`). The frontend polls PNG screenshots every 300 ms and draws them to a canvas (`frontend/app/view/appstream/appstream.tsx:7-70`).
- Workspace switching exists, but it is primarily a saved-window switcher with icon, color, rename, and delete actions (`frontend/app/tab/workspaceswitcher.tsx:52-153`).
- ACP chat is much more capable than a basic sidebar: it supports multiple runtimes, profiles, models, modes, files, permissions, stored sessions, and resume states (`frontend/app/aipanel/use-acp-session.ts:22-123`, `frontend/app/aipanel/use-acp-session.ts:335-389`).
- The settings surface is broad, but portions are still presentation-only. Skills and shortcuts are currently hardcoded arrays rather than live system state (`frontend/app/view/kronsettings/kronsettings-skills.tsx`, `frontend/app/view/kronsettings/kronsettings-shortcuts.tsx`).
- Tab groups have a UI component and local fold state, while the active vertical tab bar still renders a flat ordered `workspace.tabids` list (`frontend/app/tab/tabgroup.tsx:19-136`, `frontend/app/tab/vtabbar.tsx:179-206`).

## The Question

How does KronTerm stop feeling AI-generated and become a professional application that can credibly stand beside Warp, Turborepo-era developer tools, IDEs, and serious operations consoles?

The answer is not "add more features."

The answer is:

1. Establish one product model.
2. Make core surfaces reliable and observable.
3. Remove visible experiments from default workflows.
4. Ship differentiated autonomy only after trust, recovery, and auditability are first-class.

---

## Product Position

KronTerm should not market itself as a terminal with many extras.

It should become:

> **The agentic engineering workspace: one project cockpit for terminals, browsers, environments, desktop apps, and AI execution.**

The professional wedge is not "AI chat inside a terminal." That is easy to copy.

The differentiated wedge is:

> **A resumable, inspectable workspace where humans and agents operate the same surfaces with clear permissions and a complete activity record.**

That is harder to copy because it requires the workspace shell, runtime model, agent model, browser control, sandbox lifecycle, desktop projection, and recovery model to work as one system.

---

## Product Principles

### 1. Projects Above Everything

Users should open a **Project**, not assemble disconnected tabs and blocks.

A project owns:

- Repository roots and remote connections
- Workspace layouts
- Tabs and grouped tasks
- Browser profiles and pinned pages
- Sandbox environments
- Agent sessions and permissions
- Activity history
- Snapshots and restore points

### 2. Surfaces, Not Special Cases

Terminal, browser, sandbox desktop, streamed native app, file preview, and editor should all be treated as **surfaces** with a consistent contract:

```text
observe -> inspect -> act -> wait -> verify -> snapshot -> restore
```

### 3. Status Must Be Legible

Every long-lived object needs a clear lifecycle:

```text
starting -> ready -> busy -> degraded -> failed -> stopped
```

Avoid exposing raw endpoints, MCP URLs, localhost ports, and runtime plumbing in the default UI. Those belong in diagnostics.

### 4. Autonomy Requires Trust

Any feature that lets AI act must answer:

- What is it doing now?
- What will it do next?
- What permission allowed it?
- What changed?
- How do I undo it?
- Can I inspect the record later?

### 5. Default UI Must Be Restrained

Professional does not mean more controls. It means the common path is calm and predictable, while advanced controls remain discoverable.

---

## Massive Opportunities

### 1. Project Cockpit: Replace Workspace Assembly With a Resumable Operating Context

**What**: Elevate the existing workspace system into a first-class project cockpit. Opening a project restores tabs, block layout, running terminals, browser profile, pinned pages, active environment, agent sessions, recent activity, and permission policy.

**Why 10x**: This makes KronTerm the place where work resumes, not another application users configure after opening their editor and terminal.

**Unlocks**:

- "Open checkout-service" and resume the complete working state
- Project templates for frontend, backend, incident response, and research
- Clear separation between persistent project state and temporary scratch work
- Team-shareable cockpit definitions later

**Professional baseline**:

- Recent projects landing page
- Create/import project flow
- Restore last session
- Named cockpit layouts
- Environment health summary
- Activity timeline
- Search across tabs, commands, files, sessions, and browser pages

**Effort**: High
**Risk**: Existing workspace, tab, ACP workspace, and block concepts overlap. They need one canonical ownership model.
**Score**: MUST DO

### 2. Universal Surface Runtime: One Contract for Browser, Sandbox, Desktop, Terminal, and Files

**What**: Define and enforce a common runtime contract for every controllable surface:

```text
surface.list
surface.describe
surface.snapshot
surface.inspect
surface.act
surface.wait
surface.verify
surface.history
surface.close
```

Each surface publishes capabilities, health, permissions, and activity events.

**Why 10x**: KronTerm currently has real capability distributed across separate paths. A common runtime turns isolated demos into a platform.

**Unlocks**:

- One agent execution model across all surfaces
- One activity timeline
- One permission system
- One diagnostics model
- One plugin API for future integrations

**Evidence**:

- Webview behavior lives in Electron/React (`frontend/app/view/webview/webview.tsx`).
- Browser Go tools currently return placeholder strings (`pkg/tool/browser/browser.go:20-112`).
- Desktop control and app streams use separate tool paths (`pkg/tool/desktop/desktop.go`, `pkg/wshrpc/wshserver/appstream.go`).
- Sandbox control has QEMU, desktop endpoint, MCP, and VNC paths (`pkg/sandbox/manager/sandbox.go`, `emain/sandbox/`).

**Effort**: Very High
**Risk**: A vague abstraction will make the system harder to debug. Start with explicit capability manifests and typed results.
**Score**: MUST DO

### 3. Agent Run Center: Make Autonomy Inspectable, Recoverable, and Professional

**What**: Replace chat-centric agent visibility with a run center. Chat remains the input method, but every delegated task becomes a structured run with:

- Objective
- Plan and current step
- Active surface
- Pending approvals
- Tool activity timeline
- Diffs and artifacts
- Cost and token usage
- Checkpoints
- Stop, pause, resume, retry, and rollback

**Why 10x**: Chat is not a sufficient UI for long-running work. Serious users need to monitor execution without reading every message.

**Unlocks**:

- "Fix failing tests" as a trackable run
- Background tasks with notifications
- Failed-step recovery
- Audit history for teams
- A visible quality gap over generic chat sidebars

**Evidence**:

- ACP runtimes already store status, sessions, messages, confirmations, usage, capabilities, resume state, and timestamps (`frontend/app/aipanel/use-acp-session.ts:85-123`).
- The chat panel already renders live surface activity and runtime strips (`frontend/app/aipanel/acp-chat-panel.tsx`).

**Effort**: High
**Risk**: If execution itself remains unreliable, a run center only makes failures more visible. Ship alongside surface-runtime reliability.
**Score**: MUST DO

### 4. Managed Environments: Turn Sandbox Into a Real Development Environment Product

**What**: Replace "sandbox block" with managed environments:

- Local sandbox
- Dev container
- Remote SSH host
- Ephemeral cloud sandbox later
- Desktop VM where needed

Each environment has image/profile, CPU and memory, mounts, ports, secrets, lifecycle, snapshot, logs, and health.

**Why 10x**: Developers do not want to think about VNC URLs, QEMU images, localhost ports, or setup scripts. They want a ready environment attached to a project.

**Unlocks**:

- One-click reproducible environments
- "Run this safely in a clean environment"
- Snapshot before risky changes
- Shareable environment profiles
- Reliable agent execution boundary

**Evidence**:

- The current manager exposes QEMU allocation and a `kronterm-desktop` runtime (`pkg/sandbox/manager/sandbox.go:50-86`, `pkg/sandbox/manager/sandbox.go:148-239`).
- The Electron sandbox path still requires local images and reports "Please run setup script" (`emain/sandbox/sandbox-manager.ts`).

**Effort**: High
**Risk**: Cross-platform virtualization is expensive. Start with a polished local profile and dev-container path before broad VM matrices.
**Score**: MUST DO

### 5. Team Control Plane: Enterprise Is a Deployment Model, Not a Theme

**What**: Build the organizational layer after the single-user cockpit is stable:

- Organization workspaces
- Policy-managed agent permissions
- Shared project cockpit templates
- Shared environment profiles
- Audit export
- SSO and role-based access
- Secret scopes
- Admin diagnostics
- Usage and cost controls

**Why 10x**: "Enterprise" is not achieved by making the interface darker or denser. Teams pay for governance, repeatability, and controlled deployment.

**Unlocks**:

- Security review viability
- Managed rollout
- Shared operational workflows
- Team onboarding
- Paid enterprise tier

**Effort**: Very High
**Risk**: Premature enterprise infrastructure can consume the roadmap before the core product is dependable.
**Score**: EXPLORE AFTER CORE

---

## Medium Opportunities

### 1. Browser Workbench

**What**: Promote the browser from an inline webview into a browser workbench:

- Tab strip within the browser surface
- Named browser profiles per project
- Auth/session persistence
- DevTools toggle
- DOM and accessibility inspection
- Element references for agents
- Network and console panel
- Screenshot and replay history
- "Pin page to project"
- Preview mode and automation mode

**Why high leverage**: Browser work is central to engineering: docs, localhost previews, dashboards, cloud consoles, admin panels, and QA. A dependable embedded browser differentiates KronTerm immediately.

**Required correction**: Do not market browser automation until `browser_click`, `browser_type`, `browser_screenshot`, `browser_scroll`, and `browser_fill_form` return real typed results and verify outcomes. The current Go tool layer is still placeholder behavior (`pkg/tool/browser/browser.go:39-112`).

**Effort**: Medium-High
**Score**: MUST DO

### 2. Streaming Transport Upgrade

**What**: Replace screenshot polling as the primary app-stream transport with a proper low-latency stream:

- WebRTC or H.264/WebCodecs transport
- Adaptive frame rate
- Dirty-region updates where practical
- Input acknowledgement
- Reconnect and degraded-state UI
- Stream metrics in diagnostics

**Why high leverage**: Polling a full PNG screenshot every 300 ms is useful for a prototype but will feel laggy and expensive under real use (`frontend/app/view/appstream/appstream.tsx:7-70`).

**Effort**: Medium-High
**Score**: MUST DO BEFORE BROAD DESKTOP STREAMING

### 3. Semantic Desktop Control Before Pixel Control

**What**: Build a layered desktop connector strategy:

```text
native API / MCP -> accessibility tree -> app-specific adapter -> OCR -> pixel fallback
```

**Why high leverage**: Pixel clicking is brittle. Professional automation needs semantic targets, deterministic state, and post-action verification.

**Evidence**: The existing desktop tool path is macOS-only AppleScript and coordinates (`pkg/tool/desktop/desktop.go:28-99`), while screen recall optionally depends on Screenpipe (`pkg/tool/screen/screen.go:12-45`).

**Effort**: Medium
**Score**: STRONG

### 4. Information Architecture Cleanup

**What**: Reduce the number of top-level concepts visible at once.

**Recommended shell**:

```text
Project
  Overview
  Workspaces
  Environments
  Runs
  Activity

Main canvas
  Tabs
  Surfaces

Right panel
  Assistant
  Context
  Approvals

Settings
  App
  Integrations
  Agent runtime
  Policies
  Diagnostics
```

**Why high leverage**: The app currently exposes overlapping views for settings, ACP, Kronos snapshots, widgets, workspaces, and runtimes. A restrained shell will do more for perceived quality than another effect or sidebar.

**Effort**: Medium
**Score**: MUST DO

### 5. Real Tab and Task Organization

**What**: Finish tab grouping as persistent project structure:

- Named groups
- Drag tabs between groups
- Persisted group order
- Nested groups only if validated by usage
- Search and quick switcher
- Close, archive, and restore group
- Activity badges based on real status

**Why high leverage**: Tabs are daily workflow infrastructure. Grouping is valuable when it persists and participates in project restore.

**Evidence**: `TabGroup` exists, but the active vertical bar still operates on flat `workspace.tabids` (`frontend/app/tab/tabgroup.tsx:19-136`, `frontend/app/tab/vtabbar.tsx:184-206`).

**Effort**: Medium
**Score**: STRONG

### 6. Settings Must Reflect Reality

**What**: Make every settings section live, searchable, validated, and connected to actual runtime state.

**Required behavior**:

- Search settings
- Show source: default, user, project, policy
- Validate before save
- Show restart requirement
- Show connection test for integrations
- Keep raw config as an advanced escape hatch
- Remove hardcoded feature inventories from user-facing settings

**Evidence**: Some current settings sections render static arrays, including skills and shortcuts (`frontend/app/view/kronsettings/kronsettings-skills.tsx`, `frontend/app/view/kronsettings/kronsettings-shortcuts.tsx`).

**Effort**: Medium
**Score**: MUST DO

### 7. Command Palette and Global Search

**What**: Add one keyboard-first entry point for:

- Open project
- Switch workspace
- Find tab
- Find surface
- Launch environment
- Run command
- Ask agent
- Resume run
- Open setting
- Search activity

**Why high leverage**: Professional developer tools become fast when users can drive them without hunting through UI.

**Effort**: Medium
**Score**: MUST DO

### 8. Diagnostics Center

**What**: Move internal endpoints and health checks into a dedicated diagnostics surface:

- KronosCode runtime
- ACP backends
- MCP servers
- Desktop connector
- Sandbox runtime
- Stream quality
- Browser preload
- Permissions
- Logs and export bundle

**Why high leverage**: Internal plumbing should remain inspectable without leaking into the default experience.

**Effort**: Medium
**Score**: STRONG

---

## Small Gems

### 1. Replace Raw Endpoint Text With Product Status

**What**: Default UI shows "Desktop control ready" or "Needs setup"; diagnostics shows URLs and ports.
**Why powerful**: Removes prototype language immediately.
**Effort**: Low
**Score**: MUST DO

### 2. Add Empty States With One Primary Action

**What**: Every empty panel answers what it is for and offers one next action.
**Why powerful**: Prevents unfinished-looking blank surfaces.
**Effort**: Low
**Score**: MUST DO

### 3. Standardize Loading, Error, Degraded, and Reconnect States

**What**: Use one status component across streams, sandboxes, browsers, MCP, and agents.
**Why powerful**: Consistency reads as product maturity.
**Effort**: Low
**Score**: MUST DO

### 4. Add Project Breadcrumbs

**What**: Show `Project / Workspace / Tab / Surface` consistently.
**Why powerful**: Users always know where actions will apply.
**Effort**: Low
**Score**: STRONG

### 5. Add "Send Surface to Agent"

**What**: One scoped action from any surface header.
**Why powerful**: Converts context gathering into a direct interaction.
**Effort**: Low
**Score**: MUST DO

### 6. Add Undo and Restore Visibility

**What**: Show a persistent restore-point indicator before risky agent actions.
**Why powerful**: Confidence increases delegation.
**Effort**: Low-Medium
**Score**: MUST DO

### 7. Remove Decorative Effects From Default Mode

**What**: Keep glow, aura, animated cursor, pet, and experimental overlays behind a personalization or labs setting.
**Why powerful**: Default product presentation becomes calmer and more credible.
**Effort**: Low
**Score**: MUST DO

### 8. Add Onboarding Health Check

**What**: First-run flow verifies shell, agent runtime, desktop permissions, browser preload, sandbox availability, and MCP status.
**Why powerful**: Setup failures become guided fixes instead of mysterious partial functionality.
**Effort**: Low-Medium
**Score**: STRONG

---

## What To Stop Doing

### Stop Shipping More Visible Experimental Surfaces

Do not add more top-level widgets, panels, pets, overlays, agent badges, or settings sections until the existing shell is coherent.

### Stop Exposing Infrastructure as Product UI

Hide localhost endpoints, VNC details, MCP URLs, transport names, raw provider payloads, and runtime internals from default workflows.

### Stop Treating Chat as the Product

Chat is an input surface. The product is the project cockpit, shared surface runtime, and run center.

### Stop Styling Placeholder Behavior

Do not spend more time decorating browser automation, app streaming, or sandbox controls until actions are typed, verified, recoverable, and tested end-to-end.

### Stop Using "Enterprise" as a Visual Target

Enterprise means governance, repeatability, auditability, recovery, diagnostics, and supportability.

---

## Recommended Priority

### Do Now: Productization Freeze

1. **Write the canonical product model**: Project -> Workspace -> Tab -> Surface -> Run -> Activity.
2. **Define the universal surface runtime contract** with typed capabilities, status, permissions, actions, and verification.
3. **Move experiments behind Labs**: decorative agent aura, pixel effects, pet, unfinished settings sections, raw endpoints, and placeholder automation.
4. **Create one status system** for loading, ready, busy, degraded, failed, reconnecting, and stopped.
5. **Build the diagnostics center** and relocate runtime plumbing there.
6. **Finish real browser automation** before expanding the browser feature list.
7. **Replace hardcoded settings inventories** with runtime-backed data.

### Do Next: Professional Daily Workflow

1. **Ship the Project Cockpit** with recent projects, restore, templates, snapshots, and environment health.
2. **Ship command palette and global search** across projects, tabs, surfaces, sessions, settings, and activity.
3. **Finish persistent tab groups** and archive/restore workflows.
4. **Turn sandbox into managed environments** with profiles, snapshots, logs, mounts, and guided setup.
5. **Ship the Agent Run Center** with approvals, checkpoints, diffs, artifacts, pause, retry, and rollback.
6. **Upgrade app streaming transport** before positioning desktop streaming as a primary capability.

### Explore: Differentiated Bets

1. **Task Cockpit Templates**: reusable project layouts, environments, pinned surfaces, agent profiles, and permissions.
2. **Cross-device environments**: local machine, remote SSH, container, and cloud sandbox under one project.
3. **Team cockpit sharing**: shared templates, policy bundles, activity export, and audit trails.
4. **Semantic app connectors**: browser DOM, accessibility tree, GitHub, Linear/Jira, cloud consoles, and IDE bridges.
5. **Workspace replay**: scrub the timeline of surface states, tool calls, terminal commands, diffs, and approvals.

### Backlog

1. **Native app embedding beyond streaming**: useful but OS-specific and expensive.
2. **Deep nested tab trees**: validate simple groups first.
3. **Marketplace expansion**: wait until the surface contract and diagnostics model are stable.
4. **Additional visual themes and effects**: polish after information architecture is calm.

---

## 90-Day Productization Plan

### Days 1-30: Make the App Legible

- Freeze new visible features.
- Write the canonical project and surface model.
- Add Labs gating for experimental visuals and incomplete surfaces.
- Standardize status, error, reconnect, and empty states.
- Add diagnostics center.
- Remove raw endpoints from default UI.
- Make settings searchable and remove hardcoded inventories.
- Create a real browser automation end-to-end test path.

### Days 31-60: Make the Daily Workflow Cohesive

- Launch Project Cockpit v1.
- Restore layouts, tabs, surfaces, ACP sessions, and environment links.
- Add global command palette and search.
- Finish persistent tab groups.
- Add environment setup wizard and snapshot controls.
- Add "Send Surface to Agent" everywhere.

### Days 61-90: Make Delegation Trustworthy

- Launch Agent Run Center v1.
- Add structured plans, approval queue, active-surface display, checkpoints, diffs, and rollback.
- Add activity timeline.
- Upgrade desktop stream reconnect and metrics; begin transport replacement.
- Add project templates for frontend debugging, backend development, incident response, and research.

---

## Quality Gates

Do not call a surface production-ready until:

1. It has a typed capability manifest.
2. It reports lifecycle status.
3. It has guided setup.
4. It has deterministic error states.
5. It can reconnect or recover.
6. Agent actions return typed results.
7. Agent actions verify outcomes.
8. Risky actions honor permission policy.
9. Actions appear in activity history.
10. The surface has an end-to-end test covering the primary workflow.

---

## The Most Important Call

KronTerm should spend the next cycle **removing ambiguity**, not adding surface area.

The best version of the product is not the one with the most visible AI features. It is the one where a user opens a project, sees a calm and trustworthy cockpit, delegates a task, watches a structured run, and can inspect or undo every meaningful action.

That is how KronTerm stops feeling like a side project and starts feeling like a serious engineering platform.

---

## Questions

### Answered

- **Q**: Does KronTerm need more features to stand out?
  **A**: No. It needs product unification, reliability, recovery, and a clear project-level operating model.

- **Q**: What is the strongest differentiator?
  **A**: A resumable project cockpit where humans and agents operate the same surfaces with permissions, verification, and activity history.

- **Q**: Should browser, sandbox, streaming, desktop, workspace, tabs, and chat be improved independently?
  **A**: No. They should converge on the universal surface runtime and project cockpit.

- **Q**: What creates the "AI-made" feeling?
  **A**: Too many visible experiments, raw infrastructure leaking into UI, overlapping concepts, static settings content, inconsistent status behavior, and styled surfaces whose reliability model is incomplete.

### Blockers

- **Q**: Who is the first paid user: individual power developers, startup engineering teams, or enterprise platform teams?
- **Q**: Is KronTerm primarily local-first with optional team governance, or should managed cloud collaboration become a near-term requirement?
- **Q**: Which single end-to-end workflow should become the proof point: browser QA, sandbox coding, incident response, or autonomous code repair?

## Next Steps

- [ ] Decide the first paid user and proof-point workflow.
- [ ] Write the Project, Surface, Run, and Activity schemas.
- [ ] Audit every visible feature into `core`, `labs`, or `diagnostics`.
- [ ] Define the browser workbench v1 acceptance criteria.
- [ ] Define the managed environment v1 acceptance criteria.
- [ ] Prototype the Agent Run Center from existing ACP runtime state.
