# frontend/app/block — Block System

**Parent:** `../AGENTS.md`

## OVERVIEW

Block components and management. Blocks are the fundamental content units.

## STRUCTURE

```
block/
├── block.tsx                     # Block component + BlockRegistry (view type registry)
├── block-model.ts                # Block state model
├── blocktypes.ts                 # TypeScript types
├── blockutil.tsx                 # Block utilities
├── blockframe.tsx                # Block frame chrome (+ blockframe-header.tsx)
├── agent-widget-*.ts(x)          # Agent widget system: settings, shortcuts, action button
├── surface-chrome.ts             # Surface chrome helpers
├── widget-focus-utils.ts         # Widget focus utilities
├── folded-store.ts               # Folded-widget store
├── block-context-ribbon.tsx      # Block context ribbon
└── durable-session-flyover.tsx   # Durable SSH session flyover
```

## BLOCK LIFECYCLE

1. Created via `CreateBlockCommand`
2. View determined by `BlockDef.View`
3. ViewModel instantiated from registry
4. Component renders based on view type

## BLOCK DEF

```typescript
interface BlockDef {
  view: string; // "term", "preview", etc
  meta?: MetaMapType; // Block settings
  targetPos?: number; // Layout position
}
```

## VIEW REGISTRY

Register new view in `block.tsx` (BlockRegistry):

```typescript
BlockRegistry.register("myview", MyViewModel, MyViewComponent);
```

## CREATE BLOCK

```typescript
RpcApi.createBlockCommand(tabId, blockDef);
```
