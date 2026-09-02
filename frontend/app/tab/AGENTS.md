# frontend/app/tab — Workspace Presentations

**Parent:** `../AGENTS.md`

## OVERVIEW

Implements the three workspace presentations that share one block set: tiled `widgets`, browser-style `tabs`, and the spatial `canvas`. Selected via `app:layoutmode`.

## KEY FILES

| File | Purpose |
| ---- | ------- |
| `widget-tabs-layout.tsx` | Tiled splits presentation (widgets mode) |
| `workspace-canvas.tsx` | Spatial canvas presentation |
| `tabbar.tsx`, `tabbar-model.ts` | Tab strip state and rendering |
| `tabcontent.tsx` | Renders the focused block in tabs mode |
| `tabgroup.tsx` | Tab group / split pane rendering |
| `os-workspace.tsx`, `os-workspace-model.ts` | Kronarchy OS-style workspace shell |
| `tabs-agent-workspace.ts` | Agent workspace integration in tabs mode |
| `folded-widgets-bar.tsx` | Bar for folded widgets |
| `tabcontextmenu.ts` | Tab right-click menus (see context-menu skill) |
| `tabbarenv.ts` | WaveEnv narrowing for tabbar components |

## CONVENTIONS

- All three presentations mount the same blocks — never fork block state per presentation.
- Tab/tabbar state models live here and in `../store/tab-model.ts`; components stay thin.
- Tests colocated next to sources (`os-workspace-model.test.ts`, `tabs-agent-workspace.test.ts`).

## ANTI-PATTERNS

- No block creation logic here — blocks are created via `RpcApi.createBlockCommand` (see `../block/AGENTS.md`).
- Do not read layout geometry from the DOM — go through the layout model (`frontend/app/workspace/workspace-layout-model.ts`).
