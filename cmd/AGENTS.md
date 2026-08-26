# cmd — Go CLI Applications

**Parent:** `../AGENTS.md`

## OVERVIEW

Go command-line applications. Entry points for server, CLI tool, and code generators.

## STRUCTURE

```
cmd/
├── server/           # wavesrv (main backend server)
├── wsh/              # wsh CLI tool
├── generatets/       # TypeScript binding generator
├── generatego/       # Go client generator
├── generateschema/   # JSON schema generator
├── packfiles/        # Packaged asset packing utility
└── test*/            # Test utilities (incl. test-streammanager, test-conn)
```

## BUILD

```bash
# Build all backend components
task build:backend

# Build specific components
task build:server     # wavesrv
task build:wsh        # wsh CLI
```

## CONVENTIONS

- Use cobra for CLI structure (wsh/)
- Main entry: `main-*.go` files
- Version passed via ldflags
- Cross-compilation in Taskfile.yml

## ADDING COMMANDS

### Server RPC Handler

See `pkg/wshrpc/AGENTS.md`

### wsh CLI Command

See `.kilocode/skills/add-wshcmd/SKILL.md`
