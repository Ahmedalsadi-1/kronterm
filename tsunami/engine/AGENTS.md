# tsunami/engine — VDOM Rendering Engine

**Parent:** `../../AGENTS.md`

## OVERVIEW

Virtual DOM rendering engine. Go-based VDOM with React-like hooks, component lifecycle, and server-side rendering.

## STRUCTURE

```
engine/
├── render.go               # VDOM rendering
├── render.md               # Rendering documentation
├── rootelem.go             # Root element handling
├── serverhandlers.go       # HTTP server handlers
├── schema.go               # Component schema
├── clientimpl.go           # Client implementation
├── hooks.go                # React-like hooks
├── globalctx.go            # Global context
├── asyncnotify.go          # Async notifications
├── atomimpl.go             # Atom implementation
├── comp.go                 # Component base
└── errcomponent.go         # Error boundary component
```

## RENDERING

VDOM render pipeline:
1. Component tree built in Go
2. Rendered to virtual DOM
3. Diffed against previous state
4. Patches sent to client

## HOOKS

React-like hooks for components:
- `useState` — component state
- `useEffect` — side effects
- See `hooks.go` for full list

## SERVER

`serverhandlers.go` — HTTP handlers:
- WebSocket connection
- VDOM sync
- Asset serving

## SCHEMA

`schema.go` — component schema validation:
- Property types
- Required fields
- Default values

## CLIENT

`clientimpl.go` — client-side bridge:
- WebSocket communication
- Patch application
- Event handling

## DOCUMENTATION

`render.md` — detailed rendering docs. Read before modifying render pipeline.

## NEVER

- Skip async notification (breaks sync)
- Block in render (must be fast)
- Modify VDOM outside render cycle
