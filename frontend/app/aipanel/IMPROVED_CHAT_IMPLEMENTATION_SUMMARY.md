# Rich Composer Implementation Summary

The original rich-input experiment is now part of a larger KronTerm AI system. The current implementation spans the
compatibility AI panel, ACP sessions, KronosChamber, structured KronosCode message rendering, workspace context, agent
activity overlays, approvals, artifacts, and experimental voice input.

## Current result

- `improved-chat-input.tsx` provides the shared rich composer.
- `acp-chat-panel.tsx` and `use-acp-session.ts` provide ACP agent sessions and protocol state.
- `../view/chathubv2/` embeds the primary KronosChamber experience and reports runtime recovery state.
- `kronoscode-v2/` renders structured messages, reasoning, and tool results.
- `chat-cards.tsx` and `AcpPreviewPane.tsx` keep code, previews, and artifacts inspectable.
- `../tab/workspace-canvas-context.ts` connects selected widgets and task cards to the composer.
- `desktop-pet-activity.ts` and `../view/use-agent-overlays.ts` project live tool activity back into the workspace.
- `voice-model.ts` and `siri-button.tsx` connect the optional speech engine.

## Status boundaries

- KronosCode and KronosChamber are core private-beta product surfaces.
- ACP backends depend on the installed or packaged agent and its advertised capabilities.
- The Python voice engine is experimental and requires optional dependencies.
- The iPhone client and phone-control bridge are Labs work and use the same KronosCode gateway rather than a second AI
  engine.

## Source of truth

Read [`IMPROVED_CHAT_README.md`](./IMPROVED_CHAT_README.md) for architecture, file ownership, component rules, and focused
validation. Read the code and tests for exact protocol payloads; do not revive the obsolete sample payloads that were
previously stored in this file.
