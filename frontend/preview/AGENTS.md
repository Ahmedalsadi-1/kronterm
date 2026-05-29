# frontend/preview — Standalone Preview Server

**Parent:** `../AGENTS.md`

## OVERVIEW

Vite-based preview server for testing frontend components without Electron or backend. Serves at localhost:7007.

## STRUCTURE

```
preview/
├── vite.config.ts          # Vite configuration
├── index.html              # Entry HTML
├── preview.tsx             # Preview app root
├── preview-contextmenu.tsx # Context menu preview
├── preview.css             # Preview styles
├── previews/               # Individual component previews
│   └── *.tsx               # Preview components
└── mock/                   # Mock data and services
    └── *.ts                # Mock implementations
```

## STARTING

```bash
task preview
# or: cd frontend/preview && npx vite
```

Static build: `task build:preview`

## DO NOT

- `npm run dev` — launches Electron
- `npm run start` — launches Electron
- `npx vite` from root — wrong config
- Serve `dist/` — preview not built there

## PREVIEW COMPONENTS

Each preview in `previews/` demonstrates a component:
- Terminal views
- AI panel
- Block layouts
- UI elements

## MOCK SYSTEM

`mock/` provides:
- Mock RPC responses
- Fake store implementations
- Simulated WPS events

## WAVEENV

Previews use WaveEnv narrowing for mock environments.
See `.kilocode/skills/waveenv/SKILL.md`.
