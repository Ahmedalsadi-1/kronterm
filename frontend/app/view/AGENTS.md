# frontend/app/view — View Components

**Parent:** `../AGENTS.md`

## OVERVIEW

Block view implementations. Each view type renders specific content in blocks.

## STRUCTURE

```
view/
├── term/           # Terminal (xterm.js)
├── waveai/         # AI chat
├── preview/        # File preview (images, PDFs, etc)
├── codeeditor/     # Monaco editor
├── webview/        # Web browser
├── vdom/           # Virtual DOM (tsunami)
├── waveconfig/     # Settings UI
└── ...
```

## VIEW MODEL PATTERN

```typescript
export class MyViewModel {
  blockId: string;
  someAtom = jotai.atom("initial");

  constructor(blockId: string) {
    this.blockId = blockId;
  }
}
```

## CREATE VIEW

See `.kilocode/skills/create-view/SKILL.md` for:

- Creating ViewModel
- Registering in BlockRegistry
- Implementing View component

## KEY FILES

| View    | Model                      | Component             |
| ------- | -------------------------- | --------------------- |
| term    | `term/term-model.ts`       | `term/term.tsx`       |
| waveai  | `waveai/waveai-model.ts`   | `waveai/waveai.tsx`   |
| preview | `preview/preview-model.ts` | `preview/preview.tsx` |
