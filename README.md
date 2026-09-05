<p align="center">
  <a href="https://www.kronterm.dev">
    <img alt="KronTerm" src="./website/public/assets/product/kronterm-logo.svg" width="260">
  </a>
</p>

<h1 align="center">KronTerm</h1>

<p align="center">
  <strong>A living workspace for human + agent development.</strong><br>
  Terminal · Browser · Files · Sandboxes · Desktop control · AI
</p>

<p align="center">
  <a href="https://www.kronterm.dev"><img alt="Website" src="https://img.shields.io/badge/kronterm.dev-000000?style=flat-square&logo=google-chrome&logoColor=white"></a>
  <a href="https://www.kronterm.dev/download"><img alt="Private beta" src="https://img.shields.io/badge/Private_Beta-Request_Access-6C5CE7?style=flat-square"></a>
  <a href="https://docs.kronterm.dev"><img alt="Documentation" src="https://img.shields.io/badge/Docs-docs.kronterm.dev-00B894?style=flat-square"></a>
  <a href="https://discord.gg/XfvZ334gwU"><img alt="Discord" src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square"></a>
</p>

<p align="center">
  <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <img alt="KronTerm workspace with terminal, browser, files, and KronosCode" src="./assets/kronterm-section/kronterm-homepage.png" width="95%">
</p>

KronTerm turns the developer desktop into one persistent, agent-aware workspace. Shells, browsers, files, previews,
remote sessions, isolated Linux desktops, and native applications remain visible together. KronosCode works from that
shared evidence instead of relying on a pasted chat transcript.

KronTerm is currently a macOS private beta (`feat/kronsettings-from-kronoschamber` + KronTerm OS spatial-mode line). Windows and Linux builds remain under evaluation.

## What is new

The current development line expands KronTerm from a tiled terminal workspace into a complete human-and-agent desktop.

| Ability                         | What changed                                                                                                              | Status                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Three workspace modes + OS**  | Tiled splits, browser-style widget tabs, freeform spatial canvas, and the new KronTerm OS desktop shell (see below).     | Private-beta development build |
| **Agent-aware canvas**          | Place live widgets, notes, shapes, connectors, and agent task cards on one zoomable surface.                              | Private-beta development build |
| **Context from the canvas**     | Send a widget or agent card to KronosCode as the active focus or as quoted evidence.                                      | Private-beta development build |
| **Visible task graph**          | Follow requests, decisions, actions, approvals, evidence, and outputs through connected cards.                            | Private-beta development build |
| **Resilient KronosChamber**     | The local agent runtime reports startup and health state, reconnects, and exposes recovery guidance.                      | Private-beta development build |
| **KronTerm OS (Spatial Mode)**  | Calm window composition, flat grid overview, connected shell dock, Cover Flow app switcher, and typed `os.*` surface actions for agent control. | Private-beta development build |
| **Hermes agent surface**        | Embedded Hermes panel with file/terminal/preview slash commands, agent-working badges, and grouped browser file view with drag-to-canvas. | Private-beta development build |
| **App Stream & native apps**    | Live app-stream rails, native app launches via shared `AppIcon` registry, and real app icons in the shell.               | Private-beta development build |
| **Command Center**              | Grouped palette at `Cmd+Shift+Space` for apps, commands, and workspaces.                                                 | Private-beta development build |
| **Code intelligence**           | Monaco-based editing now connects to local language servers for richer code navigation and diagnostics.                   | Private-beta development build |
| **Voice interaction**           | A microphone control connects local audio capture and transcription to chat, with speech output support.                  | Experimental                   |
| **KronTerm for iPhone**         | A native shell opens KronosChamber and can connect to managed sandboxes or explicitly paired computers.                   | Labs                           |

Experimental and Labs features may require additional local dependencies and can change before release.

## One workspace, multiple ways to work

KronTerm keeps the same widgets and project context while changing how they are presented.

### Tiled widgets

Arrange terminal, browser, preview, editor, AI, system, and sandbox blocks in resizable splits. Drag blocks to reflow the
layout, magnify one surface, or return to the saved composition.

### Focused tabs

Keep one widget visible at a time in a browser-style tab strip. Drag tabs between split panes and create a split above,
right, below, or left without rebuilding the workspace.

### Spatial canvas

Move and resize live widgets on an infinite canvas. Pan, zoom, fit the workspace, add notes and diagram primitives, and
connect related work. Agent execution appears on the same surface as a live graph, so a request can stay attached to its
actions, approvals, evidence, and result.

### KronTerm OS (Spatial Mode)

A calm desktop shell — flat grid overview, connected shell dock, Cover Flow app switcher, native app launches, and drag-to-canvas from the grouped file browser. Motion uses no-overshoot springs with quiet menu entrances. Agents can drive it through typed `os.*` surface actions (`frontend/app/workspace/kronarchy-shell.tsx`).

Set the presentation through KronSettings or with the `app:layoutmode` configuration key:

```json
{
  "app:layoutmode": "canvas"
}
```

Valid values are `widgets`, `tabs`, `canvas`, and `os` (KronTerm OS).

## KronosCode

KronosCode is KronTerm's local agent execution layer. It combines the request with current workspace context, chooses the
correct operating surface, runs tools within that boundary, and returns the result with the evidence still visible.

<p align="center">
  <img alt="KronosCode working in the KronTerm side panel" src="./assets/kronterm-section/kronterm-sidepanel.png" width="86%">
</p>

### What the agent can work with

| Surface                | Available context and actions                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Terminal**           | Read scrollback and shell state, run commands, monitor processes, and preserve exit evidence (connected shell dock in OS mode). |
| **Files and code**     | Browse local or remote files, edit with diff review, use LSP-backed code intelligence, and drive the grouped file browser with drag-to-canvas. |
| **Browser**            | Inspect structured page state, navigate, click, type, scroll, capture screenshots, and validate flows.                       |
| **Sandbox**            | Create and operate isolated Linux desktops with their own browser, editor, terminal, and filesystem.                         |
| **macOS desktop**      | Inspect accessibility state and perform visible, permission-aware clicks, typing, key presses, scrolling, and dragging.      |
| **Canvas + OS desktop**| Read selected widgets and task cards, follow task lineage, use chosen nodes as focus/quoted evidence, and drive the KronTerm OS desktop via typed `os.*` actions. |
| **App Stream**         | Operate live native or remote app surfaces on dedicated rails (AppIcon registry, interaction state).                        |
| **Research and tools** | Search documentation and the web, call MCP servers, and load task-specific skills.                                           |

KronosCode streams meaningful tool activity into the UI. Commands, edits, approvals, browser evidence, and recovery state
remain inspectable while the agent works.

### Managed local runtime

KronosChamber is the primary conversation and control surface for KronosCode. KronTerm starts and monitors the local
runtime, refreshes its short-lived connection credentials, reconnects the embedded client, and shows repair information
when the runtime cannot become healthy. The mobile client uses the same gateway rather than running a second AI engine.

### Voice, experimental

The voice control can start the optional Python audio engine, capture speech, transcribe it with `faster-whisper`, and
submit the transcript to KronosCode. Speech output uses an online TTS provider when configured and an offline system
fallback when available. Voice remains opt-in and can be shut down from KronSettings.

## Built-in surfaces

| Surface                    | Purpose                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Terminal**               | Full PTY sessions, connected shell dock, shell integration, command history, and AI-readable scrollback.         |
| **Browser**                | Embedded Chromium for documentation, dashboards, localhost, and agent-driven validation.                         |
| **Preview and editor**     | Markdown, images, media, PDF, CSV, directories, Monaco-based editing, and grouped file browser with drag-to-canvas. |
| **KronosChamber**          | Workspace-aware chat, tools, approvals, sessions, artifacts, and model controls.                                 |
| **Hermes agent panel**     | Embedded Hermes AI surface with command center, file/terminal/preview slash commands, and agent-working badges.  |
| **Kron Sandbox**           | Isolated Linux desktop execution with visible computer use (SandboxDesktopPane).                                 |
| **App stream**             | Live native or remote application surfaces on dedicated rails with interaction state and cursor feedback.         |
| **KronTerm OS shell**      | Desktop shell — dock, flat grid overview / Cover Flow switcher, native app launches, and `os.*` agent actions.  |
| **Command Center**         | Grouped palette (`Cmd+Shift+Space`) for apps, commands, and workspaces.                                         |
| **Launcher and settings**  | Workspace navigation plus visual controls for models, agents, skills, themes, voice, and keybindings.            |
| **System information**     | CPU, memory, disk, and network monitoring inside the workspace.                                                  |

## Durable remote work

KronTerm's SSH sessions survive network changes, sleep, and application restarts. Remote terminals, files, directories,
and previews use the same workspace model as local work, so an agent can reason from the remote evidence you see.

## Architecture

```text
KronTerm desktop (Electron + React)
├── workspace presentations: widgets · tabs · canvas · os (KronTerm OS shell)
│   ├── Kronarchy shell (kronarchy-shell.tsx) — dock, overview, Cover Flow, os.* actions
│   └── command center (Cmd+Shift+Space) — grouped apps/commands/workspaces
├── interactive surfaces: terminal (connected dock) · browser · files (grouped + drag-to-canvas) · sandbox · app stream rails · native apps
├── KronosChamber + Hermes: chat · sessions · approvals · artifacts · embedded Hermes panel
└── native bridges: audio · accessibility · secure storage · IPC · app icons (AppIcon)

Go services
├── PTY and durable SSH (survives sleep / network changes)
├── wsh RPC and Widget Protocol
├── configuration, secrets, events, and persistence
└── preview, file, and sandbox services

KronosCode runtime
├── routed agent execution and specialist tools (typed os.* surface for desktop control)
├── MCP servers and loadable skills
├── browser, terminal, desktop, sandbox, and canvas context
└── local session and tool state
```

The repository also contains:

- `mcp-kron-term/` for the workspace and computer-use MCP bridge.
- `audio-engine/` for the optional speech pipeline.
- `mobile/` for the KronTerm for iPhone Labs client.
- `website/` for the product site (`npm --prefix website run build` to validate).
- `docs/` for the Docusaurus documentation site (`npm --prefix docs run build`).
- `video/` for the Remotion promo composition (`KronTermPromo` 62s cinematic, see `video/AGENTS.md`).
- `agents/kronoscode/` and `agents/hermes/` for the bundled agent package boundaries.

## Security boundaries

Agent actions stay attached to an explicit surface.

| Boundary                | Behavior                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Host vs. sandbox**    | Host commands and isolated VM actions use separate routes.                                                       |
| **Browser vs. desktop** | Structured browser interaction and native accessibility control are distinct capabilities.                       |
| **Approvals**           | Sensitive file, command, and computer-use actions can pause for confirmation.                                    |
| **Secrets**             | Credentials use the operating system's secure store where supported.                                             |
| **Model choice**        | Connect OpenAI, Anthropic, Google, OpenAI-compatible services, Ollama, or LM Studio with your own configuration. |
| **Local runtime**       | Tool orchestration and workspace state remain local; model requests go to the provider you select.               |
| **Visible evidence**    | Tool calls, diffs, screenshots, terminal output, and task state remain available for review.                     |

Cloud model providers and managed sandbox providers receive only the data required for the capability you choose. Local
models can keep model inference on the machine.

## KronTerm for iPhone, Labs

The iPhone client opens directly into KronosChamber and exposes Browser, Workspace, Files, Code, Terminal, and Preview as
secondary surfaces. It can use a managed KronTerm host or an explicitly paired personal computer. An optional developer
bridge exposes approval-gated phone control for testing; general control of unrelated iOS apps is outside the normal App
Store capability boundary.

See [`mobile/README.md`](./mobile/README.md) for the implemented slice, setup, and phase boundaries.

## Get KronTerm

KronTerm is onboarding macOS private-beta users and design partners.

**[Request private-beta access →](https://www.kronterm.dev/download)**

| Platform                      | Current status   |
| ----------------------------- | ---------------- |
| macOS (Apple Silicon and x64) | Private beta     |
| Windows (x64)                 | Under evaluation |
| Linux (arm64 and x64)         | Under evaluation |
| iPhone                        | Labs client      |

To build the desktop application from source, follow [`BUILD.md`](./BUILD.md). Common development commands include:

```bash
task init
task dev
task check:ts
npm test -- --run
```

Do not run `go build` inside individual subpackages; use the repository tasks and targeted tests described in
[`AGENTS.md`](./AGENTS.md).

## Documentation

- [Product website](https://www.kronterm.dev)
- [Hosted documentation](https://docs.kronterm.dev)
- [Build from source](./BUILD.md)
- [Contributing](./CONTRIBUTING.md)
- [Roadmap](./ROADMAP.md)
- [KronTerm for iPhone](./mobile/README.md)
- [Bundled KronosCode agent](./agents/kronoscode/README.md)

## License and community

KronTerm is licensed under [Apache License 2.0](./LICENSE). See [`NOTICE`](./NOTICE) and
[`ACKNOWLEDGEMENTS.md`](./ACKNOWLEDGEMENTS.md) for attribution and dependency information.

- [Discord](https://discord.gg/XfvZ334gwU)
- [X / @krontermdev](https://x.com/krontermdev)
- [GitHub issues](https://github.com/Ahmedalsadi-1/kronterm/issues)

<p align="center">
  <strong>KronTerm — keep the whole builder loop in view.</strong>
</p>
