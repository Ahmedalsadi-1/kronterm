# Frontend Store — State Management

**Parent:** `../../AGENTS.md`

## OVERVIEW

Jotai-based state management. All atoms defined here are singletons accessed via models.

## KEY FILES

| File              | Purpose                            |
| ----------------- | ---------------------------------- |
| `global.ts`       | Global atoms (workspace, UI state) |
| `global-atoms.ts` | Atom definitions                   |
| `keymodel.ts`     | Keyboard shortcut handling         |
| `wshclient.ts`    | WSH RPC client connection          |
| `wshrouter.ts`    | RPC route resolution               |
| `ws.ts`           | WebSocket connection               |
| `wps.ts`          | Wave PubSub events                 |
| `wos.ts`          | Workspace operations               |

## ATOM PATTERNS

```typescript
// Simple atom as field initializer
statusAtom = jotai.atom<"idle" | "running">("idle");

// Derived atom in constructor
private constructor() {
    this.lengthAtom = jotai.atom((get) => get(this.outputAtom).length);
}
```

## RPC CLIENT

- `wshclientapi.ts` — **Generated**, do not edit
- Source: `pkg/wshrpc/wshrpctypes.go`

## API ACCESS

```typescript
import { getApi } from "@/app/store/global";
getApi().getIsDev();
```

Type defined in `custom.d.ts` as `ElectronApi`.
