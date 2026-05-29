# Widget Runtime Milestone 1
Date: 2026-05-18

## Goal

Deliver one dependable closed loop for agents operating a live web widget:

1. inspect the widget
2. receive stable actionable refs
3. perform a semantic action
4. verify the result

## In Scope

- `widget_snapshot`
- `widget_find`
- `widget_inspect`
- `widget_click`
- `widget_set_value`
- `widget_select`
- `widget_toggle`
- `widget_get_value`
- `widget_wait_condition`

## Required Product Behavior

- If a DOM element lacks a native ID/name/ARIA label, KronTerm assigns a stable runtime ref.
- Refs returned by inspection tools remain reusable by action tools.
- Core semantic actions return whether the target was actually found and acted on.
- The preload layer handles the human-simulation channels that the tab runtime emits.
- The agent can reason over available capabilities through a compact capability summary.
- Permission rules can be introduced without replacing the existing approval UI flow.

## Done So Far

- Added missing webview preload handlers for widget and low-level human-sim actions.
- Added stable `data-wave-ref` assignment in snapshot/find/element-at flows.
- Converted click/set/select/toggle to awaited DOM execution with real success/failure results.
- Added isolated capability registry foundation.
- Added isolated permission-rules foundation.
- Began live integration:
  - capability summary generation
  - optional policy override path in tool approval creation

## Next After Milestone 1

1. Add request/response acknowledgements for the remaining fire-and-forget webview actions.
2. Introduce a formal widget adapter interface instead of keeping all logic in `TabClient`.
3. Fold terminal and sandbox surfaces into the same adapter vocabulary.
4. Then build `Pin as Widget` and broader desktop-surface projection on top of the common runtime.
