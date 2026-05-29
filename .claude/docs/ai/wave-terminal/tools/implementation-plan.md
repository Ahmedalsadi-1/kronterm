# Wave Terminal - Full Tool Integration Plan

**Comprehensive plan to bring all KronosCode tools into Wave Terminal**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Wave Terminal Architecture                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                      Frontend (React 19)                       │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │
│   │  │   Widgets    │  │    AI Chat   │  │   Tool Palette      │  │   │
│   │  └──────┬───────┘  └──────┬───────┘  └──────────┬─────────┘  │   │
│   └─────────┼─────────────────┼─────────────────────┼────────────┘   │
│             │                 │                     │                   │
│   ┌─────────┴─────────────────┴─────────────────────┴────────────┐ │
│   │                    Jotai State Store                              │ │
│   └─────────────────────────────────────────────────────────────────┘ │
│                                    │                                    │
│   ┌────────────────────────────────┴────────────────────────────────┐  │
│   │              wshclientapi.ts (Generated RPC Client)             │  │
│   └─────────────────────────────────────────────────────────────────┘ │
│                                    │ WebSocket                        │
│   ┌────────────────────────────────┴────────────────────────────────┐  │
│   │                    Go Backend (RPC Router)                     │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │  │
│   │  │ WshRpcTypes │  │   Commands  │  │   Tool Implementations  │  │  │
│   │  │ (Interface) │  │ (Handler)   │  │   (tool/, mcp/, etc.)   │  │  │
│   │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

New Components (This Implementation)
┌─────────────────────────────────────────────────────────────────────────┐
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    MCP Client Integration                       │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │
│   │  │ MCP Client   │  │ MCP Servers  │  │   Tool Converters    │  │   │
│   │  │ (stdio/HTTP)│  │ (ghost-os,   │  │   (MCP → Wave AI)    │  │   │
│   │  │              │  │  automation)│  │                      │  │   │
│   │  └──────────────┘  └──────────────┘  └──────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    Native Tool Implementations                   │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │
│   │  │   Desktop    │  │   Screen    │  │    Browser/UI         │  │   │
│   │  │   (e2b)      │  │   (pipe)    │  │    Automation         │  │   │
│   │  └──────────────┘  └──────────────┘  └──────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    Configuration System                          │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │
│   │  │ MCP Config  │  │  Tool Prefs  │  │   API Keys (secrets)  │  │   │
│   │  │ (settings)   │  │              │  │                      │  │   │
│   │  └──────────────┘  └──────────────┘  └──────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: MCP Infrastructure (Foundation)

**Goal**: Set up MCP client to connect to external MCP servers

#### 1.1 Add MCP Configuration Type

**Files**: `pkg/wconfig/settingsconfig.go`, `pkg/wconfig/metaconsts.go`

```go
// In settingsconfig.go - Add to SettingsType
type SettingsType struct {
    // ... existing fields

    // MCP Configuration
    MCP map[string]MCPConfig `json:"mcp,omitempty"`
}

type MCPConfig struct {
    Enabled   *bool  `json:"enabled,omitempty"`
    Type      string `json:"type"` // "local" or "remote"
    Command   []string `json:"command,omitempty"` // for local
    URL       string `json:"url,omitempty"` // for remote
    Headers   map[string]string `json:"headers,omitempty"`
    Timeout   int64 `json:"timeout,omitempty"`
    OAuth     MCPOAuthConfig `json:"oauth,omitempty"`
}

type MCPOAuthConfig struct {
    ClientID     string `json:"clientId,omitempty"`
    ClientSecret string `json:"clientSecret,omitempty"`
    Scope        string `json:"scope,omitempty"`
}
```

#### 1.2 Create MCP Client Package

**New Directory**: `pkg/mcp/`

```
pkg/mcp/
├── client.go         // MCP client implementation
├── policy.go         // Allow/deny list for MCP servers
├── transport.go      // stdio and HTTP transport
├── oauth.go          // OAuth handling
├── discovery.go     // Auto-discover MCP servers
└── toolconv.go      // Convert MCP tools to Wave tools
```

**Files to create**:

1. `pkg/mcp/client.go` - Main MCP client using @modelcontextprotocol/sdk
2. `pkg/mcp/transport.go` - StdioClientTransport and StreamableHTTPClientTransport
3. `pkg/mcp/policy.go` - Allowlist for approved MCP servers

#### 1.3 Add RPC Commands for MCP

**File**: `pkg/wshrpc/wshrpctypes.go`

```go
// Add to WshRpcInterface
McpListServersCommand(ctx context.Context) ([]McpServerInfo, error)
McpConnectCommand(ctx context.Context, serverName string) error
McpDisconnectCommand(ctx context.Context, serverName string) error
McpListToolsCommand(ctx context.Context, serverName string) ([]McpToolInfo, error)
McpCallToolCommand(ctx context.Context, data McpCallToolData) (*McpCallToolResult, error)
McpGetStatusCommand(ctx context.Context) (map[string]McpStatus, error)
```

---

### Phase 2: MCP Server Integration

**Goal**: Connect to ghost-os and automation-mcp servers

#### 2.1 Default MCP Configuration

**File**: `pkg/wconfig/defaultconfig/defaultconfig.go`

```go
func GetDefaultSettings() SettingsType {
    return SettingsType{
        // ... existing defaults

        MCP: map[string]MCPConfig{
            "ghost-os": {
                Type:    "local",
                Command: []string{"npx", "-y", "ghost-os"},
                Enabled: func() *bool { v := true; return &v }(),
            },
            "automation-mcp": {
                Type:    "local",
                Command: []string{"npx", "-y", "@opencode-ai/automation-mcp"},
                Enabled: func() *bool { v := true; return &v }(),
            },
        },
    }
}
```

#### 2.2 MCP Server Startup/Management

**File**: `pkg/mcp/client.go`

- Auto-start configured MCP servers on app launch
- Handle server lifecycle (start, stop, restart)
- Monitor server health and reconnect on failure
- Stream tool definitions from connected servers

---

### Phase 3: Native Tool Implementations

**Goal**: Implement tools that don't require external MCP servers

#### 3.1 Desktop Automation Tools (E2B-style)

**New File**: `pkg/tool/desktop/desktop.go`

| Tool                    | Description           | Implementation          |
| ----------------------- | --------------------- | ----------------------- |
| `desktop_screenshot`    | Capture screen        | Uses platform APIs      |
| `desktop_click`         | Click at coordinates  | Uses accessibility APIs |
| `desktop_type`          | Type text             | Uses accessibility APIs |
| `desktop_hotkey`        | Press key combination | Uses accessibility APIs |
| `desktop_drag`          | Drag between points   | Uses accessibility APIs |
| `desktop_window_list`   | List open windows     | Uses platform APIs      |
| `desktop_window_focus`  | Focus a window        | Uses platform APIs      |
| `desktop_clipboard_get` | Read clipboard        | Uses platform APIs      |
| `desktop_clipboard_set` | Write clipboard       | Uses platform APIs      |

**Platform Implementation**:

- **macOS**: AppleScript + Accessibility APIs
- **Windows**: PowerShell + UI Automation
- **Linux**: xdotool + AT-SPI

#### 3.2 Screen Context Tools (Screenpipe-style)

**New File**: `pkg/tool/screen/screen.go`

| Tool             | Description                         |
| ---------------- | ----------------------------------- |
| `screen_search`  | Search OCR'd screen content         |
| `screen_recall`  | Recall specific screen moments      |
| `screen_context` | Get AI-relevant context from screen |

**Requirements**: Screenpipe server running locally (port 3030)

#### 3.3 Browser Automation Tools

**New File**: `pkg/tool/browser/browser.go`

| Tool                 | Description       |
| -------------------- | ----------------- |
| `browser_navigate`   | Navigate to URL   |
| `browser_click`      | Click element     |
| `browser_type`       | Type into element |
| `browser_screenshot` | Take screenshot   |
| `browser_hover`      | Hover element     |
| `browser_scroll`     | Scroll page       |
| `browser_fill_form`  | Fill form fields  |

---

### Phase 4: Wave AI Tool Integration

**Goal**: Expose all tools to Wave AI for execution

#### 4.1 Tool Definition Format

**File**: `pkg/ai/aitoolv2/aitoolv2.go` (or create new)

Tools must be converted to Wave AI's tool format:

```go
type AI Tool struct {
    Name        string
    Description string
    Parameters  map[string]Schema
    Execute     func(args map[string]interface{}) (interface{}, error)
}
```

#### 4.2 Tool Registry

**New File**: `pkg/tool/registry/registry.go`

```go
type ToolRegistry struct {
    tools map[string]Tool
    mu    sync.RWMutex
}

func (tr *ToolRegistry) Register(t Tool) {
    tr.mu.Lock()
    defer tr.mu.Unlock()
    tr.tools[t.Name] = t
}

func (tr *ToolRegistry) List() []Tool {
    tr.mu.RLock()
    defer tr.mu.RUnlock()
    return slices.Values(tr.tools)
}
```

#### 4.3 Tool Categories

| Category            | Tools                                 | Priority |
| ------------------- | ------------------------------------- | -------- |
| **File Operations** | read, write, edit, glob, grep         | HIGH     |
| **Shell**           | bash, exec                            | HIGH     |
| **Desktop**         | screenshot, click, type, hotkey, drag | HIGH     |
| **Screen Context**  | screen_search, screen_recall          | MEDIUM   |
| **Browser**         | navigate, click, type, fill_form      | MEDIUM   |
| **MCP**             | Dynamic from MCP servers              | HIGH     |
| **Voice**           | voice\_\*                             | LOW      |
| **Image**           | jaaz_generate                         | LOW      |

---

### Phase 5: Frontend UI

**Goal**: Expose tools to users through UI

#### 5.1 Tool Widget/Block

**New Files**: `frontend/app/view/tools/`, `frontend/app/workspace/toolpalette.tsx`

Features:

- Tool palette (Cmd+K style)
- Tool status indicators (connected/disconnected)
- Quick access to common tools
- Tool configuration UI

#### 5.2 AI Context Panel

**File**: Extend existing `frontend/app/view/waveai/`

Show AI-available tools:

- List of available tools
- Tool descriptions
- Execution history
- Results display

---

## Implementation Order

### Week 1: Foundation

- [ ] 1.1 Add MCP configuration types
- [ ] 1.2 Create basic MCP client (local server support)
- [ ] 1.3 Add MCP RPC commands
- [ ] 1.4 Test MCP connection with ghost-os

### Week 2: Core Tools

- [ ] 2.1 Implement desktop automation tools (macOS first)
- [ ] 2.2 Implement screen context tools
- [ ] 2.3 Implement browser automation tools
- [ ] 2.4 Add tools to Wave AI

### Week 3: Integration

- [ ] 3.1 Connect MCP servers (ghost-os, automation-mcp)
- [ ] 3.2 Create tool registry
- [ ] 3.3 Wire tools to Wave AI
- [ ] 3.4 Test end-to-end

### Week 4: Polish

- [ ] 4.1 Frontend tool palette UI
- [ ] 4.2 Tool status indicators
- [ ] 4.3 Configuration UI
- [ ] 4.4 Documentation

---

## Files to Create

```
pkg/
├── mcp/
│   ├── client.go           (NEW - MCP client)
│   ├── policy.go          (NEW - Allowlist)
│   ├── transport.go       (NEW - Transport)
│   ├── oauth.go           (NEW - OAuth)
│   └── toolconv.go        (NEW - Tool conversion)
│
├── tool/
│   ├── registry.go        (NEW - Tool registry)
│   ├── desktop/
│   │   └── desktop.go      (NEW - Desktop tools)
│   ├── screen/
│   │   └── screen.go       (NEW - Screen tools)
│   └── browser/
│       └── browser.go     (NEW - Browser tools)
│
└── wconfig/
    └── settingsconfig.go   (MODIFY - Add MCP config)

frontend/
├── app/
│   ├── view/
│   │   └── toolpalette/   (NEW - Tool palette UI)
│   └── workspace/
│       └── toolwidget.tsx (NEW - Tool widget)
```

---

## Configuration Examples

### settings.json

```json
{
  "mcp": {
    "ghost-os": {
      "enabled": true,
      "type": "local",
      "command": ["npx", "-y", "ghost-os"]
    },
    "automation-mcp": {
      "enabled": true,
      "type": "local",
      "command": ["npx", "-y", "@opencode-ai/automation-mcp"]
    },
    "screenpipe": {
      "enabled": true,
      "type": "remote",
      "url": "http://localhost:3030"
    }
  },
  "tool": {
    "desktop": {
      "enabled": true
    },
    "screen": {
      "enabled": true,
      "serverUrl": "http://localhost:3030"
    },
    "browser": {
      "enabled": true,
      "defaultBrowser": "system"
    }
  }
}
```

---

## Testing Plan

### Unit Tests

- MCP client connection/disconnection
- Tool parameter validation
- Tool execution with mocked responses

### Integration Tests

- Real MCP server connection
- End-to-end tool execution
- Wave AI tool calling

### UI Tests

- Tool palette opens/closes
- Tool execution status display
- Configuration save/load

---

## Risk Mitigation

| Risk                   | Mitigation                                   |
| ---------------------- | -------------------------------------------- |
| MCP server instability | Auto-reconnect, health monitoring            |
| Platform-specific APIs | Feature detection, graceful degradation      |
| Security (API keys)    | Use existing secrets system                  |
| Performance            | Async tool execution, caching                |
| Breaking changes       | Version MCP protocol, backward compatibility |

---

## Dependencies

### Go Packages

- `github.com/modelcontextprotocol/sdk` - MCP protocol
- `github.com/eapache/clipboard` - Clipboard access
- `github.com/getlantern/screenshot` - Screen capture
- `github.com/skratchdot/open-golang` - Window management

### External Services

- ghost-os MCP server (npm)
- automation-mcp server (npm)
- Screenpipe server (optional)

---

## Success Metrics

1. **Connectivity**: MCP servers connect on startup
2. **Tool Availability**: 90%+ tools available in Wave AI
3. **Execution**: Tools execute successfully
4. **UI**: Tool palette accessible via keyboard shortcut
5. **Performance**: Tool execution < 5s for 95th percentile
