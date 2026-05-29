# pkg/waveobj — Object Model

**Parent:** `../AGENTS.md`

## OVERVIEW

Core domain objects. Workspace, tabs, blocks, connections.

## KEY TYPES

| Type          | Purpose              |
| ------------- | -------------------- |
| `Workspace`   | Top-level container  |
| `Tab`         | Collection of blocks |
| `Block`       | Single content unit  |
| `BlockDef`    | Block configuration  |
| `MetaMapType` | Metadata storage     |

## OREF SYSTEM

Objects referenced by typed IDs:

```go
type ORef struct {
    OType string  // "block", "tab", etc
    OID   string  // UUID
}
```

## META

Runtime metadata stored per object:

```go
meta := waveobj.GetMeta(obj)
meta["key"] = value
```

## RTINFO

Real-time ephemeral state (not persisted):

```go
rtInfo := waveobj.GetRTInfo(obj)
```

## GENERATED

- `metaconsts.go` — Object type constants
- Run `task generate` after changes
