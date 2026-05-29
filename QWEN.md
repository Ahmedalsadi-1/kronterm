# Wave Terminal — Project Context

**Version:** 0.14.3  
**Type:** Hybrid Electron + Go Desktop Application  
**Platforms:** macOS, Linux, Windows

## Project Overview

Wave Terminal is an open-source, AI-native terminal application that integrates with any AI model (OpenAI, Claude, Gemini, Ollama, LM Studio). It features durable SSH sessions that survive network interruptions, a drag-and-drop block interface, built-in file editor with remote file support, and a rich preview system.

### Architecture

- **Electron Main Process** (`emain/`) — TypeScript, manages app lifecycle, windows, IPC
- **React Frontend** (`frontend/`) — React 19, TypeScript, Jotai state management, Tailwind CSS
- **Go Backend** (`pkg/`, `cmd/`) — WebSocket RPC server, SSH/WSL connections, AI integration
- **RPC System** (`pkg/wshrpc/`) — Bidirectional WebSocket communication between frontend and backend
- **Tsunami** (`tsunami/`) — Embedded UI component framework

## Quick Start

### Prerequisites

- **Node.js:** 22 LTS (npm 10.9.2)
- **Go:** 1.25.6+
- **Task:** https://taskfile.dev/installation/
- **Zig:** Required for static CGO linking (macOS/Linux/Windows)

### Setup

```bash
# Clone and initialize
git clone git@github.com:wavetermdev/waveterm.git
cd waveterm
task init

# Development mode (hot reload)
task dev

# Standalone run (no hot reload)
task start

# Production build
task package
```

### Key Commands

| Command | Description |
|---------|-------------|
| `task dev` | Start Electron with Vite HMR |
| `task start` | Run standalone Electron app |
| `task package` | Build distributable package |
| `task generate` | Regenerate TypeScript/Go bindings |
| `task check:ts` | TypeScript type checking |
| `npm test` | Run Vitest tests |
| `task preview` | Component preview server (localhost:7007) |

## Project Structure

```
kronterm/
├── emain/                  # Electron main process (TypeScript)
│   ├── emain.ts            # App entry point
│   ├── emain-window.ts     # Window management
│   ├── emain-ipc.ts        # IPC handlers
│   └── preload.ts          # Preload script
├── frontend/               # React renderer (TypeScript/TSX)
│   ├── app/
│   │   ├── store/          # Jotai atoms & state (global.ts, wshclientapi.ts)
│   │   ├── view/           # View components (term, waveai, preview)
│   │   ├── hook/           # React hooks
│   │   └── shadcn/         # UI components
│   ├── builder/            # Builder app
│   ├── layout/             # Layout system
│   ├── preview/            # Standalone preview server
│   └── types/              # Generated TypeScript types
├── cmd/                    # Go CLI applications
│   ├── server/             # Main server (wavesrv)
│   ├── wsh/                # CLI tool (wsh)
│   └── generatets/         # TS binding generator
├── pkg/                    # Go packages
│   ├── wshrpc/             # RPC definitions (wshrpctypes.go)
│   ├── waveapp/            # App logic
│   ├── remote/             # SSH/WSL connections
│   ├── waveai/             # AI integration
│   └── wconfig/            # Configuration system
├── tsunami/                # Embedded UI framework
├── db/                     # SQLite migrations
├── docs/                   # Docusaurus documentation
└── .kilocode/skills/       # AI coding guides
```

## Critical Files

| File | Purpose | Editable? |
|------|---------|-----------|
| `pkg/wshrpc/wshrpctypes.go` | RPC type definitions | ✅ Yes |
| `frontend/app/store/wshclientapi.ts` | Generated RPC client | ❌ No (run `task generate`) |
| `frontend/types/gotypes.d.ts` | Generated Go types | ❌ No (run `task generate`) |
| `frontend/app/store/global.ts` | Frontend state management | ✅ Yes |
| `emain/emain.ts` | Electron main entry | ✅ Yes |
| `Taskfile.yml` | Build orchestration | ✅ Yes |

## Development Conventions

### TypeScript/React

- **Named exports only** — No default exports (except React components)
- **Jotai for state** — Use atoms, avoid inline `useAtomValue` in JSX
- **Path aliases** — Use `@/app/*`, `@/util/*`, `@/store/*`, etc.
- **Null checks** — Use `== null` instead of `=== undefined`
- **Base64** — Use `@/util/util` functions, not `atob()`/`btoa()`
- **React.memo** — Always add `displayName`
- **Tailwind** — Use `cn()` utility for conditional classes

### Go

- **Constructors** — Use `MakeXxx()` not `NewXxx()`
- **String constants** — Prefer over enum types
- **JSON fields** — Lowercase with struct tags
- **Error handling** — Try-catch equivalent with proper propagation
- **Locking** — `lock.Lock(); defer lock.Unlock()` pattern
- **No inline comments** — Comments only for WHY, not WHAT

### RPC System

The RPC backbone is defined in `pkg/wshrpc/wshrpctypes.go`:

1. Add method to `WshRpcInterface` (must end with `Command`)
2. Implement handler in appropriate service
3. Run `task generate` to regenerate bindings
4. Import from `frontend/app/store/wshclientapi.ts`

**Never** manually edit generated files (`wshclientapi.ts`, `gotypes.d.ts`).

### State Management (Jotai Pattern)

```typescript
export class MyModel {
  private static instance: MyModel | null = null;
  statusAtom = jotai.atom<"idle" | "running">("idle");

  private constructor() {
    this.lengthAtom = jotai.atom((get) => get(this.outputAtom).length);
  }

  static getInstance(): MyModel {
    if (!MyModel.instance) MyModel.instance = new MyModel();
    return MyModel.instance;
  }
}
```

## Code Quality

### Linting & Formatting

```bash
# Run all checks
pnpm lint && pnpm format:check && pnpm typecheck

# Auto-fix
pnpm lint:fix && pnpm format
```

### Git Hooks

- Husky pre-commit hooks enforce Prettier and ESLint
- Conventional commits encouraged (not required)

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.test.ts

# Coverage
npm run coverage
```

## Anti-Patterns

| ❌ Avoid | ✅ Prefer |
|---------|----------|
| `console.log()` | `createLogger()` from `@vibe/shared-types` |
| `as any` | Proper type guards |
| Deep nesting | Early returns |
| Private class fields (`#field`) | Public or underscore-prefixed |
| `write_to_file` for edits | `replace_in_file` |
| Backend touching frontend atoms | Strict boundary |
| Holding `cm.lock` during SSHConn calls | Release lock first |
| `cursor-help`, `cursor-not-allowed` classes | Other cursor styles |

## Environment Variables

Copy `.env.example` to `.env`:

```bash
# Required
OPENAI_API_KEY=sk-...

# Optional
USE_LOCAL_RAG_SERVER=true
USE_LOCAL_GMAIL_SERVER=true
USE_LOCAL_GMAIL_AUTH=true
```

**Never commit `.env` or secrets.**

## Debugging

### Frontend

- Open DevTools: `Cmd+Option+I` (macOS) or `Ctrl+Option+I` (Linux/Windows)
- Logs appear in Console tab

### Backend

- Log file: `~/.waveterm-dev/waveapp.log`
- Contains both NodeJS and Go backend logs

## Contributing

- **Small fixes** — Open PR directly (typos, obvious bugs)
- **Larger changes** — Discuss in Discord first: https://discord.gg/XfvZ334gwU
- **One PR = one logical change** — Don't combine unrelated fixes
- **CLA required** — Sign Contributor License Agreement on first PR

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines.

## Resources

- **Homepage:** https://www.waveterm.dev
- **Documentation:** https://docs.waveterm.dev
- **Download:** https://www.waveterm.dev/download
- **Discord:** https://discord.gg/XfvZ334gwU
- **GitHub:** https://github.com/wavetermdev/waveterm

## Skill Guides

Located in `.kilocode/skills/` for AI-assisted development:

- `add-config/` — Adding configuration settings
- `add-rpc/` — Adding RPC calls
- `add-wshcmd/` — Adding wsh commands
- `create-view/` — Creating new view types
- `electron-api/` — Electron IPC communication
- `wps-events/` — Event system (Wave PubSub)
