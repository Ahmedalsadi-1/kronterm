# pkg/wshutil — WSH Utilities

**Parent:** `../AGENTS.md`

## OVERVIEW

WSH RPC utilities. Routing, adapters, proxy, and stream handling for the RPC system.

## KEY FILES

| File                      | Purpose                        |
| ------------------------- | ------------------------------ |
| `wshrpc.go`               | Core RPC implementation        |
| `wshrouter.go`            | Route resolution               |
| `wshrouter_controlimpl.go`| Control route implementation   |
| `wshadapter.go`           | Protocol adapters              |
| `wshproxy.go`             | RPC proxy                      |
| `wshcmdreader.go`         | Command reader                 |
| `wshevent.go`             | Event handling                 |
| `wshrpcio.go`             | I/O utilities                  |
| `wshstreamadapter.go`     | Stream adapter                 |
| `wshutil.go`              | General utilities              |

## ROUTING

Routes determine transport:
- `"waveapp"` → local WebSocket
- `"blocks/{id}"` → block execution
- SSH connection name → SSH tunnel

## ADAPTERS

Protocol adapters translate between:
- WebSocket ↔ RPC
- Stream ↔ RPC
- SSH ↔ RPC

## NEVER

- Bypass router (use proper routes)
- Skip adapter for non-standard transports
- Block in RPC handlers
