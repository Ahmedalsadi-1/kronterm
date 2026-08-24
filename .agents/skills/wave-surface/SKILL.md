---
name: wave-surface
description: >-
  Control KronTerm's block layout, widget resizing, split management,
  workspace surface, and interactions within blocks. Use for layout
  management, block operations, element snapshots, clicks, typing,
  inspection, and block screenshots.
---

# KronTerm Surface Control

Control KronTerm's layout surface — blocks, widgets, splits, resize handles, and focus management via the `wave-surface` MCP server.

## Prerequisites

The `wave-surface` MCP server must be running. In your Codex config (`~/.Codex/claude_dotenv` or project `.Codex/settings.json`):

```json
{
  "mcpServers": {
    "wave-surface": {
      "command": "node",
      "args": ["/Users/albsheralsadi/kronterm/mcp-wave-surface/dist/index.js"]
    }
  }
}
```

Then restart Codex.

## Runtime Health and Limits

Call `surface_status` before diagnosing tool failures. ACP chat sessions in KronTerm receive a temporary one-hour Wave surface capability automatically. Standalone MCP launches still require `WAVETERM_JWT` for `wsh` operations; `WAVETERM_TABID` is also required for create, split, focus, and widget routes.

The current bridge exposes the active workspace presentation (`widgets`, `tabs`, or `canvas`), ordered live widgets, focus and visibility, visual bounds, split-tree or canvas geometry, whole-workspace screenshots, presentation switching, and presentation-aware movement, resize, navigation, magnification, fit, and arrange actions.

## Available Tools

### Widget Tools

| Tool             | Description                                                            |
| ---------------- | ---------------------------------------------------------------------- |
| `list_widgets`   | List all widgets in the current workspace (the launcher sidebar items) |
| `trigger_widget` | Execute a widget by key (e.g. `defwidget@term`) to create a block      |

### Block Tools

| Tool             | Description                                                             |
| ---------------- | ----------------------------------------------------------------------- |
| `list_blocks`    | List all blocks in the active tab with IDs, view types, and status      |
| `get_block_info` | Get metadata/details about a specific block by ID                       |
| `create_block`   | Create a new block with a specific view type (term, web, preview, etc.) |
| `close_block`    | Close/remove a block from the layout                                    |
| `set_block_meta` | Set metadata on a block (title, icon, connection, color)                |

### Presentation-Aware Workspace Tools

| Tool                             | Description                                                                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workspace_snapshot`             | **Call first.** Get active presentation, ordered widget IDs, titles/views, focus, visibility, screen bounds, canvas world bounds/camera, split tree, and supported actions |
| `workspace_screenshot`           | Capture the complete active widgets, tabs, or canvas surface as a real image payload                                                                                       |
| `workspace_set_presentation`     | Switch between `widgets`, `tabs`, and `canvas`                                                                                                                             |
| `workspace_focus_widget`         | Focus a pane, reveal a widget tab, or select a canvas widget                                                                                                               |
| `workspace_move_widget`          | Move relative to another widget in widgets/tabs, or set canvas world coordinates                                                                                           |
| `workspace_resize_widget`        | Resize an immediate tiled split by percentage or set canvas world geometry                                                                                                 |
| `workspace_swap_widgets`         | Swap two widgets in widgets or tabs presentation                                                                                                                           |
| `workspace_toggle_magnify`       | Toggle fullscreen magnification in widgets presentation                                                                                                                    |
| `workspace_navigate`             | Navigate spatially in widgets/canvas or sequentially in tabs                                                                                                               |
| `workspace_canvas_view`          | Fit canvas content or arrange live widgets into a fitted grid                                                                                                              |
| `workspace_canvas_add_note`      | Add a collision-free sticky note using optional canvas world coordinates                                                                                                   |
| `workspace_canvas_update_object` | Edit or reposition a sticky note or primitive whiteboard object                                                                                                            |
| `workspace_canvas_delete_object` | Delete a sticky note or primitive whiteboard object                                                                                                                        |
| `workspace_canvas_connect`       | Draw a connector between two whiteboard object IDs                                                                                                                         |

### Workspace Tools

| Tool                 | Description                                                          |
| -------------------- | -------------------------------------------------------------------- |
| `get_workspace_info` | Get current workspace info (active tab, window dimensions, AI panel) |

### Widget Human Simulation Tools

Tools for inspecting and interacting with elements inside blocks. Use these for "Computer Use" style automation within KronTerm blocks.

#### Element Discovery

| Tool                | Description                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `widget_snapshot`   | Get all interactive elements in a block with positions, roles, and names. Call this FIRST to see what's on screen |
| `widget_find`       | Find elements by role, name, value, or text. Returns matching refs                                                |
| `widget_inspect`    | Get full metadata for a specific element by ref: role, name, value, bounds, state, available actions              |
| `widget_element_at` | Identify which element is at specific screen coordinates within a block                                           |

#### Visual

| Tool                          | Description                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| `widget_screenshot`           | Capture a screenshot of any block (returns base64 PNG)                                       |
| `widget_screenshot_annotated` | Screenshot with element numbers overlaid — pairs with `widget_snapshot` for visual debugging |

#### Interaction

| Tool                | Description                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `widget_click`      | Click element by ref (@e3) or coordinates. Supports left/right/middle, single/double/triple |
| `widget_hover`      | Hover over element — triggers tooltips and CSS :hover states                                |
| `widget_type`       | Type text (use `widget_press` for special keys like Enter, Tab)                             |
| `widget_press`      | Press key combinations (e.g. `['Control', 'c']`, `['Enter']`)                               |
| `widget_scroll_to`  | Scroll to bring an element or position into view                                            |
| `widget_drag`       | Drag from one position to another — for sliders, reordering, canvas                         |
| `widget_long_press` | Press and hold — triggers context menus and Force Touch                                     |

#### Form Controls

| Tool               | Description                                      |
| ------------------ | ------------------------------------------------ |
| `widget_get_value` | Get current value of an input element            |
| `widget_set_value` | Set value of an input element                    |
| `widget_clear`     | Clear an input element's content                 |
| `widget_select`    | Select an option in a dropdown/select/combobox   |
| `widget_toggle`    | Toggle a checkbox, switch, or expandable element |

#### State & Utility

| Tool                   | Description                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `widget_wait_for`      | Wait for element condition (visible, hidden, focused, enabled, disabled) with timeout |
| `widget_get_state`     | Get block state: view type, dimensions, focus, view-specific state                    |
| `widget_clipboard_get` | Get clipboard content from a block                                                    |

## Common Workflows

### Split a terminal with a web browser

```
1. Snapshot:         workspace_snapshot
2. Create browser:   create_block view=web
3. Snapshot again:   workspace_snapshot
4. Place to right:   workspace_move_widget blockId=<web-id> targetBlockId=<term-id> direction=right
5. Focus browser:    workspace_focus_widget blockId=<web-id>
```

### Inspect before choosing a control

```
1. Snapshot:          workspace_snapshot
2. Visual context:    workspace_screenshot (only when appearance matters)
3. Read presentation and capabilities from the snapshot
4. Act with the matching workspace_* control
5. Verify:            workspace_snapshot again
```

### Reorder widgets in tabs versus canvas

```
# Tabs: relative order
workspace_move_widget blockId=<moving> targetBlockId=<target> position=before

# Canvas: world geometry from workspace_snapshot.worldbounds
workspace_move_widget blockId=<moving> x=0 y=320
workspace_resize_widget blockId=<moving> width=840 height=540
```

### Build a canvas task map

```
1. Inspect IDs/geometry: workspace_snapshot
2. Add a sticky note:    workspace_canvas_add_note text="Investigate login" color=amber x=0 y=320
3. Add the next note:    workspace_canvas_add_note text="Verify in sandbox" color=green x=0 y=560
4. Snapshot again:      workspace_snapshot
5. Connect the notes:   workspace_canvas_connect fromObjectId=<first-note-id> toObjectId=<second-note-id>
6. Verify:              workspace_snapshot
```

Canvas placements are collision-safe. A requested widget or note position may be moved to the nearest open whiteboard
space. Use the geometry returned by the verification snapshot as authoritative.

### Resize blocks in a split

```
1. Snapshot:         workspace_snapshot
2. Resize block:     workspace_resize_widget blockId=<block-id> size=70
3. Verify:           workspace_snapshot
```

### Create a multi-pane layout

```
1. Create terminal:    create_block view=term magnified=false
2. Create preview:     create_block view=preview file=~/
3. Move preview:       workspace_move_widget blockId=<preview-id> targetBlockId=<term-id> direction=right
4. Create chat:        create_block view=waveai
5. Move chat:          workspace_move_widget blockId=<chat-id> targetBlockId=<term-id> direction=down
6. Magnify terminal:   workspace_toggle_magnify blockId=<term-id>
7. Restore terminal:   workspace_toggle_magnify blockId=<term-id>
```

### Manage widgets

```
1. List widgets:     list_widgets
2. Trigger widget:   trigger_widget widgetKey=defwidget@ai
3. Set block title:  set_block_meta blockId=<block-id> key=frame:title value="AI Chat"
```

### Simulate a user interacting with a web page in a block

```
1. Snapshot:            widget_snapshot blockId=<block-id>
2. Screenshot:          widget_screenshot blockId=<block-id>
3. Click element:       widget_click blockId=<block-id> elementRef=@e3
4. Type into input:     widget_type blockId=<block-id> text="search query"
5. Press Enter:         widget_press blockId=<block-id> keys=['Enter']
6. Wait for results:    widget_wait_for blockId=<block-id> condition=visible timeoutMs=5000
```

### Inspect and verify page content

```
1. Snapshot elements:   widget_snapshot blockId=<block-id>
2. Inspect element:     widget_inspect blockId=<block-id> elementRef=@e5
3. Check value:         widget_get_value blockId=<block-id> elementRef=@e5
4. Annotated shot:      widget_screenshot_annotated blockId=<block-id>
```

## Decision Tree: Which Operation to Use

```
User wants to organize layout?
├── First learn mode/order/geometry → workspace_snapshot
├── Switch widgets/tabs/canvas → workspace_set_presentation
├── Split/place a pane → create_block then workspace_move_widget with a direction
├── Change pane/canvas size → workspace_resize_widget
├── Reorder or spatially move → workspace_move_widget or workspace_swap_widgets
├── Focus/reveal/select → workspace_focus_widget or workspace_navigate
├── Full-screen a tiled pane → workspace_toggle_magnify
├── Fit/arrange spatial canvas → workspace_canvas_view
├── Add content → create_block or trigger_widget
├── Remove content → close_block
└── See current rendered layout → workspace_snapshot (+ workspace_screenshot for appearance)

User wants to interact with elements inside a block?
├── See what's there → widget_snapshot (+ widget_screenshot for visual)
├── Get element details → widget_inspect <ref>
├── Click something → widget_click <ref> or widget_click x=<x> y=<y>
├── Type text → widget_type
├── Press special keys → widget_press (Enter, Tab, Ctrl+C, etc.)
├── Hover for tooltip → widget_hover
├── Fill form → widget_type + widget_select (dropdowns) + widget_toggle (checkboxes)
├── Get input value → widget_get_value
├── Drag slider → widget_drag from (x1,y1) to (x2,y2)
├── Wait for load → widget_wait_for condition=visible
└── Scroll to element → widget_scroll_to <ref>
```

## Error Handling

| Scenario                                   | Likely Cause                           | Fix                                                                                 |
| ------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------- |
| `workspace_move_widget` fails              | Stale ID or missing target/geometry    | Re-run `workspace_snapshot` and use IDs/bounds from that result                     |
| `workspace_resize_widget` has no effect    | Wrong presentation or solo tiled block | Check snapshot capabilities; tabs do not resize and solo tiled blocks have no split |
| `workspace_toggle_magnify` doesn't respond | Presentation is tabs or canvas         | Switch to widgets presentation first                                                |
| `trigger_widget` returns nothing           | Widget key misspelled                  | Run `list_widgets` to see available keys                                            |
| `set_block_meta` ignored                   | Wrong key name                         | Valid keys: `frame:title`, `frame:icon`, `connection`, `color`                      |
| `widget_snapshot` returns empty            | Block has no interactive elements      | Try `widget_screenshot` to see what's actually rendered                             |
| `widget_click` on ref fails                | Ref stale (page changed)               | Re-run `widget_snapshot` to get fresh refs                                          |
| `widget_type` not appearing                | Element not focused                    | Use `widget_click` on the field first                                               |
| `widget_wait_for` times out                | Element never reached condition        | Increase `timeoutMs` or check if element ref is correct                             |

## Anti-Patterns

- **NEVER assume block IDs are persistent** across sessions or split operations — always re-fetch with `list_blocks` before operating
- **NEVER infer the presentation from block metadata** — call `workspace_snapshot`; `widgets`, `tabs`, and `canvas` have different visibility and geometry semantics
- **NEVER use screen `bounds` to move canvas widgets** — use `worldbounds`; screen bounds are for visual/pointer interaction
- **NEVER report a workspace mutation as complete from its acknowledgement alone** — verify with a fresh `workspace_snapshot`
- **NEVER try to move a magnified block into a split** — restore it first, then move
- **NEVER use raw block numbers (1, 2, 3) as block IDs** — `focus_block` accepts number, but for all other tools use the opaque ID from `list_blocks`
- **NEVER split a block you just created** without first waiting for it to render — the ID may not be usable yet
- **NEVER set tiled resize to 0 or 100** — use values between 10-90; canvas width/height instead use the minimums returned by the tool schema
- **DON'T create more than 6-8 blocks in one tab** — layout becomes unmanageable; use multiple tabs instead
- **DON'T reuse element refs after page navigation** — refs are per-snapshot; re-run `widget_snapshot` after navigation
- **DON'T use `widget_type` for Enter, Tab, or Escape** — use `widget_press` instead (these are control keys, not text)
- **DON'T click before checking the element exists** — run `widget_snapshot` first, verify the ref is present
- **DON'T wait for elements that may never appear** — always set a reasonable `timeoutMs` (default 10s, max 60s)

## Notes

- Block IDs are opaque strings — always use `list_blocks` or `get_layout_tree` first
- `workspace_toggle_magnify` is a toggle — call it again to restore
- Tiled `workspace_resize_widget` uses proportional sizing (10-90) within the immediate sibling split
- Directional `workspace_move_widget` changes the split tree; relative before/after changes tab order
- Element refs (e.g. `@e3`) are **per-snapshot** — re-run `widget_snapshot` after any page change
- For annotated screenshots, enable `showElements=true` to overlay ref numbers
- `widget_type` accepts regular text only; use `widget_press` for control keys
- Each widget operation requires a `blockId` — use `list_blocks` to find the right block
