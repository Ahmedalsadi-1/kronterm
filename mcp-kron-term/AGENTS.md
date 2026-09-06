# mcp-kron-term — KronTerm MCP Server

**Parent:** `../AGENTS.md`

## OVERVIEW

Standalone MCP server exposing KronTerm workspace control (blocks/widgets, layout, notifications, connections, secrets) and native computer-use to external AI clients. TypeScript ESM, `@modelcontextprotocol/sdk` + zod.

## STRUCTURE

```
src/
├── index.ts                 # Server bootstrap + tool registration
├── wsh-bridge.ts            # Talks to a running KronTerm via the wsh bridge
├── native-bridge.ts         # Native desktop access
├── kron-computer-use.ts     # macOS accessibility / computer-use tools
├── developer-memory.ts      # Developer memory store tools
├── shared-skills.ts         # Shared project skills listing
└── interaction-contract.ts  # Interaction tool contract
```

## COMMANDS

```bash
npm --prefix mcp-kron-term run build   # tsc → dist/
npm --prefix mcp-kron-term run test    # build + node --test test/*.test.ts
npm --prefix mcp-kron-term run dev     # tsx src/index.ts
```

## NOTES

- Requires a running KronTerm app. App restarts invalidate bridge tokens — re-pair after restart.
- The `wsh` binary on PATH must be current; a stale root `wsh` breaks MCP calls.
- Tests use `node:test` via tsx, not vitest (unlike the frontend).
