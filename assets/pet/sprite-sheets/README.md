# Desktop Pet Developer Actions

This pack extends the existing KronTerm pet with developer-assistant poses while preserving the white, gray, and charcoal pixel-art design.

## Assets

- `developer-actions-1280.png`: transparent 4x4 master sheet, 320x320 pixels per cell.
- `typing-sheet.png`: four laptop and typing frames.
- `app-sheet.png`: four app-inspection and interaction frames.
- `tests-sheet.png`: four test-running and investigation frames.
- `resolve-sheet.png`: four fix, rerun, celebration, and idle frames.
- `developer-actions/<sequence>/`: the same artwork exported as individual transparent 320x320 PNG frames.
- `developer-actions-chroma.png`: original generated source with a removable chroma-key background.
- `developer-actions.png`: transparent source at the generator's native 1254x1254 resolution.

Five additional state-aware packs live under `iterations/`. See `iterations/README.md` for their row semantics, runtime mapping, and generation prompt set.

## Generation prompt

The built-in image generator used the existing `kronterm-pet-pose1.png`, `kronterm-pet-pose2.png`, and `kronterm-pet-pose3.png` files as strict character and style references with this prompt:

> Create one coherent 4-by-4 sprite sheet, exactly 16 equal square cells, showing the same KronTerm pet doing developer-assistant actions. Row 1: sit at a tiny dark laptop, open laptop, begin typing, rapid typing. Row 2: inspect an app window, peer closer, point at UI, tap the window. Row 3: run software tests, watch progress, react to one failure, investigate carefully. Row 4: fix the issue, rerun tests, celebrate success, settle into a satisfied idle pose. Match the references' crisp polished pixel art, chunky stepped pixels, white/gray/charcoal palette, clean silhouette, proportions, scale, pixel density, and baseline. Use a flat solid green chroma-key background with no grid lines. Keep one complete pose centered in every cell. Accessories are limited to a small dark laptop, minimal floating app panel, and tiny test-status symbols. No written words, letters, numbers, labels, logos, watermark, shadows, reflections, green subject pixels, cropped parts, duplicated limbs, extra characters, or painterly/3D rendering.
