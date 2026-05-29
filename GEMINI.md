# Wave Terminal (Project Context)

Wave is an open-source, AI-integrated terminal for macOS, Linux, and Windows. It features durable SSH sessions, a flexible drag-and-drop interface, and a context-aware AI assistant.

## Architecture Overview

- **Frontend:** React 19 + TypeScript + Tailwind CSS 4. Built with `vite` and `electron-vite`.
- **Backend (Main):** Go-based server (`wavesrv`) located in `cmd/server/main-server.go`. It handles terminal logic, SSH, and AI integrations.
- **Desktop Wrapper:** Electron (v41+) manages the native window and bridges frontend to the Go backend.
- **Communication:** Uses a custom RPC system (`wshrpc`) and a CLI helper `wsh` for workspace management.
- **UI Framework:** Includes "Tsunami," a specialized framework for building terminal-native web components.

## Directory Structure

- `emain/`: Electron main process source code.
- `frontend/`: React frontend application.
  - `app/`: Core application logic and stores.
  - `layout/`: UI layout components.
  - `wave.ts`: Frontend entry point.
- `pkg/`: Core Go logic organized by service.
  - `service/`: RPC service definitions (block, object, window, workspace).
  - `remote/`: SSH and remote connection handling.
  - `aiusechat/`: AI SDK integrations.
- `cmd/`: Go entry points.
  - `server/`: The main `wavesrv` binary.
  - `wsh/`: The Wave Shell CLI helper.
  - `generatets/`: Tooling to generate TypeScript bindings from Go types.
- `docs/`: Docusaurus-based documentation site.
- `tsunami/`: Sub-project for terminal-native web component framework.

## Key Commands (via Task)

The project uses [Task](https://taskfile.dev/) (defined in `Taskfile.yml`) to coordinate builds.

- `task init`: Initialize project (install dependencies for Node, Go, and Docs).
- `task dev`: Start Electron in development mode with Hot Module Reloading (HMR).
- `task start`: Start the Electron application directly.
- `task build:backend`: Build `wavesrv` and `wsh` components.
- `task package`: Create production-ready packages for the current platform.
- `task check:ts`: Run TypeScript type checking.
- `task test`: Run Vitest for frontend tests.

## Development Conventions

- **Language:** TypeScript for frontend/Electron, Go for backend.
- **RPC:** When adding backend functionality, define services in `pkg/service` and use `task generate` to create frontend bindings.
- **Styling:** Tailwind CSS 4 is the primary styling engine.
- **State Management:** Uses `jotai` for atomic state in the frontend.
- **Logging:** 
  - Frontend: `console.log` (redirected to `emain-log`).
  - Backend: Logs found in `~/.waveterm-dev/waveapp.log` during development.
