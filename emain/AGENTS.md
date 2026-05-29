# emain — Electron Main Process

**Parent:** `../AGENTS.md`

## OVERVIEW

Electron main process. Window management, native menus, IPC bridge, platform integration.

## STRUCTURE

```
emain/
├── emain.ts           # Entry point, app lifecycle
├── emain-window.ts    # WaveBrowserWindow class
├── emain-ipc.ts       # IPC handlers (main ↔ renderer)
├── emain-menu.ts      # Native menus (macOS/Win/Linux)
├── emain-wavesrv.ts   # Wavesrv process management
├── emain-wsh.ts       # WSH binary management
├── preload.ts         # Preload script (secure bridge)
└── *.ts               # Platform utils, updater, auth
```

## KEY PATTERNS

| Task            | File                | Pattern                            |
| --------------- | ------------------- | ---------------------------------- |
| Add IPC channel | `emain-ipc.ts`      | ipcMain.handle('channel', handler) |
| Window events   | `emain-window.ts`   | WaveBrowserWindow class            |
| Menu items      | `emain-menu.ts`     | Menu.buildFromTemplate             |
| Native API      | `emain-platform.ts` | Platform-specific code             |

## WINDOW LIFECYCLE

1. `emain.ts`: app.whenReady() → createWindow()
2. `emain-window.ts`: WaveBrowserWindow constructor
3. `preload.ts`: Expose APIs via contextBridge
4. Frontend loads via loadURL/loadFile

## CRITICAL

- Never expose full node API via preload (security)
- IPC calls are async (Promise-based)
- Window state persisted via `emain-window.ts`
