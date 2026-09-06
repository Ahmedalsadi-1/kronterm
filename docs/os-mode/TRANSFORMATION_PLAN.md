# OS Mode Transformation Plan — 2026-09

Supersedes conflicting parts of `UI_RULES.md`, `MOTION_SPEC.md`, and the `PHASE_01–10` docs (those produced the current
unfinished OS). The five references in `assets/future-os/*.jpeg` (A: main workspace, B: command center + widgets, C:
app stream + mode selector, D: full canvas OS, E: Hermes driving a focused app) are the visual contract. The direction
is calm, light, desktop-like, canvas-native — no 3D Cover Flow, no perspective gimmicks, no neon.

## Current state (audit)

| Area | File(s) | Status |
| --- | --- | --- |
| Presentation registry | `frontend/app/tab/workspace-presentation.ts` | `"os"` registered |
| OS shell + dock + launcher | `frontend/app/tab/os-workspace.tsx` (`OSModeShell`) | Exists; floating dock, icon-font glyphs, simple launcher modal |
| OS state model | `frontend/app/tab/os-workspace-model.ts` | **Solid — keep.** `OSModeState` (camera/windows/zOrder/groups/objects/scene), typed `spatial.*` reducer, persistence in tab meta, canvas-seed reconciliation |
| Spatial windows | `os-workspace.tsx` (`OSCanvasEntity`), framer-motion | Exists |
| Canvas engine | `frontend/app/tab/workspace-canvas.tsx` + utils/drift/agent/context | Exists; OS mode reuses camera/transform patterns |
| Session identity | blocks + WOS ORefs; OS windows keyed by `blockId` | **Invariant already holds** — one block = one session across presentations |
| Command palette | `frontend/app/modals/command-palette.tsx`, `command-palette-utils.ts` | Exists; command actions search only — extend |
| Installed apps + real icons | `RpcApi.ListInstalledAppsCommand` → `InstalledAppInfo[]` incl. `data:` icon URLs; `frontend/app/view/installedapps/installedapps.tsx` | **Real icons available from platform metadata** |
| App stream | `frontend/app/view/appstream/` | Live native/remote app surfaces exist |
| Hermes | `frontend/app/view/hermes/` (`hermes-model`, `hermes-canvas-context`, `hermes-surface-controller`) | Session + canvas context + typed controller exist |
| Wallpaper | `window:wallpaper`, `window:surfaceopacity`, `workspace-wallpaper.tsx` | Exists |
| Widgets | BlockRegistry views: sysinfo, preview, web, hermes, chathubv2, … | No weather/now-playing/calendar views yet — start catalog from existing views; new widget views are additive, low priority |

## Reuse rules

- OS windows render **existing blocks** — never create duplicate sessions (see `PHASE_00_AUDIT.md` §5).
- All launch paths (dock, command center, app stream, Hermes, launcher) funnel through **one** app/session service.
- Shell = screen space; windows/widgets = world space. Non-negotiable.
- Existing tests must keep passing: `os-workspace-model.test.ts`, `workspace-presentation.test.ts`, `kronarchy-shell.test.ts`.

## Phases

### Phase 1 — AppRegistry / AppDescriptor

Create `frontend/app/store/app-registry.ts` (+ test): derives `AppDescriptor {id, name, icon, category, aliases,
runningBlockIds, pinned, launch()}` from three sources — BlockRegistry views (Terminal, Hermes, Preview…), live
blocks (running sessions), and `ListInstalledAppsCommand` (Chrome, Sheets, VS Code…). `launch()` = focus existing
block if running, else `createBlock` (web app → `web` view; native app → `appstream`/open). One registry consumed by
dock, command center, app stream, canvas cards.

### Phase 2 — Shell rebuild (os-workspace.tsx + os-workspace.scss)

Top-left: KronTerm brand + workspaces `1 2 3 4 +` (quiet active fill). Top-center: **connected dock** — carve an inset
into the shell's lower boundary around the dock (SVG/mask curve, not a floating pill), populated from AppRegistry,
active app = subtle highlight + small dot. Top-right: clock/system + **[Hermes] [Widgets] [Canvas ▾]** selector
(Canvas | File). Reuse existing workspace switching + wallpaper menu.

### Phase 3 — Real icons everywhere

`AppIcon` component (data-URL `<img>`, fallback to icon class). Replace `makeIconClass(blockViewToIcon(view))` in
dock, launcher, collapsed dock, command center results, app stream cards, window titlebars.

### Phase 4 — Command Center (⌘⇧Space)

Extend `frontend/app/modals/command-palette.tsx` (or a sibling os-modal) with result groups: Top Results, Applications
(AppRegistry, real icons), Commands (existing palette actions), Workspaces, Widgets, Recent files, Hermes actions.
Keyboard: ↑↓/Enter/Esc/⌘number. Bind ⌘⇧Space in `frontend/app/store/keymodel.ts` (verify current binding first —
avoid collisions).

### Phase 5 — App Stream rail

`frontend/app/view/osmode/app-stream-rail.tsx`: compact live-session cards (real icon, title, subtitle, running dot)
from AppRegistry running sessions + pinned installed apps. Click → focus/launch. Drag → place block on canvas
(spatial.move + bounds). Vertical left or right per composition; collapses at narrow widths.

### Phase 6 — Canvas OS composition + window styling

OS tokens (`--os-shell-bg`, `--os-panel-*`, `--os-radius-*`, shadow) in os-mode SCSS. Window chrome: 12–18px radius,
1px `rgba(0,0,0,.08)` border, near-white translucent bg, soft broad shadow, compact titlebar; focus = slightly
stronger border/shadow. Remove perspective/coverflow from default scenes; overview becomes a calm zoomed-out grid.
Default freeform composition balanced (Hermes panel left, focused app center, stream right) with wallpaper breathing
room. Interaction boundaries: canvas pan gestures never swallow webview/terminal/textarea input.

### Phase 7 — Widget Canvas/File duality

Widget presentation state `"canvas" | "file"` on the OS model. Canvas = spatial (existing). File = grouped list
(System / Productivity / Media / Agents) overlay panel. Drag File→Canvas sets bounds on the same blockId (no data
duplication); drag back clears placement, keeps config.

### Phase 8 — Hermes panel + context

Hermes left-panel presentation (Reference A/E). Greeting + suggestions. Suggestions derive from focused block via
`hermes-canvas-context.ts` (Sheets → "Analyze this budget", Term → "Summarize output", repo → "Summarize this
repository"). Active-control state ("Hermes is working — Driving your sheet") while a Hermes run targets the focused
block; subtle 1–2px accent on the active window, no beams.

### Phase 9 — Typed os.* actions

Extend `OSSpatialAction`/surface runtime + `hermes-surface-controller.ts` with `os.openApp, os.focusApp,
os.moveWindow, os.resizeWindow, os.switchWorkspace, os.openCommandCenter, os.showWidget,
os.setWidgetPresentation, os.createCanvas, os.focusSession, os.openFile`. No DOM mutation from the agent.

### Phase 10 — Motion

Framer-motion, ease-out/spring, no overshoot: hover 100–140ms, menus 140–180ms, panels 180–240ms, window focus
180–260ms, dock reorder 180–260ms, Hermes dock 220–320ms, canvas snap 220–300ms, mode switch 260–380ms.
`prefers-reduced-motion` → instant. 1:1 while dragging.

### Phase 11 — QA + regression

Per phase: launch app, set `app:layoutmode:"os"`, screenshot. This session's agent **cannot view images** (model lacks
image input; multimodal agent route down), so QA uses: AX-tree annotate (structure/positions), `colorAt` sampling
(token colors), existing + new Vitest suites (session survival across scenes, reducer), `task check:ts`,
`npm test -- --run`, and **user visual confirmation against the five references** at each phase gate. Production
build: `task build:prod` (never `npm run start` — known OOM).

## Acceptance

Track against the goal's checklist (§28 of the master prompt). Session-survival criteria are already testable via
`os-workspace-model.test.ts` patterns; add reducer tests for every new action.

## Risks

- Webview/terminal remount on scene change — mitigate: keyed by blockId, no remounts, framer `layoutId`.
- Camera state must stay per-presentation (already separate from canvas).
- ⌘⇧Space conflicts with an existing binding — check keymodel before registering.
- Multiple live webviews memory — render full fidelity only for focused + visible; collapse others.
- Palette regression — extend, don't fork, the existing command palette.
