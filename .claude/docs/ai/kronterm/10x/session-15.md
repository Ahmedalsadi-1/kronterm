# 10x Analysis: KronTerm Runtime, KronosChamber, Native UI, Motion, and Agent Harness

Session 15 | Date: 2026-08-13

## Current Value

KronTerm already has the ingredients of an unusually strong product:

- a persistent Electron + Go workspace with terminal, browser, files, app streaming, sandbox, remote, preview, and AI surfaces;
- three presentations of the same blocks: tiled widgets, focused tabs, and a spatial canvas;
- a managed KronosCode runtime and a bundled KronosChamber client;
- runtime health, boot progress, short-lived surface tokens, reconnect handling, and power-resume recovery;
- live agent activity overlays and a task/evidence graph;
- an iPhone Labs companion with host pairing, gateway events, browser/terminal surfaces, and watch/takeover semantics.

The core value is not “a better terminal.” It is one persistent workspace where a person and an agent can see, arrange,
operate, verify, and resume the same work.

The current risk is that these capabilities feel like neighboring products rather than one operating environment. The UI
has several competing shells; runtime truth is split across processes and polling loops; motion is locally styled instead
of choreographed; and mode changes alter implementation without giving the user a strong visual or conceptual change.

## What Was Reviewed

This session inspected:

- `emain/kronoscode-runtime.ts` and `emain/chathubv2-*.ts`;
- `frontend/app/view/chathubv2/`;
- `frontend/app/workspace/workspace-layout-model.ts`;
- `frontend/app/tab/tabcontent.tsx`, `widget-tabs-layout.tsx`, `workspace-canvas.tsx`, and their styles/tests;
- the desktop theme, tab bars, widget rail, and mode persistence;
- `mobile/src/app.tsx`, `mobile/src/lib/kronos-client.ts`, `json-rpc-gateway.ts`, and the mobile styles;
- current desktop, KronosChamber, task-graph, and iPhone screenshots in `output/playwright/`;
- previous KronTerm 10x sessions, especially session 14 and the implementation plan.

Validation run:

```text
44 focused tests passed
11 test files passed
```

The passing tests cover runtime health/process handling, KronosCode connection validation, workspace layouts, widget-tab
focus/reordering, canvas camera behavior, agent activity graphs, and the KronosChamber bridge. This is a good unit-test
base, but it does not yet prove perceptual smoothness, cross-process recovery, or full user journeys.

## The Question

How can KronTerm become vastly faster, easier to manage, more reliable with KronosChamber, more capable at planning and
tool use, visually closer to a built-in macOS workspace, and more fluid and adjacent to the iPhone experience?

## The Answer

Build **one workspace kernel with three unmistakable presentations**, supervised by **one observable runtime state
machine**, and expressed through **one material, motion, and agent-interaction language**.

The 10x move is not heavier glass, more animation, or more AI panels. It is coherence:

1. One block keeps its identity, process, selection, context, and position when moving between Tiles, Focus, and Canvas.
2. One Kronos session can appear as a compact composer, a sidecar, or full Chamber without spawning a different mental
   model.
3. One runtime supervisor owns boot, health, reconnect, resume, token refresh, and recovery; every UI subscribes to it.
4. One interaction contract makes every agent action visible, bounded, interruptible, undoable, and evidence-backed.
5. One visual system uses macOS materials and depth for hierarchy, not decoration.
6. One quality harness treats latency, animation comfort, reconnection, screenshots, and accessibility as release gates.

---

## Evidence: The Highest-Leverage Problems

### 1. Workspace modes exist, but mode truth and mode identity are weak

`frontend/app/tab/tabcontent.tsx:418-458` resolves the presentation from a global setting plus the global
`kronterm:layoutmode` local-storage key. It does not use the tab’s persisted `layout:mode` as the presentation source,
although the canvas writes that metadata. The result is a split-brain contract: parts of the system persist per-tab
layout data while the renderer selects a global override.

The mode value is also exposed through `(window as any).__krontermLayoutMode`, which `blockframe.tsx` reads to change
controls. That is implicit global coordination rather than typed workspace state.

The left side-panel model declares `hidden | compact | full`, but `workspace-layout-model.ts:200-214` converts saved
`hidden` to `compact`, `setSidePanelMode()` does the same, and `cycleSidePanelMode()` only cycles compact/full. In
`vtabbar.tsx`, hidden and compact also share the same icon and label. The code says three modes; the user sees two weakly
differentiated states.

### 2. KronosChamber connectivity is robust in pieces but fragmented as a system

The main process has good foundations: a single-flight startup promise, authenticated health checks, a managed
KronosCode connection, short-lived surface JWTs, readiness checks, process-exit handling, and power-resume revalidation.

The renderer still polls runtime status every second while starting and every five seconds while ready
(`frontend/app/view/chathubv2/chathubv2.tsx:518-551`). The embedded composer also retries DOM guard installation every
250 ms after load. This is understandable for an iframe integration, but it means the UI discovers truth repeatedly
instead of receiving authoritative transitions.

The iPhone client is more event-oriented, but it combines a gateway event stream with a complete host refresh every
20 seconds and a debounced full refresh after gateway events (`mobile/src/app.tsx:191-217`). Each refresh fans out across
sessions, statuses, sandboxes, browser states, and phone control. As hosts and sessions grow, one event can trigger much
more work than the event changed.

`mobile/src/lib/json-rpc-gateway.ts` does not reconnect by itself after a close or error. The higher layer can reconnect
on later activity, but there is no explicit backoff/jitter/online-resume state machine in the gateway client.

### 3. The app uses glass, but not yet a native material hierarchy

KronTerm already enables Electron vibrancy on macOS and uses `backdrop-filter` in navigation and mobile surfaces. The
visual problem is not the absence of blur. It is that materials, borders, shadows, radii, opacity, and typography vary by
surface and sometimes communicate decoration instead of depth or ownership.

The current desktop screenshot shows several nested dark shells, multiple unrelated sidebars, tiny labels, and floating
panels competing for attention. The current iPhone screenshot shows desktop-style navigation and content clipping at a
phone width. It feels embedded rather than native to the device.

“Liquid glass” should therefore mean:

- translucent only where content moves behind a persistent control surface;
- opaque where text, terminal glyphs, diffs, or long reading require contrast;
- stronger material and shadow only for the currently manipulated layer;
- edge highlights that follow window focus and material elevation;
- very restrained spectral tinting, never a blur applied to every card.

### 4. Motion is a collection of timings, not a product choreography

The reviewed code contains 100 ms, 140 ms, 150 ms, 160 ms, 180 ms, 200 ms, 220 ms, 250 ms, 300 ms, 350 ms, 420 ms,
500 ms, and longer animation/retry timings. Reduced-motion support exists in several places, which is good, but there is
no shared semantic motion vocabulary.

Panel size transitions write `flex 0.2s ease-in-out` directly to DOM nodes, then remove it on a timer. Canvas activity
uses perpetual pulses and flow animations. Mobile focused surfaces animate independently from desktop mode changes.

The result can be technically animated but perceptually busy: unrelated elements start and stop on unrelated curves,
and layout transitions are not guaranteed to preserve spatial continuity.

### 5. Performance is not yet governed by end-to-end budgets

The bundled KronosChamber directory is 1.9 GB in the worktree; its required `dist` is 31 MB. The largest startup assets
include approximately 9.3 MB of Shiki, 3.8 MB of Mermaid code across two chunks, 1.5 MB of CodeMirror, and 1.3 MB of
HEIC conversion. These capabilities are valuable, but most are not necessary to draw an empty composer.

The repository has build-output checks and individual service timing logs, but there is no visible end-to-end trace that
connects:

```text
user input → renderer → IPC → Chamber → gateway → KronosCode → tool → evidence → final paint
```

Without that trace, “the system feels slow” becomes hard to localize and regressions survive until visual testing.

### 6. Agent planning is visible, but the harness still needs a contract

The canvas graph already models request, router, planner, executor, critic, and summarizer roles. That is useful visual
language. The missing layer is a single machine-readable run contract shared by the prompt compiler, runtime, tool
router, UI, and replay/evaluation harness.

Without it, planning can become prose, tool lists can consume prompt space, context can be sent too early, and the UI
cannot reliably distinguish “thinking,” “waiting for a tool,” “blocked on approval,” “verifying,” and “done.”

---

## Massive Opportunities

### 1. Workspace Kernel + Presentation Router

**What**: Make a typed `WorkspaceScene` the canonical source for blocks, selection, focus, layout, task association, and
agent visibility. Keep the current compatibility identifiers, but expose three user-facing presentations:

- **Tiles** — structured, dense, resizable workbench;
- **Focus** — one primary surface with an optional secondary split and quiet chrome;
- **Canvas** — spatial map with graph, grouping, notes, and live surfaces.

Changing presentation must transform the same block instances, not remount a parallel workspace. Persist presentation
per tab/scene; optionally allow a workspace default. Replace the local-storage event and window global with a Jotai/model
atom backed by tab metadata.

**Why 10x**: Users can choose how to think without losing where they were. “Mode” becomes a useful cognitive tool, not a
setting.

**Visual difference**:

| Presentation | Shape and density | Navigation | Kronos placement | Motion |
| --- | --- | --- | --- | --- |
| Tiles | tight 8–10 px gaps, low-radius content | visible workspace tree | right sidecar | direct resize, 160 ms settle |
| Focus | one elevated hero surface, generous inset | compact titlebar tabs | bottom composer or slim sidecar | matched-geometry 220 ms |
| Canvas | visible spatial field, clusters and edges | minimap + breadcrumb | floating contextual island | camera spring 260–360 ms |

Add a titlebar segmented switcher with icons, names, and shortcuts (`⌃1`, `⌃2`, `⌃3`). The selected mode should be
obvious from silhouette alone.

**Effort**: High

**Risk**: Remounting terminals/webviews during transition would destroy the benefit. Build the shared scene and view
adapters before adding the visual morph.

**Score**: 🔥 Must do

### 2. Kronos Runtime Supervisor

**What**: Replace distributed polling/retry logic with a main-process supervisor whose explicit states include:

```text
stopped → discovering → booting-engine → booting-chamber → authenticating → ready
ready → degraded → reconnecting → resuming → ready
any state → repairable-error | fatal-error
```

The supervisor publishes versioned events over Electron IPC. Every event includes `runtimeInstanceId`, `connectionEpoch`,
`sequence`, timestamps, health, current recovery action, and user-facing progress. Renderers subscribe and request one
snapshot only when a sequence gap is detected.

Use the same event/resume contract for desktop and iPhone:

- cursor-based event replay;
- idempotency keys for prompts and mutating tools;
- exponential backoff with jitter;
- online/offline and power-resume transitions;
- heartbeat based on actual work/transport health, not UI polling;
- bounded event retention and a snapshot fallback;
- a visible connection timeline in diagnostics.

An actor/state-machine implementation is a good fit. [XState](https://github.com/statelyai/xstate) is open source and
provides statecharts and actors for predictable orchestration. KronTerm can also implement the same model internally if
adding the dependency is undesirable; the important move is the explicit statechart and event log.

**Why 10x**: KronosChamber stops feeling like an iframe that may or may not be alive. Reconnect and resume become product
behavior that can be tested deterministically.

**Effort**: High

**Score**: 🔥 Must do

### 3. Native Kronos Sidecar + Full Chamber on Demand

**What**: Keep full KronosChamber for deep conversation history, settings, rich artifacts, and specialized views. Make
the default in-workspace experience a lightweight native KronTerm surface that owns:

- the composer;
- current run/plan state;
- approvals;
- tool activity and evidence;
- stop/pause/resume;
- context chips for selected blocks/files;
- the final response.

Expose a typed host SDK instead of DOM scanning or repeated composer-guard installation. The full Chamber becomes an
expandable destination, not the critical path for every prompt.

Split and lazy-load Chamber capabilities. Syntax engines, Mermaid, CodeMirror, HEIC conversion, canvas, and advanced
artifact renderers should load when the first relevant content appears. Package only release artifacts, never the full
1.9 GB source/dependency tree.

**Why 10x**: The common path becomes immediate and visually native while the powerful workbench remains available.

**Effort**: High

**Score**: 🔥 Must do

### 4. Agent Run Contract + Prompt Compiler

**What**: Replace a monolithic prompt assembly with a versioned run contract:

```ts
type AgentRun = {
    objective: string;
    acceptanceCriteria: Criterion[];
    constraints: Constraint[];
    presentation: "tiles" | "focus" | "canvas";
    contextRefs: ContextRef[];
    plan: Step[];
    permissions: CapabilityGrant[];
    budgets: { timeMs?: number; toolCalls?: number; tokens?: number };
    evidence: EvidenceRef[];
    state: "queued" | "planning" | "acting" | "waiting" | "verifying" | "done" | "failed";
};
```

Compile model context in stable layers:

1. stable system identity and safety policy;
2. task objective, success criteria, and constraints;
3. compact workspace digest;
4. deterministic tool index;
5. just-in-time context for the chosen surface/tool;
6. recent event delta;
7. evidence and unresolved failures.

Do not send every open pane or every tool on every turn. Summarize cold context, keep references, and hydrate detail only
when the planner selects it. Keep tool ordering deterministic so prompt caching remains effective; the current MCP tools
spec explicitly recommends deterministic ordering for reliable caching:
[MCP tools specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/server/tools.mdx).

Planning policy:

- answer directly for one-step, read-only questions;
- create a short internal plan for multi-file or multi-tool work;
- expose the plan when work is long-running, risky, collaborative, or user-editable;
- replan only on new evidence, failed assumptions, changed scope, or a blocked dependency;
- require a verifier/critic pass for code mutation, external side effects, and high-risk actions;
- finish with evidence mapped to each acceptance criterion.

**Why 10x**: Planning becomes faster, cheaper, inspectable, and easier to resume. The UI can display actual state instead
of guessing from text streams.

**Effort**: High

**Score**: 🔥 Must do

### 5. Companion Continuity, Not Desktop Shrinkage

**What**: Make iPhone a continuation layer for a running workspace:

- open to “Now”: active run, approval, recent result, or selected surface;
- one-thumb switch between Watch, Ask, Approve, and Take Over;
- live activities for long runs;
- hand off a surface to Mac and back without creating a new session;
- background reconnect and notification routing;
- QR/local discovery pairing with a named trusted host;
- phone-native sheets, navigation, haptics, safe-area behavior, and Dynamic Type;
- no desktop sidebar or full desktop Chamber route at phone width.

The current watch/takeover lease model is a strong foundation. Preserve it and make it the center of the phone product.

**Why 10x**: The phone becomes useful precisely when the user leaves the desk, which is the highest-value adjacent use
case.

**Effort**: High

**Score**: 👍 Strong strategic bet

---

## Medium Opportunities

### 1. Material System: “Kron Glass”

Create semantic tokens instead of component-specific glass:

```text
material.workspace   opaque or subtly translucent base
material.chrome      vibrancy/sidebar material for persistent navigation
material.floating    stronger blur + edge highlight for menus and inspectors
material.active      focused surface with controlled elevation
material.content     opaque, high-contrast terminal/editor/reading plane
material.warning     tinted but still contrast-safe state surface
```

Rules:

- at most two translucent layers over one another;
- no blur behind terminal glyphs, long prose, code, or diffs;
- 1 px light edge + 1 px dark separator instead of heavy borders;
- radius scale of 8/12/16/22 px tied to hierarchy;
- shadow only when a layer can move independently;
- use the system accent color sparingly for focus, selection, and progress;
- use SF Pro/SF Mono through system fallbacks on macOS; preserve cross-platform fallbacks;
- test both Reduce Transparency and Increase Contrast behavior.

### 2. Semantic Motion System

Use four named motions:

| Token | Use | Target |
| --- | --- | --- |
| `motion.micro` | hover, press, icon state | 90–140 ms, ease-out |
| `motion.control` | menus, sheets, tabs | 160–220 ms, ease-out |
| `motion.layout` | split, mode morph, sidecar | 220–320 ms, critically damped spring |
| `motion.camera` | canvas pan/zoom/focus | 260–420 ms, distance-aware spring |

Rules:

- animate transform and opacity where possible;
- preserve object continuity during presentation changes;
- stagger only the first reveal of a group, never routine navigation;
- stop perpetual pulses after the user has understood the state;
- use motion to explain ownership, direction, and completion;
- map reduced motion to crossfade/instant layout without losing state information.

[Motion](https://github.com/motiondivision/motion) is MIT-licensed and supports springs, gestures, layout transitions, and
reduced-motion handling. Use it only for shell-level choreography and shared-layout transitions; keep trivial color and
hover transitions in CSS.

### 3. Incremental Mobile Store

Normalize hosts, sessions, statuses, surfaces, browser states, and leases by ID. Apply gateway events as reducers instead
of refetching the complete snapshot after each event. Reserve full reconciliation for:

- initial connection;
- sequence gaps;
- reconnect with an expired cursor;
- periodic low-frequency integrity checks;
- explicit pull-to-refresh.

This will reduce host traffic, re-renders, battery use, and visible status lag.

### 4. Unified Command and Context Palette

Make one `⌘K` palette operate on:

- modes and layouts;
- open blocks and recent scenes;
- tools and skills;
- agent runs;
- settings;
- files, commands, and hosts;
- recovery actions.

Results should be ranked by current task and selected surface. Show what will happen and where. The palette and visible
segmented mode switcher should share the same command definitions.

### 5. Runtime Diagnostics as a Product Surface

Add a compact health popover and a deep diagnostics view:

- current supervisor state and duration;
- last successful heartbeat;
- renderer/IPC/Chamber/gateway/engine version compatibility;
- event cursor and connection epoch;
- active host and security scope;
- last 20 transitions and errors;
- “copy diagnostic bundle” with secrets stripped;
- one-click retry, restart Chamber, reconnect engine, and open logs.

Do not expose raw implementation jargon in the normal state. Show it when something is degraded or the user asks.

### 6. Performance and Connection Tracing

Instrument one trace across renderer, Electron main, Chamber, gateway, agent, and tools. OpenTelemetry JS provides
vendor-neutral traces and metrics: [OpenTelemetry JS](https://github.com/open-telemetry/opentelemetry-js).

Start with manual spans for:

```text
app.cold_start
workspace.first_interactive
presentation.switch
kronos.runtime.ready
kronos.prompt.accepted
kronos.first_meaningful_output
tool.queue / tool.execute / tool.verify
surface.snapshot
mobile.connect / mobile.resume
```

Export locally to a diagnostics file in development first. Do not make user telemetry a prerequisite for local
performance insight.

---

## Small Gems

### 1. Fix mode persistence and labeling

Read/write `layout:mode` per tab, remove the window global, and make Hidden/Compact/Full either real distinct states or
reduce the type to the two states that exist. **Score: 🔥**

### 2. Add mode previews

Hover or keyboard-focus on Tiles/Focus/Canvas to show a small silhouette preview without switching. **Score: 👍**

### 3. Show connection truth in the composer

Use one subtle dot/label: Ready, Reconnecting, Resuming, Needs attention. Clicking it opens the timeline. **Score: 🔥**

### 4. Optimistic prompt receipt

Render the user message immediately with a local idempotency key, then reconcile it with the gateway acknowledgement.
Never make the user wonder whether Enter worked. **Score: 🔥**

### 5. Replace endless activity pulses

Pulse briefly on state entry, then settle to a static color/icon. Reserve continuous motion for indeterminate progress
that genuinely benefits from it. **Score: 👍**

### 6. Preserve spatial origin

When a tile enters Focus or Canvas, animate from its real bounds. When returning, animate back to the same location.
**Score: 👍**

### 7. Add “Resume where I left off”

On launch, show the last active scene and any interrupted run with one-click resume/review. **Score: 🔥**

### 8. Deduplicate validation and legacy presentation branches

`vtabbar.tsx` currently calls `validateCssColor(rawFlagColor)` twice. Remove mechanical duplication while doing the mode
cleanup, but avoid unrelated compatibility renames. **Score: 👍**

---

## Harness Engineering

### Product budgets

Treat these as initial targets to measure and adjust, not claims about current behavior:

| Moment | Target |
| --- | --- |
| Pointer/keyboard visual acknowledgement | under 100 ms |
| Presentation switch input-to-stable paint | p95 under 300 ms |
| Warm composer ready | p95 under 250 ms |
| Warm prompt accepted acknowledgement | p95 under 300 ms |
| First meaningful agent output | p50 under 1.5 s; show honest progress before 700 ms of silence |
| Sleep/network resume to usable | p95 under 2 s on healthy local runtime |
| Mode switch terminal/webview remounts | zero |
| Dropped frames during common shell motion | under 1% |
| Unhandled runtime state transitions | zero |

### Test layers

1. **State-model tests**: transition tables, illegal transitions, backoff, cursor gaps, duplicate events, token expiry,
   cancellation, power resume, and process crashes. Use fake clocks.
2. **Contract tests**: renderer ↔ IPC ↔ Chamber ↔ gateway schemas, version negotiation, idempotency, and event ordering.
3. **Journey tests**: launch, prompt, tool use, approval, evidence, stop, reconnect, resume, mode switch, phone handoff.
4. **Visual matrix**: Tiles/Focus/Canvas × light/dark × 1x/2x × window sizes × reduced motion/contrast/transparency.
5. **Performance traces**: compare startup, presentation switch, first output, and reconnect against budgets.
6. **Fault injection**: kill Chamber, kill KronosCode, suspend the Mac, drop the gateway, rotate a token, reorder events,
   and fill the event buffer.
7. **Accessibility**: keyboard-only, VoiceOver labels/order, focus restoration, contrast, Dynamic Type, and reduced motion.

Use the existing Vitest and preview foundations. Add Playwright traces and screenshot comparisons to the real Electron
journeys; Playwright’s trace viewer records action snapshots and screenshot diffs:
[Playwright trace viewer](https://playwright.dev/docs/next/trace-viewer). Add `axe-core` to rendered web surfaces for
automated accessibility checks while retaining manual VoiceOver testing:
[axe-core](https://github.com/dequelabs/axe-core).

### Prompt and tool evaluations

Create a local scenario suite with recorded workspace fixtures:

- diagnose a failing command;
- compare two files and apply a safe change;
- recover after a tool timeout;
- ask for missing authority;
- switch from browser evidence to terminal verification;
- continue a run from iPhone;
- resume after a gateway reconnect;
- reject a prompt-injected webpage instruction;
- choose not to plan for a trivial question;
- replan after evidence disproves the first hypothesis.

Score:

- task success and acceptance-criteria coverage;
- time to first useful action;
- unnecessary plans/tool calls;
- context bytes and cache reuse;
- approval correctness;
- recovery without duplicated side effects;
- evidence quality;
- user interventions required.

Keep golden outputs structural, not prose-exact. Assert plan shape, tool boundaries, state transitions, evidence links,
and final outcome.

---

## Recommended Priority

### Do Now: 2–3 weeks

1. **Create the runtime trace and baseline budgets** — measure before polishing so speed work is attributable.
2. **Fix presentation truth** — per-tab mode persistence, typed state, real labels, visible titlebar switcher, no global
   local-storage/window bridge.
3. **Define material and motion tokens** — migrate only titlebar, navigation, mode switcher, panel surfaces, and composer
   first.
4. **Replace renderer runtime polling with supervisor events** — retain snapshot-on-gap fallback.
5. **Fix the iPhone narrow-width Chamber path** — route phone users to the native companion UI, not desktop Chamber
   chrome.
6. **Add Playwright journeys** for mode switching, Chamber boot/recovery, prompt acknowledgement, and iPhone reconnect.

### Do Next: 4–8 weeks

1. **Ship the native Kronos sidecar/composer** with typed host SDK and full Chamber expansion.
2. **Normalize mobile state and apply gateway deltas** instead of event-triggered full refreshes.
3. **Add connection epoch, cursor replay, idempotency, and backoff/jitter** across desktop and mobile.
4. **Lazy-load Chamber’s heavy capability islands** and package only its runtime artifacts.
5. **Introduce the AgentRun contract and layered prompt compiler** with evidence-based completion.
6. **Implement matched-geometry presentation changes** without remounting live blocks.

### Explore: 8–16 weeks

1. **Workspace scenes and templates** generated from task intent.
2. **Mac/iPhone handoff and Live Activities** for active runs and approvals.
3. **Replayable agent runs** where the canvas graph is both explanation and debugger.
4. **Local host discovery and trusted pairing** with explicit device identity and revocation.
5. **Adaptive presentation suggestions** that recommend Focus/Tiles/Canvas but never switch without user intent.

### Backlog

1. More glass effects before the material hierarchy and contrast harness exist.
2. More agent roles before the run contract and evaluation suite exist.
3. More workspace modes before the current three preserve state and feel distinct.
4. A second AI runtime inside Chamber or mobile; KronosCode should remain the shared engine.

---

## Recommended North-Star Experience

1. KronTerm opens immediately into the last scene; the terminal and primary workspace are interactive while Kronos warms
   in the background.
2. The titlebar clearly shows Tiles, Focus, and Canvas. Switching preserves every live surface and animates its spatial
   continuity.
3. The user selects a terminal and browser, presses the Kronos key, and asks for an outcome. Context chips make exactly
   what Kronos can see obvious.
4. The message appears instantly. A quiet status moves through Planning → Acting → Verifying, with tools and approvals
   attached to the affected surfaces.
5. If Chamber or the gateway restarts, the composer says Reconnecting, resumes by cursor, and never duplicates the user’s
   action.
6. The user leaves the desk. iPhone opens to the active run, requests one approval, and can Watch or Take Over.
7. Returning to Mac restores the same scene, task graph, evidence, and focused surface.

That experience would feel less like several development tools embedded in Electron and more like a fast, native,
agent-aware workspace operating system.

## Questions

### Answered

- **Should KronTerm pursue liquid glass?** Yes, as a semantic material hierarchy with restraint, contrast, and native
  motion—not as blur on every panel.
- **Should KronosChamber be removed?** No. Keep the full workbench, but remove it from the critical path of the everyday
  composer and give it a typed host contract.
- **Should the three workspace modes remain?** Yes. They solve different cognitive jobs, but they need one scene model,
  per-tab persistence, unmistakable silhouettes, and state-preserving transitions.
- **What is the first technical investment?** Observability plus an explicit runtime supervisor. Reliability and speed
  cannot be polished sustainably while truth is distributed across timers.

### Blockers

- Choose the primary visual direction after three rendered shell concepts: restrained macOS glass, warmer editorial
  glass, or darker technical glass. The recommendation is restrained macOS glass.
- Decide whether the first implementation slice targets desktop mode switching or the native Kronos sidecar. Mode truth
  is the safer first slice; the sidecar is the larger perceived-value win.

## Next Steps

- [ ] Record baseline cold/warm startup, mode switch, prompt acknowledgement, first output, and reconnect traces.
- [ ] Write the `WorkspaceScene`, `RuntimeSupervisorEvent`, and `AgentRun` contracts before UI implementation.
- [ ] Fix the per-tab presentation source of truth and remove the window/local-storage bridge.
- [ ] Produce exactly three visual shell directions for Tiles/Focus/Canvas and select one.
- [ ] Implement one vertical slice: Focus mode + native composer + supervisor status + Playwright/trace budget.
- [ ] Fault-inject Chamber/KronosCode/network restarts and prove cursor-safe recovery.
- [ ] Apply the same event contract to the iPhone companion and remove event-triggered full refreshes.
