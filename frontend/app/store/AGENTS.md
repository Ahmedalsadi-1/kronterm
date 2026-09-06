# Frontend Store — State Management

**Parent:** `../../AGENTS.md`

## OVERVIEW

Jotai-based state management. All atoms defined here are singletons accessed via models.

## KEY FILES

| File                | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `global.ts`         | Global env helpers, `getApi()`             |
| `global-model.ts`   | Top-level workspace/UI state model         |
| `global-atoms.ts`   | Atom definitions                           |
| `client-model.ts`   | Client/window model                        |
| `connections-model.ts` | Connection state model                  |
| `tab-model.ts`      | Tab state model                            |
| `adaptive-split.ts` | Adaptive split sizing logic                |
| `block-close-routing.ts` | Block close routing rules             |
| `badge.ts`          | Tab/block badges                           |
| `contextmenu.ts`    | Context menu state                         |
| `focusManager.ts`   | Block focus management                     |
| `keymodel.ts`       | Keyboard shortcut handling                 |
| `modalmodel.ts`     | Modal state                                |
| `services.ts`       | Frontend service registry                  |
| `tabrpcclient.ts`   | Tab RPC client                             |
| `windowtype.ts`     | Window type handling                       |
| `wos.ts`            | Workspace operations                       |
| `ws.ts`             | WebSocket connection                       |
| `wps.ts`            | Wave PubSub events                         |
| `wshclient.ts`      | WSH RPC client connection                  |
| `wshclientapi.ts`   | **Generated** RPC client API               |
| `wshrouter.ts`      | RPC route resolution                       |
| `wshrpcutil.ts`     | RPC utilities                              |
| `jotaiStore.ts`     | `globalStore` for non-React contexts       |
| `counters.ts`       | Counters/metrics                           |

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
