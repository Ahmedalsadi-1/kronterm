# pkg/remote — Remote Connections

**Parent:** `../../AGENTS.md`

## OVERVIEW

SSH and WSL connection handling. Manages durable sessions that survive network interruptions.

## STRUCTURE

```
remote/
├── conncontroller/     # Connection management (LOCKING CRITICAL)
├── connparse/          # Connection string parsing
├── fileshare/         # Remote file operations
├── sshclient.go       # SSH client implementation
└── wslconn/           # WSL connection handling
```

## CRITICAL: LOCK ORDERING

**DEADLOCK RISK** in `conncontroller/connmonitor.go`:

```go
// WRONG - causes deadlock
cm.lock.Lock()
defer cm.lock.Unlock()
sshConn.SomeMethod()  // NEVER call SSHConn while holding cm.lock

// CORRECT
// Release cm.lock before calling SSHConn methods
```

Methods holding `cm.lock` must NEVER call into SSHConn.

## SSH CONNECTIONS

- Auto-reconnect on network interruption
- Connection string parsing via `connparse/`
- File sharing via `fileshare/wshfs/`
