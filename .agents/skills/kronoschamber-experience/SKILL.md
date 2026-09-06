---
name: kronoschamber-experience
description: Improve KronosChamber's agent chat, control, context, approval, activity, task, artifact, diff, and evidence experiences. Use when editing `frontend/app/view/chathubv2/`, AI panel components, agent overlays, task graphs, context selection, session controls, or the managed KronosCode runtime presentation.
---

# KronosChamber Experience

Make agent work understandable and controllable at a glance while keeping the conversation calm.

## State model

Represent queued, starting, thinking, tool-running, awaiting approval, blocked, cancelling, failed, and completed states distinctly. Never collapse “no output yet,” “idle,” and “failed” into the same presentation.

## Workflow

1. Start with the user decision the interface must support.
2. Trace state from runtime event to model/atom to rendered control and persisted session.
3. Put high-frequency actions near the composer; put durable project/history navigation in stable chrome; reveal advanced diagnostics progressively.
4. Show what the agent is doing, why approval is needed, what changed, and where evidence came from.
5. Preserve cancellation and recovery paths. Avoid optimistic completion before runtime confirmation.
6. Verify keyboard navigation, screen-reader naming, narrow widths, long content, reconnect, and session resume.

## Experience principles

- Conversation is the control surface; artifacts, diffs, terminals, and browsers remain live workspace objects.
- Context must be inspectable, removable, and scoped—not mysterious.
- Approvals must explain target, consequence, and reversibility.
- Activity should be summarized by default with inspectable detail.
- Evidence links should reopen the exact relevant block, file, task, or artifact where possible.

Key paths include `frontend/app/view/chathubv2/`, `frontend/app/aipanel/`, `frontend/app/view/use-agent-overlays.ts`, and `emain/chathubv2-*.ts`.
