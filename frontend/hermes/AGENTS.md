# frontend/hermes — Embedded Hermes Agent UI

**Parent:** `../AGENTS.md`

## OVERVIEW

The Hermes agent app embedded in KronTerm as a native widget (mounted via `emain/hermes-runtime.ts`). Has its own entry points, module aliases, and themes; the agent-side package lives at `agents/hermes/`.

## STRUCTURE

- `hermes.ts`, `main.tsx` — entry bootstrap; gateway client via `JsonRpcGatewayClient`
- `app/` — feature areas: `agents/`, `artifacts/`, `chat/`, `command-center/`, `command-palette/`, `cron/`, `gateway/`, `hud/`, `learning/`
- `components/`, `store/`, `hooks/`, `lib/`, `sdk/`, `plugins/`, `i18n/`, `themes/`

## CONVENTIONS

- Imports use `@hermes/*` aliases (e.g. `@hermes/shared`, `@hermes/lib/...`) — not the core `@/` aliases.
- Runtime wiring (window, lifecycle, gateway) is in `emain/hermes-runtime.ts`.
- Keep the boundary with the main KronTerm app loose: do not import core store atoms from here.

## NOTES

- Changes here affect the embedded widget and any standalone Hermes usage of this codebase.
- `agents/hermes/plugins/kronterm-tools/` is the Python plugin that lets Hermes call into KronTerm — tested via pytest in `agents/hermes/tests/`.
