# Rich Composer Integration Notes

The rich composer is already integrated into KronTerm. This file replaces the original pre-integration walkthrough,
whose example payloads and component boundaries no longer matched the running product.

Use [`IMPROVED_CHAT_README.md`](./IMPROVED_CHAT_README.md) for the current architecture and validation commands.

## Integration contract

When adding the rich composer to another KronTerm chat surface:

1. Reuse `ImprovedChatInput` from `improved-chat-input.tsx`.
2. Adapt the surface's real session state instead of creating a second model or message store.
3. Route files through `ai-utils.ts` validation and preview helpers.
4. Preserve commands, skills, agent mentions, file mentions, and widget mentions supported by the target backend.
5. Keep pending approvals and active tool state visible while streaming.
6. Accept workspace canvas context from `../tab/workspace-canvas-context.ts` when the surface can act on widgets.
7. Subscribe to the optional `kronterm:voice-transcript` event only while the composer is mounted.
8. Keep submit, cancel, retry, removal, and keyboard paths accessible.

## Do not duplicate

- ACP protocol state from `use-acp-session.ts`.
- KronosChamber runtime health logic from `emain/chathubv2-*.ts`.
- file encoding or base64 helpers from `@/util/util` and `ai-utils.ts`.
- canvas agent identifiers with display-only labels.
- provider compatibility settings stored under `waveai:*`.

## Validation checklist

- Submit plain text and multiline text.
- Attach and remove text, image, and PDF inputs.
- Paste a large text selection and verify its preview.
- Exercise command, skill, agent, file, and widget suggestions.
- Verify stream cancellation, retry, approval, error, and reconnect states.
- Submit with `follow` and `quote` canvas context.
- Verify microphone transcript submission when the optional engine is available.
- Run the focused tests listed in `IMPROVED_CHAT_README.md` and `task check:ts`.
