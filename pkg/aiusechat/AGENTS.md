# pkg/aiusechat — AI Chat Tools & Backends

**Parent:** `../AGENTS.md`

## OVERVIEW

AI chat tool implementations and usechat backend logic. Tools for sandbox, terminal, file operations, web, and human simulation.

## STRUCTURE

```
aiusechat/
├── usechat.go              # Main usechat logic, streaming
├── usechat-mode.go         # Mode handling (chat, agent, etc)
├── usechat-prompts.go      # Prompt templates
├── usechat-backend.go      # Backend interface
├── usechat-utils.go        # Utilities
├── tools.go                # Tool registry
├── tools_sandbox.go        # Sandbox execution
├── tools_term.go           # Terminal tool
├── tools_writefile.go      # File writing
├── tools_readfile.go       # File reading
├── tools_readdir.go        # Directory listing
├── tools_human_sim.go      # Human interaction simulation
├── tools_tsunami.go        # Tsunami VDOM tool
├── tools_gui.go            # GUI automation tool
├── tools_codebase.go       # Codebase analysis
├── tools_web.go            # Web browsing
├── tools_screenshot.go     # Screenshot capture
├── tools_builder.go        # Build tool
├── toolapproval.go         # Tool approval flow
├── kronos-backend.go       # Kronos backend integration
├── kronos-discovery.go     # Kronos service discovery
├── aiutil/                 # AI utilities
├── anthropic/              # Anthropic provider
├── gemini/                 # Google Gemini provider
├── google/                 # Google provider
├── openai/                 # OpenAI provider
├── openaichat/             # OpenAI chat
├── chatstore/              # Chat persistence
└── uctypes/                # Type definitions
```

## TOOL PATTERN

Each tool implements:
- `Name()` — tool identifier
- `Description()` — what it does
- `Parameters()` — JSON schema
- `Execute()` — run with args

## ADDING TOOL

1. Create `tools_<name>.go`
2. Implement tool interface
3. Register in `tools.go`
4. Add to prompt in `usechat-prompts.go`

## MODES

- `chat` — conversational AI
- `agent` — autonomous tool use
- See `usechat-mode.go` for routing

## KRONOS INTEGRATION

- `kronos-backend.go` — main Kronos backend logic
- `kronos-discovery.go` — service discovery
- Test: `kronos_backend_test.go`

## NEVER

- Block in tool execution (use async)
- Skip tool approval for dangerous ops
- Hold locks while calling external tools
