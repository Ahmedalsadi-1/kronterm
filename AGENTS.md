# Wave Terminal — Project Knowledge Base

**Generated:** 2026-05-17
**Commit:** main
**Type:** Hybrid Electron + Go Desktop Application
**Version:** 0.14.3

## Quick Reference

| Need               | Location                            |
| ------------------ | ----------------------------------- |
| Add RPC call       | `pkg/wshrpc/` → run `task generate` |
| Add config setting | `pkg/wconfig/` → see skill guide    |
| Frontend state     | `frontend/app/store/` (Jotai)       |
| AI backends        | `pkg/waveai/`                       |
| AI chat tools      | `pkg/aiusechat/`                    |
| SSH connections    | `pkg/remote/`                       |
| Electron IPC       | `emain/`                            |
| Terminal views     | `frontend/app/view/term/`           |
| Job management     | `pkg/jobmanager/`                   |
| Tsunami VDOM       | `tsunami/engine/`                   |

## OVERVIEW

Wave Terminal (v0.14.3) — AI-native cross-platform terminal. Electron app with React 19 frontend and Go backend communicating over WebSocket RPC.

## STRUCTURE

```
kronterm/
├── emain/              # Electron main process (TypeScript)
├── frontend/           # React renderer (TypeScript/TSX)
│   ├── app/            # Main application components
│   │   ├── store/      # Jotai state management (CRITICAL)
│   │   ├── view/       # View types (term, waveai, preview, etc)
│   │   ├── element/    # Shared UI components
│   │   ├── block/      # Block system
│   │   ├── tab/        # Tab management
│   │   ├── onboarding/ # Onboarding flow
│   │   ├── aipanel/    # AI panel
│   │   ├── modals/     # Modal dialogs
│   │   └── hook/       # React hooks
│   ├── builder/        # Builder app
│   ├── layout/         # Layout system
│   ├── preview/        # Standalone preview server
│   ├── util/           # Frontend utilities
│   └── types/          # TypeScript type definitions
├── cmd/                # Go CLI apps (wsh daemon, server)
├── pkg/                # Go packages
│   ├── wshrpc/         # RPC system (backbone)
│   ├── wshutil/        # WSH utilities (routing, adapters)
│   ├── aiusechat/      # AI chat tools & backends
│   ├── jobmanager/     # Job & stream management
│   ├── service/        # Service layer
│   ├── remote/         # SSH/WSL connections
│   ├── waveai/         # AI provider backends
│   ├── wconfig/        # Configuration system
│   ├── wstore/         # Database persistence
│   ├── wcore/          # Core business logic
│   ├── waveobj/        # Object model
│   ├── wps/            # Wave PubSub events
│   ├── vdom/           # Virtual DOM bridge
│   ├── filestore/      # File storage
│   ├── streamclient/   # Streaming client
│   ├── utilds/         # Data structures
│   └── util/           # Shared utilities
├── tsunami/            # Embedded monorepo (workspace)
│   ├── engine/         # VDOM rendering engine
│   └── frontend/       # Tsunami frontend
├── db/                 # SQLite migrations
├── docs/               # Docusaurus site
└── .kilocode/          # AI coding rules & skills
```

## BUILD

```bash
task dev          # Development (hot reload)
task start        # Standalone run
task package      # Production build
task preview      # Component preview (localhost:7007)
npm test          # Frontend tests (Vitest)
```

## KEY FILES

| Task                | Location                             | Notes                                |
| ------------------- | ------------------------------------ | ------------------------------------ |
| RPC definitions     | `pkg/wshrpc/wshrpctypes.go`          | Source of truth for all RPC commands |
| Frontend RPC client | `frontend/app/store/wshclientapi.ts` | **Generated** - do not edit          |
| TypeScript types    | `frontend/types/gotypes.d.ts`        | **Generated** - do not edit          |
| Electron main       | `emain/emain.ts`                     | App lifecycle                        |
| Window management   | `emain/emain-window.ts`              | `WaveBrowserWindow` class            |
| State management    | `frontend/app/store/global.ts`       | Singleton atoms                      |
| AI integration      | `pkg/waveai/`                        | Wave AI backend                      |
| AI chat tools       | `pkg/aiusechat/`                     | Tool implementations, usechat logic  |
| Config system       | `pkg/wconfig/`                       | Settings management                  |
| Job management      | `pkg/jobmanager/`                    | Circular buffers, stream management  |
| Tsunami engine      | `tsunami/engine/`                    | VDOM rendering, server handlers      |

## CRITICAL RULES

### DO NOT

- ❌ Run `go build` — breaks compilation detection
- ❌ Manually edit generated files (`gotypes.d.ts`, `wshclientapi.ts`, `metaconsts.go`)
- ❌ Use `cursor-help`, `cursor-not-allowed` (looks terrible)
- ❌ Use `atob()`/`btoa()` — use `@/util/util` base64 functions
- ❌ Use `=== undefined` — use `== null`
- ❌ Use default exports — named exports only
- ❌ Add comments describing code — comments only for WHY
- ❌ Use `write_to_file` — prefer `replace_in_file`
- ❌ Call useAtom/useAtomValue inline in JSX — must be top-level
- ❌ Hold `cm.lock` while calling SSHConn methods — causes deadlock

### MUST

- ✅ Use `lock.Lock(); defer lock.Unlock()` for synchronization
- ✅ Use `@/...` aliases for cross-module imports
- ✅ 4-space indentation
- ✅ "Make" not "New" for Go constructors
- ✅ String constants (not enum types) in Go
- ✅ Lowercase JSON field names
- ✅ Add `cursor-pointer` to buttons
- ✅ Add displayName to React.memo()
- ✅ Early returns: `if (!cond) { return };`

## SKILL GUIDES

Located in `.kilocode/skills/` — read these for specific tasks:

- `add-config/` — Adding configuration settings
- `add-rpc/` — Adding RPC calls
- `add-wshcmd/` — Adding wsh commands
- `context-menu/` — Creating and displaying context menus
- `create-view/` — Creating new view types
- `electron-api/` — Electron IPC communication
- `waveenv/` — Creating WaveEnv narrowings
- `wps-events/` — Event system (Wave PubSub)

## ANTI-PATTERNS

- **Backend touching frontend atoms** — strict boundary
- **Private class fields** — impossible to inspect
- **Deep nesting** — use early returns
- **Unrelated file changes in PRs** — one PR = one logical change
