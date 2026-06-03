<p align="center">
  <a href="https://www.kronterm.dev">
    <img alt="KronTerm Pet" src="./assets/kronterm-pet-logo.png" width="120">
  </a>
</p>

<p align="center">
  <b>The AI-native workspace that replaces your terminal, browser, sandboxes, tile manager, and AI assistant.</b>
</p>

<p align="center">
  <a href="https://www.kronterm.dev/download"><img alt="Download" src="https://img.shields.io/badge/Download-macOS_%7C_Linux_%7C_Windows-6C5CE7?style=flat-square"></a>
  <a href="https://docs.kronterm.dev"><img alt="Docs" src="https://img.shields.io/badge/Docs-docs.kronterm.dev-00B894?style=flat-square"></a>
  <a href="https://discord.gg/XfvZ334gwU"><img alt="Discord" src="https://img.shields.io/badge/Discord-join_chat-5865F2?style=flat-square"></a>
  <a href="https://x.com/krontermdev"><img alt="X" src="https://img.shields.io/badge/X-@krontermdev-000000?style=flat-square"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/License-Apache_2.0-EA6B6B?style=flat-square"></a>
  <a href="https://github.com/sponsors/krontermdev"><img alt="Sponsor" src="https://img.shields.io/badge/❤️_Sponsor-B5A0FF?style=flat-square"></a>
</p>

---

## Stop juggling tools. One workspace rules them all.

KronTerm isn't another terminal emulator. It's a **unified workspace** that fuses terminal, editor, browser, and AI into a single canvas — so you stop context-switching and start shipping.

<p align="center">
  <img alt="KronTerm Workspace" src="./assets/kronterm-homepage.png" width="90%">
</p>

Need a sandbox to test an idea? A browser to check docs? A terminal to SSH into prod? An AI to debug an error? It's all here, in drag-and-drop blocks, side by side.

### What Makes KronTerm Different

KronTerm isn't just "another tool in your dock." It's the **only tool in your dock** — a single surface that replaces your terminal emulator, browser, IDE preview pane, AI chat app, sandbox environment, and tile window manager all at once.

But the real difference is this: **everything is programmable**. Every block, every widget, every pixel of the interface is exposed through tools that KronosCode AI can call. The AI doesn't sit in a sidebar guessing what you're doing — it reads your actual terminal scrollback, sees your actual browser viewport, inspects your actual file tree, and operates everything with real tool calls.

---

## Why KronTerm?

Most developers keep 5+ apps open at all times — terminal, browser, editor, AI chat, sandbox, notes — each in its own window, each fighting for screen space. KronTerm replaces that pile with one cohesive workspace.

### 🧩 Replace your sandboxes — and everything they require

Spin up isolated Linux VMs (E2B-powered) alongside your code, not in a separate tab or browser window. Each sandbox has its own Firefox, VS Code, terminal, and file system — and the AI can operate them directly, just like it operates your local machine. Run commands, test scripts, install packages, and iterate without leaving your flow. No more juggling Docker containers, Vagrant boxes, or cloud VMs in separate windows.

<p align="center">
  <img alt="KronTerm Sandbox" src="./assets/kronterm-sandbox-screenshot.png" width="90%">
</p>

### 🌐 Replace your browser clutter — and your browser automation tools

Inline Chromium web views for docs, dashboards, and previews — right next to your code. No more alt-tabbing through 20 tabs. And because every web block is visible to the AI, you can ask it to navigate, fill forms, scrape data, take screenshots, and interact with any web page — all within the block. This isn't just a browser viewer; it's a browser automation surface the AI operates natively.

### 🪟 Replace your tile manager — and your desktop automation scripts

Drag-and-drop blocks that snap into any layout. Full-screen any block on demand. It's i3/bspwm flexibility without the config headache. But more than that — every block's position, size, and state is accessible to the AI programmatically. The AI can rearrange your workspace, open new blocks, close old ones, and create custom layouts on the fly. Your desktop layout becomes a programmable surface.

### 🤖 Replace your AI window — and your entire AI toolchain

Built-in AI assistant that sees everything in your workspace — your terminal output, your open files, your web views, your desktop apps. No separate chat app needed. No manual context-pasting. No "please read this file" — it's already visible. And because the AI controls blocks natively, it can run commands, edit files, browse the web, and control desktop apps directly. This isn't a chatbot with a terminal plugin — it's an agentic AI engine that lives inside your workspace and operates everything.

<p align="center">
  <img alt="KronTerm AI Side Panel" src="./assets/kronterm-sidepanel.png" width="90%">
</p>

---

## Key Features

### 🤖 AI-Native Terminal

KronTerm AI is built into the terminal itself — not a bolted-on sidebar. It reads your terminal output, understands your workspace context, and performs file operations across local and remote machines. Bring your own keys for OpenAI, Claude, Gemini, or run local models via Ollama and LM Studio. No accounts, no cloud dependency.

### 🧠 KronosCode — The AI Engine That Controls Everything

KronosCode is the brain behind KronTerm's AI capabilities. It's an **agentic AI engine** that doesn't just chat — it operates your workspace at every level of the stack. From reading individual pixels on a screen to rewriting entire codebases, from SSH-ing into production to scraping the web — KronosCode agents can do it all:

- **Create, close, and arrange blocks** — spin up terminals, web views, previews, and sandboxes on demand
- **Read and interact with widgets** — take screenshots, inspect accessibility trees, click buttons, type text, scroll content
- **Run terminal commands** — execute shell commands, read scrollback, parse output, capture exit codes
- **Browse the web** — navigate pages, fill forms, scrape data, take browser screenshots all within a KronTerm block
- **Edit files** — read, write, and modify code with intelligent diff previews and rollback support
- **Control native macOS apps** — observe any desktop app's accessibility tree, click UI elements by coordinate or element ref, type, press keys, scroll, drag, set values
- **Manage SSH connections** — connect, disconnect, and operate on remote machines
- **Research and search** — search the web, fetch URLs, search code examples and documentation, search screen/audio history

#### How It Works — The Agent Hierarchy

KronosCode uses a **routing-first architecture**. Every request is classified by surface — the narrowest tool capable of fulfilling it — and delegated accordingly.

```
User Request
    │
    ▼
┌─────────────────────────────┐
│      Kronos (Primary AI)    │  ← Router: classifies the request
│  ┌───────────────────────┐  │
│  │ Surface Router        │  │  ← Picks the correct surface
│  │  • Host terminal?     │  │     (narrowest wins)
│  │  • Sandbox desktop?   │  │
│  │  • macOS native app?  │  │
│  │  • Browser/widget?    │  │
│  │  • Research?          │  │
│  └───────────────────────┘  │
└──────────┬──────────────────┘
           │ delegates to
           ▼
┌────────────────────────────────────────────┐
│           Specialist Agent Pool            │
├──────────────┬─────────────────────────────┤
│  Hephaestus  │ Host terminal, code edits,  │
│              │ builds, tests, git          │
├──────────────┼─────────────────────────────┤
│  Sisyphus    │ Sandbox VM, Bytebot desktop │
│              │ desktop widget automation   │
├──────────────┼─────────────────────────────┤
│  Prometheus  │ Native macOS app control,   │
│              │ desktop automation          │
├──────────────┼─────────────────────────────┤
│  Oracle      │ KronTerm browser blocks,    │
│              │ widgets, visible tabs       │
├──────────────┼─────────────────────────────┤
│  Librarian   │ Web search, code search,    │
│              │ documentation research      │
└──────────────┴─────────────────────────────┘
```

##### The Prompt Stack

Every operation flows through a deterministic pipeline:

| Stage          | Purpose                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------- |
| **Router**     | Classify user intent, choose one primary surface, state fallback only if needed                     |
| **Planner**    | Produce minimal ordered steps with concrete verification gates                                      |
| **Executor**   | Run tools in small batches, prefer deterministic local actions, report partial failures immediately |
| **Critic**     | Verify outputs against user intent and constraints before final response                            |
| **Summarizer** | Return concise user-facing outcome + next action without exposing internal chain-of-thought         |

This isn't a loose chatbot — it's a **structured execution engine** that plans, executes, verifies, and reports, every single time.

#### Tool Selection — Best-Fit, Not Just Available

KronosCode doesn't just grab whatever tool is closest. It evaluates a priority chain:

```
1. BEST-FIT AVAILABLE TOOL   ← healthiest connector that matches the capability
   ↓
2. SPECIALIST AGENT          ← delegate to Hephaestus/Sisyphus/Prometheus/Oracle/Librarian
   ↓
3. FALLBACK PATH             ← only when no better match exists
```

For **browser tasks**: built-in `browser_*` tools (BrowserOS) are primary. Connected browser MCP tools are first-class when they're the better fit or explicitly requested.

For **desktop tasks**: native `kron_*` computer-use tools for macOS automation. `computer_*` tools for the KronTerm sandbox desktop. E2B `e2b_desktop_*` for background cloud desktop tasks.

For **terminal tasks**: `bash` for command execution, `read`/`write`/`edit` for file operations, `lsp` for code intelligence.

Every tool call is real — no simulation, no narration. If a tool was used, the runtime actually emitted the call.

#### Surface Router — Every Request Gets the Correct Surface

| Need                                              | Surface                        | Delegate     |
| ------------------------------------------------- | ------------------------------ | ------------ |
| Host terminal commands, code edits, builds, tests | Terminal & file tools          | `hephaestus` |
| Sandbox VM, Bytebot desktop, sandbox files        | `computer_*` tools             | `sisyphus`   |
| Native macOS apps and user desktop                | `kron_*`, `everywhere_*` tools | `prometheus` |
| KronTerm browser blocks, widgets, visible tabs    | `browser_*`, widget tools      | `oracle`     |
| Documentation, dependency research, code search   | Research tools                 | `librarian`  |

#### Capability Context Contract

KronosCode doesn't assume tools are available just because they're listed. Every capability is checked against **live runtime health**:

1. Host-provided capability metadata is source-of-truth
2. Connector availability is verified before routing
3. If a requested capability is unavailable, the exact missing dependency is reported with the best available fallback
4. App workspaces (chat, business, browser, creative, desktop-control) are checked before routing desktop-specific flows

This means the AI never pretends a tool exists — it knows exactly what's connected, healthy, and callable.

#### How Deep the Integration Goes

KronosCode doesn't just run text commands. It operates at **every layer of the machine**:

- **Screen level**: Take screenshots of any KronTerm block or the host macOS desktop. Read pixel colors. Track cursor positions.
- **Accessibility level**: Inspect the full accessibility tree of native macOS apps. Click by element reference, not just coordinates. Read values, scroll panels, invoke secondary actions.
- **Widget level**: Inside KronTerm blocks, take annotated screenshots with element labels, click by `@e3` refs, type into fields, scroll to specific elements, drag between coordinates, wait for elements to appear/disappear.
- **Terminal level**: Execute shell commands with timeout control, read scrollback, capture exit codes, parse JSON output, pipe between commands.
- **Network level**: Fetch URLs, search the web, scrape pages, search code documentation, make API calls.
- **Memory level**: Search screen/audio history via Screenpipe. Recall what was on screen minutes or hours ago. Build context blocks from recent activity.

This is what **AI-native** truly means: the AI lives inside your workspace and can touch everything — from pixels to processes to network requests.

> **KronosCode is included with KronTerm.** The agent system is available now. ACP premium agents (Hermes, OpenClaw, Codex) are coming soon.

### 🧩 The Workspace — Blocks, Not Windows

Drag, drop, resize, and arrange terminals, editors, web views, AI chats, previews, and sandboxes into any layout. Every block can full-screen with one click.

#### Block Types

| Block View   | Purpose                                                                            |
| ------------ | ---------------------------------------------------------------------------------- |
| `term`       | Full PTY terminal with shell integration, scrollback capture, SSH support          |
| `web`        | Embedded Chromium web view — docs, dashboards, previews, browser automation target |
| `preview`    | Renders markdown, images, CSVs, PDFs, HTML — auto-refreshes on file changes        |
| `waveai`     | AI chat panel — inline assistant that sees the entire workspace                    |
| `sandbox`    | Full Linux desktop VM (E2B-powered) with Firefox, VS Code, terminal                |
| `launcher`   | Command palette for quick actions and block creation                               |
| `sysinfo`    | Real-time system resource monitor                                                  |
| `waveconfig` | Visual settings editor for themes, keybindings, font config                        |

#### Widget Protocol — How the AI Interacts with Blocks

Every KronTerm block exposes a **widget interaction layer** via the `wsh` IPC bridge. The AI can:

1. **Snapshot** — Get the full accessibility/element tree of any block (structured JSON with refs like `@e3`, roles, names, values, coordinates)
2. **Find** — Search elements by role, name, value, or text content
3. **Inspect** — Get detailed properties of any element by ref
4. **Click** — Click by element ref (`@e3`) or screen coordinates, with configurable button and click count
5. **Type** — Type text into focused elements
6. **Scroll** — Scroll by direction, coordinates, or within a specific element
7. **Press** — Send key combinations
8. **Drag** — Drag between start/end coordinates with configurable duration
9. **Screenshot** — Capture the block visually, optionally with annotated element labels overlaid
10. **Get State** — Read structured content state (terminal: cwd, shell, exit code; web: URL, title, loading; editor: file, language; sandbox: running state)

This means the AI can **see and manipulate any block** as a human would — without needing a separate browser automation tool for web blocks, a separate PTY library for terminals, or a separate screen reader for desktop apps.

### 🔗 Durable SSH Sessions

Your remote connections survive network drops, sleep cycles, and even KronTerm restarts. Automatic reconnection means you never lose your session mid-work. Includes a built-in graphical editor for remote files, inline previews for markdown, images, CSVs, PDFs, and more.

### 💻 Cross-Platform by Design

macOS, Linux, and Windows — same experience everywhere. Native performance with Electron + Go backend, connected by WebSocket RPC.

### 🎯 Command Blocks

Isolate and monitor individual commands in their own block. See output in real time, rerun, and capture results without polluting your main terminal.

### 🔐 Secret Storage & Security

API keys, credentials, and secrets stored using native system backends (macOS Keychain, Linux secret service, Windows Credential Manager). Access them seamlessly across local and SSH sessions.

### 🎨 Full Customization

Tab themes, terminal styles, background images, custom keybindings. Make it yours.

---

## 🏗️ Technology Stack — How It All Fits Together

KronTerm and KronosCode together form a **vertically integrated AI-native workspace**. Here's how the layers stack:

```
┌──────────────────────────────────────────────────────────┐
│                    USER INTERFACE                         │
│  KronTerm Desktop App (Electron + Go backend)             │
│  • Block canvas with drag-and-drop layout engine          │
│  • WebSocket RPC bridge between UI and Go backend         │
│  • Native menus, tabs, themes, keybindings                │
│  • macOS / Linux / Windows (same DX everywhere)           │
├──────────────────────────────────────────────────────────┤
│                   WIDGET LAYER (wsh)                      │
│  • wsh IPC protocol — every block is a widget             │
│  • widget_* tools: snapshot, click, type, scroll, drag    │
│  • Terminal PTY via node-pty (local) or SSH (remote)      │
│  • Chromium embedded for web blocks                       │
│  • E2B SDK for sandbox VM lifecycle                       │
├──────────────────────────────────────────────────────────┤
│                KRONOSCODE AI ENGINE                       │
│  • TypeScript core (Bun runtime)                          │
│  • Vercel AI SDK for provider abstraction                 │
│  • Hono HTTP server for local API endpoints               │
│  • Drizzle ORM + SQLite for persistence (sessions, tools) │
│  • Zod schema validation throughout                       │
│  • Session management with context windows                │
│  • LSP integration for code intelligence                  │
│                                                           │
│  Agent Architecture:                                      │
│  Kronos (router) → Hephaestus / Sisyphus / Prometheus     │
│                    / Oracle / Librarian (specialists)      │
├──────────────────────────────────────────────────────────┤
│                   TOOL EXECUTION LAYER                    │
│  • 69+ built-in tools (file, bash, browser, desktop)      │
│  • MCP server integration (connected extensions)          │
│  • Skills system (loadable domain-specific capabilities)  │
│  • Dynamic tool creation (create_tool API)                │
│  • Tool budgets (max searches before coding, etc.)        │
│  • Batch execution (parallel tool calls for speed)        │
├──────────────────────────────────────────────────────────┤
│                   AI PROVIDER LAYER                       │
│  • OpenAI (GPT-4o, o3, etc.)                              │
│  • Anthropic (Claude 4 Sonnet/Opus)                       │
│  • Google (Gemini 2.0 Pro/Flash)                          │
│  • Ollama / LM Studio (local models)                      │
│  • Pluggable provider architecture (add your own)         │
│  • Bring your own API keys — no vendor lock-in            │
├──────────────────────────────────────────────────────────┤
│                   STORAGE & PERSISTENCE                   │
│  • SQLite via Drizzle ORM (sessions, tools, config)       │
│  • macOS Keychain / Linux secret service / Windows CM     │
│  • Snapshot-based session save/restore                    │
│  • File-based skill storage (.kronoscode/skills/)         │
└──────────────────────────────────────────────────────────┘
```

### Key Runtime Details

| Component           | Technology                  | Purpose                                                   |
| ------------------- | --------------------------- | --------------------------------------------------------- |
| **Desktop Shell**   | Electron + TypeScript       | Cross-platform window, menu, native integrations          |
| **Backend**         | Go                          | High-performance IPC, PTY, SSH, WebSocket bridge          |
| **AI Engine**       | TypeScript + Bun            | Agent logic, tool execution, session management           |
| **Widget Protocol** | wsh IPC (JSON)              | Bidirectional control between AI and block widgets        |
| **Database**        | SQLite via Drizzle ORM      | Session persistence, tool metadata, config storage        |
| **AI SDK**          | Vercel AI SDK (`ai`)        | Unified provider interface, stream handling, tool calling |
| **HTTP**            | Hono                        | Local API routes, MCP server, health checks               |
| **Validation**      | Zod                         | Runtime schema validation for all tool parameters         |
| **SSH**             | Go-based PTY bridge         | Durable remote sessions with auto-reconnect               |
| **Sandbox**         | E2B SDK                     | Cloud Linux VM lifecycle (Firefox, VS Code, terminal)     |
| **Layout Engine**   | React + custom tile manager | Drag-and-drop block positioning, snap, full-screen        |

---

## ⚡ ACP Agents — Premium TUI Intelligence

KronTerm is expanding beyond the terminal with **ACP (Agent Control Protocol)** — a system for running personal TUI agents that live in your workspace alongside KronosCode:

While KronosCode operates _on demand_ — invoked when you ask the AI to do something — **ACP agents run autonomously** in the background, watching your workspace and acting on your behalf.

| Agent        | Role                                                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Hermes**   | Personal automation agent — orchestrates your workspace, runs workflows, manages your dev loop. Hermes can watch file changes, trigger builds, run tests on save, and keep your dev loop spinning without manual intervention. |
| **OpenClaw** | File system intelligence — navigates, understands, and operates on your codebase. OpenClaw groks your project structure, understands dependency graphs, and can perform large-scale refactors with surgical precision.         |
| **Codex**    | Code generation & analysis agent — powered by advanced AI for deep engineering work. Codex handles the heavy lifting: generating entire modules, analyzing complex code paths, and producing production-grade implementations. |

### How ACP Agents Differ from KronosCode Specialists

| Dimension       | KronosCode Specialists (Built-in)    | ACP Agents (Premium)                         |
| --------------- | ------------------------------------ | -------------------------------------------- |
| **Trigger**     | On-demand — invoked by user request  | Autonomous — run continuously or on schedule |
| **Scope**       | Single task, single surface          | Multi-step workflows across surfaces         |
| **Persistence** | Per-session, stateless               | Persistent with memory and state             |
| **Autonomy**    | Zero — follows explicit instructions | High — plans and executes independently      |
| **Cost**        | Included with KronTerm               | Premium tier                                 |

> **Premium feature.** ACP agents are coming as part of KronTerm's premium tier, giving you autonomous TUI assistants that work alongside you — not just when you ask, but proactively.

---

## 🔒 Security Model — How the AI Stays Safe

KronosCode has deep access to your system — terminals, files, desktop, browser, network. Here's how we keep that power under control:

### Explicit Permission Model

- **Bring your own keys** — KronosCode uses your API keys for OpenAI, Claude, Gemini, or local models. No cloud dependency, no data leaving your machine unless you explicitly route through a remote provider.
- **No automatic execution** — The AI never runs commands or edits files without being asked. Every tool call is in response to a user request or an explicitly delegated sub-task.
- **Secret storage** — API keys and credentials use the OS-native secure store (macOS Keychain, Linux secret service, Windows Credential Manager). Secrets are never stored in plaintext config files.

### Sandbox Isolation

- **E2B sandboxes** are fully isolated Linux VMs — the AI can do anything inside them (root access, package installs, network operations) without affecting your host machine
- **KronTerm blocks** are sandboxed at the widget level — a crashed web block can't take down the terminal
- **Terminal sessions** run in isolated PTY processes — no cross-session interference

### Tool Governance

| Mechanism                       | What It Prevents                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| **Surface routing**             | The AI can't accidentally run macOS desktop commands on the sandbox or vice versa        |
| **Tool budgets**                | Limits broad searches before coding — prevents runaway API costs                         |
| **Capability context contract** | Runtime health checks prevent the AI from calling unavailable tools                      |
| **Stop conditions**             | The AI stops when acceptance checks pass or blocked by missing credentials               |
| **Git safety protocol**         | The AI never force-pushes, amends pushed commits, or skips hooks unless explicitly asked |

### Data Flow

```
Your API Key → AI Provider (OpenAI/Claude/Gemini/Ollama)
     ↓
KronosCode Engine (local)
     ↓
Tool calls executed locally
     ↓
Results return to AI → Response back to you
```

Your source code, terminal output, and files are processed by the AI provider through your API key — they never transit through a KronTerm cloud service because there is no KronTerm cloud service. The only exception is the E2B sandbox, which runs on cloud infrastructure but is fully isolated per-user.

---

## 🔮 The Future — KronTerm API

We're building a **full control API** for KronTerm — programmatically create blocks, run commands, manage layouts, trigger agents, and integrate KronTerm into your own tools and pipelines.

The KronTerm API turns your workspace into a programmable surface. CI pipelines, automation scripts, and custom tools will be able to drive KronTerm like a headless development environment.

---

## Installation

KronTerm runs on macOS 11+, Windows 10 1809+, and Linux (glibc 2.28+).

| Platform            | Download                                                   |
| ------------------- | ---------------------------------------------------------- |
| macOS (arm64 / x64) | [kronterm.dev/download](https://www.kronterm.dev/download) |
| Windows (x64)       | [kronterm.dev/download](https://www.kronterm.dev/download) |
| Linux (arm64 / x64) | [kronterm.dev/download](https://www.kronterm.dev/download) |

See [the docs](https://docs.kronterm.dev/gettingstarted) for detailed installation guides.

### Build from Source

```bash
git clone https://github.com/krontermdev/kronterm.git
cd kronterm
task dev
```

See [BUILD.md](BUILD.md) for full build instructions.

---

## Roadmap

KronTerm is under active development. See [ROADMAP.md](./ROADMAP.md) for what's coming next.

Want to influence the direction? Join our [Discord](https://discord.gg/XfvZ334gwU) or open a [Feature Request](https://github.com/krontermdev/kronterm/issues/new/choose).

---

## Community & Links

- **Homepage** — [kronterm.dev](https://www.kronterm.dev)
- **Documentation** — [docs.kronterm.dev](https://docs.kronterm.dev)
- **Download** — [kronterm.dev/download](https://www.kronterm.dev/download)
- **X (Twitter)** — [@krontermdev](https://x.com/krontermdev)
- **Discord** — [Join the community](https://discord.gg/XfvZ334gwU)
- **GitHub** — [krontermdev/kronterm](https://github.com/krontermdev/kronterm)

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Sponsoring KronTerm ❤️

If KronTerm is useful to you or your company, consider [sponsoring development](https://github.com/sponsors/krontermdev). Sponsorship supports the time and effort spent building and maintaining the project.

---

## License

KronTerm is licensed under the [Apache 2.0 License](LICENSE). See [ACKNOWLEDGEMENTS.md](./ACKNOWLEDGEMENTS.md) for dependency information.

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fkrontermdev%2Fkronterm.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fkrontermdev%2Fkronterm?ref=badge_large)
