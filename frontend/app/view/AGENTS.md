# frontend/app/view — View Components

**Parent:** `../AGENTS.md`

## OVERVIEW

Block view implementations. Each view type renders specific content in blocks.

## STRUCTURE

```
view/
├── term/            # Terminal (xterm.js)
├── webview/         # Web browser widget
├── preview/         # File preview (images, PDFs, etc)
├── codeeditor/      # Monaco editor + LSP integration
├── chathubv2/       # KronosChamber V2 block view (has its own AGENTS.md)
├── kronoschamber/   # KronosChamber classic surface
├── kronoscanvas/    # Spatial canvas workspace (+ canvas-cowork sync)
├── kronsettings/    # KronSettings UI
├── appstream/       # Computer-use application streams
├── sandbox/         # Kron Sandbox desktop VM views
├── hermes/          # Hermes agent widget host
├── aifilediff/      # AI file diff viewer
├── waveai/          # Legacy AI chat panel
├── waveconfig/      # AI model config visuals
├── tsunami/, vdom/  # Tsunami VDOM views
└── ...              # launcher, sysinfo, installedapps, helpview, quicktipsview, design
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

| View     | Model                        | Component               |
| -------- | ---------------------------- | ----------------------- |
| term     | `term/term-model.ts`         | `term/term.tsx`         |
| waveai   | `waveai/waveai-model.ts`     | `waveai/waveai.tsx`     |
| preview  | `preview/preview-model.ts`   | `preview/preview.tsx`   |
| chathubv2 | `chathubv2/chathubv2-model.ts` | `chathubv2/chathubv2.tsx` |
