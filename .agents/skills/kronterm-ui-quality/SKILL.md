---
name: kronterm-ui-quality
description: Audit and improve KronTerm desktop UI quality across widgets, tabs, canvas, settings, browser, terminal, and KronosChamber. Use for visual polish, interaction consistency, accessibility, responsive layout, motion, information hierarchy, or native macOS/iOS-like feel in frontend React, Tailwind, or SCSS work.
---

# KronTerm UI Quality

Create a calm, precise, agent-native workspace that combines the immediacy of a native Apple app, the editing clarity of Cursor, the agent control of Codex, and browser intelligence without copying their branding.

## Workflow

1. Inspect the current screen and the relevant component, styles, model, tests, and recent diff before editing.
2. Identify the user's primary job and one memorable interaction. Preserve KronTerm's `widgets`, `tabs`, and `canvas` presentations.
3. Define acceptance criteria for hierarchy, keyboard use, focus, empty/loading/error states, reduced motion, contrast, and narrow widths.
4. Reuse existing tokens and components. Prefer Tailwind v4 for new styles, `cn()` for class merging, and `cva` for variants.
5. Make the smallest coherent change. Keep all hooks above conditional returns and add `cursor-pointer` to clickable controls.
6. Verify with targeted tests and a rendered screenshot at relevant desktop and mobile sizes.

## Product rules

- Make the interface feel native through rhythm, feedback, focus behavior, command-first navigation, and predictable state—not through ornamental imitation.
- Keep agent activity legible: distinguish thinking, tool use, approval, blocked, failure, and completion.
- Keep chrome quiet and content dominant. Use one accent hierarchy and avoid competing glows, borders, badges, or floating controls.
- Preserve user context across views and make transitions between terminal, browser, editor, files, and agent surfaces explicit.
- Treat Labs features as Labs; never imply general availability.

## Key paths

- Workspace presentations: `frontend/app/tab/`, `frontend/app/workspace/`
- Shared block chrome: `frontend/app/block/`
- KronosChamber: `frontend/app/view/chathubv2/`, `frontend/app/aipanel/`
- Theme and shared styles: `frontend/app/theme.scss`, `frontend/tailwindsetup.css`
- iPhone Labs client: `mobile/src/`

## Verification

Run the narrowest relevant Vitest target and `task check:ts`. For visual changes, compare screenshots for hierarchy, clipping, focus indication, pointer targets, and reduced-motion behavior. Report pre-existing failures separately.
