# KronTerm — Project Knowledge Base

**Type:** Agent-aware Electron + Go desktop workspace
**Base version:** Wave Terminal 0.14.3 with the KronTerm private-beta product layer
**Go module:** `github.com/wavetermdev/waveterm` (retained for source compatibility)

## Product Model

KronTerm is the user-facing product name. It combines terminal, browser, file, preview, sandbox, remote, native-app, and
AI surfaces in one persistent workspace. KronosCode is the agent execution engine; KronosChamber is its primary chat and
control surface.

The desktop has three workspace presentations that share the same blocks:

- `widgets`: resizable tiled splits.
- `tabs`: focused widgets in a browser-style tab strip with pane splitting.
- `canvas`: a pan-and-zoom spatial workspace with live widgets, notes, shapes, connectors, and agent task cards.

The current development line also includes live agent activity overlays, task/evidence graphs, selection-to-agent context,
a managed KronosChamber runtime, LSP-backed editing, improved computer-use streams, and an optional voice engine. The
`mobile/` client and phone-control bridge are Labs work. Do not present experimental or Labs functionality as generally
available.

Legacy `Wave`, `WaveAI`, `waveai:*`, `.waveterm`, and Go module names remain in compatibility-sensitive code and config.
Use KronTerm and KronosCode in new user-facing copy, but never rename compatibility identifiers as part of an unrelated
change.

## Quick Reference

| Need                        | Location                                                                       |
| --------------------------- | ------------------------------------------------------------------------------ |
| Add RPC call                | `pkg/wshrpc/wshrpctypes.go` → `task generate`                                  |
| Add config setting          | `pkg/wconfig/` → `.kilocode/skills/add-config/SKILL.md`                        |
| Frontend state              | `frontend/app/store/` (Jotai)                                                  |
| Workspace presentations     | `frontend/app/tab/` (`widget-tabs-layout.tsx`, `workspace-canvas.tsx`)         |
| Workspace layout model      | `frontend/app/workspace/workspace-layout-model.ts`                             |
| KronosChamber view          | `frontend/app/view/chathubv2/`                                                 |
| KronosChamber runtime       | `emain/chathubv2-*.ts`, `emain/kronoscode-runtime.ts`                          |
| Agent activity and overlays | `frontend/types/agent-activity.ts`, `frontend/app/view/use-agent-overlays.ts`  |
| KronosCode package boundary | `agents/kronoscode/`                                                           |
| AI backends                 | `pkg/waveai/`, `pkg/aiusechat/`                                                |
| KronTerm MCP bridge         | `mcp-kron-term/`                                                               |
| Code intelligence           | `frontend/app/lsp/`, `emain/emain-lsp.ts`                                      |
| Voice                       | `audio-engine/`, `emain/emain-audio.ts`, `frontend/app/aipanel/voice-model.ts` |
| Sandbox                     | `pkg/sandbox/`, `frontend/app/view/sandbox/`                                   |
| Computer-use stream         | `frontend/app/view/appstream/`                                                 |
| SSH connections             | `pkg/remote/`                                                                  |
| Electron IPC                | `emain/emain-ipc.ts`, `emain/preload.ts`                                       |
| Terminal views              | `frontend/app/view/term/`                                                      |
| Tsunami VDOM                | `tsunami/engine/`                                                              |
| Electron API access         | `getApi()` from `@/store/global`                                               |
| iPhone Labs client          | `mobile/`                                                                      |
| Product website             | `website/`                                                                     |
| Documentation site          | `docs/`                                                                        |

## Build, Lint, Test

```bash
task dev                # Development (hot reload, full stack)
task start              # Standalone run (production-like)
task quickdev           # Dev mode, no docsite/wsh build (macOS arm64)
task package            # Production build + electron-builder
task preview            # Component preview (localhost:7007, no Electron)
task check:ts           # TypeScript typecheck (tsc --noEmit)
task generate           # Regenerate TS bindings from Go types
task init               # Full project init (npm install + go mod tidy)
npm --prefix website run build  # Validate the product website
npm --prefix docs run build     # Validate the Docusaurus site

# Lint & format
npx eslint .            # Lint TS/TSX (config: eslint.config.js)
npx prettier --check .  # Check formatting (config: prettier.config.cjs)

# Frontend tests (Vitest)
npm test                # Run all frontend tests (watch mode)
npm test -- --run       # Run once (no watch)
npx vitest run src/path/file.test.ts  # Single test file
npx vitest run -t "test name"         # Single test by name pattern
npm run coverage        # Run with coverage (istanbul → lcov/)

# Backend tests (Go)
go test ./pkg/...                    # All Go packages
go test ./pkg/waveai/...             # Single package
go test ./pkg/waveai/... -run TestFn # Single test function
go vet ./pkg/...                     # Static analysis

# NEVER run `go build` in sub-packages — breaks compilation detection.
# VSCode error diagnostics are sufficient to verify Go compilation.
```

## Project Structure

```
kronterm/
├── emain/              # Electron main process, native bridges, managed agent runtime
├── frontend/           # React renderer (TypeScript/TSX)
│   ├── app/            # Components: block/, tab/, view/, store/, aipanel/, element/
│   ├── builder/        # Builder app
│   ├── layout/         # Layout system (tests in layout/tests/)
│   ├── preview/        # Standalone preview server (no Electron)
│   ├── util/           # Utilities (base64, color, endpoints, etc.)
│   └── types/          # TypeScript types (gotypes.d.ts is GENERATED)
├── cmd/                # Go CLI apps (wsh daemon, server, generators)
├── pkg/                # Go packages (wshrpc, waveai, wps, wconfig, etc.)
├── agents/             # Packaged ACP agent boundaries
├── mcp-kron-term/      # KronTerm workspace and computer-use MCP server
├── audio-engine/       # Optional Python speech capture, STT, and TTS process
├── mobile/             # KronTerm for iPhone Labs client and connector
├── tsunami/            # Embedded VDOM rendering engine (Go + frontend)
├── db/                 # SQLite migrations
├── website/            # Vite product website
└── docs/               # Docusaurus documentation site
```

## Key Generated Files (DO NOT EDIT)

| File                                 | Source                                        |
| ------------------------------------ | --------------------------------------------- |
| `frontend/types/gotypes.d.ts`        | Go types → `task generate`                    |
| `frontend/app/store/wshclientapi.ts` | `pkg/wshrpc/wshrpctypes.go` → `task generate` |
| `pkg/wshrpc/metaconsts.go`           | Generated constants                           |

## Code Style Guidelines

### General

- **4-space indentation** (`.editorconfig`, `prettier.config.cjs`)
- **Lowercase filenames** everywhere (except `Taskfile.yml`, etc.)
- **Use 2026 for new/updated copyright years**
- **Comments only for WHY**: never describe what code does; explain non-obvious choices, edge cases, or pitfalls. No comment is better than a redundant comment.
- **Print width**: 120 characters
- **Trailing commas**: ES5-style (no trailing commas on function calls)
- **Prettier plugins**: `prettier-plugin-jsdoc`, `prettier-plugin-organize-imports`

### TypeScript / React

- **Named exports only** — no `export default`
- **Imports**: `@/...` aliases for cross-module (`@/app/`, `@/store/`, `@/util/`, `@/element/`, `@/view/`, `@/layout/`, `@/shadcn/`, `@/builder/`, `@/preview/`); relative imports (`./name`) only within same directory
- **`== null` / `!= null`** — never `=== undefined` / `!== undefined` (unless specifically distinguishing undefined from null)
- **Base64**: use `@/util/util` functions, never `atob()` / `btoa()` (not UTF-8 safe)
- **CSS merging**: use `cn()` from `@/util/util` (wraps tailwind-merge + clsx)
- **Class variants**: use `class-variance-authority` (cva)
- **Styling**: Tailwind v4 preferred; SCSS deprecated for new code
- **Accent buttons**: `bg-accent/80 text-primary rounded hover:bg-accent transition-colors cursor-pointer`
- **`cursor-pointer`** on all clickable elements; never `cursor-help` or `cursor-not-allowed`
- **Atom hooks** (`useAtom`, `useAtomValue`) must be called at component top level, never inline in JSX; complete all hook calls before any conditional returns
- **`React.memo()`** components must have a `displayName`
- **No private class fields** (impossible to inspect at runtime)
- **PascalCase** for global constants at top of files
- **Early returns** preferred: `if (!cond) { return };` over nesting in if-blocks
- **TypeScript strict null checks off** — no need for `| null` on types; cast `atom(null)` to `PrimitiveAtom<Type>` for writable atoms
- **`React.RefObject`** (not deprecated `MutableRefObject`) for React 19
- **`no-explicit-any`** is off; `no-unused-vars` is warn with `_` prefix, `e` (event), `get` ignored

### Jotai Model Pattern

- Singleton per model: `getInstance()`, `private constructor`, `private static instance`
- Simple atoms as field initializers; derived/readonly atoms in constructor
- Models never use React hooks; use `globalStore.get/set` instead
- Writable atoms typed as `PrimitiveAtom<Type>` (not generic `atom<Type>`)
- OK to call model methods from event handlers or `useEffect`
- Older models may not use the singleton pattern yet
- Import `globalStore` from `@/app/store/jotaiStore`
- Access Electron API via `getApi()` from `@/store/global` (type: `ElectronApi` in `custom.d.ts`)

### Go

- **String constants, not enum types**: `const StatusRunning = "running"` instead of `type Status string`
- **"Make" not "New"** for constructors: `MakeFoo()` not `NewFoo()`
- **Synchronization**: `lock.Lock(); defer lock.Unlock()` pattern; avoid inline lock/unlock pairs; prefer helper functions with `defer`
- **Constants at top of file** (before types and functions)
- **JSON field names**: all lowercase, no underscores
- **`Printf()` preferred over `Println()`**
- **Never use `go build`** — rely on VSCode/IDE diagnostics to verify compilation

### Skill Guides

Read the matching `.kilocode/skills/<name>/SKILL.md` before these tasks:

| Skill          | When to Read                                                   |
| -------------- | -------------------------------------------------------------- |
| `add-config`   | Adding a new configuration setting                             |
| `add-rpc`      | Adding a new RPC call (modify `wshrpctypes.go`, then generate) |
| `add-wshcmd`   | Adding a new wsh CLI command                                   |
| `context-menu` | Creating and displaying right-click context menus              |
| `create-view`  | Implementing a new view type + BlockRegistry                   |
| `electron-api` | Adding frontend-to-Electron IPC through preload                |
| `waveenv`      | Creating WaveEnv narrowings for component trees                |
| `wps-events`   | Working with Wave PubSub event system                          |

## Anti-Patterns

- **Backend touching frontend atoms** — strict boundary violation
- **Private class fields** — impossible to inspect at runtime
- **Deep nesting** — use early returns to flatten
- **Unrelated file changes in PRs** — one PR = one logical change
- **Holding `cm.lock` while calling SSHConn methods** — causes deadlock
- **Editing generated files** — always modify Go source and run `task generate`
- **`cursor-help` or `cursor-not-allowed`** — looks terrible, never use
- **Running `go build`** — breaks compilation detection; rely on IDE diagnostics
- **Adding comments that describe what code does** — the code should speak for itself
