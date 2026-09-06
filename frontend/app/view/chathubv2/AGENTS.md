# view/chathubv2 — KronosChamber V2 Block View

**Parent:** `../AGENTS.md`

## OVERVIEW

Block view (`viewType: "chathubv2"`) for the managed KronosChamber runtime. UI-only; process/PTY/health/credentials live in `emain/chathubv2-*.ts`.

## STRUCTURE

| File                       | Role                                        |
| -------------------------- | ------------------------------------------- |
| `chathubv2.tsx`            | View component                              |
| `chathubv2-model.ts`       | `ChatHubV2ViewModel` (implements `ViewModel`) |
| `chathubv2-state.ts`       | Jotai state                                 |
| `chathubv2-bridge.ts`      | Connection to Electron-side runtime         |
| `chathubv2-composer.ts`    | Input/composer logic                        |
| `chathubv2-activity.ts(x)` | Agent activity/status feed                  |
| `index.ts`                 | Re-exports `ChatHubV2ViewModel`             |

## CONVENTIONS

- Co-located `*.test.ts` per module — run with `npx vitest run <file>`
- ViewModel pattern per `.kilocode/skills/create-view/SKILL.md`
- This dir consumes runtime state pushed from `emain/`; it never manages processes itself

## ANTI-PATTERNS

- Direct process/PTY access from the view — go through bridge/state
- Copying legacy `kronoschamber/` or `waveai/` logic into here instead of sharing
