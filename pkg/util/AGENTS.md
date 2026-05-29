# pkg/util — Shared Utilities

**Parent:** `../../AGENTS.md`

## OVERVIEW

Common Go utilities. 20+ sub-packages for specific concerns.

## KEY UTILITIES

| Package      | Purpose                 |
| ------------ | ----------------------- |
| `dbutil/`    | Database utilities      |
| `fileutil/`  | File operations         |
| `logutil/`   | Structured logging      |
| `shellutil/` | Shell command execution |
| `iochan/`    | Async I/O channels      |
| `logview/`   | Log viewer components   |
| `ds/`        | Data structures         |

## USAGE

```go
import "github.com/wavetermdev/waveterm/pkg/util/logutil"
import "github.com/wavetermdev/waveterm/pkg/util/fileutil"
```

## LOGGING

Use `logutil` for consistent structured logging with context.
