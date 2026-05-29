# pkg/wconfig — Configuration System

**Parent:** `../AGENTS.md`

## OVERVIEW

Settings management, schema generation, validation.

## KEY FILES

| File                   | Purpose                         |
| ---------------------- | ------------------------------- |
| `wconfig.go`           | Config loading, defaults        |
| `metaconsts.go`        | **Generated** setting constants |
| `settingsconfig.go`    | Settings definitions            |
| `connectionsconfig.go` | Connection configs              |

## ADDING CONFIG

See `.kilocode/skills/add-config/SKILL.md` for:

- Adding setting definition
- Generating metaconsts
- Frontend config access

## SCHEMA

```bash
task build:schema  # Generates JSON schema
```

## ACCESS

```go
// Backend
config := wconfig.GetGlobalConfig()
value := config.GetStringSetting("setting-key", defaultValue)

// Frontend
const [config, setConfig] = useConfigAtom("setting-key");
```

## GENERATED FILES

- `metaconsts.go` — Never edit directly
- Run `task generate` after changes
