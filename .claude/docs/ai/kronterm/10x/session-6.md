# 10x Analysis: KronTerm Visual Intelligence, Pet, and Tooling
Session 6 | Date: 2026-06-01

## Current Value

KronTerm and KronosCode already contain the raw ingredients for a differentiated agentic engineering workspace:

- ACP runtime sessions, structured tool calls, approvals, agent status, model selection, MCP injection, and session restore.
- Native Wave tools for files, terminal, browser, sandbox desktop, and widget interaction.
- KronosCode discovery for providers, model capabilities, selected tools, connector metadata, risk levels, and fallbacks.
- A desktop pet with idle and walking animation, activity text, thoughts, chat, click-through, reasoning history, screenshot preview, roaming, and cursor-follow options.
- A full-screen overlay capable of rendering click, type, scroll, drag, hover, trace, wait, and cursor-position animations.
- In-product activity UI: ACP tool cards, runtime strips, a live surface strip, block-level activity events, and agent-facing context ribbons.

The product is not short on indicators or tools. It is short on a single truth that makes all of them coherent.

Today, one agent action can be represented through several separate paths:

```text
ACP event
  -> chat tool card
  -> Electron desktop-pet state
  -> full-screen overlay animation

frontend reportDesktopPetActivity()
  -> Electron desktop-pet state
  -> browser CustomEvent for live surface strip
  -> browser CustomEvent for block-level widget activity
  -> optional localhost POST /pet/activity
```

The result is visually ambitious but structurally fragmented. Users may see motion without understanding the run, a tool without understanding its source, or a pet state inferred from a tool title rather than emitted by a canonical activity model.

### Codebase Evidence

- The desktop pet receives ACP events directly and derives context, cursor action, and overlay animation by regex matching tool titles (`emain/emain-pet.ts`).
- The frontend independently derives surface, action, cursor state, and points from tool details and input fields (`frontend/app/aipanel/desktop-pet-activity.ts`).
- The ACP panel renders a live surface strip from browser events while also rendering separate tool-call cards and runtime status dots (`frontend/app/aipanel/acp-chat-panel.tsx`).
- The overlay is a distinct Electron window with its own animation command union and lifecycle (`emain/emain-overlay.ts`, `frontend/overlay/overlay.ts`).
- Wave tab tools are assembled dynamically based on visible blocks (`pkg/aiusechat/tools.go`).
- A Wave tool registry exists, but it classifies only the tool definitions passed into it and currently derives pack and risk from names (`pkg/aiusechat/capabilities.go`, `pkg/aiusechat/toolregistry/`).
- KronosCode discovery separately exposes providers, selected tools, connectors, risk levels, interactivity, and fallback routes (`pkg/aiusechat/kronos-discovery.go`).
- MCP has configuration and client code, while the user-facing WSH RPC handlers still return placeholder inventory and status data (`pkg/mcp/`, `pkg/wshrpc/wshserver/wshserver.go`).
- ACP session startup separately injects the temporary Wave surface MCP server and configured MCP servers (`emain/acp/acp-agent-manager.ts`).

## The Question

How do KronTerm and KronosCode turn visual indicators, the pet, and a large tool inventory into one polished product advantage?

The answer is not more decorative animation and not a longer tool list.

The answer is:

> Build one agent activity nervous system and one capability control plane. Make every visual surface, including the pet, a trustworthy projection of those systems.

---

## Product Position

KronTerm should make agent work feel spatial, legible, and controllable:

> **See what the agent can do. See what it is doing. Know why it is doing it. Take control instantly.**

KronosCode remains the deep agent runtime. KronTerm becomes the cockpit. The pet becomes the optional ambient embodiment of the active run, not a parallel product and not a source of truth.

## Canonical Model

### CapabilityGraph

Every tool, connector, MCP server, runtime, and surface capability should resolve into one graph:

```text
Capability
  id
  canonicalAction
  label
  description
  source
  connector
  surfaceKinds
  risk
  permissionPolicy
  availability
  health
  setupState
  inputSchema
  outputSchema
  verificationStrategy
  fallbackChain
  provenance
```

Sources include:

```text
wave-native | kronos-native | acp-client | mcp | plugin | surface-runtime
```

Availability is not a boolean. Use a lifecycle:

```text
unknown -> discovering -> ready -> busy -> degraded -> failed -> disabled -> needs-setup
```

### ActivityStream

Every meaningful action should publish a canonical event:

```text
ActivityEvent
  id
  runId
  parentId
  timestamp
  phase
  category
  action
  actor
  capabilityId
  connectorId
  surfaceRef
  summary
  detail
  risk
  permission
  progress
  target
  result
  verification
  artifactRefs
  error
  presentationHints
```

Phases:

```text
queued -> awaiting-approval -> running -> verifying -> succeeded
                                     -> degraded
                                     -> failed
                                     -> cancelled
```

Every projection consumes these same events:

```text
ActivityStream
  -> Agent Run Center
  -> chat tool cards
  -> global status island
  -> surface ribbons
  -> block highlights
  -> desktop overlay
  -> pet
  -> audit timeline
  -> replay
```

This is the centralization move. It converts scattered UI effects into a product system.

---

## Massive Opportunities

### 1. Agent Activity Nervous System

**What**: Replace regex-derived presentation state with a typed activity stream shared by KronosCode, ACP, Wave-native tools, MCP tools, surface runtimes, and Electron overlays.

**Why 10x**: The product stops merely showing that an agent is active and starts explaining the agent's work consistently everywhere. Trust improves because status, approval, target, progress, verification, and outcome no longer disagree between surfaces.

**Unlocks**:

- One timeline for chat, pet, overlays, terminal actions, browser actions, file edits, and desktop control.
- Replay and audit without building a second telemetry system.
- Run-level progress summaries such as `7 / 9 steps complete`.
- Reliable stop, inspect, retry, and rollback controls.
- Reduced motion and accessibility variants without changing tool execution.

**Effort**: High
**Risk**: A generic event schema can become vague. Keep a small stable envelope and typed payloads per action family.
**Score**: MUST DO

### 2. Capability Control Plane

**What**: Merge Wave tool generation, the Wave registry, KronosCode discovery snapshots, MCP server inventory, ACP client capabilities, connector health, and surface capabilities into a single searchable graph.

**Why 10x**: Users and agents both gain a truthful answer to: "What can this workspace do right now?" Tooling becomes composable and diagnosable rather than hidden behind runtime-specific paths.

**Unlocks**:

- Searchable tool palette grouped by intent rather than implementation.
- Per-project tool packs and permission presets.
- Connector diagnostics with guided setup.
- Fallback routing visible before failure.
- Tool usage analytics and quality scoring.
- A stable plugin contract.

**Effort**: High
**Risk**: Blindly unifying names can erase meaningful distinctions. Canonicalize intent while preserving source-specific implementations and provenance.
**Score**: MUST DO

### 3. Pet as Ambient Run Companion

**What**: Reframe the pet as an optional, calm, context-aware companion for the active run. It consumes `ActivityStream` and shows only the information appropriate for ambient display.

**Why 10x**: The pet becomes useful rather than decorative. It answers the user's highest-frequency questions without requiring the AI panel to remain open:

- Is the agent working?
- What is it doing?
- Does it need me?
- Did it succeed?
- Is it safe to leave running?

**Unlocks**:

- A memorable product identity without sacrificing professional default UX.
- Peripheral awareness for background tasks.
- Approval and failure handoff with one click.
- Optional personality packs and accessibility modes later.

**Professional rule**: The pet is a projection of run state. It never invents status, exposes raw reasoning, or competes with the primary workspace.

**Effort**: Medium
**Risk**: Persistent motion can feel noisy or unserious. Default to docked, restrained, reduced-motion behavior; keep expressive behavior opt-in.
**Score**: MUST DO

### 4. Tool Quality Flywheel

**What**: Track every capability's execution count, latency, success rate, approval friction, fallback rate, verification rate, and common failure reasons. Surface this privately in diagnostics and use it to prioritize fixes and route tools.

**Why 10x**: A large tool inventory is not a moat. A tool system that continuously becomes more reliable is a moat.

**Unlocks**:

- Automatic routing toward the most reliable implementation.
- Detection of broken MCP servers and stale tools.
- "Needs setup" and "degraded" states backed by evidence.
- Prioritized engineering work based on actual failure frequency.

**Effort**: Medium-High
**Risk**: Telemetry must remain local-first by default and explicit if exported.
**Score**: STRONG

---

## Medium Opportunities

### 1. Indicator Hierarchy With Progressive Disclosure

**What**: Standardize five levels of visual feedback:

| Level | Surface | Purpose |
| --- | --- | --- |
| Ambient | pet, dock badge, status island | answer "is anything happening?" |
| Workspace | top-level run strip | show active run, phase, progress, approval |
| Surface | block ribbon, border, cursor overlay | show where the agent is acting |
| Detail | tool card, approval card, diff, terminal output | show exact action and result |
| Audit | timeline, replay, diagnostics | explain history and failures |

**Why 10x**: Users get the right amount of information at the right distance. Every indicator earns its place.

**Impact**: Less visual noise, faster comprehension, and a calmer default UI.
**Effort**: Medium
**Score**: MUST DO

### 2. Semantic Tool Families

**What**: Present tools by intent:

```text
Code       read, search, edit, patch, review, test
Terminal   inspect, run, wait, capture output
Browser    navigate, inspect, interact, verify
Desktop    observe, focus, interact, verify
Workspace  list, open, arrange, snapshot, restore
Research   search, fetch, cite
System     notify, schedule, delegate, diagnose
```

Implementation-specific tools remain available in diagnostics and advanced mode.

**Why 10x**: Users should choose outcomes, not memorize tool prefixes. Agents also receive a smaller, more relevant capability set per context.

**Impact**: Better discovery, fewer redundant tool choices, less prompt bloat, and cleaner permissions.
**Effort**: Medium
**Score**: MUST DO

### 3. Capability Palette and Tool Inspector

**What**: Add a searchable palette showing tool families, enabled packs, source, health, setup state, risk, permissions, recent use, and fallbacks. Each capability opens an inspector.

**Why 10x**: Tooling becomes visible and understandable without leaking ports, transport details, or raw schemas into default flows.

**Impact**: Users can answer "why can the agent not do this?" without reading logs.
**Effort**: Medium
**Score**: STRONG

### 4. Pet State Machine and Visual Grammar

**What**: Give the pet a small deliberate state machine:

```text
docked-idle
observing
thinking
acting
verifying
waiting-for-user
succeeded
degraded
failed
paused
```

Use a consistent grammar:

- Color conveys lifecycle, not tool type.
- Icon conveys action family.
- Motion intensity conveys urgency.
- Text is one short verb phrase.
- Clicking opens the relevant run, approval, surface, or failure.

**Why 10x**: The pet stops overloading users with raw event detail and becomes instantly learnable.

**Impact**: Professional polish and useful ambient awareness.
**Effort**: Medium
**Score**: MUST DO

### 5. Verified Action Feedback

**What**: Distinguish `acting` from `verifying` and `succeeded`. A click animation means "attempted click"; success appears only when the surface runtime verifies the expected result.

**Why 10x**: The current visual effects can imply success when they only represent intent. Verified feedback is the trust difference between a demo and an automation product.

**Impact**: Less false confidence and easier diagnosis.
**Effort**: Medium
**Score**: MUST DO

### 6. Project Tool Packs

**What**: Persist tool packs, MCP servers, runtime requirements, and permission defaults per project template:

```text
Frontend QA
Backend Development
Incident Response
Research
Desktop Automation
Restricted Production
```

**Why 10x**: Tool setup becomes repeatable. The product configures itself around the job.

**Impact**: Faster onboarding and safer delegation.
**Effort**: Medium
**Score**: STRONG

### 7. One Diagnostics Center

**What**: Move raw endpoints, MCP transport state, sandbox MCP URLs, connector routing, capability schemas, last errors, and health probes into one diagnostics center.

**Why 10x**: The default UI stays calm while advanced users retain full inspectability.

**Impact**: Product polish without hiding failures.
**Effort**: Medium
**Score**: MUST DO

---

## Small Gems

### 1. Approval Beacon
**What**: When any run needs approval, the pet, run strip, and relevant tool card use one amber state and one action: `Review`.
**Why powerful**: Users stop hunting for the blocked action.
**Effort**: Low
**Score**: MUST DO

### 2. Click Pet to Resume Context
**What**: Clicking the pet opens the active run or focuses the surface where the agent is acting.
**Why powerful**: Converts ambient awareness into immediate control.
**Effort**: Low
**Score**: MUST DO

### 3. Quiet Mode
**What**: Add `Off`, `Status only`, `Docked`, and `Expressive` pet modes plus reduced-motion support.
**Why powerful**: Makes a distinctive feature acceptable in professional environments.
**Effort**: Low
**Score**: MUST DO

### 4. Tool Health Summary
**What**: Show `42 ready`, `3 need setup`, `1 degraded` instead of a flat tool count.
**Why powerful**: A count becomes actionable confidence.
**Effort**: Low
**Score**: MUST DO

### 5. Explain This Indicator
**What**: Every non-obvious status opens a short explanation with run, tool, target, and next action.
**Why powerful**: Removes ambiguity without permanent UI clutter.
**Effort**: Low
**Score**: STRONG

### 6. Recent Tool Trail
**What**: Keep the last five actions in a compact expandable strip: `read -> edit -> test -> verify`.
**Why powerful**: Gives users a mental model of progress at a glance.
**Effort**: Low
**Score**: STRONG

### 7. Source Badge Only When It Matters
**What**: Default cards show intent. Show `Wave native`, `Kronos native`, `MCP`, or fallback routing only on inspect, setup, or failure.
**Why powerful**: Preserves diagnostics while removing implementation noise.
**Effort**: Low
**Score**: MUST DO

### 8. Pet Success Restraint
**What**: Use a brief success acknowledgement, then return to idle. No persistent celebration.
**Why powerful**: Keeps delight compatible with daily professional use.
**Effort**: Low
**Score**: STRONG

---

## Ruthless Evaluation

| Opportunity | Impact | Reach | Frequency | Differentiation | Defensibility | Feasibility | Score |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Agent Activity Nervous System | Very High | Very High | Very High | High | High | Medium | MUST DO |
| Capability Control Plane | Very High | Very High | High | High | High | Medium | MUST DO |
| Pet as Ambient Run Companion | High | Medium | High | Very High | Medium | High | MUST DO |
| Tool Quality Flywheel | High | High | High | High | High | Medium | STRONG |
| Capability Palette | High | High | Medium | Medium | Medium | High | STRONG |
| Personality packs before core states | Low | Low | Low | Medium | Low | High | PASS FOR NOW |
| More overlay animation types | Low | Medium | Medium | Low | Low | High | PASS FOR NOW |
| Copy every KronosCode tool into Wave | Low | Medium | Medium | Low | Low | Low | PASS |

---

## Recommended Priority

### Do Now: Centralize the Truth

1. **Define `ActivityEvent` and `Capability` schemas** shared by Wave, ACP, KronosCode, MCP, and surface runtimes.
2. **Map every current indicator producer and consumer** into the canonical stream: ACP event bridge, frontend pet reporting, Electron pet, overlay, live surface strip, tool cards, block events, and TUI POST bridge.
3. **Replace title regex inference at source boundaries** with explicit `category`, `action`, `surface`, `risk`, `phase`, and `presentationHints`.
4. **Create one lifecycle grammar** for `discovering`, `ready`, `busy`, `awaiting-approval`, `verifying`, `succeeded`, `degraded`, `failed`, `paused`, and `disabled`.
5. **Define pet modes**: `off`, `status-only`, `docked`, and `expressive`.
6. **Audit tool inventory** into canonical families with source, connector, health, setup state, permission, and fallback metadata.
7. **Remove placeholder MCP status from default UI** until it is backed by real manager state.

### Do Next: Ship the Visible Product

1. **Build the global run strip** with active action, progress, approval, stop, and inspect.
2. **Refactor the pet into an `ActivityStream` consumer** with the small state machine and click-to-focus behavior.
3. **Refactor overlays into verified surface feedback**: attempted action, verification, failure.
4. **Ship the Capability Palette** with family view, tool inspector, health summary, guided setup, and project packs.
5. **Connect real MCP manager state** to WSH RPC and settings UI.
6. **Route Wave-native, Kronos-native, ACP-client, MCP, and plugin tools through the same capability graph** while preserving provenance.
7. **Add a compact activity timeline** and use it as the foundation for replay.

### Explore: Compounding Bets

1. **Tool Quality Flywheel**: route toward reliable implementations and prioritize repair from local metrics.
2. **Workspace Replay**: scrub actions, diffs, approvals, screenshots, and verification results.
3. **Pet Personality Packs**: optional visual and voice identity after the restrained default ships.
4. **Shared Team Tool Packs**: reusable project policies, approved MCP servers, and audited capability bundles.

### Backlog

1. Additional pet sprites and animation families.
2. More decorative surface effects.
3. Marketplace expansion before capability health and permissions are trustworthy.
4. Large new connector inventory before existing connectors expose reliable setup and diagnostics.

---

## 60-Day Plan

### Days 1-15: Schemas and Audit

- Write the canonical activity and capability schemas.
- Inventory producers, consumers, duplicate inference logic, localhost bridges, MCP paths, and tool catalogs.
- Define lifecycle colors, icons, motion rules, reduced-motion behavior, and copy style.
- Classify all existing capabilities by family, source, connector, risk, availability, and verification support.

### Days 16-30: Shared Backbone

- Add the canonical event adapter at ACP, Wave tool, KronosCode, and MCP boundaries.
- Replace duplicated title matching with explicit activity metadata.
- Back the tool graph with real discovery and manager state.
- Store a bounded local activity timeline per run.
- Gate expressive pet and overlay behavior behind user mode.

### Days 31-45: Visible Polish

- Ship the global run strip and approval beacon.
- Refactor chat cards, live surface strip, surface ribbons, overlay, and pet to consume the same events.
- Add click-to-focus from pet and activity items.
- Add verified success and failure states.
- Move raw URLs, ports, schemas, and transport details into diagnostics.

### Days 46-60: Tooling Product

- Ship the Capability Palette and tool inspector.
- Add project tool packs and permission presets.
- Add guided setup for degraded and missing capabilities.
- Start local reliability metrics and fallback reporting.
- Validate one full workflow: delegate browser QA or autonomous code repair, observe it from the pet and run strip, approve one risky step, inspect verification, and replay the timeline.

---

## Quality Gates

Do not call this polished until:

1. One activity event produces consistent chat, strip, surface, overlay, and pet feedback.
2. Status is explicit metadata, not inferred from tool title text.
3. `acting`, `verifying`, and `succeeded` are visibly distinct.
4. Any approval is discoverable from the pet, run strip, and tool detail.
5. Every visible tool resolves to source, connector, health, risk, setup, permission, and fallback metadata.
6. MCP UI reflects real manager state rather than placeholder responses.
7. Pet motion can be reduced or disabled without losing essential status.
8. Raw endpoints and transports appear only in diagnostics.
9. A failed action explains what failed, what was verified, and what the user can do next.
10. One end-to-end workflow is tested across KronTerm and KronosCode.

---

## What To Stop Doing

### Stop Adding Separate Indicator Paths

Every new visual cue must consume the canonical activity stream. Do not add another custom bridge, local event shape, or regex mapper.

### Stop Measuring Tooling by Count

`75+ tools` is not a user outcome. Measure ready capabilities, verified outcomes, setup friction, failure rate, and fallback quality.

### Stop Copying Tools Without Ownership

Do not copy KronosCode tools into Wave solely to make the inventory larger. Decide the canonical action, preferred implementation, fallback route, permission model, and diagnostics owner.

### Stop Letting the Pet Carry Raw Reasoning

The pet should show concise operational summaries. Detailed thoughts, traces, and logs belong in the run center and audit timeline.

### Stop Equating More Motion With More Clarity

Animation is valuable when it communicates target, phase, urgency, or result. Otherwise it is noise.

---

## The Most Important Call

The next cycle should not be "improve the pet" and "add more tools" as two independent projects.

Build the shared activity and capability spine first.

Then:

- The pet becomes credible because it reflects real run state.
- Indicators become calm because they share one hierarchy.
- Tooling becomes discoverable because it resolves into one graph.
- MCP becomes understandable because health and setup are visible.
- KronosCode and KronTerm feel like one product because they expose the same actions, statuses, and provenance.

That is the centralization move with compounding value.

---

## Questions

### Answered

- **Q**: Should the pet be removed for professional polish?
  **A**: No. Make it optional, restrained by default, and backed by canonical run state.

- **Q**: Should KronTerm import every KronosCode tool?
  **A**: No. Unify canonical capabilities and preserve runtime-specific implementations as routes and fallbacks.

- **Q**: What is the highest-leverage technical product investment?
  **A**: A shared `ActivityStream` plus `CapabilityGraph`.

- **Q**: What makes the visual system trustworthy?
  **A**: Explicit lifecycle metadata and verified outcomes, not title matching or optimistic animation.

### Blockers

- **Q**: Should the default pet mode be `status-only` or `docked`?
- **Q**: Which proof workflow should validate the spine first: browser QA or autonomous code repair?
- **Q**: Should local activity history persist only per project, or support an explicit opt-in export for team audit?

## Next Steps

- [ ] Write the `ActivityEvent` schema and typed action payloads.
- [ ] Write the `Capability` schema and canonical family map.
- [ ] Produce an indicator producer/consumer audit.
- [ ] Produce a tool inventory ownership audit across Wave, KronosCode, ACP, MCP, plugins, and surface runtimes.
- [ ] Choose the proof workflow and define acceptance criteria.
- [ ] Prototype the global run strip and restrained pet state machine from the same recorded activity events.
