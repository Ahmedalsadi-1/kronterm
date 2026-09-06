# Kronos tool parity ledger

This ledger tracks the Hermes compatibility runtime underneath Kronos. “Parity” means the capability is reachable through
Kronos with equivalent scope, approval behavior, cancellation, output limits, and
user-visible evidence. Matching a tool name alone is not parity.

## Inventory baseline

- KronosCode currently contains **139 literal `Tool.define(...)` registrations** under
  `kronoscoder/packages/kronoscode/src/tool/`. This excludes dynamically generated desktop and automation tools, so it is
  a lower bound.
- The scoped KronTerm TypeScript runtime currently exposes **136 tools** from `mcp-kron-term/src/index.ts`; Hermes registers
  that live manifest through the bundled `kronterm-tools` backend plugin.
- Kronos's compatibility runtime also supplies native file, patch, shell, web, browser, computer-use, delegation, memory, skill, terminal,
  preview, project, media, and plugin tool families.
- The two counts are not expected to match: KronosCode has several aggregate tools while the MCP server exposes smaller,
  auditable operations, and Hermes replaces some KronosCode tools with native equivalents.

Reproduce the counts:

```bash
perl -0777 -ne 'while (/Tool\.define\(\s*"([^"]+)"/g) { print "$1\n" }' \
  kronoscoder/packages/kronoscode/src/tool/*.ts | sort -u | wc -l
perl -0777 -ne 'while (/server\.tool\(\s*"([^"]+)"/g) { print "$1\n" }' \
  mcp-kron-term/src/index.ts | sort -u | wc -l
```

## Capability status

| Capability family                                                    | Hermes path                                                                     | Status                        | Remaining parity work                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| File read/write/search/patch                                         | Hermes native file tools                                                        | Available                     | Add equivalence tests for KronosCode edit and multiedit edge cases.                                  |
| Shell and terminal execution                                         | Hermes native terminal plus KronTerm `terminal_*` and `block_run_command` tools | Available                     | Verify cancellation, process death, and scrollback truncation end to end.                            |
| KronTerm blocks, tabs, layout, badges, backgrounds, notifications    | Native TypeScript bridge                                                        | Available                     | Convert remaining aggregate KronosCode convenience verbs only when they add real semantics.          |
| Browser navigation and inspection                                    | KronTerm `browser_*`, `widget_*`, and Hermes browser/computer-use tools         | Available                     | Build a scenario matrix for dialogs, downloads, uploads, hidden pages, and compromised page content. |
| Native desktop control                                               | KronTerm `kron_computer_*` native tools                                         | Available                     | Validate app allowlists, approval copy, interruption, and screen-data redaction.                     |
| Sandbox desktop control                                              | KronTerm `sandbox_*` native tools                                               | Available                     | Add lifecycle recovery and denied/malformed action tests.                                            |
| Canvas load/edit/render/launch/assets                                | KronTerm `canvas_*` native tools                                                | Available                     | Add renderer integration tests and larger-scene performance limits.                                  |
| Packaged, project, and user skills                                   | KronTerm `shared_skill_list` and `shared_skill_read` native tools               | Available                     | Add richer provenance/version display in Kronos.                                                     |
| Managed widget JWT/profile routing                                   | Rotating capability file plus profile-scoped REST/WS URLs                       | Available                     | Add multi-window contention coverage if separate managed runtimes are introduced.                    |
| Workspace memory, conversations, action items, sessions              | Native TypeScript bridge                                                        | Available                     | Decide which data remains KronTerm-owned versus Hermes-native memory before bidirectional sync.      |
| Secrets, SSH/WSL connections                                         | Native TypeScript bridge                                                        | Available, approval-sensitive | Add explicit approval and audit tests for reads, mutation, and remote connection changes.            |
| LSP/code intelligence                                                | KronTerm `lsp_*` tools through the Electron LSP service                         | Scoped bridge complete        | Add server discovery/status, cancellation tests, and packaged-server availability diagnostics.       |
| Planning, todos, questions, context compaction                       | Hermes-native session tools                                                     | Partial equivalent            | Map durable state and resume semantics; do not replay side effects during recovery.                  |
| Specialist workers, swarm discovery, consensus, agent forge, handoff | Hermes delegation and plugin system                                             | Not migrated                  | Preserve stable worker identity, budgets, cancellation, evidence, and terminal states.               |
| Screenpipe recall and ambient context                                | No enabled Hermes bridge                                                        | Not migrated                  | Threat-model capture scope, retention, consent, and secret exposure before implementation.           |
| Ghost staging/autosave/snapshots                                     | Mixed Hermes and git capabilities                                               | Not migrated                  | Define recovery semantics and prove reversibility before exposing writes.                            |
| Provider adapters and model routing                                  | Hermes provider/runtime system                                                  | Partial equivalent            | Migrate KronosCode-specific provider policy, fallback, quotas, and normalized error behavior.        |
| Dynamic tool creation and ACP proxying                               | Hermes plugins/MCP                                                              | Not migrated                  | Require signed provenance, bounded registration, collision handling, unload cleanup, and approvals.  |
| Kronos micro-widgets for KronTerm surfaces                           | Bundled `kronterm-surfaces` plugin                                              | First slice complete          | Add create/split/canvas-placement UI actions; equivalent actions already exist in the scoped MCP.    |

## Automated parity gate

`mcp-kron-term/test/hermes-tool-parity.test.ts` compares the native bridge manifest with the production server registration
and asserts that Hermes receives every registered KronTerm tool, plus focused contracts for terminal, browser,
native desktop, sandbox, canvas, and LSP families. It also checks
read/write/destructive annotations, schema rejection, coordinate validation before runtime observation, and fail-closed
behavior when a destructive target runtime is unavailable.

```bash
npm --prefix mcp-kron-term test
```

## Safety gate for every remaining row

A row moves to **Available** only after tests cover allowed, denied, malformed, repeated, interrupted, and untrusted-content
paths. Write-capable MCP tools must declare accurate annotations; missing read-only metadata is treated as write-capable by
Hermes. Browser text, terminal output, repository content, downloaded files, and tool results never expand authority.

## Next implementation slices

1. Add LSP server discovery/status plus cancellation and real-server integration coverage.
2. Map KronosCode specialists onto Hermes delegation with durable worker IDs, cancellation, budgets, and evidence.
3. Add individually permissioned surface creation and split-placement actions to the KronTerm Surfaces plugin.
