---
name: kronterm-reliability-sweep
description: Find, prioritize, fix, and prevent KronTerm defects with evidence across Electron, React, Go, RPC, terminal, browser, sandbox, agent, and mobile surfaces. Use for bug sweeps, regressions, flaky tests, crashes, hangs, lifecycle failures, broken state restoration, or “fix all bugs” requests that need bounded, risk-ranked execution.
---

# KronTerm Reliability Sweep

Convert broad quality requests into verified, reviewable slices. Never claim that all bugs are fixed.

## Workflow

1. Define the surface, user journey, environment, and stop condition.
2. Reproduce before editing. Capture exact steps, expected behavior, actual behavior, logs, and affected build.
3. Rank by user harm, reach, data loss/security risk, reproducibility, and regression likelihood.
4. Trace the earliest incorrect state across renderer, preload, Electron main, RPC, Go service, or external process boundaries.
5. Add a failing test or deterministic check when practical, then implement the smallest root-cause fix.
6. Run the targeted test, adjacent suite, and relevant type or static checks.
7. Record unresolved risks and a next bounded batch.

## High-risk journeys

- App launch, upgrade, restore, window close, quit, and crash recovery
- Widget creation, focus, split, move, close, and presentation switching
- Terminal PTY lifecycle and remote reconnect
- Browser navigation, permission, download, and computer-use streaming
- KronosChamber process startup, session resume, approval, cancellation, and evidence display
- Sandbox isolation and host boundary handling
- iPhone host pairing, reconnect, keyboard, background/foreground, and secure storage

## Verification

Use Vitest for frontend behavior, Go package tests for backend changes, and existing Electron/mobile harnesses for integration paths. Never run `go build`. Separate new failures from pre-existing dirty-worktree failures.
