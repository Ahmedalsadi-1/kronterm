# 10x Analysis: KronTerm Widgets, Icons, Canvas, and KronosChamber UX
Session 14 | Date: 2026-07-24

## Current Value

KronTerm is already more ambitious than a terminal application. It is an AI-native desktop workspace with:

- block-based terminals, browsers, files, sandboxes, app streams, design tools, system information, and AI;
- a widget launcher and responsive block layout;
- agent-visible and agent-operable surfaces;
- a semantic canvas persisted through Go/RPC;
- KronosChamber as a bundled AI workbench;
- desktop app discovery and streaming;
- agent activity overlays, approvals, tool calls, screenshots, and workspace context.

The core user value is not "open a terminal faster." It is: keep every surface of a technical task visible, composable, and usable by both the human and KronosCode.

The product is therefore competing with several categories at once:

- terminal and shell workspaces;
- IDEs and coding agents;
- browser and desktop automation;
- visual workflow/canvas products;
- command palettes and desktop launchers;
- persistent AI workbenches.

That breadth is the advantage. It is also the current UX risk: several powerful subsystems have evolved into overlapping shells instead of one coherent product.

## What Was Audited

The audit covered:

- the widget rail, widget grouping, compact modes, app launcher, and default widget definitions;
- block chrome and view registration;
- icon libraries, icon configuration, desktop app fallbacks, and visual assets;
- KronTerm's tldraw-based KronosCanvas and its Go/RPC persistence model;
- KronosChamber's separate React Flow canvas, store, browser/terminal nodes, assistant island, and runtime API;
- ChatHub V2's embedded iframe and server startup path;
- the packaged KronosChamber build, route filtering, bundle shape, and packaging scope;
- current screenshots shipped with the website;
- the standalone component-preview startup path.

No product implementation code was intentionally edited. The authored deliverable is this strategy document. Audit note:
`task preview` invoked its dependency-install step and refreshed the already-uncommitted `package-lock.json` against the
current `package.json` before the preview failed. It was not reverted because the worktree already contains extensive user
changes and replacing the lockfile with `HEAD` could discard their dependency work.

## Evidence: The Five Structural Problems

### 1. Two Products Are Trying to Own the Canvas

KronTerm has `KronosCanvasView`, a tldraw surface with semantic `CanvasDocument`, Go/RPC persistence, asset uploads, widget/app/AI nodes, live block launching, outline navigation, selection controls, and a cowork bridge:

- `frontend/app/view/kronoscanvas/kronoscanvas.tsx`
- `frontend/app/view/kronoscanvas/canvas-cowork/canvas-editor.tsx`
- `pkg/wshrpc/wshrpctypes_canvas.go`
- `pkg/wshrpc/wshserver/canvas.go`

KronosChamber separately has:

- `CanvasWorkspaceView.tsx` at 3,027 lines;
- `useCanvasWorkspaceStore.ts` at 1,099 lines;
- spatial and widget display modes;
- React Flow nodes;
- browser, terminal, note, file, diff, artifact, and app nodes;
- an assistant that can dock or float as an island;
- separate persistence and runtime APIs.

The packaged ChatHub then explicitly disables Chamber's canvas, clears `kronos.canvas.workspace.v1`, blocks canvas routes/APIs, and repeatedly scans the DOM to hide canvas UI in `third_party/kronoschamber-web/dist/index.html:55-240`.

This is not merely duplicated code. It is duplicated product truth. Users cannot build durable mental models while the host and embedded workbench disagree about which canvas, node model, persistence layer, and assistant layout are canonical.

### 2. The Widget Rail Is a Launcher, Not Yet a Workspace Control Plane

The widget system has useful foundations:

- grouping by Terminal, Browser, AI, Sandbox, Design, Apps, and Tools;
- normal, compact, and supercompact modes;
- fold state;
- workspace filtering;
- recent applications;
- responsive measurement.

But the rail is fixed to 48 pixels in normal mode, uses labels as small as 9 pixels for group headers, and compresses into icon-only or two-column modes when height is constrained. A folded group disappears from the rail entirely and relies on another surface to recover it.

Evidence:

- group and color logic: `frontend/app/workspace/widgets.tsx:55-99`;
- icon/label rendering: `widgets.tsx:153-190`;
- 9-pixel group labels: `widgets.tsx:661-710`;
- compact/supercompact measurement: `widgets.tsx:763-830`;
- 48-pixel rail: later in the same component;
- default widgets: `pkg/wconfig/defaultconfig/widgets.json`.

The current default config also exposes two separate ChatHub V2 widget entries with different icons/colors but the same destination: `defwidget@ai` and `defwidget@chat` in `widgets.json:46-68`.

The rail answers "what can I launch?" It does not yet answer:

- what is already open;
- what is active, busy, errored, or requesting approval;
- what I used recently;
- what belongs to this task;
- what can be dropped onto the canvas;
- what can be automated;
- what the agent can currently see or control.

### 3. Icons Do Not Yet Form a Product Language

The UI mixes:

- Font Awesome names through `makeIconClass`;
- Lucide components;
- Remix Icon components;
- Codicons;
- provider logos and custom SVG/PNG assets;
- generic fallbacks.

This is manageable technically, but visually it creates inconsistent stroke weight, optical size, fill style, alignment, and meaning.

The shipped app-launcher screenshot makes the practical consequence obvious: many desktop apps use the same bright green cube. The list is technically complete but visually unscannable. Users recognize applications by silhouette and color long before reading labels.

The icon system also lacks a visible semantic state grammar. A terminal icon, active terminal, agent-controlled terminal, failed terminal, approval-needed terminal, and durable terminal should be distinguishable without inventing a different base icon for every state.

### 4. KronosChamber Is Embedded as a Patched Web App, Not a Native Product Surface

The host starts a separate local server, waits for health, issues a surface JWT, and renders Chamber in an iframe. The packaged HTML then modifies the embedded product through:

- global flags;
- route and API blocking;
- `window.fetch` interception;
- localStorage mutation;
- CSS overrides;
- DOM text matching;
- repeated `querySelectorAll("body *")`;
- a `MutationObserver`.

Evidence:

- embedded route filtering: `third_party/kronoschamber-web/dist/index.html:55-240`;
- iframe host: `frontend/app/view/chathubv2/chathubv2.tsx`;
- startup and health path: `emain/chathubv2-server.ts`;
- a 90-second health timeout: `chathubv2-server.ts:68-73`.

This makes Chamber feel like a product inside a product. It also makes UI behavior fragile: wording, labels, or DOM structure can accidentally break the host's hiding logic.

Naming compounds the problem. The repo still contains WaveAI, KronosChat, ChatHub V2, KronosChamber, KronosCode, `waveai`, `kronoschat`, `chathubv2`, and `kronoschamber` routes. The registry intentionally maps multiple legacy names to the same surface, but users should not have to understand that migration history.

### 5. Heavy Capability Is on the Critical Path

The packaged Chamber `dist` is approximately 26 MB uncompressed. Its largest assets include:

- Shiki vendor chunk: approximately 9.6 MB;
- Mermaid runtime chunks: more than 5 MB combined;
- CodeMirror: approximately 1.6 MB;
- HEIC conversion: approximately 1.35 MB;
- Cytoscape, Ghostty, syntax tooling, Markdown, KaTeX, Radix, and React.

The HTML module-preloads the 9.6 MB Shiki chunk at startup in `third_party/kronoschamber-web/dist/index.html:413-415`, even when the user only needs an empty chat composer.

The Electron build rule copies the entire `third_party/kronoschamber-web` directory. In the current working tree that directory is approximately 1.9 GB because it includes `node_modules`, while the required `dist` is only approximately 26 MB. Actual packaged output should be verified, but the scope is risky and unnecessarily broad.

The standalone preview also failed during this audit. `task preview`:

- scanned unrelated nested workspaces and emitted many missing-`extends` diagnostics;
- then failed pre-bundling `langium` because of missing `vscode-jsonrpc` exports.

This matters beyond developer convenience. Slow and fragile UI iteration directly lowers the quality and consistency of visual work.

---

## The Question

What UI upgrades, additions, and restructuring would make KronTerm's widgets, icons, canvas, KronosChamber feel, speed, and overall UI 10x better?

## The Answer

Build one spatial workspace operating system, not a collection of adjacent panels.

The north-star experience:

1. The user describes an outcome or selects a task template.
2. KronTerm creates the right workspace scene: terminal, browser, files, app, diff, and Kronos sidecar.
3. Every widget has a clear identity, live status, typed actions, and a consistent icon.
4. Widgets can exist in a tiled layout, on the spatial canvas, or as a focused full-screen surface without changing their underlying state.
5. Kronos is native to the workspace. It can dock beside a widget, float over the canvas, or expand into the full Chamber, while preserving the same session and context.
6. The shell is interactive immediately. Heavy capabilities load only when used.
7. Every action is visible, undoable, and recoverable.

The strategic move is unification:

- one workspace/node model;
- one launcher and command system;
- one icon grammar;
- one design-token contract;
- one AI identity;
- one performance budget;
- multiple presentations of the same underlying surfaces.

---

## Massive Opportunities

### 1. One Spatial Workspace Kernel

**What**: Make KronTerm's Go/RPC `CanvasDocument` and block runtime the canonical workspace model. Use it for nodes, edges, live block references, status, context, persistence, versioning, and agent actions. Let renderers be replaceable presentations:

- tiled layout;
- spatial graph;
- freeform ink/annotation layer;
- focused single surface;
- presentation/replay view.

Use tldraw for freeform drawing, frames, notes, and annotation—not as the only source of semantic graph truth. Port the best interaction patterns from Chamber's React Flow canvas into the canonical KronTerm canvas, then retire the duplicate Chamber persistence and disabled canvas route.

**Why 10x**: Users stop choosing between "the KronTerm canvas" and "the Chamber canvas." Any terminal, browser, file, app, diff, agent run, or note can move between tile and spatial modes without losing identity or state.

**Unlocks**:

- drag a live widget onto the canvas;
- turn a canvas node into a split pane;
- save and share task scenes;
- agent-generated layouts;
- execution edges and approval gates;
- replayable workflows;
- one persistence/recovery system;
- one extension contract.

**Effort**: Very High

**Risk**: A big-bang rewrite would stall the product. Migrate through an adapter: define the canonical node/action contract first, then make both existing renderers read it before removing either UI.

**Score**: 🔥 Must do

### 2. Widget OS: From Rail Buttons to Live Workspace Objects

**What**: Redefine a widget as a first-class object with:

- identity and icon;
- current state and health;
- live preview;
- typed actions;
- supported contexts;
- agent permissions;
- preferred size;
- open instances;
- recent/favorite/pinned state;
- drag payload;
- saved presets.

Replace the always-narrow launcher with an adaptive system:

- compact icon dock for favorites and live states;
- `⌘K` universal command palette for everything;
- expandable launcher for search, categories, recents, templates, and plugins;
- canvas drop targets;
- task-aware suggestions.

**Why 10x**: The launcher becomes the control plane for the entire workspace. Users launch, inspect, resume, arrange, automate, and troubleshoot from the same model.

**Unlocks**:

- "reopen my failed test terminal";
- "show widgets relevant to this repo";
- live approval/error badges;
- recent task scenes;
- plugin marketplace;
- generated contextual actions;
- keyboard-first and pointer-first parity.

**Effort**: High

**Risk**: A launcher can become a cluttered app store. Default to recents, favorites, and task suggestions; place the full catalog behind search.

**Score**: 🔥 Must do

### 3. Kronos as a Native Workspace Sidecar

**What**: Separate the KronosChamber product into capability islands and a stable host contract. The default embedded experience should be a lightweight native sidecar:

- current task and plan;
- conversation;
- approvals;
- tool/run timeline;
- context chips;
- active-surface indicator;
- composer.

Advanced Chamber surfaces—sessions, providers, MCP, skills, terminal runtime, full history, deep diffs—open on demand without changing the current session.

Replace DOM hiding and CSS patching with an explicit embedded profile exported by Chamber itself. The host should ask for `profile: "sidecar"` or `profile: "full-workbench"` and receive a supported component/route contract.

**Why 10x**: Kronos feels like part of KronTerm, not a web application placed inside a block. The AI can attach to any widget, follow focus, and expand when needed.

**Unlocks**:

- attach Kronos to a terminal/browser/canvas node;
- move between compact, docked, island, and full views;
- consistent keyboard focus;
- shared theming and motion;
- much faster first prompt;
- safer host integration.

**Effort**: Very High

**Risk**: Chamber is large and fast-moving. The contract must be versioned and owned jointly; copying Chamber components into KronTerm would create another fork.

**Score**: 🔥 Must do

### 4. Intent-to-Workspace Scenes

**What**: Let users start from outcomes instead of manually arranging widgets. Examples:

- Debug web app;
- Review a PR;
- Research an API;
- Investigate production incident;
- Build and test a feature;
- Automate a desktop workflow;
- Analyze a dataset;
- Design and implement a screen.

Each scene declares widgets, layout, sizes, context, agent mode, validation gates, and visual density. Kronos previews the layout and asks for approval before rearranging existing work.

**Why 10x**: The product's unique power is the combination of surfaces. Scenes make that power immediately useful instead of requiring users to become layout experts.

**Unlocks**:

- one-command setup;
- repeatable workflows;
- team templates;
- marketplace templates;
- onboarding through use cases;
- agent-created workspace choreography.

**Effort**: High

**Risk**: Automatic rearrangement can feel destructive. Scenes need preview, merge, undo, and "open in new tab."

**Score**: 🔥 Must do

### 5. Instant Shell, Progressive Capability

**What**: Establish a strict startup architecture:

- shell, tabs, existing layout, and terminal paint first;
- widget catalog and local state hydrate next;
- Kronos composer accepts input immediately;
- agent runtime, MCP, syntax highlighting, Mermaid, editors, desktop streams, and advanced Chamber routes load independently;
- prewarm only the last-used high-probability capability;
- show readiness without blocking interaction.

**Why 10x**: KronTerm's breadth should not make the core experience feel heavy. A user should be able to type a command or prompt while the rest of the system becomes ready.

**Unlocks**:

- sub-second perceived startup;
- smaller memory footprint;
- fewer startup races;
- actionable degraded mode;
- measurable performance ownership.

**Effort**: High

**Risk**: Lazy loading can turn failures into late surprises. Pair it with readiness badges and the runtime doctor.

**Score**: 🔥 Must do

---

## Medium Opportunities

### 1. A Semantic Icon System

**What**: Define one icon grammar with three layers:

1. **Product objects**: terminal, browser, file, diff, canvas, sandbox, app, agent, workflow.
2. **State badges**: running, paused, failed, approval, unread, durable, remote, agent-controlled.
3. **Actions**: add, close, focus, split, inspect, retry, attach, pin.

Choose one outline family for UI actions—Remix or Lucide—and normalize it through a single `KronIcon` component. Keep Font Awesome configuration compatibility through an adapter. Use custom SVG marks only for product identity and providers.

Create an icon-token spec for size, optical box, stroke, fill, color, badge position, and motion.

**Why 10x**: Users can read the workspace at a glance. Icons stop being decoration and become a compact operational language.

**Impact**: Faster recognition, cleaner headers, better accessibility, consistent plugins.

**Effort**: Medium

**Score**: 🔥 Must do

### 2. Real Desktop App Icons and Intelligent Fallbacks

**What**: Extract real app icons where possible. Cache multiple sizes. If unavailable, generate a stable fallback using:

- app initials or product glyph;
- deterministic color;
- category shape;
- optional provider badge.

Never show dozens of identical cubes.

**Why 10x**: Visual recognition is the entire value of an app grid. Better icons make the launcher feel native and premium immediately.

**Impact**: Faster app selection, lower visual fatigue, stronger demos.

**Effort**: Medium

**Score**: 🔥 Must do

### 3. Canvas Progressive Disclosure

**What**: Replace simultaneous floating panels with a clear hierarchy:

- top-left: compact create/search/scene control;
- bottom-left: zoom, fit, minimap;
- right: one contextual inspector that changes with selection;
- bottom or side: collapsible Kronos sidecar;
- outline: toggled drawer, not always-on overlay;
- save/sync: small status in the canvas title bar;
- commands: universal palette, not permanent buttons.

The current toolbar, outline, selection card, and cowork bridge all occupy the canvas viewport at once in `kronoscanvas.tsx` and `kronoscanvas.scss`.

**Why 10x**: The content becomes the main character. Power remains one click or shortcut away.

**Impact**: Less clutter, larger working area, better small-window behavior.

**Effort**: Medium

**Score**: 🔥 Must do

### 4. Spatial Nodes That Feel Alive

**What**: Give every canvas node:

- a recognizable type silhouette;
- live status and last activity;
- compact preview;
- clear selection and focus states;
- agent-attention state;
- resize affordances;
- typed input/output ports only when relevant;
- one primary action;
- a contextual menu.

Live terminal/browser/app nodes should preview their real surface and degrade gracefully to a snapshot when suspended.

**Why 10x**: The canvas stops feeling like a diagram editor with metadata and starts feeling like a live operating workspace.

**Impact**: Stronger spatial memory and task awareness.

**Effort**: Medium/High

**Score**: 🔥 Must do

### 5. One Product Naming Model

**What**: Use:

- **KronTerm**: the desktop workspace;
- **Kronos** or **KronosCode**: the agent;
- **Chamber**: the expanded AI workbench experience.

Remove "ChatHub V2" from user-facing UI. Keep legacy route names only as internal compatibility aliases. Merge the two default ChatHub launcher entries.

**Why 10x**: Clear identity is a prerequisite for trust and word-of-mouth. Users should know what opened and why.

**Impact**: Cleaner onboarding, settings, docs, launcher, and support.

**Effort**: Medium

**Score**: 🔥 Must do

### 6. Unified Block Chrome

**What**: Standardize every block header:

- left: object icon, editable title, scope/connection;
- middle: task or breadcrumb only when useful;
- right: state, agent attention, primary action, overflow;
- hover: secondary actions;
- compact mode: icon/title/state only;
- focus mode: almost no chrome.

Avoid displaying equal visual weight for close, split, settings, connection, agent, and view-specific actions.

**Why 10x**: Blocks become calm and predictable even as capability grows.

**Impact**: Less header noise, faster action finding, fewer accidental closes.

**Effort**: Medium

**Score**: 👍 Strong

### 7. Universal Command Palette

**What**: One palette for:

- launch widget/app;
- open/reopen block;
- run widget action;
- switch tab/workspace;
- create scene;
- ask Kronos;
- search settings;
- find canvas node;
- recover recent closed surface;
- inspect health.

Results rank by current context, recency, frequency, and availability.

**Why 10x**: The product can grow without adding more permanent chrome.

**Impact**: Dramatically faster expert workflows and easier discovery.

**Effort**: Medium

**Score**: 🔥 Must do

### 8. Shared Design Tokens Across Host and Chamber

**What**: Define a versioned token contract for:

- surfaces and elevation;
- text hierarchy;
- borders and focus;
- accent and semantic status;
- spacing and density;
- typography;
- icon sizing;
- motion;
- terminal/code colors.

The host supplies tokens to Chamber. Chamber must render correctly without host CSS selectors that inspect its DOM.

**Why 10x**: The product feels intentional across native React, iframe/web content, tldraw, terminal, and plugins.

**Impact**: Faster theming, fewer visual regressions, better white-label/enterprise potential.

**Effort**: Medium

**Score**: 🔥 Must do

### 9. Performance Budgets by User Milestone

**What**: Measure and enforce:

- shell visible;
- existing terminal interactive;
- widget rail usable;
- first prompt accepted;
- Kronos first token;
- canvas interactive;
- first app stream frame;
- memory after idle and after opening Chamber.

Initial suggested targets on a warm modern Mac:

- shell visible: under 500 ms;
- terminal interactive: under 900 ms;
- prompt accepted: under 700 ms;
- cached Chamber sidecar usable: under 1.5 s;
- no route should preload more than 500 KB of unused JavaScript for its first interaction.

**Why 10x**: "Fast" becomes an owned product behavior instead of a vague optimization project.

**Impact**: Better prioritization and fewer regressions.

**Effort**: Medium

**Score**: 🔥 Must do

### 10. Split the Heavy Chamber Capabilities

**What**: Do not preload syntax highlighters, Mermaid, Cytoscape, HEIC conversion, CodeMirror, Ghostty, or diff engines for an empty chat. Load each renderer when content actually requires it. Use worker boundaries for syntax, diagrams, and image conversion.

**Why 10x**: The common path becomes light without removing advanced capability.

**Impact**: Faster startup, lower memory, less main-thread contention.

**Effort**: Medium/High

**Score**: 🔥 Must do

### 11. Canvas History, Recovery, and Branching

**What**: Add:

- visible saved/saving/offline/conflict states;
- named checkpoints;
- undo across semantic and visual changes;
- restore after crash;
- duplicate/branch scene;
- compare scene versions;
- conflict-safe merging for agent and user edits.

**Why 10x**: Users will only make the canvas central to work if it is more durable than a whiteboard.

**Impact**: Trust, experimentation, team handoff.

**Effort**: Medium/High

**Score**: 🔥 Must do

### 12. Accessibility and Input Parity

**What**: Set minimum hit targets, visible focus, screen-reader labels, reduced-motion mode, contrast targets, full keyboard navigation, and trackpad/pointer parity. Avoid critical 9-pixel labels. Make spatial navigation possible without precise dragging.

**Why 10x**: Dense developer tools often become inaccessible through accumulated small controls. Fixing the interaction foundation improves every user.

**Impact**: Better speed, comfort, and reach.

**Effort**: Medium

**Score**: 👍 Strong

---

## Small Gems

### 1. Merge the Duplicate AI Launchers

**What**: One launcher item for Kronos, with a long-press/overflow choice for sidecar, full Chamber, or new session.

**Why powerful**: Removes immediate identity confusion.

**Effort**: Low

**Score**: 🔥

### 2. Favorites Above Categories

**What**: Put 4-6 user-selected widgets at the top of the dock; move the full taxonomy behind expand/search.

**Why powerful**: Most users repeatedly use a tiny subset.

**Effort**: Low

**Score**: 🔥

### 3. Recent and Running Sections

**What**: Show recently used widgets and currently running/error/approval instances before the full catalog.

**Why powerful**: Resuming work is more common than launching from scratch.

**Effort**: Low/Medium

**Score**: 🔥

### 4. Drag Widget to Place

**What**: Drag a widget from the launcher into a split target or canvas position.

**Why powerful**: Removes the create-then-rearrange loop.

**Effort**: Medium

**Score**: 🔥

### 5. Live Agent Attention Halo

**What**: A restrained ring/badge on the one surface Kronos is reading or controlling, with "Inspect" on hover.

**Why powerful**: Immediate trust and orientation.

**Effort**: Low

**Score**: 🔥

### 6. One-Click Focus Mode

**What**: Hide rails, reduce block chrome, and center the active surface; Escape restores the scene.

**Why powerful**: Makes a complex workspace feel calm instantly.

**Effort**: Low/Medium

**Score**: 🔥

### 7. Canvas Minimap and "Find Lost Nodes"

**What**: A minimap plus one action to fit all or jump to off-screen active/error nodes.

**Why powerful**: Removes spatial anxiety.

**Effort**: Low/Medium

**Score**: 👍

### 8. Command Palette Everywhere

**What**: `⌘K` opens commands; typing `>` narrows to actions, `@` to widgets, `/` to scenes, and `?` to help.

**Why powerful**: One learned interaction scales with the product.

**Effort**: Medium

**Score**: 🔥

### 9. Meaningful Empty States

**What**: Empty canvas and empty Chamber show 3-5 outcome-based starters, not feature lists.

**Why powerful**: Teaches the product at the moment of need.

**Effort**: Low

**Score**: 🔥

### 10. Suspended Live Previews

**What**: When a live node is off-screen or inactive, show a recent snapshot and suspend expensive rendering.

**Why powerful**: Preserves the spatial feel without paying full CPU/GPU cost.

**Effort**: Medium

**Score**: 🔥

### 11. Icon Inspector in Development

**What**: A preview page that shows every product icon at all supported sizes, states, themes, and pixel densities.

**Why powerful**: Prevents visual drift and bad plugin icons.

**Effort**: Low

**Score**: 👍

### 12. Restore Last Closed Surface

**What**: `⌘⇧T` restores the last closed block with its placement and state.

**Why powerful**: Removes fear from workspace manipulation.

**Effort**: Low/Medium

**Score**: 🔥

### 13. Save Current Scene

**What**: One action saves widgets, sizes, positions, focus, and attached Kronos context as a named template.

**Why powerful**: Converts good manual setups into reusable value.

**Effort**: Medium

**Score**: 🔥

### 14. Replace Generic "Loading..." With Surface Skeletons

**What**: Use instant shells with specific readiness text: restoring terminal, connecting Chamber, loading syntax renderer, waiting for desktop stream.

**Why powerful**: Progress feels faster when it is concrete.

**Effort**: Low

**Score**: 👍

---

## Ruthless Evaluation

Scores: 1 is low, 5 is high. Feasibility is scored high when delivery risk is lower.

| Opportunity | Impact | Reach | Frequency | Differentiation | Defensibility | Feasibility | Verdict |
|---|---:|---:|---:|---:|---:|---:|---|
| One Spatial Workspace Kernel | 5 | 5 | 5 | 5 | 5 | 2 | 🔥 |
| Widget OS | 5 | 5 | 5 | 5 | 4 | 3 | 🔥 |
| Native Kronos Sidecar | 5 | 5 | 5 | 4 | 4 | 2 | 🔥 |
| Intent-to-Workspace Scenes | 5 | 4 | 4 | 5 | 4 | 3 | 🔥 |
| Instant Shell / Capability Islands | 5 | 5 | 5 | 3 | 3 | 3 | 🔥 |
| Semantic Icon System | 4 | 5 | 5 | 3 | 2 | 4 | 🔥 |
| App Icon Extraction | 4 | 4 | 4 | 2 | 1 | 4 | 🔥 |
| Canvas Progressive Disclosure | 4 | 4 | 5 | 3 | 2 | 4 | 🔥 |
| Universal Command Palette | 4 | 5 | 5 | 3 | 3 | 4 | 🔥 |
| Shared Host/Chamber Tokens | 4 | 5 | 5 | 3 | 3 | 3 | 🔥 |
| Canvas Versioning and Recovery | 5 | 4 | 4 | 4 | 4 | 3 | 🔥 |
| Voice-first navigation | 3 | 3 | 2 | 4 | 2 | 3 | 🤔 |
| Large widget marketplace now | 3 | 3 | 2 | 4 | 4 | 2 | 🤔 |
| More permanent sidebars | 2 | 5 | 5 | 1 | 1 | 4 | ❌ |
| More independent canvas modes | 2 | 3 | 3 | 2 | 1 | 2 | ❌ |
| More decorative agent animations before speed work | 2 | 4 | 4 | 2 | 1 | 4 | ❌ |

---

## Recommended Priority

### Do Now: 0-30 Days

1. **Declare one canonical workspace model**  
   Decision: KronTerm block identity plus `CanvasDocument` becomes the source of truth. Chamber canvas capabilities become input to that model, not a second model.

2. **Write the embedded Chamber contract**  
   Replace DOM/text hiding with explicit `sidecar` and `full-workbench` profiles. Stop adding new host patches to the packaged HTML.

3. **Create the icon grammar and migration map**  
   Inventory every current icon, assign object/action/state semantics, choose the canonical outline family, and define the compatibility adapter.

4. **Merge the two default AI launcher items**  
   User-facing name: Kronos or KronosCode. Remove ChatHub V2 as visible copy.

5. **Redesign the widget rail as favorites + running + search**  
   Preserve the current catalog behind expansion. Do not wait for the full Widget OS backend to improve the default hierarchy.

6. **Remove heavy Chamber assets from first interaction**  
   Shiki, Mermaid, Cytoscape, CodeMirror, HEIC, terminal, and diff engines must load on demand.

7. **Narrow packaging scope**  
   Package only the Chamber runtime files required in production. Add an artifact-size gate.

8. **Repair the standalone UI preview boundary**  
   It must ignore nested product workspaces and launch without scanning unrelated tsconfigs. Add previews for widget rail, block header, icon states, canvas toolbar, and Chamber sidecar.

9. **Define baseline metrics**  
   Measure startup milestones, Chamber time-to-composer, canvas time-to-interactive, bundle transfer/parse, memory, and widget-launch latency before visual restructuring begins.

### Do Next: 30-90 Days

1. **Ship the lightweight native Kronos sidecar**  
   Composer, messages, tool timeline, approvals, context, and active surface only.

2. **Ship canvas progressive disclosure**  
   One contextual inspector, one optional outline drawer, a compact creation control, and a collapsible Kronos sidecar.

3. **Build the Widget Manifest v1**  
   Identity, icon, actions, health, preferred size, live instances, drag payload, permissions, and context.

4. **Add real app icons and deterministic fallbacks**  
   Cache them and use the same assets in launcher, canvas nodes, tabs, and activity cards.

5. **Add universal command palette**  
   Widgets, apps, blocks, scenes, actions, settings, and Kronos in one search surface.

6. **Add scene save/restore and 5 first-party task scenes**  
   Debug web app, PR review, research, incident investigation, and desktop automation.

7. **Add canvas checkpoints and crash recovery UI**  
   Make save failure actionable and restoration visible.

8. **Unify design tokens across KronTerm and Chamber**  
   Include density, icons, focus, elevation, and motion—not only colors.

### Explore: 90-180 Days

1. **Complete the spatial kernel migration**  
   Let tile and canvas views operate on the same live widget instances.

2. **Agent-generated workspace choreography**  
   Kronos proposes and previews scenes, then creates/rearranges surfaces with full undo.

3. **Executable canvas edges**  
   Typed context, triggers, conditions, approvals, and verification gates.

4. **Team scene and widget marketplace**  
   Only after manifests, permissions, versioning, and recovery are stable.

5. **Replay and presentation mode**  
   Turn a completed workspace session into an inspectable timeline or demo.

### Backlog: Good, But Not Now

1. **More mascot animation** — revisit after interaction latency and hierarchy are excellent.
2. **Broad voice control** — wait for the widget action registry and approval grammar.
3. **Social/community canvas features** — wait for one durable canvas model.
4. **Many new widgets** — improve the object model and discovery before increasing catalog size.
5. **More layout modes** — tile, spatial, focused, and presentation are enough initially.

---

## Proposed Information Architecture

### Global Shell

- workspace/tab switcher;
- universal command/search;
- small global health/readiness indicator;
- user/settings.

### Adaptive Dock

- favorites;
- running and attention-needed surfaces;
- add/search;
- recent scenes;
- collapses fully in focus mode.

### Workspace

- tiled or spatial presentation of the same live objects;
- clear focused surface;
- drag/drop and keyboard layout operations;
- persistent undo/restore.

### Context Inspector

- selected widget/node properties;
- actions;
- state and health;
- agent permissions and attached context;
- history/checkpoints.

### Kronos

- compact action chip;
- widget-attached sidecar;
- floating canvas island;
- full Chamber workbench;
- one session across all presentations.

---

## Visual Direction

The right visual direction is "calm technical instrument," not "more cyberpunk."

Use:

- dark neutral surfaces with disciplined elevation;
- one restrained product accent plus semantic colors;
- brighter color only for live status, selection, and agent attention;
- 12-14 px body copy, never 9 px for essential navigation;
- fewer permanent borders;
- consistent 4/8 px spacing rhythm;
- crisp outline icons with controlled badge layers;
- motion that explains state changes, not ambient motion everywhere;
- previews and snapshots as content, not decorative cards;
- density presets: Compact, Comfortable, Presentation.

Kronos can keep a distinctive warm/gold identity, but it should appear as an intelligence/state accent rather than coloring every AI surface.

---

## Success Metrics

### Speed

- median shell-visible time;
- median terminal-interactive time;
- median first-prompt-accepted time;
- median Chamber-sidecar-interactive time;
- canvas time-to-interactive;
- app memory at idle and with one Chamber session;
- JavaScript parsed before the first chat interaction.

### Usability

- time to launch a known widget;
- time to resume an existing surface;
- percentage of actions completed through `⌘K`;
- launcher misclick and abandonment rate;
- number of visible permanent controls per state;
- canvas viewport percentage occupied by chrome;
- successful scene restore rate.

### Trust

- percentage of agent actions with visible target surface;
- save/conflict recovery success;
- user undo rate after agent layout changes;
- stale or duplicate widget instance rate;
- percentage of errors with a direct recovery action.

### Adoption

- users saving at least one scene;
- users attaching Kronos to a widget;
- weekly reuse of saved scenes;
- percentage of active sessions using more than one surface type;
- canvas sessions resumed on another day.

---

## Questions

### Answered

- **Q: Is the main problem visual polish?**  
  **A:** No. The primary problem is overlapping product shells and duplicated sources of truth. Visual polish should follow the structural unification.

- **Q: Should KronTerm keep a canvas?**  
  **A:** Yes. The canvas can be the defining surface, but only if it represents live workspace objects and shares identity/state with tiled blocks.

- **Q: Should KronosChamber remain a separate full workbench?**  
  **A:** Yes, as an expandable mode. It should not be the default heavyweight path for every chat, and it should embed through a stable profile contract.

- **Q: Is a complete icon redesign worth prioritizing?**  
  **A:** Yes, after defining the semantic grammar. It is a relatively feasible, high-frequency improvement that makes the whole product feel more coherent.

- **Q: Should more widgets be added now?**  
  **A:** Not broadly. Make existing widgets live, searchable, stateful, composable, and beautiful first.

### Blockers

- **Canonical canvas renderer**: the data/runtime model can be decided now, but the team should prototype whether tldraw remains the primary spatial renderer or whether React Flow becomes the semantic graph renderer with tldraw as an annotation layer.
- **Public AI naming**: choose whether the user-facing agent is "Kronos" or "KronosCode." Do not keep ChatHub V2 visible.
- **KronosChamber ownership boundary**: decide which team owns the versioned embedded profile and release compatibility.

---

## Next Steps

- [ ] Approve the north-star: one workspace kernel, multiple presentations.
- [ ] Choose the public naming model.
- [ ] Produce a one-page canonical widget manifest.
- [ ] Produce a one-page canonical canvas node/action contract.
- [ ] Create wireframes for dock, spatial workspace, inspector, and Kronos sidecar.
- [ ] Establish current startup and bundle baselines.
- [ ] Prototype a lightweight Chamber sidecar without Shiki/Mermaid/editor chunks.
- [ ] Prototype dragging one live terminal between tile and canvas presentations.
- [ ] Build the icon inventory and semantic migration map.
- [ ] Repair the standalone preview and add visual regression coverage for the new shell.
