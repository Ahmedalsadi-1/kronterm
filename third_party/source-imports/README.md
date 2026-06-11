# Kronterm Source Imports

This directory contains verbatim upstream source snapshots requested for Kronterm canvas and KronosCode UI integration.

These files are intentionally kept outside `frontend/` and `emain/` so Kronterm's active TypeScript build does not compile incompatible app shells, aliases, Bun server code, or foreign Electron entrypoints. Adapted code should be copied from here into Kronterm-owned modules with local imports, tests, and attribution.

## Imported Sources

| Directory | Upstream | Purpose |
| --- | --- | --- |
| `flowith-canvas-cowork/` | `https://github.com/flowith-ai/canvas-cowork` | Flowith canvas cowork skill/source package. |
| `inspirepan-canvas-cowork/` | `https://github.com/inspirepan/canvas-cowork` | tldraw canvas cowork web/server stack, canvas filesystem mapping, outline panel, sync utilities, and agent panel patterns. |
| `hermes-desktop/` | `https://github.com/NousResearch/hermes-agent/tree/main/apps/desktop` | Hermes Desktop React/Electron UI stack, chat cards, assistant UI, settings/control primitives, preview patterns, and session UI. |

## Integration Rule

Do not import from this directory directly in production code. Use it as a local upstream snapshot, then port selected files into Kronterm namespaces so they follow Kronterm state, RPC, styling, and Electron boundaries.
