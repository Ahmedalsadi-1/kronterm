---
name: kronterm-release-readiness
description: Assess KronTerm changes against private-beta release gates for functionality, regression risk, security, privacy, performance, accessibility, packaging, migration, observability, documentation, and support. Use before releases, beta milestones, packaging, launch claims, or declaring a large feature complete.
---

# KronTerm Release Readiness

Require evidence proportional to risk and distinguish desktop, website, and Labs mobile readiness.

## Gate sequence

1. Scope: list included behavior, excluded behavior, compatibility impact, and rollback path.
2. Correctness: map acceptance criteria to tests and manual evidence.
3. Reliability: verify launch, upgrade, restore, reconnect, cancellation, and failure recovery.
4. Security/privacy: check trust boundaries, secrets, permissions, telemetry, retention, and user controls.
5. Experience: verify keyboard, accessibility, narrow layouts, empty/loading/error states, and performance budgets.
6. Distribution: verify generated artifacts, signing/notarization expectations, configuration migrations, and release notes.
7. Operations: define diagnostics, support triage, known issues, staged rollout, and stop/rollback signals.

## Required outcome

Return `ready`, `ready with explicit risks`, or `not ready`. Attach evidence for each satisfied gate and owners for remaining work. Never promote Labs functionality to generally available through copy alone.
