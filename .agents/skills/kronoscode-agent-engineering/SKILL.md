---
name: kronoscode-agent-engineering
description: Design and improve KronosCode's ACP agent execution engine, session lifecycle, provider adapters, context assembly, streaming, cancellation, approvals, tool results, artifacts, and durable recovery. Use for `agents/kronoscode/`, `emain/acp/`, `emain/kronoscode-runtime.ts`, or managed agent runtime behavior.
---

# KronosCode Agent Engineering

Build predictable agent behavior with explicit state, bounded authority, durable evidence, and recoverable execution.

## Workflow

1. Write the user-visible contract and runtime state machine before implementation.
2. Trace inputs from project/context selection through ACP transport, provider execution, tool calls, events, persistence, and UI projection.
3. Give every session and operation stable identity, ordering semantics, cancellation, timeout, retry budget, and terminal state.
4. Make adapters normalize provider differences without erasing useful capabilities.
5. Separate model text, reasoning/activity summaries, tool intents, approvals, results, artifacts, and errors.
6. Persist enough state to resume safely; never replay side effects merely to reconstruct the UI.
7. Add deterministic tests for event ordering, duplicate events, malformed messages, cancellation races, process death, and resume.

## Boundaries

- `agents/kronoscode/`: packaged ACP boundary
- `emain/acp/`: protocol and agent management
- `emain/kronoscode-runtime.ts`: managed process lifecycle
- `emain/chathubv2-*.ts`: chamber transport and session services
- `frontend/app/view/chathubv2/`: user-facing projection

Prefer boring, inspectable state machines over implicit orchestration. Keep compatibility identifiers unchanged unless migration is the task.
