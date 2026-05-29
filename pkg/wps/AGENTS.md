# pkg/wps — Wave PubSub

**Parent:** `../AGENTS.md`

## OVERVIEW

Event system. Asynchronous communication between backend services and frontend.

## PATTERN

### Subscribe

```go
sub := wps.Subscribe("event:name")
for msg := range sub.Ch {
    // handle event
}
```

### Publish

```go
wps.Publish("event:name", payload)
```

## EVENT TYPES

See `wpstypes.go` for constants:

- `block:*` — Block lifecycle
- `conn:*` — Connection events
- `config:*` — Config changes

## ADDING EVENT

1. Add constant to `wpstypes.go`
2. Document payload type
3. Handle in subscriber

## SCOPE

Events can be scoped:

- Global (no scope)
- Block-specific (blockId)
- Connection-specific (connName)

## NEVER

- Hold locks while publishing (deadlock risk)
- Publish in tight loops (performance)
