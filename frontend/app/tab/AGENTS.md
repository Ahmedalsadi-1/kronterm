# frontend/app/tab — Tab System

**Parent:** `../AGENTS.md`

## OVERVIEW

Tab management and layout. Tabs contain blocks in a resizable grid.

## STRUCTURE

```
tab/
├── tab.tsx           # Tab component
├── tab-layout.tsx    # Resizable grid layout
├── tab-model.ts      # Tab state/model
├── tab-content.tsx   # Block rendering
└── tab-shared.tsx    # Shared utilities
```

## LAYOUT

Tabs use `react-resizable-panels`:

- Vertical/horizontal splits
- Nested panel groups
- Persisted layout state

## TAB MODEL

```typescript
const tabModel = useTabModel(tabId);
const blocks = jotai.useAtomValue(tabModel.blockIds);
```

## ADDING BLOCKS

```typescript
// Create and add
RpcApi.createBlockCommand(tabId, {
  view: "term",
  meta: { connection: "local" },
});
```

## LAYOUT PERSISTENCE

Layout saved in tab metadata:

- Panel sizes
- Block positions
- Split orientations

## FOCUS

- One block focused per tab
- Focus drives keyboard events
- Visual focus indicator
