# emain — Electron Main Process

**Parent:** `../AGENTS.md`

## OVERVIEW

Electron main process: window management, IPC bridge, managed agent runtimes (KronosCode via ACP, Hermes), ChathubV2 server stack, LSP, audio, pet/overlay windows.

## STRUCTURE

```
emain/
├── emain.ts               # Entry point, app lifecycle
├── emain-window.ts        # WaveBrowserWindow class
├── emain-ipc.ts           # IPC handlers (main ↔ renderer)
├── preload.ts             # Main window preload (secure bridge)
├── preload-webview.ts     # Webview widget preload
├── preload-overlay.ts     # Overlay window preload
├── preload-pet.ts         # Desktop pet preload
├── acp/                   # ACP transport/harness/agent-manager for KronosCode sessions
├── chathubv2-*.ts         # Managed KronosChamber runtime: process, pty, health, context, state-push
├── kronoscode-runtime.ts  # KronosCode managed runtime lifecycle
├── hermes-runtime.ts      # Hermes agent backend lifecycle
├── emain-lsp.ts           # Language server management (frontend client in frontend/app/lsp/)
├── emain-audio.ts         # Voice/audio-engine process bridge
├── emain-pet.ts           # Desktop pet window logic
├── emain-overlay.ts       # Overlay window logic
├── emain-krondesign.ts    # Starts the krondesign design-system daemon
├── emain-wavesrv.ts       # Wavesrv process management
├── emain-wsh.ts           # WSH binary management
└── sandbox/               # Sandbox VM manager + MCP server bridge
```

## KEY PATTERNS

| Task                | File                                  | Pattern                               |
| ------------------- | ------------------------------------- | ------------------------------------- |
| Add IPC channel     | `emain-ipc.ts`                        | ipcMain.handle('channel', handler)    |
| Window events       | `emain-window.ts`                     | WaveBrowserWindow class               |
| Menu items          | `emain-menu.ts`                       | Menu.buildFromTemplate                |
| Own an OS process   | `emain-audio.ts`, `emain-wavesrv.ts`  | child lifecycle owned here            |
| Runtime health      | `chathubv2-health.ts`                 | startup state + reconnect + repair    |
| New Electron API    | `.kilocode/skills/electron-api/SKILL.md` | preload → IPC → renderer           |

## TESTS

Co-located `*.test.ts` next to source. Run one: `npx vitest run emain/acp/acp-transport.test.ts`

## CRITICAL

- Never expose full node API via preload (security)
- Each window type has its own preload (main / webview / overlay / pet)
- Managed runtimes report health state; spawn success ≠ healthy
- Backend never touches frontend atoms — communicate via IPC/WPS only
