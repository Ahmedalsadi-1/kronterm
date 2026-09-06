# frontend/layout — Layout Engine

**Parent:** `../AGENTS.md`

## OVERVIEW

Tiled layout engine powering the widgets/tabs workspace presentations.

## STRUCTURE

```
layout/
├── index.ts            # Public exports
├── lib/
│   ├── layoutModel.ts  # Core model (largest file; split/resize/reflow logic)
│   ├── layoutTree.ts   # Tree operations
│   ├── layoutNode.ts   # Node shape and types
│   ├── layoutAtom.ts   # Jotai atom wiring
│   ├── TileLayout.tsx  # React rendering component
│   └── drag-preview.ts # Drag ghost rendering
└── tests/              # Centralized here, NOT co-located
    ├── layoutTree.test.ts
    ├── layoutNode.test.ts
    ├── utils.test.ts
    └── model.ts        # Test helpers
```

## WHERE TO LOOK

| Task                          | Location              |
| ----------------------------- | --------------------- |
| Split/resize/magnify behavior | `lib/layoutModel.ts`  |
| Tree insert/remove/replace    | `lib/layoutTree.ts`   |
| Node types                    | `lib/layoutNode.ts`   |
| Rendering                     | `lib/TileLayout.tsx`  |

## TESTS

Centralized in `tests/` (unlike the co-located convention elsewhere in the repo):
`npx vitest run frontend/layout/tests/layoutTree.test.ts`
