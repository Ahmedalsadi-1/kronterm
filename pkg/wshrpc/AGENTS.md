# pkg/wshrpc — RPC Communication System

**Parent:** `../../AGENTS.md`

## OVERVIEW

WebSocket RPC backbone. All frontend ↔ backend communication flows through here.

## STRUCTURE

```
wshrpc/
├── wshrpctypes.go          # RPC definitions (SOURCE OF TRUTH)
├── wshserver/              # Server-side implementation
├── wshclient/              # Go client (generated)
└── wshremote/              # Remote connection handling
```

## ADDING RPC CALLS

1. Add definition to `wshrpctypes.go`
2. Run `task generate`
3. Implement handler in `wshserver/`
4. Frontend client auto-generated to `frontend/app/store/wshclientapi.ts`

## ROUTING

Routes resolve to transport automatically:

- `"waveapp"` → local WebSocket
- `"blocks/{id}"` → block execution
- SSH connection name → SSH tunnel

## NEVER EDIT

- `frontend/app/store/wshclientapi.ts` (generated)
- `pkg/wshrpc/wshclient/wshclient.go` (generated)
