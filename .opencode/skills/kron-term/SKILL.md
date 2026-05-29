---
name: kron-term
description: >-
  Control KronTerm's block layout, widget resizing, split management,
  workspace surface, and interactions within blocks. Use for layout
  management, block operations, element snapshots, clicks, typing,
  inspection, and block screenshots.
---

# KronTerm Surface Control

Control KronTerm's layout surface — blocks, widgets, splits, resize handles, and focus management via the `kron-term` MCP server.

## Prerequisites

The `kron-term` MCP server must be registered and running:

### Option A: ACP Agent (primary — KronTerm AI)

Already wired into `emain/acp/acp-agent-manager.ts` — passes `kron-term` MCP config in `session/new`. No manual setup needed.

### Option B: OpenCode

Manually registered in `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "KRON_TERM": {
      "command": "node",
      "args": ["/path/to/kronterm/mcp-kron-term/dist/index.js"],
      "enabled": true,
      "type": "local"
    }
  }
}
```

Replace `/path/to/kronterm` with the actual path. Then restart opencode.

### Option C: Direct Launch (testing)

```bash
node /path/to/kronterm/mcp-kron-term/dist/index.js
```

Connect via MCP inspector or any MCP-compatible client.

## Runtime Health and Limits

Call `surface_status` before diagnosing tool failures. ACP chat sessions in KronTerm receive a temporary one-hour Wave surface capability automatically. Standalone MCP launches still require `KRONTERM_JWT` for `wsh` operations; `KRONTERM_TABID` is also required for create, split, focus, and widget routes.

The current bridge supports block listing, creation, closing, focus, metadata, widget launch/listing, split creation, and `widget_*` interaction. Resize, swap, move, magnify, directional navigation, and true split-tree inspection are reserved until `wsh` exposes a layout-action route.

## Available Tools

### Widget Tools

| Tool | Description |
|------|-------------|
| `trigger_widget` | Execute a widget by key (e.g. `defwidget@term`) to create a block |

### Block Tools

| Tool | Description |
|------|-------------|
| `list_blocks` | List all blocks in the active tab with IDs, view types, and status |
| `get_block_info` | Get metadata/details about a specific block by ID |
| `create_block` | Create a new block with a specific view type (term, web, preview, etc.) |
| `close_block` | Close/remove a block from the layout |
| `set_block_meta` | Set metadata on a block (title, icon, connection, color) |

### Resize Tools

| Tool | Description |
|------|-------------|
| `resize_block` | Set the proportional size factor of a block within a split (1-100) |

### Layout Surface Tools

| Tool | Description |
|------|-------------|
| `swap_blocks` | Swap the positions of two blocks in the layout |
| `move_block` | Move a block to a position before or after another block |
| `focus_block` | Focus a block by ID or block number |
| `magnify_block` | Toggle magnification (fullscreen) of a block |
| `navigate_focus` | Navigate focus between blocks in a direction (up/down/left/right) |
| `get_layout_tree` | Get the full layout tree showing how blocks are arranged |

### Workspace Tools

| Tool | Description |
|------|-------------|
| `get_workspace_info` | Get current workspace info (active tab, window dimensions, AI panel) |

### Notifications & Badges

| Tool | Description |
|------|-------------|
| `notify` | Send a desktop notification |
| `tab_set_badge` | Set a badge count on a tab |
| `tab_clear_badge` | Clear a badge count from a tab |
| `tab_set_background` | Set a background color/effect on a tab |
| `tab_clear_background` | Clear a background color/effect from a tab |

### Connection Management

| Tool | Description |
|------|-------------|
| `connection_list` | List all active SSH/WSL/container connections |
| `connection_connect` | Open a new connection to a remote host |
| `connection_disconnect` | Disconnect a specific connection |
| `connection_disconnect_all` | Disconnect all active connections |

### AI Integration

| Tool | Description |
|------|-------------|
| `ai_append` | Append text to the AI panel conversation |

### Secrets

| Tool | Description |
|------|-------------|
| `secret_list` | List all stored secret keys |
| `secret_get` | Retrieve a stored secret by key |
| `secret_set` | Store a secret value by key |
| `secret_delete` | Delete a stored secret by key |

### Command Execution

| Tool | Description |
|------|-------------|
| `block_run_command` | Run a shell command in a terminal block |

### Variables

| Tool | Description |
|------|-------------|
| `block_get_variables` | Get environment/block variables (key-value storage) |
| `block_set_variables` | Set environment/block variables (key-value storage) |

### Widget Human Simulation Tools

Tools for inspecting and interacting with elements inside blocks. Use these for "Computer Use" style automation within KronTerm blocks.

#### Element Discovery

| Tool | Description |
|------|-------------|
| `widget_snapshot` | Get all interactive elements in a block with positions, roles, and names. Call this FIRST to see what's on screen |
| `widget_find` | Find elements by role, name, value, or text. Returns matching refs |
| `widget_inspect` | Get full metadata for a specific element by ref: role, name, value, bounds, state, available actions |
| `widget_element_at` | Identify which element is at specific screen coordinates within a block |

#### Visual

| Tool | Description |
|------|-------------|
| `widget_screenshot` | Capture a screenshot of any block (returns base64 PNG) |
| `widget_screenshot_annotated` | Screenshot with element numbers overlaid — pairs with `widget_snapshot` for visual debugging |

#### Interaction

| Tool | Description |
|------|-------------|
| `widget_click` | Click element by ref (@e3) or coordinates. Supports left/right/middle, single/double/triple |
| `widget_hover` | Hover over element — triggers tooltips and CSS :hover states |
| `widget_type` | Type text (use `widget_press` for special keys like Enter, Tab) |
| `widget_press` | Press key combinations (e.g. `['Control', 'c']`, `['Enter']`) |
| `widget_scroll_to` | Scroll to bring an element or position into view |
| `widget_drag` | Drag from one position to another — for sliders, reordering, canvas |
| `widget_long_press` | Press and hold — triggers context menus and Force Touch |

#### Form Controls

| Tool | Description |
|------|-------------|
| `widget_get_value` | Get current value of an input element |
| `widget_set_value` | Set value of an input element |
| `widget_clear` | Clear an input element's content |
| `widget_select` | Select an option in a dropdown/select/combobox |
| `widget_toggle` | Toggle a checkbox, switch, or expandable element |

#### State & Utility

| Tool | Description |
|------|-------------|
| `widget_wait_for` | Wait for element condition (visible, hidden, focused, enabled, disabled) with timeout |
| `widget_get_state` | Get block state: view type, dimensions, focus, view-specific state |
| `widget_clipboard_get` | Get clipboard content from a block |

## Common Workflows

### Create a multi-pane layout

```
1. Create terminal:    create_block view=term magnified=false
2. Split right:        create_block view=preview file=~/ 
3. Set block title:    set_block_meta blockId=<block-id> key=frame:title value="Files"
```

### Manage widgets

```
1. Trigger widget:   trigger_widget widgetKey=defwidget@ai
2. Set block title:  set_block_meta blockId=<block-id> key=frame:title value="AI Chat"
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

### Send notification

```
1. Notify user:       notify title="Build Complete" body="All tests passed" severity=info
```

### Manage tabs

```
1. Set badge:         tab_set_badge tabId=<tab-id> count=3
2. Clear badge:       tab_clear_badge tabId=<tab-id>
3. Set background:    tab_set_background tabId=<tab-id> color="rgba(255,0,0,0.1)"
4. Clear background:  tab_clear_background tabId=<tab-id>
```

## Decision Tree: Which Operation to Use

```
User wants to organize layout?
├── Split a pane → create_block (or split_horizontal/split_vertical via wsh)
├── Change pane size → resize_block (get layout tree first)
├── Reorder panes → swap_blocks or move_block
├── Focus a pane → focus_block (by ID) or navigate_focus (by direction)
├── Full-screen a pane → magnify_block (toggle, call again to restore)
├── Add content → create_block or trigger_widget
├── Remove content → close_block
└── See current layout → get_layout_tree or list_blocks

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

| Scenario | Likely Cause | Fix |
|----------|-------------|-----|
| `resize_block` has no effect | Block not in a split | Check `get_layout_tree` — solo blocks can't resize |
| `magnify_block` doesn't respond | Block already magnified | Call it again to toggle back |
| `trigger_widget` returns nothing | Widget key misspelled | Run `list_widgets` to see available keys |
| `set_block_meta` ignored | Wrong key name | Valid keys: `frame:title`, `frame:icon`, `connection`, `color` |
| `widget_snapshot` returns empty | Block has no interactive elements | Try `widget_screenshot` to see what's actually rendered |
| `widget_click` on ref fails | Ref stale (page changed) | Re-run `widget_snapshot` to get fresh refs |
| `widget_type` not appearing | Element not focused | Use `widget_click` on the field first |
| `widget_wait_for` times out | Element never reached condition | Increase `timeoutMs` or check if element ref is correct |

## Anti-Patterns

- **NEVER assume block IDs are persistent** across sessions or split operations — always re-fetch with `list_blocks` before operating
- **NEVER try to split a magnified block** — un-magnify first, then split
- **NEVER use raw block numbers (1, 2, 3) as block IDs** — `focus_block` accepts number, but for all other tools use the opaque ID from `list_blocks`
- **NEVER split a block you just created** without first waiting for it to render — the ID may not be usable yet
- **NEVER set resize to 0 or 100** — use values between 10-90; extremes can hide blocks
- **DON'T create more than 6-8 blocks in one tab** — layout becomes unmanageable; use multiple tabs instead
- **DON'T reuse element refs after page navigation** — refs are per-snapshot; re-run `widget_snapshot` after navigation
- **DON'T use `widget_type` for Enter, Tab, or Escape** — use `widget_press` instead (these are control keys, not text)
- **DON'T click before checking the element exists** — run `widget_snapshot` first, verify the ref is present
- **DON'T wait for elements that may never appear** — always set a reasonable `timeoutMs` (default 10s, max 60s)

## Notes

- Block IDs are opaque strings — always use `list_blocks` or `get_layout_tree` first
- `magnify_block` is a toggle — call it again to un-magnify
- `resize_block` uses proportional sizing (1-100) — values are relative to sibling blocks
- When splitting, the original block shrinks to make room for the new block
- Element refs (e.g. `@e3`) are **per-snapshot** — re-run `widget_snapshot` after any page change
- For annotated screenshots, enable `showElements=true` to overlay ref numbers
- `widget_type` accepts regular text only; use `widget_press` for control keys
- Each widget operation requires a `blockId` — use `list_blocks` to find the right block
