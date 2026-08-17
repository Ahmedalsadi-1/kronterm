---
name: kronterm-electron-hardening
description: Harden KronTerm's Electron main, preload, renderer, native bridges, managed runtimes, windows, permissions, and packaging without replacing established architecture. Use when editing `emain/`, `preload.ts`, frontend-to-Electron APIs, BrowserWindow behavior, IPC, app lifecycle, code signing, updates, or Electron security and performance.
---

# KronTerm Electron Hardening

Apply secure Electron practices through KronTerm's existing API and RPC boundaries.

## Required context

Read `.kilocode/skills/electron-api/SKILL.md` before adding frontend-to-Electron IPC. Inspect `emain/preload.ts`, `emain/emain-ipc.ts`, `frontend/types/custom.d.ts`, and the nearest tests.

## Workflow

1. Map the caller, trust boundary, input shape, authority, side effect, response, cancellation, and cleanup path.
2. Keep renderer code behind typed `getApi()` functions. Never expose raw `ipcRenderer` or Node primitives.
3. Validate renderer-controlled values in the main process and scope capabilities narrowly.
4. Make subscriptions return cleanup functions; make startup, retry, cancellation, window close, and app quit idempotent.
5. Preserve compatibility identifiers and KronTerm's existing build/packaging stack.
6. Add tests for allowed behavior, malformed input, repeated calls, and teardown.

## Review checklist

- Context isolation, sandboxing, Node integration, navigation, popup, permission, and external URL policy
- IPC sender validation, path/URL validation, secret handling, and error serialization
- Child process ownership, signals, restart budgets, logs, and orphan prevention
- Window state restoration, multi-window synchronization, memory leaks, and background work
- Signing, notarization, update integrity, CSP, and production diagnostics

Use the installed `electron-best-practices` skill as a reference, but KronTerm conventions and compatibility constraints take precedence.
