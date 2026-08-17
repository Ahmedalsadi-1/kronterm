# KronTerm Pet Animation Iterations

Five production-ready 4-by-4 animation packs extend the existing pet without changing its white, gray, and charcoal pixel-art identity. Every pack includes a transparent 1280-by-1280 master and sixteen transparent 320-by-320 frames.

| Pack                    | Rows 1–4                                                                   | Runtime use                    |
| ----------------------- | -------------------------------------------------------------------------- | ------------------------------ |
| `terminal-operator`     | keyboard input; log watching; command progress/success; failure/recovery   | Terminal activity and results  |
| `browser-scout`         | opening a page; clicking/scrolling; inspecting/capturing; recovery/success | Browser computer use           |
| `code-review-detective` | reading; close inspection; deciding; resolving                             | Files, diffs, and review work  |
| `sandbox-builder`       | opening a workspace; building; completion; recovery                        | Sandboxes and controlled apps  |
| `expressive-status`     | calm idle; thinking; approval/warning/failure/paused; active/success       | General agent lifecycle states |

## Files

Each pack contains:

- `source-chroma.png`: the image generator's original green-screen output.
- `master-native.png`: transparent output at the generator's native dimensions.
- `master-1280.png`: normalized 4-by-4 master sheet.
- `frames/frame-1.png` through `frames/frame-16.png`: row-major animation frames.

## Generation prompt set

All five sheets were generated with the built-in image generator and the existing KronTerm pet artwork as strict character references. The shared direction was: one coherent 4-by-4 sheet with exactly sixteen equal cells; the same complete pet centered at a consistent scale and baseline; crisp chunky pixel art; white, cool gray, and charcoal palette; only small task-specific props; solid removable green background; no grid, text, logos, watermark, cropped parts, duplicate limbs, extra characters, gradients, painterly rendering, or 3D rendering.

The five prompt variations were:

1. **Terminal Operator:** type at a compact keyboard, enter a command, watch logs stream, monitor progress, celebrate a passing command, react to an error, debug, and recover.
2. **Browser Scout:** open a browser card, point and click, scroll, inspect page regions with a magnifier, capture a view, encounter a page problem, retry, and confirm success.
3. **Code Review Detective:** read a file, compare code and diff cards, inspect a suspicious line, reason through a decision, mark an issue, apply a fix, verify it, and approve the result.
4. **Sandbox Builder:** open a contained workspace, assemble app blocks, connect parts, run the build, inspect progress, complete the environment, encounter a broken build, repair it, and relaunch.
5. **Expressive Status:** calm idle and breathing poses, thinking poses, awaiting approval, warning, failure, paused, energetic active states, and successful celebration.
