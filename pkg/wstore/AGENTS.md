# pkg/wstore — Wave Object Store

**Parent:** `../AGENTS.md`

## OVERVIEW

Database persistence layer. SQLite with migrations.

## STRUCTURE

```
wstore/
├── wstore.go       # Main API
├── dbquery.go      # Query helpers
└── dbquery_*.go    # Object-specific queries
```

## CRUD OPERATIONS

```go
// Create
obj, err := wstore.CreateObject(otype, initialData)

// Read
obj, err := wstore.GetObject(otype, oid)

// Update
err := wstore.UpdateObject(otype, oid, updates)

// Delete
err := wstore.DeleteObject(otype, oid)
```

## TRANSACTIONS

```go
ctx := wstore.WithTransaction(ctx)
// ... multiple ops ...
```

## MIGRATIONS

In `db/migrations/`:

- Sequential numbered files
- Applied on startup

## CACHING

Objects cached in memory:

- Reduces DB queries
- Invalidated on update

## NEVER

- Raw SQL (use wstore API)
- Skip migrations
- Hold tx too long (performance)
