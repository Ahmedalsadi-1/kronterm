---
name: kronoscode-evals-observability
description: Add privacy-aware evaluation and observability for KronosCode agent quality, latency, reliability, tool use, approvals, recovery, and user outcomes. Use for eval suites, trace schemas, structured events, dashboards, regression corpora, agent performance investigations, or release quality gates.
---

# KronosCode Evals and Observability

Measure whether agents complete useful work safely—not whether they merely produce plausible text.

## Evaluation workflow

1. Define the capability, user outcome, failure taxonomy, dataset source, and pass threshold.
2. Prefer deterministic checks for state, files, commands, tests, tool arguments, and artifacts; use model judges only for genuinely semantic qualities.
3. Include success, refusal, malformed input, missing tool, approval denial, cancellation, timeout, reconnect, and resume cases.
4. Record model/provider/version, configuration, environment, duration, tool count, retries, approvals, token/cost data when available, and final outcome.
5. Compare against a pinned baseline and inspect regressions by failure class.

## Observability rules

- Use structured event names and correlation IDs across renderer, Electron main, ACP process, and tool execution.
- Separate user content from operational metadata; redact secrets and minimize retention.
- Measure time to first useful activity, time awaiting approval, tool failure rate, cancellation success, recovery rate, and task completion.
- Make diagnostics exportable and understandable without exposing hidden reasoning.

Tests and local traces are the first observability surface. External telemetry must remain optional, documented, and privacy-controlled.
