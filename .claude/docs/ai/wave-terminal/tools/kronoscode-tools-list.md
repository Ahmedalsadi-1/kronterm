# Complete List of KronosCode Tools

This document lists ALL tools available in the KronosCode AI coding agent that can be copied to Wave Terminal.

---

## 1. CORE BUILT-IN TOOLS

| Tool ID             | Description                        |
| ------------------- | ---------------------------------- |
| `invalid`           | Invalid tool placeholder           |
| `question`          | Ask user questions interactively   |
| `bash`              | Execute shell commands             |
| `read`              | Read files from the filesystem     |
| `glob`              | Find files by glob patterns        |
| `grep`              | Search file contents with regex    |
| `edit`              | Edit files using search/replace    |
| `write`             | Write/create new files             |
| `task`              | Spawn agent tasks                  |
| `webfetch`          | Fetch web page content             |
| `todowrite`         | Manage todo lists                  |
| `todoread`          | Read todo list items               |
| `websearch`         | Search the web                     |
| `codesearch`        | Search code examples on GitHub     |
| `skill`             | Use AI skills                      |
| `skill_update`      | Update/create skills               |
| `everywhere`        | Native app control (macOS/Windows) |
| `openfang`          | OpenFang automation                |
| `dynamic`           | Create dynamic tools               |
| `snapshot_save`     | Save session snapshot              |
| `snapshot_restore`  | Restore session snapshot           |
| `agent_spawn`       | Spawn AI agents                    |
| `doctor`            | Environment diagnostics            |
| `persona`           | AI persona tuning                  |
| `notify`            | Send notifications                 |
| `review`            | Code review                        |
| `docs`              | Documentation maintenance          |
| `forge`             | Agent forge                        |
| `acp_proxy`         | ACP proxy                          |
| `swarm`             | Swarm discovery                    |
| `mesh_search`       | Mesh search                        |
| `compact`           | Context compaction                 |
| `handoff`           | Session handoff                    |
| `autosave`          | Auto-save sessions                 |
| `consensus`         | Multi-model consensus              |
| `ghost_stash`       | Ghost branch staging               |
| `health`            | Project health check               |
| `predictive_skills` | Predictive skill loading           |
| `apply_patch`       | Apply code patches                 |
| `lsp`               | Language Server Protocol           |
| `batch`             | Batch operations                   |

---

## 2. SCREENPIPE TOOLS (Screen + Audio Capture)

| Tool ID              | Description                 |
| -------------------- | --------------------------- |
| `screenpipe_search`  | Search screen/audio content |
| `screenpipe_recall`  | Recall past screen content  |
| `screenpipe_context` | Get AI context from screen  |
| `screenpipe_digest`  | Digest screen content       |

**Requirements**: Screenpipe server running on port 3030

---

## 3. E2B DESKTOP SANDBOX TOOLS

| Tool ID                     | Description           |
| --------------------------- | --------------------- |
| `e2b_create`                | Create E2B sandbox    |
| `e2b_list`                  | List E2B sandboxes    |
| `e2b_providers`             | Get E2B providers     |
| `e2b_takeover`              | Take over E2B sandbox |
| `e2b_release`               | Release E2B sandbox   |
| `e2b_quota`                 | Get quota info        |
| `e2b_desktop_screenshot`    | Capture screenshot    |
| `e2b_desktop_click`         | Click on screen       |
| `e2b_desktop_type`          | Type text             |
| `e2b_desktop_hotkey`        | Press hotkey          |
| `e2b_desktop_drag`          | Drag mouse            |
| `e2b_desktop_window_list`   | List windows          |
| `e2b_desktop_window_focus`  | Focus window          |
| `e2b_desktop_open_app`      | Open app              |
| `e2b_desktop_clipboard_get` | Get clipboard         |
| `e2b_desktop_clipboard_set` | Set clipboard         |
| `e2b_desktop_wait`          | Wait/delay            |
| `e2b_desktop_run_macro`     | Run macro             |

**Requirements**: E2B account with E2B_API_KEY or E2B_ACCESS_TOKEN

---

## 4. PLUELY TOOLS (Voice Control)

| Tool ID                 | Description                 |
| ----------------------- | --------------------------- |
| `pluely`                | Open Pluely voice interface |
| `pluely_voice_start`    | Start voice recording       |
| `pluely_voice_stop`     | Stop voice recording        |
| `pluely_transcript_get` | Get voice transcript        |
| `pluely_overlay_show`   | Show overlay                |
| `pluely_overlay_hide`   | Hide overlay                |
| `pluely_context_recent` | Get recent context          |

---

## 5. JAAZ TOOLS (AI Image Generation)

| Tool ID               | Description           |
| --------------------- | --------------------- |
| `jaaz`                | Main Jaaz tool        |
| `jaaz_generate`       | Generate image        |
| `jaaz_generate_batch` | Batch generate images |
| `jaaz_project_list`   | List projects         |
| `jaaz_project_create` | Create project        |
| `jaaz_export`         | Export images         |

**Requirements**: JAAZ_API_KEY

---

## 6. ANYTHING BROWSER TOOLS

| Tool ID                         | Description            |
| ------------------------------- | ---------------------- |
| `anything_browser_action`       | Generic browser action |
| `anything_open_context_menu`    | Open context menu      |
| `anything_double_click_handoff` | Double-click handoff   |
| `anything_capture_selection`    | Capture selection      |

---

## 7. VOICE BOX TOOLS

| Tool ID                   | Description            |
| ------------------------- | ---------------------- |
| `voice_box_open`          | Open voice interface   |
| `voice_box_listen`        | Listen for voice input |
| `voice_box_interrupt`     | Interrupt voice        |
| `voice_box_inject_prompt` | Inject voice prompt    |

---

## 8. AI BROWSER TOOLS

| Tool ID                 | Description            |
| ----------------------- | ---------------------- |
| `browser_navigate`      | Navigate browser       |
| `browser_click`         | Click element          |
| `browser_type`          | Type in element        |
| `browser_screenshot`    | Take screenshot        |
| `browser_hover`         | Hover element          |
| `browser_scroll`        | Scroll page            |
| `browser_evaluate`      | Execute JavaScript     |
| `browser_select_option` | Select dropdown option |
| `browser_drag`          | Drag and drop          |
| `browser_fill_form`     | Fill form fields       |

---

## 9. MCP EXTERNAL TOOLS

These tools come from external MCP servers configured in KronosCode:

| MCP Server       | Tools Provided                                                                        |
| ---------------- | ------------------------------------------------------------------------------------- |
| `ghost-os`       | macOS desktop automation (click, type, hotkey, drag, window control, clipboard, etc.) |
| `automation-mcp` | Browser automation, UI interaction                                                    |
| `browseros`      | Browser control                                                                       |
| `filesystem-mcp` | File operations                                                                       |
| And many more... |

**MCP Configuration Location**: `~/.config/kronoscode/config.json` under `mcp` key

---

## 10. TOOL CONNECTORS

KronosCode groups tools by "connector":

| Connector                     | Tools                                     | Auth Required     |
| ----------------------------- | ----------------------------------------- | ----------------- |
| `core`                        | bash, read, glob, grep, edit, write, etc. | None              |
| `e2b`                         | All e2b\_\* tools                         | E2B_API_KEY       |
| `pluely`                      | All pluely\_\* tools                      | PLUELY_API_KEY    |
| `jaaz`                        | All jaaz\_\* tools                        | JAAZ_API_KEY      |
| `screenpipe`                  | All screenpipe\_\* tools                  | Screenpipe server |
| `browser`                     | All browser*\* + anything*\* tools        | Browser           |
| `voice_bus`                   | All voice*box*\* tools                    | Voice device      |
| `mcp`                         | External MCP server tools                 | Per server        |
| `ghost-os` (builtin-adjacent) | Desktop automation                        | macOS permissions |

---

## TOOL IMPLEMENTATION REFERENCE

### Tool Definition Pattern

```typescript
import z from "zod";
import { Tool } from "./tool";

export const MyTool = Tool.define("my_tool", {
  description: "Description of what the tool does",
  parameters: z.object({
    param1: z.string().describe("Parameter description"),
    param2: z.number().optional(),
  }),
  async execute(params, ctx) {
    // Tool implementation
    return {
      title: "My Tool Result",
      output: "Result text",
      metadata: {
        /* any extra data */
      },
    };
  },
});
```

### Tool Registry Entry

Add to `src/tool/registry.ts`:

```typescript
import { MyTool } from "./my_tool";

export async function all(): Promise<Tool.Info[]> {
  return [
    // ... other tools
    MyTool,
  ];
}
```

---

## RECOMMENDED TOOLS TO COPY TO WAVE TERMINAL

### Priority 1: Desktop Automation (ghost-os equivalent)

- `everywhere` - List apps, inspect UI, control apps
- All E2B desktop tools (screenshot, click, type, hotkey, drag, clipboard)

### Priority 2: Screen Context (screenpipe equivalent)

- `screenpipe_search` - Search what was on screen
- `screenpipe_context` - Get AI context from screen

### Priority 3: Browser Automation

- All `browser_*` tools from ai_browser.ts

### Priority 4: Core File Operations

- Already available in Wave Terminal via RPC

### Priority 5: MCP Integration

- Copy MCP client infrastructure from `src/mcp/index.ts`
- Enable ghost-os, automation-mcp, and other MCP servers

---

## IMPLEMENTATION FILES REFERENCE

| File                     | Purpose                         |
| ------------------------ | ------------------------------- |
| `src/tool/registry.ts`   | Tool registration and listing   |
| `src/tool/tool.ts`       | Base Tool class and definitions |
| `src/mcp/index.ts`       | MCP client for external tools   |
| `src/mcp/policy.ts`      | MCP allowlist policy            |
| `src/tool/everywhere.ts` | Native app control              |
| `src/tool/e2b.ts`        | E2B sandbox tools               |
| `src/tool/screenpipe.ts` | Screen capture tools            |
| `src/tool/ai_browser.ts` | Browser automation              |
| `src/tool/pluely.ts`     | Voice tools                     |
| `src/tool/jaaz.ts`       | Image generation                |
| `src/tool/anything.ts`   | Anything browser                |
| `src/tool/voice_bus.ts`  | Voice box                       |
