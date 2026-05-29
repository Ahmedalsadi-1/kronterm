# pkg/jobmanager — Job & Stream Management

**Parent:** `../AGENTS.md`

## OVERVIEW

Job management and stream handling. Circular buffers for terminal output, job lifecycle, and stream multiplexing.

## STRUCTURE

```
jobmanager/
├── jobmanager.go           # Main job manager
├── jobmanager_unix.go      # Unix-specific code
├── jobmanager_windows.go   # Windows-specific code
├── jobcmd.go               # Job command handling
├── cirbuf.go               # Circular buffer for output
├── streammanager.go        # Stream multiplexing
├── streammanager_test.go   # Stream manager tests
└── mainserverconn.go       # Main server connection
```

## CIRCULAR BUFFER

`cirbuf.go` — fixed-size buffer for terminal output:
- Overwrites oldest data when full
- Thread-safe reads/writes
- Used for scrollback history

## STREAM MANAGER

`streammanager.go` — multiplexes multiple streams:
- Stream creation/deletion
- Data routing to correct stream
- Connection to main server

## JOB LIFECYCLE

1. Job created via `jobmanager.go`
2. Output written to circular buffer
3. Stream manager routes to clients
4. Job cleaned up on exit

## PLATFORM DIFFERENCES

- Unix: PTY-based job management
- Windows: Console API

## NEVER

- Lose output (cirbuf must not drop data unexpectedly)
- Block stream reads (async only)
- Skip cleanup on job exit
