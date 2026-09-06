# Session Summary: Agent Activity Overlays

**Date:** 2026-05-28  
**Focus:** Agent activity overlay system for KronTerm — FlickeringGrid component, event chain from MCP server through to frontend, activity-aware tool wrapping

## Goal

Implement agent activity overlays (FlickeringGrid + aura) that display when ACP/MCP agents interact with browser/sandbox blocks, with activity reporting from the MCP surface server through to the frontend overlay components.

## What We Did

### 1. Created FlickeringGrid Component
- **File:** `frontend/app/element/flickering-grid.tsx`
- Canvas-based grid animation (MagicUI-style) with randomly flickering squares
- `IntersectionObserver` for performance — disables animation when off-screen
- Fully customizable: `squareSize`, `gridGap`, `flickerChance`, `color`, `maxOpacity`
- Integrated into `AgentWidgetOverlay` in `blockframe.tsx` as background layer behind the aura
- Color: teal (`rgb(0,255,200)`) for `pixel` pointer style, indigo (`rgb(99,102,241)`) for `smooth`/`minimal`

### 2. Diagnosed Root Cause of Invisible Overlays
The agent activity overlay never showed because **no `agent:surfaceactivity` events were being published** by the `mcp-kron-term` MCP server. The ACP event chain (`use-acp-session.ts` → `reportDesktopPetActivity` → `blockIdFromToolInput`) could not work because ACP tool params don't include `blockId`.

### 3. Fire-and-Forget Activity Publishing
- Updated `WshBridge.publishAgentSurfaceActivity` (in `wsh-bridge.ts`) to use `spawn` (detached, `unref`'d) instead of `execFileSync`
- Activity reporting no longer blocks tool execution — non-critical UI feedback

### 4. Activity Helper Framework (in `mcp-kron-term/src/index.ts`)
Added four exports:
- **`toolActivityMap`** — Maps 30+ tool names to `{action, detail}` descriptors
- **`inferSurface(blockId)`** — Infers block type from ID prefix: `sb-` → sandbox, `web-` → browser, `term-` → terminal; falls back to `"browser"`
- **`publishActivity(blockId, toolName)`** — Calls WshBridge to fire the event, errors silently caught
- **`wrapActivity(toolName)`** — Decorator that wraps any tool handler to auto-publish activity

### 5. Wrapped 30 Tool Handlers
All interactive tools that modify blocks or perform agent actions now report activity:

**Widget Tools (22):** `widget_snapshot`, `widget_find`, `widget_inspect`, `widget_element_at`, `widget_screenshot`, `widget_screenshot_annotated`, `widget_click`, `widget_hover`, `widget_type`, `widget_press`, `widget_scroll_to`, `widget_drag`, `widget_long_press`, `widget_get_value`, `widget_set_value`, `widget_clear`, `widget_select`, `widget_toggle`, `widget_wait_for`, `widget_get_state`, `widget_clipboard_get`, `widget_clipboard_set`

**Browser Tools (3):** `browser_open`, `browser_navigate`, `browser_get_html`

**Block/Terminal Tools (5):** `create_block`, `focus_block`, `block_run_command`, `terminal_open`, `terminal_scrollback`

## Event Chain (End-to-End)

```
mcp-kron-term tool handler
  → wrapActivity(toolName) decorator fires
    → publishActivity(blockId, toolName)
      → WshBridge.publishAgentSurfaceActivity(blockId, action, detail)
        → spawn("wsh", ["agentactivity", JSON.stringify({})])
          → Go: agentActivityRun → EventPublishCommand
            → WPS event "agent:surfaceactivity" sent to webapp
              → frontend/global.ts: waveEventSubscribeSingle("agent:surfaceactivity")
                → reportAgentSurfaceActivity(data)
                  → dispatches "agent-widget-activity" CustomEvent on window
                    → AgentWidgetOverlay in blockframe.tsx receives it
                      → Shows FlickeringGrid + aura on the correct block
```

## Key Decisions
- **MCP server as source of truth** — not ACP event chain, because MCP has the actual `blockId` from tool parameters
- **Fire-and-forget over blocking** — activity is non-critical UI feedback; uses `spawn`+`unref` so it never adds latency
- **Surface inference heuristic** — block ID prefix matching (`sb-`, `web-`, `term-`) without querying block metadata on every call
- **Silent failures** — `publishActivity` catches errors with `.catch(() => undefined)` — activity failures never impact tool execution

## What's Ready
- Full FlickeringGrid component with performance optimization
- Complete event chain from MCP tool execution to frontend overlay
- 30 tool handlers wrapped with activity decorators
- ACP-side fallback via `use-acp-session.ts` → `reportDesktopPetActivity` (works when `blockIdFromToolInput` succeeds)

## Relevant Files
- `frontend/app/element/flickering-grid.tsx` — NEW canvas-based FlickeringGrid
- `frontend/app/block/blockframe.tsx` — AgentWidgetOverlay with FlickeringGrid integration
- `frontend/app/block/agent-widget-settings.ts` — Visual settings defaults
- `frontend/app/aipanel/desktop-pet-activity.ts` — Activity event types/reporting
- `frontend/app/store/global.ts` — WPS event subscription
- `mcp-kron-term/src/index.ts` — Activity helpers + 30 wrapped tool handlers
- `mcp-kron-term/src/wsh-bridge.ts` — Fire-and-forget activity publishing via spawn
- `cmd/wsh/cmd/wshcmd-agentactivity.go` — Go CLI command
- `pkg/wps/wpstypes.go` — WPS event definitions
