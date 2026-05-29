# pkg/service — Service Layer

**Parent:** `../../AGENTS.md`

## OVERVIEW

Backend service interfaces. Each service has frontend and backend implementations.

## STRUCTURE

```
service/
├── blockservice/       # Block execution
├── clientservice/      # Client management
├── objectservice/      # Object CRUD
├── userinputservice/   # User input handling
├── windowservice/      # Window management
└── workspaceservice/   # Workspace operations
```

## SERVICE PATTERN

Services expose RPC interfaces defined in `wshrpc/wshrpctypes.go`. Each service:

1. Registers RPC handlers
2. Manages state
3. Emits WPS events for async notifications

## EVENTS

Use WPS (Wave PubSub) for service → frontend notifications:

```go
wps.Publish("service:event", payload)
```
