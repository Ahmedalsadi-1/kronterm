# 10x Analysis: KronTerm for iPhone — Hermes Surface Browser

Session 1 | Date: 2026-08-03

## Executive Verdict

KronTerm should not try to squeeze the Electron desktop application, Bun-based KronosCode runtime, Go backend, PTYs, and macOS Accessibility control onto an iPhone.

The 10x product is a **standalone pocket workspace with a controllable operating system**:

- Opening KronTerm on iPhone provisions or resumes a hosted KronTerm sandbox. No computer is required.
- KronosCode runs beside that sandbox and can launch its apps, navigate its browser, use its terminal and files, click, type, scroll, drag, inspect, and verify results.
- The iPhone receives a touch-native **Surface Browser**: every browser tab, terminal, file, controlled app, artifact, and KronosCode run appears as a live card that can be opened, grouped, suspended, restored, or handed to the agent.
- A user's Mac or another computer is an optional host. Connecting one adds its local files, terminals, browser, and native desktop apps to the same control plane.
- Hermes Desktop supplies the visual and interaction language—streaming tool cards, composer, previews, sessions, files, terminal, settings, overlays, and haptics—but KronosCode remains the only production chat/agent engine.
- On the iPhone operating system itself, KronTerm uses Apple-sanctioned surfaces such as App Intents, Shortcuts, Share extensions, widgets, Live Activities, notifications, Files, camera, and microphone. It does not claim arbitrary control of SpringBoard or unrelated App Store apps.

The north-star promise is:

> Open KronTerm anywhere. Kronos gets a real computer, browser, and apps inside its sandbox. Connect your own computer only when you want Kronos to reach your local world.

That is meaningfully different from "SSH on a phone": the user gets an immediately available, agent-operated workspace, while the phone remains a high-quality control surface rather than pretending to be a laptop. If a complete desktop sandbox is too heavy for the first release, the same architecture can launch as a managed **Browser Host** first and add terminal, files, and desktop apps without redesigning the iPhone product.

---

## Current Value

### What KronTerm solves today

KronTerm is already a desktop execution environment rather than a simple terminal:

- terminals, browsers, files, previews, sandboxes, native applications, and AI live in one block workspace (`README.md:38-67`);
- the Widget Protocol exposes structured element trees and actions to agents (`README.md:67-71`);
- KronosCode routes work across terminal, browser, sandbox, and macOS-control specialists (`README.md:79-121`);
- the Go service exposes authenticated WebSocket RPC and durable routing (`pkg/web/ws.go:321-380`);
- durable SSH and remote files already exist (`README.md:231-235`);
- native Mac application control already has screenshot, click, type, key, scroll, drag, paste, and wait paths (`pkg/wshrpc/wshserver/appstream.go:31-120`);
- KronTerm already models a Linux desktop sandbox with start/status/stop RPC, noVNC presentation, SSH, screenshots, mouse, keyboard, scrolling, dragging, clipboard, file access, and application launching (`pkg/aiusechat/tools_sandbox.go:19-96`, `frontend/app/view/sandbox/sandbox.tsx:144-185`, `pkg/aiusechat/tools_kronterm_desktop.go:344-380`);
- KronosCode can already attach to an external HTTPS endpoint instead of launching only a local runtime (`emain/kronoscode-runtime.ts:103-111`, `emain/kronoscode-runtime.ts:426-447`).

These are exactly the primitives a standalone mobile workspace needs. The core asset is not the Electron window. It is the combination of **sandbox runtime + structured surfaces + agent execution + approvals**, with optional personal-computer access layered on top.

### An iPhone prototype already exists

The repository contains an untracked but functional `mobile/` prototype:

- React 19 + Capacitor 8 application with an iOS project (`mobile/package.json:1-33`, `mobile/capacitor.config.ts:1-22`);
- Canvas, Kronos, and Device sections (`mobile/src/components/app-shell.tsx:15-19`);
- a bridge client for health, sessions, messages, and approved device actions (`mobile/src/types.ts:60-70`);
- a Mac-side Node bridge that proxies KronosChamber sessions and terminal APIs (`mobile/bridge/server.mjs:321-403`);
- a six-digit pairing flow that issues 24-hour bearer tokens (`mobile/bridge/server.mjs:6-10`, `mobile/bridge/server.mjs:290-301`);
- an allowlisted MCP connector for inspect, tap, and type against a development iPhone (`mobile/bridge/server.mjs:17`, `mobile/bridge/server.mjs:235-255`, `mobile/bridge/server.mjs:406-425`);
- an explicit UI statement that an App Store build cannot silently control other apps (`mobile/src/components/device-panel.tsx:189-195`).

Validation during this session:

- `npm test -- --run`: 3 tests passed;
- `npm run build`: TypeScript and Vite production build passed;
- resulting main JavaScript bundle: approximately 236 KB uncompressed / 75 KB gzip.

This is a good vertical-slice prototype. It proves that the mobile UI can talk to KronosCode through the Mac. Its largest product gap is that pairing a Mac is currently the only live path: there is no `EngineClient` for provisioning and controlling a hosted sandbox, even though KronTerm's desktop code already contains many of the sandbox-control primitives. It is not yet a production security or transport architecture.

### What the prototype currently does not provide

1. **The canvas is mostly a demo.** Its four nodes and links are local constants, not a synchronized view of the desktop workspace (`mobile/src/components/canvas-board.tsx:27-68`).
2. **Chat is request/response, not a resilient run stream.** A prompt can hold an HTTP request for up to 15 minutes, and the app only loads the first session (`mobile/bridge/server.mjs:343-357`, `mobile/src/app.tsx:22-40`).
3. **Terminal transport exists in the bridge but is not exposed by the mobile `EngineClient`.** The server can create, write to, and stream a terminal, while the mobile interface has no corresponding methods (`mobile/bridge/server.mjs:361-403`, `mobile/src/types.ts:60-70`).
4. **Pairing is LAN-only and manual.** The user types an HTTP IP address and code (`mobile/src/components/pairing-sheet.tsx:15-16`, `mobile/src/components/pairing-sheet.tsx:65-95`).
5. **The bearer token is stored in WebView local storage.** It should be in Keychain/Secure Enclave-backed native storage (`mobile/src/engine/storage.ts:3-26`).
6. **The LAN token crosses plain HTTP.** A six-digit code and rate limit are useful prototype safeguards, but they do not authenticate the Mac to the phone or prevent a local-network interception (`mobile/bridge/server.mjs:25-31`, `mobile/bridge/server.mjs:97-125`).
7. **Authorization is too broad.** The token gates the whole bridge, including agent prompts and terminal input. Only the developer-device actions are allowlisted and shown with one-time approval (`mobile/bridge/server.mjs:304-425`).
8. **Approval is asserted by the client as `approved: true`.** A production host must issue a challenge for an exact action, and the phone must sign that action after local authentication. A boolean in a request body is not an approval proof (`mobile/src/engine/bridge-client.ts:135-143`).
9. **The existing surface token cannot be reused as-is.** It can only be issued by an Electron RPC session and scopes only to a tab/block for one hour (`pkg/wshrpc/wshserver/wshserver.go:77-114`).
10. **There is no native system presence yet.** The Capacitor package has haptics and status-bar support, but no APNs, Live Activities, App Intents, widgets, Share extension, Keychain plugin, or biometric approval (`mobile/package.json:15-21`).

### What the requested reference projects prove

The three requested projects are useful as architecture evidence, not as permission to promise unrestricted consumer iPhone control:

| Reference                                                      | Proven pattern to borrow                                                                                                                                                                                                                                              | Boundary to preserve                                                                                                                                                                                                                               |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Qalti / AIQA](https://github.com/qalti/qalti)                 | A black-box `view → decide → act → verify → repeat` loop can tap, type, scroll, open apps/URLs, cross app boundaries, and produce screenshot-backed logs on simulators or connected devices. Its visual approach is a valuable fallback when no semantic tree exists. | It is a macOS/Xcode test runner for simulators or connected development devices, not an App Store technique for one iPhone app to control every other app. Pixel-only control is slower and more brittle than KronTerm's semantic Widget/DOM path. |
| [PhoneAgent](https://github.com/rounak/PhoneAgent)             | A compact cross-device RPC vocabulary—screen, tree, context, open app, tap, tap element, enter text, scroll, swipe, stop—works well as an agent control surface. Its notification completion and quick-reply loop are strong mobile patterns.                         | Its iOS control path is hosted by XCTest, requires Xcode/developer setup, and exposes a localhost bridge. It belongs in KronTerm Labs, not the consumer execution path.                                                                            |
| [iGentic iPhone](https://github.com/pokekarten/igentic-iphone) | The iPhone should be the trusted control point: hold identity and policy locally, classify risk, approve consequential actions, delegate heavy compute, verify results, and retain a minimized audit log.                                                             | It is explicitly experimental and its App Intents work is research guidance. KronTerm should adopt the trust thesis while using its own real KronosCode and sandbox runtimes.                                                                      |

Qalti and PhoneAgent are MIT-licensed; iGentic is Apache-2.0. Their ideas can inform the product, and any copied implementation must retain the appropriate license notices. The strategic synthesis is:

> Use semantics first, visual perception second, and XCTest/WDA only in an explicitly developer-controlled lane.

### Hermes Desktop is already the right UI source

Hermes is not a speculative visual reference. Its source is already imported under `third_party/source-imports/hermes-desktop/`, and the import manifest explicitly names its chat cards, assistant UI, settings/control primitives, preview patterns, and session UI as adaptation sources (`third_party/source-imports/README.md:1-17`). KronTerm already uses adapted Hermes modules for chat cards, prompt overlays, model controls, settings primitives, and Kronos Canvas (`frontend/app/aipanel/chat-cards.tsx:1-20`, `frontend/app/components/hermes-ui/`, `frontend/app/view/kronoscanvas/kronoscanvas.tsx:1-12`).

Hermes Desktop contributes three important design rules:

1. **The runtime stays behind a gateway.** Hermes' renderer talks to its dashboard backend over standard gateway APIs rather than rebuilding the agent inside the UI (`third_party/source-imports/hermes-desktop/README.md:86-88`). KronTerm should do the same with KronosCode.
2. **Chat and work stay together.** Hermes keeps streaming tool activity beside previews, files, and terminal surfaces (`third_party/source-imports/hermes-desktop/README.md:10-18`, `third_party/source-imports/hermes-desktop/src/app/desktop-controller.tsx:888-978`).
3. **Surfaces retain state when hidden.** Its terminal stays mounted and is moved between panes instead of being recreated (`third_party/source-imports/hermes-desktop/src/app/desktop-controller.tsx:803-808`). On iPhone, browser sessions, terminals, and app surfaces need the same continuity even though the presentation changes from panes to cards and sheets.

Do not copy Hermes' desktop multi-pane geometry onto iPhone. Port its component language, information hierarchy, tool/event rendering, haptics, and gateway separation into a one-surface-at-a-time mobile shell. Hermes is the **view system**; KronosCode is the **brain**; KronLink and WSH are the **nervous system**; the hosted sandbox and optional computers are the **hands**.

---

## The Question

How can KronTerm become a standalone iPhone product that navigates apps, controls a browser, performs actions, owns a controllable sandbox, and optionally connects to a user's computer?

## The Boundary That Defines the Product

Apple's rules make the correct topology unusually clear:

- All third-party iPhone apps are sandboxed. They cannot modify other apps or the operating system, and can reach outside their own container only through services iOS explicitly provides. The system partition is read-only and apps cannot elevate their privileges. [Apple Platform Security: runtime process security](https://support.apple.com/en-mide/guide/security/sec15bfe098e/web)
- App Review Guideline 2.5.2 restricts downloading or executing code that changes app functionality, while 2.5.4 restricts background services to their declared purposes. [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- iOS background execution is scheduled and limited. Background refresh receives short bursts, and silent push delivery is system-controlled rather than a permanent daemon guarantee. [Choosing Background Strategies for Your App](https://developer.apple.com/documentation/backgroundtasks/choosing-background-strategies-for-your-app)

Therefore:

| Goal                                                                              | Viable product model                                                                                           | Verdict               |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------- |
| Navigate apps and perform actions without a computer                              | Give each user a hosted Linux desktop sandbox with an app catalog, semantic control, and live streaming        | Core product          |
| Control a browser without a computer                                              | Run the controlled browser inside the hosted sandbox; expose DOM/widget semantics plus an interactive viewport | Core product          |
| Run terminals, code agents, files, and previews without a computer                | Run KronosCode and a KronTerm Host beside the sandbox                                                          | Core product          |
| Control a user's Mac from iPhone                                                  | Optionally install a KronTerm Host connector on the Mac; send scoped commands and evidence over a secure link  | Optional extension    |
| Let KronTerm participate in iOS                                                   | App Intents, Shortcuts, Share extension, Files, camera, voice, notifications, widgets, Live Activities         | Core product          |
| Arbitrarily inspect/tap/type across third-party iPhone apps in an App Store build | Not available through public iOS APIs                                                                          | Do not promise        |
| Automate a development iPhone or simulator                                        | Mac-hosted Xcode/WebDriverAgent connector, explicit developer mode, allowlisted tools                          | Separate Labs feature |
| Jailbreak/private-entitlement OS control                                          | Fragile, unsafe, non-App-Store, destroys trust                                                                 | Pass                  |

The iPhone can deliver the **experience of commanding an operating system** because KronTerm owns the sandbox operating system. It can fully control apps, browser, terminal, and files there. Connecting a user's computer extends the same model to that computer. It cannot reproduce macOS-style unrestricted control over iOS itself.

## Three Product Scopes

### Scope A: KronTerm Sandbox — full control, default

This is the standalone product. Every user gets a persistent or resumable isolated Linux workspace containing:

- browser;
- terminal and PTY sessions;
- file explorer and editor;
- VS Code or another web/desktop editor;
- preview surfaces;
- approved app catalog;
- installable packages within policy;
- snapshots, restore points, and disposable branches.

KronosCode has full declared control inside this boundary: launch apps, inspect the active UI, click, type, scroll, drag, copy/paste, read/write files, execute commands, browse the web, and verify outcomes. This is the place to make the "AI controls an operating system" promise without ambiguity.

### Scope B: KronTerm iPhone app — owned and sanctioned control

KronosCode can control KronTerm's own canvas, embedded views, composer, saved workflows, and data. It can invoke explicit App Intents and Shortcuts that the user configured. It can receive user-shared files, URLs, text, photos, voice, and camera context. It cannot silently navigate unrelated native iOS apps.

For browser tasks, default to a managed Browser Host because Kronos owns its state, identity, downloads, automation, and continuity. A local `WKWebView` remains useful for user-driven viewing, reading, and handing a URL to Kronos, but it should not become a second autonomous-agent architecture. Browser Host can be the first shippable standalone tier before the complete Linux desktop is ready.

### Scope C: Personal Computer Link — full host control, optional

When the user installs and pairs KronTerm Host on macOS, Kronos gains the capabilities that host explicitly publishes:

- local terminal and repositories;
- host browser;
- files and previews;
- native apps through macOS Accessibility and screen access;
- local secrets under policy;
- handoff between sandbox and Mac.

The iPhone app must remain valuable when this scope is absent or offline.

---

## Required Product Properties

### 1. Control-first, not desktop-shrunk

The phone should optimize for six actions:

1. start or resume a sandbox instantly;
2. ask Kronos to open an app, use the browser, or complete an outcome;
3. watch or take over one focused surface;
4. see what needs attention and inspect enough evidence to decide;
5. approve, deny, stop, retry, or redirect;
6. optionally hand the focused surface to or from a personal computer.

The current freeform canvas should become a secondary workspace map. The default surface should be the **Surface Browser**: an Arc-like two-column overview of live browser pages, terminals, files, controlled apps, previews, and runs. A compact attention shelf shows approvals, failures, and completions; a floating Kronos composer starts or steers work. A 6.1-inch screen is excellent for selecting and directing one surface and poor for managing four tiny desktop windows.

### 2. Host-independent

The mobile app must see every execution target through one model, while making the hosted sandbox the zero-configuration default:

- KronTerm sandbox;
- optional paired Mac;
- optional SSH host;
- managed cloud Linux workspace;
- later, a team-owned host.

Each host publishes the same properties:

```text
identity
online / asleep / locked / offline
runtime versions
workspaces
surfaces
available capabilities
permission state
active runs
resource health
last trusted contact
```

The user chooses the outcome; Kronos chooses an eligible host. Browser, app, terminal, and file tasks run in the sandbox by default. A Mac-UI automation run requires an optional connected, unlocked Mac user session with Accessibility/Screen Recording access. The UI must make that distinction visible rather than fail mysteriously.

The model must support multiple simultaneous hosts from the first contract, even if beta provisioning exposes only one sandbox and one Mac. Host identity belongs on every surface, event, capability, approval, and artifact; it must never be inferred from whichever connection happens to be active.

### 3. Semantic before pixels

KronTerm's Widget Protocol is the mobile moat.

Send the iPhone:

- compact surface snapshots;
- element references and available actions;
- terminal deltas with sequence numbers;
- file and git diffs;
- agent plan and tool timeline;
- thumbnails or screenshots only when useful;
- a pixel stream only for focus/takeover mode.

Raw remote desktop alone will always feel cramped and bandwidth-heavy. A terminal error should arrive as a failure card with command, exit code, relevant lines, suggested fix, and actions. A browser should arrive as a semantic page summary plus tappable targets. A native Mac app should arrive as an accessibility snapshot plus an optional live image.

### 4. Interruption-resilient

The iPhone cannot be the owner of a long-running WebSocket or the agent process. Runs need durable IDs, replayable event logs, idempotent commands, resumable streams, sequence checkpoints, and offline-safe action queues. APNs wakes or alerts the user; reconnecting rehydrates the current state.

This is a stronger version of KronTerm's existing durable SSH idea, applied to every run.

### 5. Capability-secure

Any product that exposes a shell, browser identity, files, secrets, or personal computer is a security product. Every request needs:

- a device identity, not one shared bearer string;
- host authentication and transport encryption;
- workspace and surface scope;
- explicit tool/action scope;
- risk class and approval policy;
- time, count, and resource budgets;
- exact-action approval proofs for sensitive actions;
- revocation and a visible kill switch;
- an audit receipt containing intent, evidence, action, actor, result, and time.

The phone should be able to say "approve this exact deployment to staging" without granting "run arbitrary shell commands for 24 hours."

### 6. Native at the edges

Keep the existing React/Capacitor surface for fast product iteration, but add a small native Swift capability layer for:

- Keychain and Secure Enclave device keys;
- LocalAuthentication / Face ID approvals;
- APNs;
- Live Activities and widgets;
- App Intents and Shortcuts;
- Share extension;
- camera-based QR pairing;
- Bonjour discovery;
- background URLSession and reconnect handoff.

Apple explicitly supports App Intents across Siri, Shortcuts, Spotlight, widgets, and system experiences. Interactive widgets and Live Activities can expose buttons and toggles without opening the app. [Creating your first app intent](https://developer.apple.com/documentation/appintents/creating-your-first-app-intent), [Widgets, Live Activities, and controls](https://developer.apple.com/documentation/appintents/widgets-and-live-activities), [Adding interactivity to widgets and Live Activities](https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities)

### 7. Cloud-ready with local and self-hosted options

The default sandbox needs zero networking setup, while KronTerm's privacy promise remains credible:

- The iPhone connects to the hosted sandbox over authenticated TLS, with workspace encryption and short-lived capabilities.
- A personal computer makes an outbound encrypted connection to the control service, so the user does not expose ports.
- On the same network, the phone may discover the computer with Bonjour and establish a faster direct path after verifying the same device identity.
- End-to-end encrypt personal-computer control payloads so the relay routes opaque messages.
- Keep a self-hosted control-plane and sandbox option for advanced and regulated users.
- Store only minimal notification metadata; fetch sensitive evidence after device unlock.

Apple requires a user-facing local-network permission and Bonjour service declarations for discovery. The current app already has `NSLocalNetworkUsageDescription`; it would need a declared service type such as `_kronterm._tcp` for direct computer discovery. [TN3179: Understanding local network privacy](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy), [Bonjour](https://developer.apple.com/documentation/foundation/bonjour/)

### 8. Glanceable and proactive

The mobile product should come to the user only at meaningful state changes:

- approval required;
- run failed;
- agent is blocked;
- deployment is ready;
- security-sensitive capability changed;
- long task completed.

APNs is the correct wake/notification mechanism, and Live Activities can display and update a run outside the application. [Setting up a remote notification server](https://developer.apple.com/documentation/usernotifications/setting-up-a-remote-notification-server), [Starting and updating Live Activities with ActivityKit push notifications](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications)

### 9. One real KronosCode engine

The production app must never quietly fall back to a fake assistant. The current unpaired path constructs `DemoEngineClient`, returns `version: "demo"`, and fabricates an answer after a timer (`mobile/src/app.tsx:8-24`, `mobile/src/engine/demo-client.ts:21-76`). Keep that client only for component previews, automated UI fixtures, and an explicitly labeled demo build.

Production uses a `KronosGatewayClient` connected to the user's hosted sandbox by default or to a selected KronosCode host. It must carry the complete structured conversation and run stream:

- user, assistant, and system messages;
- incremental text and reasoning/status events;
- tool-call start, progress, output, and failure;
- plans, todos, approvals, and clarifications;
- artifacts, screenshots, diffs, previews, and surface references;
- cancel, steer, retry, branch, resume, and reconnect semantics.

The current bridge discards every non-text message part and marks every returned message complete (`mobile/src/engine/bridge-client.ts:21-52`, `mobile/src/engine/bridge-client.ts:123-136`). That would throw away the very tool evidence that makes Hermes useful. The mobile gateway should normalize KronosCode's native event model into Hermes-derived renderers without translating it into a text-only chatbot.

### 10. A capability ladder that ships early

KronTerm should degrade by available capability, not by showing a broken desktop:

| Mode                 | Works without a computer | Capabilities                                                                                                   | Product role                                                             |
| -------------------- | -----------------------: | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| iPhone Local         |                      Yes | real KronosCode chat, local `WKWebView`, Share extension, camera/voice/files, App Intents/Shortcuts, approvals | Useful companion and trust key; no claim of arbitrary native-app control |
| Managed Browser Host |                      Yes | persistent automated browser, tabs, downloads, browser files, screenshots, DOM/visual actions                  | Fastest standalone release if full desktop provisioning is delayed       |
| Kron Sandbox Host    |                      Yes | browser plus terminal, files, editor, previews, Linux desktop apps, snapshots                                  | Complete standalone promise                                              |
| Personal/Team Host   |                 Optional | selected local files, shells, browsers, and controlled native apps                                             | Adds private context and specialized capabilities                        |

All four modes use the same Surface Browser, KronosCode session, host picker, approval system, and action protocol. Users gain capabilities as hosts come online; they do not enter a different product.

---

## Recommended System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ KronTerm iPhone                                             │
│ Hermes Surface Browser · Kronos composer · approvals         │
│ browser · terminal · files · apps · runs · multi-host picker │
│ Swift edge: Keychain, Face ID, APNs, Intents, Share, Bonjour│
└───────────────────────────┬─────────────────────────────────┘
                            │ KronLink
                       E2EE over TLS
                            │
┌───────────────────────────▼─────────────────────────────────┐
│ KronTerm Control Service                                   │
│ device trust · capabilities · policy · audit · stream mux   │
│ durable events · workspace registry · notification emitter  │
└──────────────┬─────────────────────┬────────────────────────┘
               │ default             │ optional connector
┌──────────────▼─────────────┐  ┌────▼────────────────────────┐
│ Hosted Sandbox Plane      │  │ Personal Computer Plane     │
│ KronosCode + wavesrv/wsh  │  │ signed KronTerm Host        │
│ isolated Linux desktop    │  │ local PTY / files / browser │
│ browser + apps + terminal │  │ native macOS app control    │
│ files + previews + VNC    │  │ Accessibility + screen      │
└────────────────────────────┘  └─────────────────────────────┘
```

### What runs where

| Component                                            |     iPhone client | Hosted sandbox (default) | Personal computer (optional) |
| ---------------------------------------------------- | ----------------: | -----------------------: | ---------------------------: |
| Hermes-derived Surface Browser and cached task state |               Yes |                       No |                           No |
| KronosCode reasoning/runtime                         |                No |                      Yes |          Optional/attachable |
| Go `wavesrv` / WSH router                            |                No |                      Yes |                          Yes |
| Linux desktop apps                                   |      View/control |                      Yes |            Optional local VM |
| Controlled browser                                   |      View/control |                      Yes |        Optional host browser |
| PTY, files, editor, and previews                     |      View/control |                      Yes |                          Yes |
| macOS native app control                             |                No |                       No |                          Yes |
| iPhone App Intents/Share/notifications               | Triggers/receives |  Receives context/events |      Receives scoped handoff |
| Development iPhone automation                        |       Target only |                       No |          Xcode/WDA connector |
| Durable run/event ledger                             |            Cached |                      Yes |              Optional mirror |
| Remote relay                                         |            Client |             Service side |                       Client |

### Hosted sandbox platform properties

The current product story names E2B as the cloud sandbox (`README.md:62`, `README.md:199`, `README.md:290`), while the checked-in manager currently selects local QEMU or a `kronterm-desktop` endpoint (`pkg/sandbox/manager/sandbox.go:124-153`, `pkg/sandbox/manager/sandbox.go:174-212`). The iPhone product needs one explicit reference cloud runtime rather than relying on that ambiguity.

| Platform component       | Responsibility                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Identity/API gateway     | account, iPhone device identity, session issuance, quotas                                       |
| Sandbox scheduler        | provision, warm pool, pause, resume, destroy, region selection                                  |
| Versioned base image     | browser, terminal, files, editor, previews, accessibility bridge, Kronos sidecar                |
| Surface gateway          | semantic snapshots/actions, terminal stream, focused visual stream                              |
| Workspace storage        | encrypted persistent volume, disposable branches, snapshot/restore                              |
| Secret broker            | inject a secret into one process/action without revealing it to the phone or general sandbox UI |
| Network policy           | per-workspace egress rules, download scanning, abuse limits, private-network restrictions       |
| Event and artifact store | durable run timeline, screenshots, diffs, recordings, receipts, resumable cursors               |
| Metering and budgets     | CPU, memory, storage, network, model/tool spend, automatic pause                                |
| Health and recovery      | agent heartbeat, frozen-app detection, browser restart, workspace rollback                      |

For the beta, prefer the fastest managed runtime that can meet the control contract and snapshot requirements. Preserve the host interface so KronTerm can later operate its own microVM pool or accept self-hosted providers without rewriting the mobile app.

### Four control loops

| Surface           | Observe                                                            | Act                                                                             | Verify                                               | Phone presentation                             |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| Sandbox apps      | app/window registry, Linux accessibility tree, screenshot          | launch, focus, close, click ref/coordinate, type, keys, scroll, drag, clipboard | next accessibility/screenshot snapshot and app state | app deck + focused interactive stream          |
| Browser           | URL, tabs, DOM/widget snapshot, console/network state, screenshot  | navigate, click ref, fill, submit, scroll, upload/download, open/close tab      | DOM condition, URL, network result, screenshot       | native toolbar + semantic page + live viewport |
| Terminal/files    | PTY deltas, exit code, process state, file metadata/diff           | input, signal, resize, command, read/write/move                                 | exit code, new output sequence, resulting diff/test  | focus terminal + diff/file cards               |
| Optional computer | WSH blocks, Accessibility tree, host screenshot, capability health | the same typed actions, restricted by host grants                               | host snapshot, command result, audit receipt         | host badge + focused surface                   |

The agent loop should always be `observe → choose typed action → execute → verify`. Coordinate clicks remain a fallback, not the primary protocol.

For production, separate the control and viewing paths:

- **Control path**: resumable KronLink events and typed actions with idempotency keys.
- **Semantic path**: compressed Widget/DOM/accessibility snapshots and deltas.
- **Visual path**: noVNC is enough for the first prototype; move focused interactive sessions to adaptive WebRTC/H.264 when latency and bandwidth justify it.
- **Artifact path**: signed, expiring URLs for downloads, screenshots, diffs, recordings, and run evidence.

### Universal Surface contract

The browser metaphor should be applied to lifecycle and navigation, not used to pretend every tool is a webpage. A universal `Surface` is the unit shown by the iPhone:

```text
surfaceId          stable identity
kind               browser | terminal | file | app | preview | run | approval
hostId             sandbox, browser host, Mac, SSH, or team host
workspaceId        project/space grouping
title + subtitle   human-readable identity
thumbnail          cached visual preview, never the sole source of truth
semanticSummary    current state in compact structured form
lifecycle          opening | live | working | waiting | suspended | closed | failed
runBinding         KronosCode session/run currently operating it
attention          none | progress | blocked | approval | failed | complete
capabilities       focus, inspect, navigate, input, edit, stop, restore, handoff, etc.
risk + privacy     sensitivity and approval policy
lastEventCursor    resumable stream position
restoreToken       host-scoped continuation state
```

Every surface action includes `surfaceId`, `hostId`, expected revision, idempotency key, actor, and capability. This prevents a tap intended for one browser or computer from landing on another after a reconnect or host switch.

Browser behaviors generalize as follows:

| Browser concept   | KronTerm meaning                                                                      |
| ----------------- | ------------------------------------------------------------------------------------- |
| Tab               | Any live surface: webpage, shell, file, app, preview, or run                          |
| Tab group / Space | Workspace, project, objective, or host collection                                     |
| Address bar       | Kronos omnibox: URL, command, file path, app name, or natural-language objective      |
| Back / forward    | Surface-local history; terminal history is not mutated by browser navigation          |
| Close             | Suspend or close according to surface type; never kill a process without saying so    |
| Recently closed   | Restorable surface descriptors and host continuation tokens                           |
| Incognito         | Disposable sandbox/browser branch with explicit secret and persistence policy         |
| Sync              | Durable surface metadata and event cursors, not uncontrolled copying of all host data |

### iPhone interaction model: Hermes meets the Surface Browser

The supplied screenshot is the correct home-screen direction: a calm, touchable grid of live cards with a recently closed tray. Adapt it beyond browsing:

1. **Surface overview** — Two-column cards show a live thumbnail, type icon, title, host badge, agent state, and one attention signal. Pinch or a toolbar control switches between grid and a compact list. Cards may be grouped by Space or host.
2. **Kronos omnibox** — A persistent floating composer accepts a URL, shell command, file path, app name, or outcome such as “compare these plans and put the result in a sheet.” KronosCode resolves the intent and eligible host before acting.
3. **Focused surface** — Tapping a card opens one surface full-screen. The content gets the space; a small universal toolbar exposes back, surface switcher, inspect, keyboard/input, hand to Kronos, takeover, stop, and more.
4. **Kronos sheet** — Swipe the composer upward to reveal the real KronosCode conversation, streaming Hermes tool cards, plan, evidence, approvals, and artifacts over the current surface. Chat is never a disconnected tab that hides what it is controlling.
5. **Attention shelf** — Approvals, blockers, failures, and completed artifacts appear in a small prioritized shelf, not as a permanent fourth navigation destination.
6. **Recently closed surfaces** — The translucent tray in the reference image becomes universal restore history. Restoring a browser reopens its page/session; restoring a terminal reattaches or creates a new shell only after showing which; restoring a file returns to its revision; restoring an app resumes its host surface if available.
7. **Host switcher** — A compact control shows `Kron Sandbox`, `Browser Cloud`, `Alba's Mac`, or team hosts. Selecting a host filters cards; `All Hosts` keeps cross-host work visible. Every card retains its host badge.

Use Hermes' typography, neutral surfaces, rounded cards, compact controls, haptic feedback, streaming states, code/tool cards, composer, prompt overlays, preview renderers, settings rows, and session history. Adapt desktop side rails into mobile sheets and card stacks. Avoid tiny always-visible panes, hover-only controls, desktop title bars, and exposing provider/model setup as the primary onboarding experience.

### Controllability rules

Ease of use comes from predictable authority, not from hiding what the agent is doing. Every focused surface should expose the same five-state control strip:

| Control    | Meaning                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------- |
| Ask Kronos | Give an outcome or correction while Kronos retains control                                        |
| Watch      | Follow live actions with touch input disabled, preventing accidental interference                 |
| Take Over  | Pause agent input and grant the user direct touch/keyboard control of this exact surface          |
| Give Back  | Snapshot current state, explain any user-made changes, and explicitly return control to Kronos    |
| Stop       | Cancel the run and revoke its active action capabilities; preserve evidence and recoverable state |

Consequential actions add `Preview`, `Approve once`, and `Deny`; reversible surfaces add `Restore`. The UI must always answer four questions without opening settings: **what is Kronos controlling, on which host, what is it doing now, and how do I stop it?**

Do not mix user and agent pointer/keyboard events. Taking over acquires a short surface lease; Kronos becomes an observer until the user gives control back or the lease safely expires. This avoids races where the agent submits a form while the user is editing it.

### Non-negotiable experience targets

Treat these as beta hypotheses to validate, not promises:

- first useful sandbox under 10 seconds from cold and under 2 seconds from pause;
- one tap from Surface Browser to the active browser/app/terminal;
- focused input-to-render latency below 200 ms at the 95th percentile on a good mobile connection;
- semantic action acknowledgement below 500 ms when the sandbox is healthy;
- reconnect without lost or duplicated actions after app suspension or network change;
- 720p/30 fps adaptive focus stream, with semantic mode remaining useful on weak networks;
- snapshot before high-risk autonomous work and restore in under 30 seconds;
- no Mac, IP address, SSH key, or terminal knowledge required for the first completed task.

### Evolve the prototype instead of discarding it

Keep:

- Capacitor/React application shell;
- the `EngineClient` boundary;
- the bridge as a development harness;
- existing session and terminal route experiments;
- allowlisted developer-device actions;
- Hermes-derived components already adapted into KronTerm;
- the best existing touch interactions, after aligning them with the Surface Browser.

Replace or elevate:

- the primary shell becomes `Surface Browser → Focused Surface ↔ Kronos Sheet`; Canvas is an optional map, approvals are contextual, and connections live under the host switcher/settings;
- the current `Device` screen becomes the host/surface inspector rather than implying unrestricted iOS control;
- `bridge/server.mjs` becomes a temporary adapter; the production gateway belongs in the signed KronTerm Host service and WSH capability system;
- manual IP entry becomes QR + Bonjour + remote discovery;
- local-storage bearer token becomes a per-device key in Keychain/Secure Enclave;
- blocking prompt POST becomes durable async run creation plus event streaming;
- the production unpaired state provisions or resumes Kron Sandbox/Browser Host; it never silently substitutes `DemoEngineClient` for KronosCode;
- the text-only bridge mapping becomes a complete structured KronosCode message/tool/artifact stream rendered with Hermes-derived components;
- static canvas becomes real synchronized workspace data;
- `approved: true` becomes a host-issued, device-signed exact-action challenge;
- one broad token becomes short-lived, least-privilege capabilities;
- LAN HTTP becomes authenticated encryption;
- the Electron-only surface JWT becomes a general device/session capability with mobile-specific issuance and revocation.

Apple recommends Keychain for small secrets and supports Secure Enclave-backed private keys that cannot be directly extracted from the device. App Attest can additionally prove requests came from a legitimate app instance. [Using the keychain to manage user secrets](https://developer.apple.com/documentation/security/using-the-keychain-to-manage-user-secrets), [Protecting keys with the Secure Enclave](https://developer.apple.com/documentation/security/protecting-keys-with-the-secure-enclave), [Establishing your app's integrity](https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity)

### Suggested native properties and entitlements

The exact set should remain minimal and purpose-bound:

| Property/capability                              | Purpose                                                             | Current state                     |
| ------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------- |
| `NSLocalNetworkUsageDescription`                 | Explain paired-Mac discovery/access                                 | Present                           |
| `NSBonjourServices` with a KronTerm TCP service  | Zero-config Mac discovery                                           | Add                               |
| Keychain access                                  | Device credential and refresh-token storage                         | Add                               |
| `NSFaceIDUsageDescription`                       | Step-up authentication for risky approvals                          | Add when Face ID flow ships       |
| `NSCameraUsageDescription`                       | QR pairing and context capture                                      | Add when camera flow ships        |
| Push Notifications / `aps-environment`           | Approval, failure, and completion notifications                     | Add                               |
| `remote-notification` background mode            | Short background refresh after appropriate pushes                   | Add only with APNs implementation |
| App Group                                        | Share state among app, widget, Live Activity, and Share extension   | Add with extensions               |
| Associated Domains                               | Universal-link handoff and verified pairing links                   | Optional                          |
| App Intents / WidgetKit / ActivityKit extensions | Shortcuts, Control Center/Action button where available, run status | Add progressively                 |

Do not request iPhone Accessibility, Screen Recording, or permanent background execution as if they provide macOS-style device control. They do not create that capability.

---

## Massive Opportunities

### 1. Instant Kron Sandbox

**What**: Give every iPhone user an isolated, resumable Linux desktop that starts from the app with no Mac, IP address, SSH key, or infrastructure setup. It includes a controlled browser, terminal, files, editor, previews, and an approved app catalog. KronosCode runs beside it and operates the desktop through semantic elements plus screenshot/pointer fallback.

**Why 10x**: This fulfills the core promise directly on day one: KronTerm on iPhone can navigate apps, control a browser, and do real work even if the user owns no other configured computer. The sandbox is safe to give agents broad capability because it is isolated, observable, snapshotable, and disposable.

**Unlocks**:

- "research this and build me a prototype" from an iPhone;
- visible browser automation;
- launch and control VS Code, terminal, file manager, and preview apps;
- package installs and root-like freedom inside policy;
- snapshot before risky actions and restore afterward;
- persistent workspaces plus disposable task branches;
- optional larger CPU/GPU workspace upgrades;
- a clean first-run experience before computer pairing.

**Effort**: Very High

**Risk**: Startup latency, per-user compute cost, browser identity/secrets, abuse prevention, persistence, and stream quality can dominate the product. Start with a tightly defined base image and warm-pool target rather than a universal VM marketplace.

**Score**: 🔥 Must do

### 2. Hermes Surface Browser

**What**: Turn the screenshot's browser-card overview into KronTerm's universal mobile workspace. Browser tabs, terminals, files, apps, previews, agent runs, and approvals share one surface lifecycle and can be opened, grouped, suspended, restored, or moved between eligible hosts. A Hermes-derived Kronos composer and streaming tool sheet remain attached to the currently focused surface.

**Why 10x**: Users already understand tabs, cards, history, spaces, and an omnibox. Generalizing that model removes the complexity of a desktop canvas without reducing KronTerm to a browser or terminal client. It also creates a stable mobile front end while the execution backend grows from Browser Host to full sandbox and multiple computers.

**Unlocks**:

- one effortless home for every controlled thing;
- a browser-first release that naturally expands into shells, files, and apps;
- live agent presence and approvals attached to the exact surface;
- cross-host tabs without forcing users to understand transport topology;
- recently closed/restore for terminal, file, app, and run state;
- the same design language across iPhone, iPad, web, and desktop.

**Effort**: High

**Risk**: A generic card can erase important differences. A terminal close can terminate work; a browser close may only suspend; a file may have unsaved changes. The shared shell must delegate lifecycle, history, persistence, and destructive-action rules to each surface type.

**Score**: 🔥 Must do

### 3. Pocket Mission Control

**What**: A run-centric inbox where the user supervises every KronosCode task across the default sandbox and any optional Mac, SSH, or team host. Each card contains current objective, elapsed time, host, plan step, evidence, risk, and the next meaningful action.

**Why 10x**: The user no longer babysits agents at a desk. A 25-minute test, refactor, browser workflow, or deployment can continue while the user walks away. The product returns attention only when a human decision has leverage.

**Unlocks**:

- approval from Lock Screen;
- rerun failed tests from a notification;
- redirect an agent by voice;
- inspect a diff or screenshot before approval;
- stop a runaway process instantly;
- hand a run back to the focused desktop surface.

**Effort**: High

**Risk**: If events are noisy or evidence is insufficient, users will either mute it or approve blindly. Notification quality and proof-of-work design are core product work.

**Score**: 🔥 Must do

### 4. KronTerm Host Fabric

**What**: Make the hosted sandbox the reference KronTerm Host, then let an optional signed, headless-capable computer connector publish the same device-trust, WSH, PTY, workspace, policy, and resumable-event model. Cloud, Mac, Linux, and SSH variants expose one capability contract.

**Why 10x**: KronTerm becomes a personal compute fabric rather than an app tethered to one desktop window. The sandbox is always available; personal computers add unique local capabilities when connected.

**Unlocks**:

- multi-host routing;
- always-available headless tasks;
- team workspaces;
- cloud continuation when a Mac is offline;
- self-hosted enterprise deployments;
- future iPad, web, and watch surfaces without duplicating the engine.

**Effort**: Very High

**Risk**: Lifecycle, OS permissions, sleep/lock behavior, updates, and secure remote exposure become serious operational responsibilities. Build the hosted sandbox host first, then a narrow Mac connector.

**Score**: 🔥 Must do

### 5. Semantic App, Browser, and Remote Surfaces

**What**: Extend the Widget Protocol into the hosted sandbox and across devices. A phone receives mobile projections of live blocks: the current sandbox app, browser DOM/element lists, terminal failure cards, file diffs, agent timelines, accessibility trees, and on-demand screenshots. It acts using typed surface actions rather than mostly coordinates, with live pixel takeover as a fallback.

**Why 10x**: This is the differentiation that Blink, Termius, VibeTunnel, and generic remote-desktop clients do not have. Those products provide terminal or pixel access; KronTerm can provide intent-aware, agent-aware control across heterogeneous surfaces.

**Unlocks**:

- control that remains usable on a small screen;
- lower bandwidth than video-first remote desktop;
- accessibility and automation through the same model;
- AI summaries grounded in current UI state;
- reusable mobile renderers for every future widget.

**Effort**: Very High

**Risk**: A leaky surface schema will create one-off adapters. Define versioned snapshot, action, event, and capability contracts before adding many mobile views.

**Score**: 🔥 Must do

### 6. The iPhone as the Trust Key

**What**: Make the phone a cryptographic approval device. Sensitive host actions produce an immutable action digest and evidence package. The user authenticates, reviews the exact action, and signs it with the device key. The host verifies scope, freshness, and policy before execution.

**Why 10x**: Deep agent autonomy becomes safer precisely because the user can approve from anywhere. This converts mobile from a convenience client into a foundational part of KronTerm's permission architecture.

**Unlocks**:

- Face ID approval for deploy, delete, purchase, or credential use;
- "allow this action once," "for this run," or "for this workspace";
- team approval chains;
- signed audit receipts;
- instant device revocation;
- high-trust autonomous runs.

**Effort**: High

**Risk**: Security theater would be worse than no feature. The signed payload must bind the actual executable action, inputs, host, workspace, expiry, and expected side effects—not just a human-readable label.

**Score**: 🔥 Must do

### 7. Optional Computer Link

**What**: Let a user pair a Mac, Linux workstation, or SSH host after they already have a working sandbox. The connected computer contributes selected workspaces, files, terminals, browsers, native apps, and secrets. The user can hand a run or artifact between sandbox and computer without merging their trust boundaries.

**Why 10x**: KronTerm is useful immediately but becomes deeply personal when connected to the user's real machine. It can use the safe sandbox for autonomous work and ask for the computer only when local context or a native app is genuinely required.

**Unlocks**:

- "send this repo to the sandbox and continue";
- "open the result in Xcode on my Mac";
- local browser and native app automation;
- selective file and secret access;
- scheduled work while the Mac is online;
- explicit handoff when a host locks or disconnects.

**Effort**: Very High

**Risk**: Repository synchronization, secrets, host sleep/lock, and permission ambiguity can overwhelm the product. Start with explicit workspace grants and visible copy/handoff operations, not invisible full-disk access.

**Score**: 👍 Strong strategic bet

### 8. KronTerm Labs: Developer iPhone Automation

**What**: Productize the existing MCP/WebDriverAgent path as a separate developer feature. From KronTerm on Mac, an agent can inspect, tap, type, screenshot, and test an app running in a simulator or on an explicitly connected development device. The iPhone companion shows the connection and one-time approvals.

**Why 10x**: KronTerm could become a uniquely strong mobile-development environment: edit code, build, launch simulator/device, inspect UI, perform flows, capture evidence, and fix failures in one agent loop.

**Unlocks**:

- autonomous mobile E2E tests;
- accessibility audits;
- screenshot regression capture;
- reproduce-and-fix loops on real hardware;
- App Store release verification.

**Effort**: High

**Risk**: This must never be marketed as general consumer iPhone control. Keep it behind an explicit Labs/developer connector, separated from the App Store-safe companion capabilities.

**Score**: 👍 Strong, after the core companion

---

## Medium Opportunities

### 1. Surface Cards and Restore Tray

**What**: Present Browser, Terminal, Files, Editor, Preview, controlled apps, and runs as the screenshot-inspired two-column card grid. Each card carries a live/semantic preview, host, state, and attention marker. Tapping opens a focused surface; closing moves a typed continuation into a translucent restore tray where safe.

**Why 10x**: This directly makes "navigate through apps and control the browser" feel native to iPhone without shrinking a Linux desktop into unreadable pixels.

**Impact**: The sandbox and every optional host become a usable, familiar product surface rather than invisible agent infrastructure or a tiny remote desktop.

**Effort**: Medium

**Score**: 🔥 Must do

### 2. Approval Inbox with Evidence Bundles

**What**: Every approval combines reason, exact action, diff/command, affected target, reversible status, estimated risk, and the agent's verification plan.

**Why 10x**: The hardest part of mobile agent supervision is deciding safely with limited attention. Better evidence creates faster decisions without blind trust.

**Impact**: Turns approvals from modal interruptions into a trusted workflow.

**Effort**: Medium

**Score**: 🔥 Must do

### 3. QR + Bonjour Pairing

**What**: The Mac advertises a signed service. The phone discovers it or scans a QR containing the host public key and an expiring pairing challenge. Both devices show the same verification phrase.

**Why 10x**: Removes IP addresses and makes the first live success feel like an Apple-quality device handoff.

**Impact**: Higher activation, fewer networking failures, and real host authentication.

**Effort**: Medium

**Score**: 👍 Strong once computer linking starts

### 4. Live Run Activity

**What**: Put active KronosCode work on Lock Screen/Dynamic Island with current step, elapsed time, host, and safe actions such as pause or open. Route sensitive actions into authenticated review.

**Why 10x**: Users can supervise without repeatedly opening the application.

**Impact**: High-frequency awareness with lower notification fatigue.

**Effort**: Medium

**Score**: 👍 Strong

### 5. Mobile Diff and Verification Review

**What**: A touch-native review surface for changed files, test results, screenshots, and acceptance checks. Approve, request changes, or open the exact desktop block.

**Why 10x**: A full terminal is rarely the best way to validate an agent's work from a phone.

**Impact**: Makes code-agent outcomes reviewable anywhere.

**Effort**: Medium

**Score**: 🔥 Must do

### 6. Focus Terminal

**What**: A full-screen terminal for exceptions, with reconnectable sessions, mobile modifier keys, command snippets, paste protection, and an AI explanation action. It is not the home screen.

**Why 10x**: Preserves power-user escape hatches while keeping the product differentiated from ordinary SSH clients.

**Impact**: Covers incident response and last-mile debugging.

**Effort**: Medium

**Score**: 👍 Strong

### 7. Share Anything to a Run

**What**: A Share extension sends a URL, selected text, screenshot, photo, or file into a chosen KronosCode run or workspace.

**Why 10x**: The phone becomes a sensor and context collector, not merely a remote display.

**Impact**: Fast research capture, bug reporting, visual QA, and field workflows.

**Effort**: Medium

**Score**: 👍 Strong

### 8. Voice Steering

**What**: Press-and-hold to add an objective, clarification, or approval note to the current run. Show the transcript and intended action before sending.

**Why 10x**: Short interventions are faster by voice while walking or away from a keyboard.

**Impact**: Higher mobile usage and lower interaction cost.

**Effort**: Medium

**Score**: 👍 Strong

### 9. Team Escalation

**What**: A blocked agent can request review from the workspace owner or on-call teammate, with scoped evidence and an expiring action.

**Why 10x**: Mobile approvals become a collaboration network, not just a single-user remote.

**Impact**: Opens team and enterprise value.

**Effort**: High

**Score**: 🤔 Explore after single-user trust works

---

## Small Gems

### 1. "Why do you need this?"

**What**: One tap asks the agent to explain an approval in plain language without changing the run.

**Why powerful**: Reduces blind approval and teaches the user what the agent is doing.

**Effort**: Low

**Score**: 🔥 Must do

### 2. Global Stop Button

**What**: A persistent, authenticated control stops a run or revokes its capabilities.

**Why powerful**: Eliminates the anxiety of leaving an agent unattended.

**Effort**: Low

**Score**: 🔥 Must do

### 3. Host Capability Lights

**What**: Show `terminal`, `browser`, `desktop`, `locked`, `screen access`, and `offline` as plain status chips.

**Why powerful**: Users immediately understand why a task can or cannot run.

**Effort**: Low

**Score**: 🔥 Must do

### 4. Hold to Approve

**What**: Require a short hold before low-to-medium-risk approval; use Face ID for high risk.

**Why powerful**: Prevents notification and pocket taps without adding friction everywhere.

**Effort**: Low

**Score**: 👍 Strong

### 5. "Open on Mac"

**What**: Deep-link the Mac directly to the corresponding tab, block, diff, terminal position, or agent step.

**Why powerful**: Makes cross-device handoff instant.

**Effort**: Low

**Score**: 👍 Strong once computer linking starts

### 6. Approval Expiry Countdown

**What**: Display when the request, evidence, or host state becomes stale.

**Why powerful**: Prevents approving an action whose context has changed.

**Effort**: Low

**Score**: 🔥 Must do

### 7. Notification Bundling by Run

**What**: Replace tool-by-tool pushes with one evolving run notification.

**Why powerful**: Protects attention and reduces the chance users disable notifications.

**Effort**: Low

**Score**: 👍 Strong

### 8. Network Route Badge

**What**: Clearly show `Direct`, `Relay E2EE`, or `Offline cache`.

**Why powerful**: Makes the security and availability model legible.

**Effort**: Low

**Score**: 👍 Strong

### 9. Copy Last Safe Command

**What**: Copy the exact last non-secret command or open it in Focus Terminal.

**Why powerful**: Gives expert users a fast escape hatch.

**Effort**: Low

**Score**: 👍 Strong

### 10. Default Deny on Stale Evidence

**What**: Automatically invalidate an approval if the target diff, command, host, or surface changed.

**Why powerful**: A small policy closes a large class of confused-deputy mistakes.

**Effort**: Low

**Score**: 🔥 Must do

---

## Competitive Position

The category already proves that developers want mobile access:

- [Blink Shell](https://blink.sh/) offers SSH, Mosh, CLI tools, files, and remote coding;
- [Termius](https://termius.com/) synchronizes SSH hosts across desktop and mobile;
- [VibeTunnel](https://github.com/amantus-ai/vibetunnel) exposes Mac terminal sessions and agents through browsers and includes an iOS companion;
- [GitHub Codespaces](https://docs.github.com/en/codespaces/developing-in-a-codespace/developing-in-a-codespace?tool=webui) provides browser-accessible cloud development environments.
- [Qalti](https://github.com/qalti/qalti) demonstrates screenshot-driven iOS observe/act/verify automation for testing;
- [PhoneAgent](https://github.com/rounak/PhoneAgent) demonstrates a compact tree/screenshot/action RPC and notification follow-up loop using XCTest-hosted control;
- [iGentic iPhone](https://github.com/pokekarten/igentic-iphone) frames the iPhone as the local identity, policy, approval, and audit plane for delegated compute;
- [Hermes Desktop](https://github.com/NousResearch/hermes-agent/tree/main/apps/desktop) demonstrates a polished agent UI that unifies streaming tool activity, chat, preview, file browser, terminal, voice, sessions, and settings behind a gateway.

KronTerm should not compete on "we also have a terminal." Its category should be:

> **The secure mobile control plane for agents and every surface they operate.**

The defensible stack is:

```text
instant owned sandbox
    + controllable apps and browser
    + Hermes-derived universal Surface Browser
    + optional personal-computer link
    + semantic Widget Protocol
    + KronosCode task state
    + exact-action approvals
    + cross-device handoff
```

No single terminal client or remote desktop product gets stronger merely because it observes more KronTerm surfaces. KronTerm does. That compounding surface graph is the moat.

---

## Recommended Priority

### Do Now

1. **Commit to the standalone sandbox positioning** — Why: the iPhone must launch a real controllable workspace without requiring a user's computer.
2. **Make the real KronosCode gateway the only production engine** — Why: preserve sessions, tool calls, evidence, approvals, artifacts, steering, and resumption; restrict `DemoEngineClient` to explicit previews/tests.
3. **Build the Hermes Surface Browser shell** — Why: one grid, omnibox, focused surface, Kronos sheet, attention shelf, restore tray, and host switcher can front every capability tier.
4. **Turn the existing sandbox into a remotely provisionable reference host** — Why: browser, app, terminal, file, screenshot, pointer, keyboard, and VNC primitives already exist; make them the first live mobile backend.
5. **If full sandbox provisioning slips, ship Managed Browser Host without forking the UX** — Why: it delivers standalone browse/control value while the same cards and protocols are extended to shells, files, and apps.
6. **Prove one complete app/browser workflow** — Why: validate `open surface → Kronos acts → user watches/takes over → Kronos verifies` before expanding the catalog.
7. **Define the KronLink contracts** — Why: multi-host identity, durable run events, host capabilities, semantic snapshots, actions, approvals, and receipts must be versioned before either cloud or computer bridge expands.
8. **Productionize device trust** — Why: Keychain device keys, encrypted transport, revocation, and scoped capabilities are release blockers even when the host is KronTerm's own sandbox.

### Do Next

1. **APNs approval/failure/completion flow** — Unlocks useful away-from-desk operation.
2. **Evidence-rich approval inbox** — Unlocks safe autonomy rather than blind remote command execution.
3. **Touch-native browser, app, terminal, and file focus views** — Unlocks direct watch/takeover without exposing a tiny whole desktop.
4. **Mobile diff, test, and screenshot review** — Unlocks real completion decisions without a laptop.
5. **Focus Terminal using the existing terminal bridge experiment** — Covers emergencies and power users.
6. **Real semantic workspace projection** — Replace demo canvas nodes with live surface cards and typed actions; keep Canvas as a map.
7. **Optional Mac connector with QR/Bonjour pairing** — Adds local files, browser, terminal, and native apps after the standalone experience works.
8. **Share extension, voice, Live Activities, and App Intents** — Turn the iPhone into a context source and system-native control surface.

### Explore

1. **Persistent vs disposable sandbox tiers** — Upside: serve both quick tasks and long-lived workspaces. Risk: storage, cost, and user confusion.
2. **Self-hosted KronTerm Sandbox** — Upside: privacy and enterprise deployment. Risk: support matrix and networking complexity.
3. **KronTerm Labs iPhone automation** — Upside: a complete AI mobile-development loop. Risk: testing-only platform boundaries and device fragility.
4. **Team approval chains** — Upside: strong enterprise control plane. Risk: premature collaboration complexity.
5. **iPad full workspace mode** — Upside: canvas, terminal, and diff surfaces have enough room. Risk: distracting the iPhone team before the iPhone control loop is excellent.

### Backlog

1. **Full pixel remote desktop as the primary UX** — Why later: useful fallback, weak differentiator, poor phone ergonomics.
2. **Local on-iPhone KronosCode runtime** — Why later: the hosted sandbox fulfills the need with fewer Bun/PTY/background/App Review constraints.
3. **Consumer cross-app iPhone automation** — Why later: public iOS APIs do not provide the required control.
4. **A mobile clone of every desktop setting and panel** — Why later: surface only what is necessary to supervise work.
5. **Replacing KronosCode with Hermes Agent** — Why later: it violates the product requirement and discards KronTerm's existing runtime, routing, WSH, sessions, and tool semantics. Reuse Hermes UI patterns, not its engine.

---

## 90-Day Validation Sequence

### Days 0-30: Prove the killer loop

- Replace the demo fallback with a real hosted KronosCode connection and preserve structured tool/event parts.
- Build the first Hermes-derived Surface Browser with browser, terminal, file, app, and run cards, plus a focused surface and Kronos sheet.
- Provision or resume one real hosted sandbox from the iPhone without a paired computer; use Managed Browser Host as the scoped fallback if the full image is not ready.
- Launch a browser and at least two sandbox apps through KronosCode.
- Let the agent inspect, click, type, scroll, use terminal/files, and verify the outcome.
- Let the user watch, take over the focused surface, stop, retry, redirect, approve, and deny.
- Replace demo state with one durable real run and one exact-action approval receipt.
- Test with ten developers doing research, form workflows, builds, and browser tasks entirely from iPhone.

**Gate**: At least half of testers complete one useful browser/app/terminal task from iPhone without configuring or opening another computer, and no tester mistakes demo output for a real KronosCode action.

### Days 31-60: Make the sandbox durable and trustworthy

- Authenticated account/device enrollment and sandbox identity.
- Keychain/Secure Enclave device identity.
- Encrypted direct transport and per-device revocation.
- Capability scopes and stale-evidence invalidation.
- Signed audit receipts and global stop.
- Sandbox snapshots, restore, expiry, resource limits, and clear persistence state.

**Gate**: No broad long-lived credential is sufficient to invoke arbitrary terminal or desktop actions.

### Days 61-90: Add native reach and optional computer control

- APNs and native iOS system surfaces.
- Resumable run/event stream.
- Approval and completion deep links.
- Mobile diff/test/screenshot review.
- Live Activity for one active run.
- Optional Mac connector with E2EE relay plus direct LAN path.
- TestFlight beta.

**Gate**: A run can survive app suspension, network changes, and iPhone relaunch without losing state or duplicating an action.

---

## Success Metrics

The north-star metric should be **completed phone-native outcomes per weekly active user**: useful browser, app, terminal, or agent tasks completed from iPhone without needing another computer.

Supporting metrics:

- median notification-to-decision time;
- percent of active runs successfully resumed after app suspension;
- percent of runs completed without connecting or reopening another computer;
- time from install to first live sandbox action;
- optional computer pairing completion rate;
- approval denial, expiry, and "explain first" rates;
- mobile review-to-completion rate;
- host reconnect time after sleep/network change;
- notifications per completed run;
- global-stop invocation and successful containment time;
- weekly users with two or more paired execution hosts.

Avoid optimizing raw prompt count or terminal time. The product wins when the phone reduces attention cost.

---

## Questions

### Answered

- **Q**: Can KronTerm be made for iPhone? **A**: Yes. A working Capacitor/iOS prototype, Mac bridge, and controllable Linux sandbox primitives already exist. The production product should make the hosted sandbox the default live engine and the computer bridge optional.
- **Q**: Can the full Electron/Go/Bun desktop stack run locally on iPhone? **A**: Not as a faithful App Store product. The execution stack belongs on a Mac, Linux host, or cloud workspace.
- **Q**: Can it navigate apps and control a browser without a user's computer? **A**: Yes. Run those apps and the controlled browser inside KronTerm's hosted sandbox, where Kronos owns the operating boundary and the phone presents focused live/semantic views.
- **Q**: What if the complete Linux sandbox is too complicated for the first release? **A**: Ship Managed Browser Host first. It provides a persistent controlled browser, downloads, browser files, semantic/visual actions, and real KronosCode with no computer. Add terminal, files, and apps as new surface capabilities without replacing the mobile shell.
- **Q**: Can the iPhone optionally control macOS? **A**: Yes, indirectly. The paired Mac executes Accessibility, screen, terminal, browser, and file tools; the iPhone sends scoped actions and receives evidence.
- **Q**: Can users have more than one host? **A**: Yes. Multi-host identity is part of the first protocol: every surface and action names its host, the host switcher can filter or show all, and Kronos routes only to eligible hosts with explicit grants.
- **Q**: Can KronTerm arbitrarily control iOS itself? **A**: No, not in a normal App Store build. It can control its own app and use Apple-provided integrations. Developer devices/simulators can have a separate Mac-hosted testing connector.
- **Q**: Should the mobile product lead with the canvas? **A**: No. Lead with the Hermes Surface Browser, Kronos omnibox, and one focused surface; retain Canvas as an optional map and handoff surface.
- **Q**: Does “use Hermes Desktop” mean replacing KronosCode with Hermes Agent? **A**: No. Hermes supplies the interface language and reusable components. Production sessions, tools, routing, approvals, artifacts, and memory come from the real KronosCode gateway.
- **Q**: Should KronTerm build another SSH client? **A**: No. A Focus Terminal is necessary, but the differentiated value is semantic multi-surface agent supervision.
- **Q**: Is the current bridge ready for internet exposure? **A**: No. It is a useful private-LAN prototype, but its HTTP bearer-token and broad authorization model need replacement before production remote access.
- **Q**: Should the beta default to a managed or user-supplied sandbox? **A**: Managed by KronTerm. “Usable for all” requires zero infrastructure setup. Preserve the host contract for self-hosted and user-supplied endpoints after the default experience works.

### Blockers

- **Q**: Which three sandbox apps must ship in the base image beyond browser, terminal, files, and editor?
- **Q**: Should workspaces persist indefinitely, pause after inactivity, or default to disposable with explicit save?
- **Q**: What startup-time and monthly compute-cost targets make the standalone promise viable?
- **Q**: Which initial iOS App Intents deliver real everyday value without creating confusing or risky automation promises?

## Next Steps

- [ ] Confirm the one-sentence positioning: "KronTerm gives KronosCode a real browser, apps, and computer from your iPhone—and can optionally connect your own computers."
- [ ] Turn the supplied card-grid reference into a Hermes-derived mobile specification: Surface Browser, Kronos omnibox, focused surface, Kronos sheet, attention shelf, restore tray, and multi-host switcher.
- [ ] Choose the hosted sandbox provider/runtime and define startup, pause, persistence, snapshot, restore, and cost budgets.
- [ ] Define Managed Browser Host as the launch fallback so standalone value does not wait for the full desktop image.
- [ ] Define the base sandbox image: browser, terminal, files, editor, preview, required system packages, and allowed app installation policy.
- [ ] Name the first three no-computer workflows and recruit ten users who need them weekly.
- [ ] Write the versioned multi-host, run-event, universal-surface, action, lease, approval, and receipt contracts.
- [ ] Threat-model sandbox isolation, abuse, browser identity, terminal access, computer pairing, desktop actions, secrets, notification previews, and lost phones.
- [ ] Add a real hosted KronosCode gateway client, preserve every structured tool/artifact event, and make demo mode explicit and non-production.
- [ ] Replace the static mobile home with real Hermes-rendered surface cards and host data; keep Canvas as the synchronized secondary map.
- [ ] Add one end-to-end exact-action approval with evidence and a verified receipt.
- [ ] Prove browser navigation and two sandbox application workflows end to end from iPhone.
- [ ] After the standalone flow works, decide whether the optional Mac host runs as a login item, launch agent, or explicit background mode, and document lock/sleep limitations.
- [ ] Prototype optional computer QR + Bonjour pairing with a device-held key before expanding computer access.
- [ ] Keep the WebDriverAgent/MCP route explicitly branded as KronTerm Labs and outside consumer iOS-control claims.
- [ ] Test the core loop through network loss, app suspension, host sleep, host lock, token revocation, and stale evidence.
