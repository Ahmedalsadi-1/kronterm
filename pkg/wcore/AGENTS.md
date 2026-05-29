# pkg/wcore — Core Operations

**Parent:** `../AGENTS.md`

## OVERVIEW

Core business logic. Object CRUD, workspace operations.

## STRUCTURE

```
wcore/
├── workspace.go      # Workspace management
├── tab.go           # Tab operations
├── block.go         # Block CRUD
├── conn.go          # Connection refs
└── core.go          # Common utilities
```

## PATTERNS

### Object Creation

```go
block, err := wcore.CreateBlock(tabId, blockDef)
```

### Object Update

```go
wcore.UpdateBlockMeta(blockId, updates)
```

### Object Delete

```go
wcore.DeleteBlock(blockId)
```

## WPS EVENTS

Core publishes events on changes:

- `block:update` — Block modified
- `tab:update` — Tab changed
- `workspace:update` — Workspace changed

## TRANSACTIONS

Use `waveappstore` for transactional updates:

```go
err := wstore.UpdateObjectMeta(...)
```

## NEVER

- Direct DB access (use wstore)
- Skip WPS events (breaks sync)
