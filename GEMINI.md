# KronTerm Agent Context

Read [`AGENTS.md`](./AGENTS.md) before changing this repository. It is the canonical source for architecture, commands,
code style, generated-file rules, and task-specific skill guides. This file supplies the short product map needed by AI
coding tools that load `GEMINI.md` automatically.

## Product Vocabulary

- **KronTerm:** the desktop product and persistent developer workspace.
- **KronosCode:** the local agent execution engine and tool layer.
- **KronosChamber:** the main KronosCode chat, session, approval, artifact, and control surface.
- **Widget Protocol:** the structured interaction layer used to inspect and operate visible blocks.
- **Kron Sandbox:** an isolated Linux desktop surface.

Legacy `Wave`, `WaveAI`, `waveai:*`, `.waveterm`, and `github.com/wavetermdev/waveterm` identifiers remain for source and
configuration compatibility. Use KronTerm and KronosCode in new user-facing copy. Do not rename compatibility identifiers
without a dedicated migration.

## Current Capabilities

KronTerm combines terminal, browser, preview, editor, remote, sandbox, native-app, and AI surfaces. The desktop offers
three presentations over the same workspace blocks:

1. `widgets` — resizable tiled splits.
2. `tabs` — focused widgets with browser-style tabs and pane splits.
3. `canvas` — a spatial, pan-and-zoom workspace with live widgets, notes, shapes, connectors, and agent task cards.

The current development line includes live agent activity, task/evidence graphs, selection-to-agent context, a managed
KronosChamber runtime with recovery state, LSP-backed editing, and computer-use streaming. The Python voice engine is
experimental. The `mobile/` client and phone-control bridge are Labs work; describe them with that status.

## Architecture Map

| Area                                      | Location                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| Electron main process and native IPC      | `emain/`                                                                      |
| React renderer                            | `frontend/`                                                                   |
| Workspace modes                           | `frontend/app/tab/`                                                           |
| Jotai application state                   | `frontend/app/store/`                                                         |
| KronosChamber UI                          | `frontend/app/view/chathubv2/`                                                |
| Managed KronosCode/KronosChamber process  | `emain/chathubv2-*.ts`, `emain/kronoscode-runtime.ts`                         |
| Agent activity overlays                   | `frontend/app/view/use-agent-overlays.ts`, `frontend/types/agent-activity.ts` |
| Computer-use stream                       | `frontend/app/view/appstream/`                                                |
| LSP services                              | `frontend/app/lsp/`, `emain/emain-lsp.ts`                                     |
| Go PTY, SSH, RPC, config, and persistence | `pkg/`, `cmd/`                                                                |
| KronTerm MCP server                       | `mcp-kron-term/`                                                              |
| Optional voice process                    | `audio-engine/`                                                               |
| iPhone Labs client                        | `mobile/`                                                                     |
| Product website                           | `website/`                                                                    |
| Docusaurus docs                           | `docs/`                                                                       |

## Essential Commands

```bash
task init
task dev
task quickdev
task check:ts
task generate
npm test -- --run
go test ./pkg/...
npm --prefix website run build
npm --prefix docs run build
```

Never run `go build` inside a subpackage. Do not edit generated TypeScript bindings directly; update the Go source and run
`task generate`.

## Implementation Boundaries

- Keep backend code out of frontend atoms. Cross the boundary through wsh RPC or Electron IPC.
- Call React/Jotai hooks at component top level before conditional returns.
- Access Electron through `getApi()` from `@/store/global`.
- Use `globalStore` inside models; models do not call React hooks.
- Keep host, browser, remote, and sandbox actions on their explicit surfaces.
- Preserve user approval and runtime health states in agent-facing flows.
- Treat `frontend/types/gotypes.d.ts`, `frontend/app/store/wshclientapi.ts`, and `pkg/wshrpc/metaconsts.go` as generated.
- Preserve unrelated work in the repository; this workspace often contains concurrent product experiments.
