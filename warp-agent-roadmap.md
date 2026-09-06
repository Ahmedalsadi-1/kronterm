# Warp Agent System — Architecture & UX Roadmap

> Deep-dive reference of how Warp (warpdotdev/warp, app/src/) designs and behaves around its AI
> agent: where the agent lives, what context it gets, how it controls the terminal, how the UI
> looks, and how settings are organized. Source of truth: Warp repo at `app/src/`, read 2026-08-14.
> Purpose: reference for KronTerm/KronosCode agent surface design.

---

## 1. Two AI surfaces (the split that matters)

Warp has **two distinct AI products** living side by side:

| Surface | Module | What it is |
|---|---|---|
| **Warp AI (side panel)** | `app/src/ai_assistant/` | Resizable right panel. Q&A/chat over your terminal, "Ask Warp AI" workflows, suggestion chips. Legacy-ish. |
| **Agent Mode / Warp Agent** | `app/src/ai/blocklist/` | The modern agent. Full conversation model, executes actions (shell, edits, MCP), orchestrates subagents. Feature-flagged (`FeatureFlag::AgentMode`, `FeatureFlag::AgentView`). |

`app/src/ai/mod.rs` doc comment states the boundary explicitly:

> "This module houses all horizontal/cross-cutting AI functionality throughout Warp (including
> Agent Mode). The side panel Warp AI implementation lives in `super::ai_assistant`."

**KronTerm implication:** don't build one surface to do both jobs. Keep a lightweight chat panel
(side-panel AI) separate from a full agent execution surface (blocklist AI).

---

## 2. Where the agent is placed in the UI

### 2.1 Agent View — two display modes (`AgentViewDisplayMode`)

`app/src/ai/blocklist/agent_view/controller.rs`:

```rust
pub enum AgentViewDisplayMode {
    FullScreen,  // navstack-based, replaces the terminal content area
    Inline,      // rich header above the active block (long-running commands)
}
```

- **FullScreen**: the pane shows the agent conversation instead of the terminal. Entered via
  `/agent`, `cmd+enter` (`ENTER_AGENT_VIEW_NEW_CONVERSATION_KEYSTROKE`, macOS; `ctrl+shift+enter`
  otherwise), prompt chips, conversation selector, etc.
- **Inline**: an `InlineAgentViewHeader` renders as rich content above the active block when a
  long-running command is agent-tagged. Shows control state messages:
  - "Prompt agent to interact with `{command}`" / "… the running command"
  - "Agent is waiting on instructions"
  - "Agent is waiting for command to exit"
  - "Agent needs your permission to continue"
  - "Agent is in control" / "User is in control"

### 2.2 Agent View entry points (`AgentViewEntryOrigin`, ~35 variants)

Every entry point is tracked for telemetry + UI behavior:

- `Input` (was_prompt_autodetected), `PromptChip`, `ConversationSelector`, `AgentModeHomepage`,
  `AgentViewBlock`, `AIDocument`, `AutoFollowUp`, `RestoreExistingConversation`,
  `SharedSessionSelection`, `AgentRequestedNewConversation`, `AcceptedPromptSuggestion`,
  `AcceptedUnitTestSuggestion`, `AcceptedPassiveCodeDiff`, `InlineCodeReview`, `CloudAgent`,
  `ThirdPartyCloudAgent`, `Cli` (`warp agent run`), `Tui`, `ImageAdded`, `SlashCommand`,
  `SlashInit`, `CreateEnvironment`, `Keybinding`, `CodeReviewContext`, `CodexModal`,
  `InlineHistoryMenu`, `InlineConversationMenu`, `OnboardingCallout`, `ConversationListView`,
  `DefaultSessionMode`, `LongRunningCommand`, `Onboarding`, `ChildAgent`,
  `OrchestrationPillBar`, `ProjectEntry`, `LinearDeepLink`, `ClearBuffer`,
  `JumpToLatestAgentMessage`, plus viewer/resume variants.

Each origin also dictates **auto-trigger behavior** (`AutoTriggerBehavior::Always` /
`InAgentView` / `Never`) — whether the initial prompt auto-submits to the LLM.

### 2.3 Agent View blocks in the terminal blocklist

`AgentViewEntryBlock` (`agent_view/agent_view_block.rs`) — a rich block in the terminal blocklist
representing an agent conversation. Has fork + open-conversation icon buttons, cached title when
conversation is deleted, hover states. Two container styles: `LongRunningCommand` origin gets
rounded padded card; other origins get bordered, divider-aware containers.

### 2.4 Orchestration pill bar (parent/child agents)

`agent_view/orchestration_pill_bar.rs` — horizontal pill bar **above the agent view header**
listing the orchestrator + child agents. Clicking a pill switches the active pane to that agent's
conversation. Pills: 22px high, 15px avatar disc with deterministic per-name color palette, status
badge, label (max 83px), overflow button + hairline scrollbar.

### 2.5 Agent view zero state (Agent Mode homepage)

`agent_view/zero_state_block.rs` — shown when a conversation has no exchanges yet. Contains:
- Start new conversation + start cloud conversation buttons
- Model switcher, exit button
- "Latest updates" changelog section (`MAX_OZ_UPDATE_COUNT = 4` from the changelog model)
- Recent conversations list (`MAX_RECENT_CONVERSATION_COUNT = 3`)
- Init callout

### 2.6 Side panel (legacy Warp AI) & right panel

- `AIAssistantPanelView` (`ai_assistant/panel.rs`) is a `ViewHandle` owned by the workspace view
  (`workspace/view.rs`), rendered in the resizable right region alongside the `RightPanelView`
  (file sidebar / code review). Events: `ClosePanel`, `PasteInTerminalInput`, `FocusTerminalInput`,
  `OpenWorkflowModalWithCommand`.
- The right panel itself is file/repo focused (`RightPanelView` with `ToggleFileSidebar`,
  `SelectRepo`, `ToggleMaximize`); it has an `is_agent_management_view_open` flag.

---

## 3. Agent context — what the agent sees

### 3.1 `BlocklistAIContextModel` (`blocklist/context_model.rs`)

Per-terminal-surface pending context for the next query:

- `pending_context_block_ids: HashSet<BlockId>` — terminal blocks attached as context
- `pending_context_selected_text: Option<String>` — selected text
- `pending_attachments: Vec<PendingAttachment>` — images (base64 in memory) + files (path refs)
- `pending_inline_diff_hunk_attachments: HashMap<String, AIAgentAttachment>`
- `pending_document_id: Option<AIDocumentId>` — AI document attached as plain text
- `auto_attached_agent_view_user_block_ids: Vec<BlockId>` — **auto-attach** of user-executed
  commands (`AgentViewBlockContext` feature). Completed user commands are automatically included
  in the next query's context.
- `directory_context: DirectoryContext` — cwd + home for prompt context
- `conversation_selection: ConversationSelectionHandle`

### 3.2 Block context capture (`block_context_from_terminal_model`)

A block becomes context as `BlockContext` with: id, index, `command_to_string()`, output
(`content_summary(5000, 5000, false)`), exit_code, is_auto_attached, start/finished timestamps,
and (currently unset) pwd/shell/username/hostname/git_branch/os/session_id.

Secret redaction is respected — if the user explicitly asked for a block as context, secrets are
**not** force-obfuscated; user settings apply.

### 3.3 Context chips in the input footer

`agent_input_footer/chips.rs` + `context_chips/` — the footer shows attachable context as chips
(ContextChipKind): selected text, blocks, files, images, repo, skills, etc. Auto-detection
("terminal command autodetection in agent input") is a toggleable setting.

---

## 4. Agent control over the terminal

### 4.1 Action model & executor (`blocklist/action_model.rs`)

- `BlocklistAIActionModel` manages `AIAgentAction`s from responses, including an **action queue**
  for multiple actions in one response.
- Actions execute one-by-one: user-initiated or **auto-executed if permissions allow**
  (`BlocklistAIActionExecutor`).
- `AIActionStatus` lifecycle: `Preprocessing → Queued → Blocked → RunningAsync → Finished(result)`.
- Input is hidden while a pending AI-requested command requires user action.

### 4.2 Action executor submodules (`action_model/execute.rs`)

24 executors — the full tool surface:

`ask_user_question`, `call_mcp_tool`, `create_documents`, `edit_documents`, `fetch_conversation`,
`file_glob`, `grep`, `read_documents`, `read_files`, `read_mcp_resource`, `read_skill`,
`request_computer_use`, `request_file_edits`, `run_agents`, `search_codebase`, `send_message`,
`shell_command`, `start_agent`, `start_recording`, `stop_recording`, `suggest_new_conversation`,
`suggest_prompt`, `upload_artifact`, `use_computer`, `wait_for_events`.

Execution phases: `Serial` (barrier actions run alone) vs `Parallel(ReadOnlyLocalContext)`
(read-only local actions coalesce).

### 4.3 Shell command execution (`execute/shell_command.rs`)

- `ShellCommandExecutor` + `ShellCommandExecutorEvent` — the primary "agent controls the
  terminal" mechanism.
- Commands are **requested**, then run by the user or auto-approved depending on the execution
  profile's command allowlist/denylist.
- Requested command UX renders inline in the block output with accept/deny + edit affordances
  (`inline_action/requested_command::RequestedCommand`, `render_requested_action_row`).

### 4.4 Permissions — execution profiles (`ai/execution_profiles/`)

- `AIExecutionProfile` with `ActionPermission` variants: `AskUserQuestionPermission`,
  `RunAgentsPermission`, `WriteToPtyPermission`, `ComputerUsePermission`.
- Profile fields: `command_denylist`, `command_allowlist` (seeded from legacy settings,
  excluding `DEFAULT_COMMAND_EXECUTION_ALLOWLIST` entries), `directory_allowlist`, `base_model`,
  `name`, `is_default_profile`.
- Persistence: file-backed collection in `AISettings` for TUI + flagged GUI builds; legacy per-
  profile Warp Drive cloud objects otherwise, with one-way migration (`ProfileSource`).
- Org policy can force values (`is_forced_by_org`): e.g. computer use resolves through the
  workspace `ai_autonomy_settings` (Never / AlwaysAllow / AlwaysAsk) with user preference as
  fallback.
- `AgentModeCommandExecutionPredicate` + default allowlist/denylist in `settings/ai.rs`.
- `FocusedTerminalInfo` restricts AI in remote sessions (org policy).
- Long-context warnings: `LONG_CONTEXT_WARNING_THRESHOLD = 272_000` tokens (GPT 5.4/5.5) with
  pricing warning link.

### 4.5 Fast-forward (auto-approve)

`FastForwardToggle` toolbar item — "Auto-approve all agent actions for this task". Always-on for
cloud agent conversations ("Fast forward is always enabled for cloud agent conversations").

### 4.6 Orchestration (parent/child)

- `orchestration_topology.rs`: parent → children index on `BlocklistAIHistoryModel`; helpers walk
  the tree for the pill bar, keyboard nav, and credit rollup. `OrchestrationParticipantKind`:
  `Orchestrator` | `Agent { name }` | `Unknown`.
- `run_agents` / `start_agent` executors spawn child agent conversations; `ChildAgent` origin
  tracks entry.
- Conversation statuses drive inline header + pills: streaming, waiting, blocked, in-control.

---

## 5. The block UI (how an agent reply looks)

### 5.1 AI block layout (`block/view_impl.rs` doc)

```
┌───────────────────────────────────────────────┐
│ header: "1 block attached" / "selected text"  │  (attached-context chip + overflow menu)
├───────────────────────────────────────────────┤
│ query: "<Avatar> What went wrong?"             │  (the prompt, as submitted)
├───────────────────────────────────────────────┤
│ output:                                        │
│   • text sections (markdown)                   │
│   • shell command blocks (e.g. `cargo fix`)    │
│   • inline action UX (edits, searches, MCP)    │
│   • todos / comments / orchestration           │
├───────────────────────────────────────────────┤
│ status footer (usage, debug, rating)           │
└───────────────────────────────────────────────┘
```

### 5.2 Header (`block/view_impl/header.rs`)

- Shows cwd (pre-AgentView), attached-context chip ("1 block" / "N blocks" / "selected text"),
  overflow menu, rewind-to-checkpoint button (`RevertToCheckpoints` feature).
- With `AgentView` enabled and no context chips, the header row is skipped (returns `None`).

### 5.3 Output (`block/view_impl/output.rs`, 4293 lines)

The richest component. Renders: markdown text sections, code snippets with highlights, suggested
commands, citations chips, todos (render_todos / completed todo items), imported review comments,
debug footer, failed-output usage notice, orchestration section, autonomy-setting speedbump
footer, embedded code editor for file edits, inline action views:
- `RequestedCommand` (shell command approval)
- `SearchCodebaseView`, `WebSearchView`, `WebFetchView`
- `SuggestedUnitTestsView`, `RunAgentsCardView`
- `AskUserQuestionView`, `CreateOrEditDocumentAction`
- error cards: `AwsBedrockCredentialsErrorView`, `GeminiEnterpriseCredentialsErrorView`

### 5.4 Input footer (`agent_view/agent_input_footer/`)

Configurable, drag-and-drop-editable toolbar (`AgentToolbarItemKind`, all rendered through one
editor):

| Item | Availability |
|---|---|
| `ContextChip(ContextChipKind)` | Both |
| `ModelSelector` | AgentView only |
| `NLDToggle` (autodetection on/off) | AgentView only |
| `ContextWindowUsage` (usage meter) | AgentView only |
| `FileExplorer` | CLI agent only |
| `RichInput` | CLI agent only |
| `VoiceInput` | Both (feature-gated) |
| `FileAttach` (alias `ImageAttach`) | Both |
| `ShareSession` (`/remote-control`) | Both |
| `Settings` | CLI agent only |
| `FastForwardToggle` (auto-approve) | AgentView only |
| `HandoffToCloud` | AgentView only |

Viewer/session semantics: host-controlling items (`Settings`, `ShareSession`, `FileExplorer`,
`FastForwardToggle`, `HandoffToCloud`) hidden from shared-session viewers.

Also in the footer: environment selector (`EnvironmentSelector`), profile/model selector,
plugin install chips (CLI agents), cloud VM indicators ("Connected to a live cloud agent session"
/ "Not connected… next prompt starts a new cloud machine"), prompt alerts, and the
long-context-usage icon.

---

## 6. Settings — how it looks (`settings_view/ai_page.rs`, 10,356 lines)

### 6.1 Subpages (`AISubpage`)

1. **WarpAgent** (default): global AI toggle + Active AI + Input + Other sections
2. **Profiles**: agent profiles & permissions (execution profiles editor)
3. **Knowledge**: knowledge / Rules settings
4. **ThirdPartyCLIAgents**: third-party CLI agent settings

MCP servers render as a standalone page (not an AI subpage).

### 6.2 Toggle settings (bindings + actions, `BindingGroup::WarpAi`)

- **AI** (global enable) → `ToggleGlobalAI`
- **Active AI** → `ToggleActiveAI`
- **terminal command autodetection in agent input** (or "natural language detection" pre-AgentView)
  → `ToggleAIInputAutoDetection`
- **agent prompt autodetection in terminal input** → `ToggleNLDInTerminal`
- **Next Command** (intelligent autosuggestions) → `ToggleIntelligentAutosuggestions`
- **prompt suggestions** → `TogglePromptSuggestions`
- **code suggestions** → `ToggleCodeSuggestions`
- **Show agent tips** → `ToggleShowAgentTips`
- **Show Warp Agent changelog in new agent conversation view** → `ToggleShowOzUpdatesInZeroState`

### 6.3 Settings model (`settings/ai.rs`)

Rich settings surface — the interesting ones for agent behavior:

- `AgentModeCommandExecutionPredicate`, `AgentModeCommandExecutionDenylist`,
  `AgentModeCodingPermissionsType`
- `AutoApproveBypassesCommandDenylist`
- `LongRunningCommandSubmissionMode`, `PromptSubmissionMode`, `ThinkingDisplayMode`,
  `OrchestrationMessageDisplayMode`
- `CodebaseContextEnabled`, `WarpDriveContextEnabled`, `MemoryEnabled`, `FileBasedMcpEnabled`
- `IncludeAgentCommandsInHistory`, `SharedBlockTitleGenerationEnabled`,
  `GitOperationsAutogenEnabled` (commit messages + PR titles/descriptions)
- `ShowConversationHistory`, `ShowHintText`, `ShouldShowOzUpdatesInZeroState`, `ShowAgentTips`
- `ShouldRenderCLIAgentToolbar`, `ShouldRenderUseAgentToolbarForUserCommands`
- `VoiceInputEnabled`, `AIAutoDetectionEnabled`, `NLDInTerminalEnabled`
- API keys manager, custom inference endpoints modal, model selection with context-window slider,
  set-default-model modal, execution profile view

Copy patterns worth stealing (setting descriptions):
- Next Command: "Let AI suggest the next command to run based on your command history, outputs,
  and common workflows."
- Prompt suggestions: "Let AI suggest natural language prompts, as inline banners in the input,
  based on recent commands and their outputs."
- Code suggestions: "Let AI suggest code diffs and queries as inline banners in the blocklist,
  based on recent commands and their outputs."

---

## 7. Conversation model & persistence

`ai/agent/conversation.rs` (4,810 lines):
- `AIConversation` with status, exchanges, todos (`AIAgentTodoList`), comments (code review),
  orchestration config (`OrchestrationConfig` + status), parent/child agent ids, agent name,
  recording spans (audio), artifacts, task tree (`Task`/`TaskId`, `derive_todo_lists_from_root_task`).
- Persisted via `persistence::model::AgentConversationData` + `TaskStore` with transactions
  (`Task`, `Transaction`, `SavedTask`).
- Token usage model: warp tokens / BYOK tokens / custom-endpoint tokens buckets, footer rollup,
  `compute_orchestration_rollup` for agent-mode usage footer.
- Restore behavior: `RestoreConversationEntryBehavior::PreserveAgentViewState` — session restore
  re-enters agent view with preserved state.
- Session viewer semantics via `SharedSessionStatus` (host/executor/viewer).

---

## 8. Keyboard model

- Enter agent view: `cmd+enter` (macOS) / `ctrl+shift+enter` (`ENTER_AGENT_VIEW_NEW_CONVERSATION_KEYSTROKE`).
- Exit: `Esc` / `Ctrl+C` with **1-second double-press confirmation window**
  (`ENTER_OR_EXIT_CONFIRMATION_WINDOW`) shared across enter/exit/new-conversation keybindings.
- `ClearBuffer` (Cmd+K) while in agent view = new conversation.
- Errors: `EnterAgentViewError::{AlreadyInAgentView, LongRunningCommand}`;
  `ExitAgentViewError::{LongRunningCommand, ConversationViewer, AmbientAgent}`.

---

## 9. Roadmap takeaways for KronTerm / KronosCode

1. **Two-surface split**: lightweight chat panel vs. full agent execution surface — keep separate
   like `ai_assistant` vs `ai/blocklist`.
2. **Placement spectrum**: full-screen agent view (pane swap), inline agent header over active
   command, agent entry blocks in the blocklist, orchestration pill bar above the header. Map
   these to KronTerm's widget/tabs/canvas presentations.
3. **Control state language** (copy): "Agent is in control", "User is in control", "Agent needs
   your permission to continue", "Agent is waiting for command to exit", "Prompt agent to interact
   with `{command}`".
4. **Permissions model**: execution profiles = allowlist/denylist + directory allowlist + action
   permissions (ask_user_question, run_agents, write_to_pty, computer_use) + org-forced values.
   Auto-approve (fast-forward) as per-task toggle, forced on for cloud agents.
5. **Auto-attach context**: completed user commands auto-attached to the next query
   (`AgentViewBlockContext`) — the killer UX for terminal-native agents. Respect secret redaction.
6. **Action queue UX**: multiple actions in one response queue up; block input while a requested
   command awaits approval; statuses Preprocessing/Queued/Blocked/Running.
7. **Entry-origin telemetry**: track every entry origin; decide auto-submit behavior per origin.
8. **Orchestration visualization**: pill bar with deterministic avatar colors + status badges;
   click to navigate parent/child conversations; credit rollup across the tree.
9. **Settings organization**: subpages (main / profiles / knowledge / third-party CLI), toggle
   pairs with copy, per-feature bindings, and inline description banners for AI suggestion
   features.

---

## Appendix: key files (Warp repo, app/src/)

| Concern | File |
|---|---|
| AI module map / surface split | `ai/mod.rs` |
| Blocklist AI module | `ai/blocklist/mod.rs` |
| Core controller | `ai/blocklist/controller.rs` |
| Context (pending) | `ai/blocklist/context_model.rs` |
| Action queue + executor | `ai/blocklist/action_model.rs`, `action_model/execute.rs` |
| Shell command execution | `ai/blocklist/action_model/execute/shell_command.rs` |
| Conversation model | `ai/agent/conversation.rs` (4.8k lines) |
| Task/todo model | `ai/agent/task.rs`, `ai/agent/todos.rs`, `ai/agent/task_store.rs` |
| Agent view controller | `ai/blocklist/agent_view/controller.rs` |
| Agent view block | `ai/blocklist/agent_view/agent_view_block.rs` |
| Inline header | `ai/blocklist/agent_view/inline_agent_view_header.rs` |
| Zero state | `ai/blocklist/agent_view/zero_state_block.rs` |
| Orchestration pill bar | `ai/blocklist/agent_view/orchestration_pill_bar.rs` (+_model) |
| Input footer toolbar | `ai/blocklist/agent_view/agent_input_footer/` (mod, toolbar_item, editor, chips, environment_selector) |
| AI block model | `ai/blocklist/block/model.rs` |
| AI block render | `ai/blocklist/block/view_impl.rs`, `view_impl/{header,query,output,orchestration,todos,comments}.rs` |
| Execution profiles | `ai/execution_profiles/` (mod, profiles, config, editor/) |
| Settings model | `settings/ai.rs` |
| Settings page | `settings_view/ai_page.rs` (10.3k lines) |
| Workspace placement | `workspace/view.rs` (AIAssistantPanelView, right panel, agent view entry) |
| Side panel | `ai_assistant/panel.rs` |
