# 10x Analysis: KronTerm Toolset + Hermes Agent (Tools, Indicators, Workspace Manipulation, OS Reactions)
Session 1 | Date: 2026-09-05

Audit scope: every agent-invocable tool across the three surfaces (KronTerm MCP bridge, Hermes desktop, KronosCode/ACP), when tools fire, what visual indicators exist, how agents manipulate the workspace, and how the OS reacts when the agent works vs. when it doesn't.

---

## Current Value (audit findings)

### The toolset is already large — and split across three kingdoms

**1. KronTerm MCP bridge** (`mcp-kron-term/src/index.ts`, served in-process by `emain/kronterm-tool-server.ts` over loopback HTTP with bearer-token auth). ~90 registered tools in 9 families:

| Family | Tools | What it mutates |
| --- | --- | --- |
| `workspace_*` (20) | snapshot, screenshot, set_presentation, focus/move/resize/swap widget, open_app, open_native_app, set_os_view, open_file, open_command_center, dock/detach/collapse widget, show_overview, switch_workspace, toggle_magnify, navigate | Full presentation control — blocks, layout, OS view |
| `workspace_canvas_*` (5) | canvas_view, add_note, update_object, delete_object, connect | Canvas objects |
| block tools (8) | list_blocks, get_block_info, get_layout_tree, create_block, close_block, focus_block, set_block_meta, block_run_command | Block lifecycle |
| `browser_*` (5) | open, open_tab, configure, navigate, get_html | Browser blocks |
| `sandbox_*` (11) | start/status/stop/screenshot/mouse/click/type/paste/press/scroll/drag | Sandbox VM |
| `kron_computer_*` (12) | status, list_apps, get_app_state, click, type_text, press_key, scroll, drag, set_value, secondary_action, sequence, turn_ended | Native macOS accessibility (external `open-computer-use` binary, warmed at startup — `kron-computer-use.ts:60`) |
| `widget_*` (26) | click/move/hover/type/press/scroll/drag/set_value/select/toggle/clipboard/sequence/wait_for/snapshot/find/inspect… | In-app widget interaction contract |
| `lsp_*` (3) | diagnostics, symbols, hover (+definition/references in activity map) | Code intelligence |
| misc | surface_status, shared_skill_list/read, file_*, terminal_*, canvas graph (create/update/delete/connect/launch node) | Skills, files, graph canvas |

Dispatch is two-layered: MCP tools → `KronTermNativeToolBridge` (`emain/kronterm-native-tool-bridge.ts`) → wsh RPC (`createblock`, `setblockfocus`, `setmeta`, `controllerinput`, `workspacesurfacecontrol`…). Web-fullscreen host mode is gated by **prefix-based capability policy** (`mcp-kron-term/src/surface-policy.ts:3-19`) and enforced both at `tools/list` filtering and `tools/call` rejection (`kronterm-tool-server.ts:120-139`).

**2. Hermes desktop** (embedded `frontend/hermes/`):
- 22 curated desktop slash commands (`third_party/source-imports/hermes-desktop/src/lib/desktop-slash-commands.ts:25-48`): /agents /background /branch /compress /debug /goal /new /profile /queue /resume /retry /rollback /skin /status /steer /stop /title /undo /usage /version /yolo — plus aliases (/bg /fork /q /reset /tasks) and a large **blocked** set (terminal-only: /browser /tools /toolsets /indicator /mouse /snap…; messaging-only: /approve /deny; settings-owned: /skills; advanced: /curator /fast /insights /kanban /personality /reasoning /reload-mcp /reload-skills /voice).
- Agent terminal mirrors: read-only xterm tabs keyed by procId, streamed via `agent.terminal.output` events with a 256KB capped backlog (`frontend/hermes/app/right-sidebar/terminal/agent-terminal-stream.ts:15`), seeded with the command so tabs never open empty (`:47-60`). Agent can close its own mirror via `close_terminal` (`terminals.ts:304`).
- Preview reader: `read_preview` reads the ACTIVE right-rail tab through a registered page reader, 24k-char cap, graceful identity fallback for non-webview tabs (`frontend/hermes/app/chat/right-rail/preview-reader.ts:48,77-121`).
- Composer event bus: focus / insert / insert-refs / attach-images / **submit** / voice-toggle dispatch (`frontend/hermes/app/chat/composer/focus.ts:46-51`) — external panels can hand the agent tasks without user typing (`requestComposerSubmit`, :262).
- Toolset curation block-list for the Skills UI (`frontend/hermes/lib/desktop-toolsets.ts:11-20`: hides discord/yuanbao/context_engine/moa rows only).

**3. KronosCode/ACP** (`emain/acp/`, `pkg/aiusechat/toolapproval.go`): approval registry with per-toolcall channels (`WaitForToolApproval`, `toolapproval.go:98`), SSE close = auto-cancel (`:77-79`), phases incl. `awaiting-approval`.

### The visual indicator plane — one stream, many consumers

`frontend/types/agent-activity.ts` is a genuinely rich, typed model: 9 phases (queued → awaiting-approval → running → verifying → succeeded/degraded/failed/cancelled/paused), 6 surfaces, 14 actions, **risk levels** (read/write/sensitive/dangerous, `:34`), verification status, structured error codes, presentation hints (cursorAction/overlayAction), a 120-event-per-run timeline (`:108-134`), and a window CustomEvent bus (`agent-surface-ui-activity`, `:84,138-148`).

Consumers of that stream (12+): block overlays (`use-agent-overlays.ts`: waterflow effect + up to 8 action markers + live cursor point + click flash), appstream, webview (browser), acp-chat-panel, agent-run-strip, computer-use-status-card, agent-widget-bridge, **workspace-canvas task cards** (`workspace-canvas.tsx:1343`), **os-workspace** (`os-workspace.tsx:230,1269`), desktop pet (`desktop-pet-activity.ts` publishes pet activity into the same stream).

MCP tools feed the stream through a per-tool declaration map (`mcp-kron-term/src/index.ts:104-205` `toolActivityMap` → `wrapActivity`), defaulting source `"acp"` with sessionId from `KRONTERM_TABID`.

### How the OS reacts today

- OS mode (`os-workspace.tsx`): an `os-agent-activity` HUD — "Worker activity / Working in your apps / Live" with elapsed seconds and last-5 events, anchored under the Hermes HUD composer when docked (`os-workspace.tsx:228-269`). A second subscription persists per-workspace activity history (`systemModel.recordAgentActivity`, `:1269-1278`).
- **When the agent is idle: nothing.** The HUD returns null without activity (`:241`). No dock glow, no ambient presence, no worker indicator anywhere in the shell. `kronarchy-shell.tsx` has zero agent-activity integration (grep-verified).
- Workspace manipulation by agent is symmetric with user manipulation (same wsh RPCs: createblock/setmeta/workspacesurfacecontrol) — same code paths, **but no undo, no ledger**.

---

## The Question

What would make the toolset + indicator plane 10x more valuable — so the agent feels like a *visible, trustworthy worker in your desktop* rather than 90 silent RPCs plus a spinner?

---

## Massive Opportunities

### 1. Workspace Time Machine — undo + ledger for every agent mutation
**What**: Every `workspace_*`, `workspace_canvas_*`, and block-mutating tool call writes an inverse op to a per-run ledger. `Cmd+Z` / a "revert agent changes" affordance reverts any span (one op, one run, since a point in time).
**Why 10x**: Today the agent can close_block, move, resize, delete canvas objects, and switch your workspace with zero reversal path. The single biggest anxiety for "agent drives my desktop" is *can I take it back?* The activity stream already records every call with runid + risk (`agent-activity.ts:34,108`); the RPCs are already deterministic (setmeta/createblock/deleteblock). This converts tool breadth into tool *trust*.
**Unlocks**: Braver agent autonomy (auto-execute workspace ops), session replay demos, "diff my workspace before/after the run".
**Effort**: High. **Risk**: Inverse-op correctness for canvas meta writes (the known zombie-writer hazard — live canvas instances re-persist stale state; see bulk-edit protocol memory).
**Score**: 🔥

### 2. Consent Layer — human-in-the-loop for external MCP clients
**What**: The in-process tool server (`kronterm-tool-server.ts`) authenticates by bearer token and filters by capability prefix, but any token-holding client executes any allowed tool with no human gate. Add risk-classified approval: `kron_computer_*`, `sandbox_*`, `block_run_command`, close_block, canvas delete → pause for approval (reusing the existing ACP approval registry pattern, `toolapproval.go:72-98`), with approve/deny from dock, HUD, or iPhone.
**Why 10x**: This is the platform move. Any agent on the machine (Claude, Codex, whatever) can drive the desktop *through* KronTerm — but only if KronTerm is the trust boundary. "Approve from your phone" pairs with the existing mobile gateway. Differentiation no terminal vendor has.
**Unlocks**: Safe external-agent story, audit-grade logs, enterprise posture.
**Effort**: High. **Risk**: Approval fatigue → mitigate with per-surface grants + /yolo-style time-boxes.
**Score**: 🔥

### 3. One Activity Plane — Hermes tools emit into the KronTerm stream
**What**: Hermes tool calls (file_/terminal_/read_preview/close_terminal…) currently surface only inside the Hermes panel (terminal mirrors, working badges). They never publish `agent-activity` events, so overlays, canvas task cards, OS HUD, and dock don't see them. Add a Hermes→KronTerm activity adapter so every agent action, from either brain, appears once.
**Why 10x**: Two indicator systems for two agents is 1/10th the value of one. "What is my agent doing right now" must have one answer regardless of which agent ran it. The stream model already supports `source: "acp" | "kronoscode-tui" | "wave" | "mcp" | "plugin" | "surface-runtime"` (`agent-activity.ts:1`) — add hermes.
**Unlocks**: Unified canvas task graphs, unified OS HUD, unified pet behavior.
**Effort**: High (gateway/runtime work in `emain/hermes-runtime.ts`). **Risk**: Double-emission for delegated runs (KronosCode→Hermes).
**Score**: 🔥

---

## Medium Opportunities

### 4. Kill regex inference — declare, don't guess
**What**: `inferAgentActivityAction/Surface` (`agent-activity.ts:171-225`) guess actions/surfaces from detail strings by regex; `inferSurface` in the MCP layer defaults unknown tools to `"browser"` (`mcp-kron-term/src/index.ts:207-221`). Make every emitter declare surface+action+risk in the tool registration (the `toolActivityMap` pattern already does this for ~60 tools — extend to the rest and to Hermes).
**Why 10x**: Mis-routed indicators (a workspace move showing as a "panel browser" event) quietly destroy trust in the indicator plane; correctness here is the foundation for 1–3.
**Impact**: Indicator accuracy → everything downstream. **Effort**: Medium. **Score**: 🔥

### 5. Risk-colored agent cursor + overlays
**What**: The risk field exists (`agent-activity.ts:34`) but `use-agent-overlays.ts` never reads it. Color the overlay cursor/markers: read=neutral, write=accent, sensitive=amber, destructive=red. One-line semantic upgrade to the existing waterflow/cursor system.
**Why 10x**: The cursor is the most-watched pixel during computer use; making danger legible there eliminates the "what is it about to click?" anxiety. **Effort**: Low-Medium. **Score**: 🔥

### 6. OS-mode ambient presence (dock glow, worker badge)
**What**: When activity is live, the OS shell shows a calm presence signal — dock indicator on the connected shell, a "worker" chip in the top bar — and goes fully quiet when idle (calm computing). Today: HUD only, shell integration zero.
**Why 10x**: The OS presentation is the product's identity ("agent-aware desktop"); it should visibly *be* agent-aware. The subscription already exists in `os-workspace.tsx`; extend to the shell layer. **Effort**: Medium. **Score**: 👍

### 7. Approve/Deny as desktop-native surfaces
**What**: `/approve` and `/deny` are messaging-platform-only today (`desktop-slash-commands.ts:106`); desktop approvals live only in chat cards. Promote them: keyboard-driven approval toast (global hotkey), dock badge with pending-approval count, one-tap on mobile.
**Why 10x**: Approvals are the highest-stakes moment in the loop and currently demand finding the right chat card. **Effort**: Medium. **Score**: 🔥

### 8. Canvas bulk ops without context flooding
**What**: `workspace_canvas_add_note` returns the full canvas snapshot per call — bulk creation floods model context (observed: 106→1-object meta flip during batch writes; see canvas bulk-edit protocol). Add a `workspace_canvas_batch` tool (add/update/connect in one call, returning a diff summary) and document the unmount-write-reload protocol as a first-class tool path.
**Why 10x**: Canvas-as-agent-workspace is a headline feature; if agents can't cheaply build large canvases, the feature underperforms exactly where it should shine. **Effort**: Medium. **Score**: 👍

### 9. Workspace-manipulation indicators on the manipulated object
**What**: `workspace_*` tools map to surface `"panel"` (`index.ts:208`), so moving/resizing a widget shows an abstract panel event, not feedback on the widget itself. Emit blockid-scoped events so the *target widget* pulses/labels during agent manipulation (the overlay system already matches on blockid — `use-agent-overlays.ts:23-35`).
**Why 10x**: "The agent is rearranging MY workspace" needs to be visible at the point of change, not in a side HUD. **Effort**: Medium. **Score**: 👍

---

## Small Gems

### 10. Awaiting-approval heartbeat
**What**: Overlays treat `awaiting-approval` as "stop animating" (`use-agent-overlays.ts:57`) — a dead-looking UI at exactly the moment you're needed. Pulse the block/dock/HUD in a distinct "needs you" rhythm.
**Why powerful**: Eliminates the #1 stall ("it froze"). Uses an existing phase. **Effort**: Low. **Score**: 🔥

### 11. Time-boxed /yolo
**What**: `/yolo` toggles auto-approval with no bounds (`desktop-slash-commands.ts:47`). Add `/yolo 10m` with a persistent countdown chip in the composer.
**Why powerful**: YOLO-mode accidents are brand-defining for an agent product; time-boxing converts a risk into a feature ("auto-approve for one task"). **Effort**: Low. **Score**: 🔥

### 12. "Agent did X" run journal
**What**: The timeline already retains 120 events/run (`agent-activity.ts:108`). Surface a scannable, timestamped run log (per runid) with risk dots — one click from the HUD/strip.
**Why powerful**: Review-after beats watch-live for long runs; the data already exists. **Effort**: Low. **Score**: 👍

### 13. Dock/tab title elapsed timer
**What**: The HUD already computes elapsed seconds per run (`os-workspace.tsx:244-247`). Mirror the running time + last verb into the dock badge / tab title so the agent is visible from any app.
**Why powerful**: The desktop-wide glanceable answer to "is it still working?" **Effort**: Low. **Score**: 👍

### 14. Delete the stale panel doc
**What**: `AGENTS.md` promises `/files /terminal /preview` slash commands in `workspace-hermes-panel.ts`; that file is 29 lines of width math. Move the real command surface (embedded Hermes app) into the doc.
**Why powerful**: Agent/docs accuracy compounds into every future session. **Effort**: Trivial. **Score**: 👍

---

## Recommended Priority

### Do Now (quick wins, outsized trust gains)
1. **Awaiting-approval heartbeat** (#10) — phases exist; kill the biggest stall.
2. **Risk-colored cursor/overlays** (#5) — field exists; one styling pass.
3. **Time-boxed /yolo** (#11) — few lines in the slash layer; large safety optics.
4. **Workspace-object manipulation indicators** (#9) — blockid already flows; route events to the right block.

### Do Next (high leverage on the indicator plane)
1. **Declare-don't-guess tool emission** (#4) — foundation for everything below.
2. **Approve/Deny as desktop surfaces** (#7) — completes the consent loop.
3. **Run journal** (#12) + **elapsed dock badge** (#13) — cheap visibility everywhere.
4. **Canvas batch tool** (#8) — unblocks the headline agent-canvas story.

### Explore (strategic bets)
1. **Workspace Time Machine** (#1) — undo ledger; risk: canvas meta zombie-writer must be solved first.
2. **Consent Layer for external MCP clients** (#2) — platform-defining trust boundary; pairs with iPhone approvals.
3. **One Activity Plane (Hermes unification)** (#3) — one answer to "what is my agent doing"; watch double-emission.
4. **OS ambient presence** (#6) — the calm-computing identity play.

### Backlog
- Widget-tool family audit: 26 `widget_*` interaction tools + 12 `kron_computer_*` overlap heavily in purpose (in-app vs. native) — consider a unified interaction contract doc, not a merge.
- Toolset block-list (`desktop-toolsets.ts`) duplicates slash-command curation mechanics — one shared curation module.

---

## Questions

### Answered
- **Q**: Where do agent tool calls get their visual feedback? **A**: One window-CustomEvent stream (`agent-surface-ui-activity`) fanned out to 12+ consumers (overlays, canvas cards, OS HUD, pet, appstream, webview, chat strip).
- **Q**: Does the OS react when the agent works? **A**: Yes in `os-workspace.tsx` (HUD + per-workspace history); no ambient shell integration, and idle state is visually identical to no-agent.
- **Q**: Is agent workspace manipulation privileged? **A**: No — same wsh RPCs as the user; no undo; external MCP clients gated only by token + capability prefix.

### Blockers
- **Q**: Should external MCP tool calls be approval-gated by default (breaking change for scripted clients) or opt-in per client? (Need product call before #2.)

## Next Steps
- [ ] Validate: measure how often `inferAgentActivity*` misclassifies in real runs before/after #4
- [ ] Prototype: approval heartbeat + risk cursor in one demo run
- [ ] Design: inverse-op ledger shape for `workspace_*` + canvas meta (solve zombie-writer first)
- [ ] Decide: external-client consent default (blocker for #2)
