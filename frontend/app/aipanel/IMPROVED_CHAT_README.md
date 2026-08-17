# KronTerm AI Surfaces

This directory contains the React chat surfaces that connect KronTerm to KronosCode, ACP agents, configured model
providers, workspace context, approvals, artifacts, and the optional voice engine.

The name `WaveAIModel` and several `waveai-*` files remain for compatibility with the original data model. Use
KronosCode, KronosChamber, and KronTerm in new user-facing text.

## Which surface should I change?

| Surface                            | Entry point                         | Use it for                                                                                          |
| ---------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| **KronosChamber**                  | `../view/chathubv2/chathubv2.tsx`   | Primary embedded KronosCode chat, sessions, artifacts, settings, and runtime recovery               |
| **ACP chat**                       | `acp-chat-panel.tsx`                | ACP agent sessions, agent/model switching, approvals, slash commands, mentions, and session history |
| **Kronos chat components**         | `kronos-chat-components.tsx`        | Shared streamed message, status, reasoning, and tool presentation                                   |
| **KronosCode V2 message renderer** | `kronoscode-v2/`                    | Structured SDK message parts, reasoning groups, tool results, and canvas insertion                  |
| **Compatibility AI panel**         | `aipanel.tsx`, `waveai-model.tsx`   | Existing provider chat and `wsh ai` integration                                                     |
| **Composer**                       | `improved-chat-input.tsx`           | Rich text entry, attachments, pasted content, models, tools, and submit behavior                    |
| **Voice**                          | `siri-button.tsx`, `voice-model.ts` | Experimental microphone, transcription, and speech state                                            |

KronosChamber's managed process lives in `emain/chathubv2-*.ts` and `emain/kronoscode-runtime.ts`. Keep runtime startup,
health, credential refresh, reconnect, and repair logic in Electron rather than duplicating it in React.

## Message flow

```text
Composer
├── text, files, pasted content, commands, skills, and mentions
├── selected workspace/canvas context
└── optional voice transcript
        ↓
KronosChamber or ACP session
├── session and model selection
├── streamed assistant/reasoning/tool events
├── approval requests
└── artifacts and previews
        ↓
Visible workspace activity
├── agent activity stream
├── widget aura and cursor overlays
├── canvas task/evidence cards
└── desktop pet state
```

The UI must keep tool progress inspectable. Do not collapse a pending approval, failed runtime, degraded tool result, or
recoverable connection error into a generic loading state.

## Workspace and canvas context

The spatial workspace can send selected widgets and agent cards to the composer in two modes:

- `follow`: make the selected node the active task focus.
- `quote`: attach the selected node as evidence without replacing the active focus.

The shared context contract lives in `../tab/workspace-canvas-context.ts`. Canvas agent card creation and lineage live in
`../tab/workspace-canvas-agent.ts`; run aggregation lives in `../tab/workspace-canvas-task-graph.ts`.

The composer must preserve the block or agent identifiers used by these modules. Display text alone is insufficient
because the canvas needs to reconnect streamed activity to the original node.

## ACP sessions

`use-acp-session.ts` is the state and event boundary for ACP chat. It tracks:

- configured agent profiles and backend capabilities;
- active sessions and session history;
- available models, modes, commands, and skills;
- streamed messages and active tool state;
- pending confirmations;
- connection, retry, degraded, and completion state.

Keep reducers and compatibility checks in pure exported helpers where possible. UI components should render the session
state and call the hook's actions rather than reconstructing protocol state.

## Attachments and rich input

`improved-chat-input.tsx` owns the rich composer experience. `ai-utils.ts` contains file type checks, size validation,
image resizing, MIME normalization, previews, and base64 conversion.

When changing attachments:

1. Keep the user-visible file and the payload metadata in sync.
2. Preserve UTF-8 by using utilities from `@/util/util`; never introduce `atob()` or `btoa()`.
3. Validate before reading large files into memory.
4. Keep removal and retry paths available before submission.
5. Verify keyboard and drag-and-drop behavior.

## Voice, experimental

`VoiceModel` starts and controls the optional Python engine through the Electron API. A final transcript dispatches the
`kronterm:voice-transcript` browser event and is submitted through the active composer.

The runtime implementation lives in:

- `../../../audio-engine/` for audio capture, `faster-whisper` transcription, and speech output;
- `../../../emain/emain-audio.ts` for process lifecycle and JSON-line IPC;
- `siri-button.tsx` for the microphone control and status overlay;
- `voice-model.ts` for Jotai state and Electron callbacks.

Voice is opt-in and dependency-sensitive. Preserve idle, listening, transcribing, speaking, and error states. Shutting
down the feature must stop capture and terminate the child process.

## Provider and compatibility paths

The compatibility AI panel still supports configured cloud and local providers. `aimode.tsx`, `providers-panel.tsx`, and
`waveai-model.tsx` must continue to understand existing `waveai.json` and `waveai:*` settings. These identifiers are part
of the configuration contract even though the product name has changed.

Do not state that a provider is private by default. Local models can keep inference local; cloud providers receive the
context sent to their API.

## Component rules

- Use named exports.
- Keep all hooks at the component top level and before conditional returns.
- Give every `React.memo()` component a `displayName`.
- Use `cn()` from `@/util/util` for class merging.
- Use `getApi()` from `@/store/global` for Electron APIs.
- Use `globalStore` inside models; models never call React hooks.
- Put reusable protocol transitions in pure functions and cover them with focused tests.
- Preserve keyboard access, visible focus, `aria-label` text, and reduced-motion behavior.

## Focused validation

Run the smallest checks that cover the changed surface:

```bash
npx vitest run frontend/app/aipanel/acp-chat-controls.test.ts
npx vitest run frontend/app/aipanel/use-acp-session.test.ts
npx vitest run frontend/app/view/chathubv2/chathubv2-composer.test.ts
npx vitest run frontend/app/view/chathubv2/chathubv2.test.ts
task check:ts
```

For managed-runtime changes, also run the relevant `emain/chathubv2-*.test.ts` tests. For canvas-context changes, run the
`frontend/app/tab/workspace-canvas-*.test.ts` suite.

## Documentation status

The older implementation guide and summary in this directory describe the original rich-composer rollout. They now
serve as historical context; this file and the current code are authoritative.
