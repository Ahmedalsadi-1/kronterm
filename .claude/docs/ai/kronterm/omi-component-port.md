# Omi Component Port: KronTerm Developer Memory

Date: 2026-07-02

## What Landed

This pass ports Omi's product architecture into KronTerm-native seams instead of copying the Python/Firebase runtime.

## Ported Concepts

### Memories

Omi concept:

- Memories are extracted facts with a lifecycle layer.
- Legal layers are `short_term`, `long_term`, and `archive`.
- Records carry status, processing state, source/evidence, and promotion metadata.

KronTerm implementation:

- Shared renderer/main contracts: `frontend/types/developer-memory.ts`.
- MCP local store/runtime: `mcp-kron-term/src/developer-memory.ts`.
- MCP tools: `get_memories`, `get_memory`, `search_memories`, `create_memory`, `edit_memory`, `delete_memory`, `promote_memory`.

### Conversations -> Workspace Sessions

Omi concept:

- Conversations are upstream session records, not memories.
- Conversations carry transcript/session data and feed memory extraction.

KronTerm implementation:

- KronTerm maps conversations to developer workspace sessions.
- Session events cover terminal commands/errors, browser navigation, file changes, agent tools, sandbox events, and manual notes.
- MCP tools: `create_workspace_session`, `get_workspace_sessions`, `get_workspace_session`, `search_workspace_sessions`, `append_workspace_session_event`, `complete_workspace_session`.
- Omi-compatible aliases: `get_conversations`, `get_conversation_by_id`, `search_conversations`.

### Action Items

Omi concept:

- Workflow/action items are separate from memories but linked to sources.

KronTerm implementation:

- MCP tools: `get_action_items`, `search_action_items`, `create_action_item`, `update_action_item`, `complete_action_item`, `delete_action_item`.
- Action items can link to session IDs, memory IDs, and evidence.

### Action Registry

CopilotOne/Omi-adjacent concept:

- Apps/widgets should expose typed actions instead of forcing agents to infer capabilities.

KronTerm implementation:

- Shared action contracts in `frontend/types/developer-memory.ts`.
- MCP runtime registry in `DeveloperActionRegistry`.
- MCP tool: `developer_action_registry`.

### First Pipeline Adapter

Omi concept:

- Capture -> understand -> remember -> retrieve -> act.

KronTerm implementation:

- MCP tool: `ingest_workspace_event`.
- It records a workspace event, optionally saves a linked short-term memory, and optionally creates a linked action item.
- This is intentionally deterministic for now. LLM-based extraction and embedding search should plug in behind this seam later.

## Storage

The MCP implementation uses a local JSON store:

- Default path: `~/.kronterm/developer-memory.json`.
- Override: `KRONTERM_MEMORY_STORE` or `WAVETERM_MEMORY_STORE`.

This is deliberately local-first. Cloud sync, encryption, redaction, and workspace UI should come after the product contract is stable.

## Next Integration Points

1. Wire terminal command completion and error events into `ingest_workspace_event`.
2. Add a "Remember This" UI action for terminal selections, AI messages, diffs, and browser pages.
3. Add a workspace resume card backed by `get_workspace_sessions`, `get_memories`, and `get_action_items`.
4. Replace lexical memory search with embeddings once workspace snapshot embeddings exist.
5. Add a privacy ledger UI before automatic capture is enabled by default.
6. Move the local store behind a KronTerm main-process service when renderer UI needs direct access.

## Validation

- `npm run build` passes in `mcp-kron-term`.
