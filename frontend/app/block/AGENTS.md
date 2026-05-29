# frontend/app/block — Block System

**Parent:** `../AGENTS.md`

## OVERVIEW

Block components and management. Blocks are the fundamental content units.

## STRUCTURE

```
block/
├── block.tsx           # Block component
├── blocktypes.ts       # TypeScript types
├── blockutil.ts        # Block utilities
└── block-registry.ts   # View type registry
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

Register new view in `block-registry.ts`:

```typescript
BlockRegistry.register("myview", MyViewModel, MyViewComponent);
```

## CREATE BLOCK

```typescript
RpcApi.createBlockCommand(tabId, blockDef);
```
