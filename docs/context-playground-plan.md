# KronTerm Context Playground Plan

## Product decision

`WorkspaceCanvas` is the canonical spatial surface. It already hosts real KronTerm blocks, including browser, terminal,
and sandbox views. The separate `KronosCanvas` implementation remains a source of semantic graph behavior, but its
node lineage, snapshots, and outline model should move into the universal workspace rather than becoming a competing
canvas experience.

The memorable behavior is: **the agent leaves a useful, editable trail of its work on the same canvas where the work
happens**.

## Current status

Phase 1 is implemented in the tab-level workspace canvas:

- agent activity becomes persistent, movable semantic cards;
- low-level browser gestures update one evolving surface card instead of flooding the canvas;
- explicit and inferred lineage renders as visible graph edges;
- the real KronosChamber composer is embedded as a compact canvas console and anchors to the live canvas viewport;
- project context, file/agent mentions, commands, shell mode, model selection, and native KronosChamber submission remain
  available without duplicating their UI in KronTerm;
- Follow and Quote selections are included in the submitted prompt;
- submitted prompts appear immediately as queued request cards;
- the creation dock and context composer remain separate at narrow canvas widths.

The durable `CanvasDocument` RPC mirror, checkpoint restart, and cross-canvas recall remain planned work.

## Interaction model

- A live block is the working surface.
- Agent work appears as semantic cards beside that surface.
- Cards advance through `queued`, `running`, `verifying`, and terminal phases without duplicating themselves.
- Edges show which request or result supplied context to a later action.
- **Follow** selects one card and continues its lineage.
- **Quote** selects several cards and combines them as explicit context.
- The canvas uses KronosChamber's real composer as its only primary prompt entrance; the generic quick composer remains
  available outside the canvas.
- Follow and Quote transform the outgoing prompt at the iframe boundary, so the user-facing text stays concise while
  the runtime receives readable canvas context.
- A submitted canvas prompt appears immediately as a queued request card.
- Browser, sandbox, terminal, file, and planning events update or create cards through the existing agent-activity
  stream.

## Data model

The first implementation stores agent cards in the existing versioned `layout:canvas` tab metadata. This preserves
camera, live block rectangles, notes, and execution history atomically with the tab.

Each agent card contains:

- stable activity or request identity;
- run, parent/context, block, surface, action, and source identifiers;
- phase, verification, error, and timestamps;
- visible title, detail, reasoning steps, and optional evidence preview;
- canvas rectangle.

The next persistence step is to mirror these cards into the existing `CanvasDocument` RPC model. That creates one
queryable semantic graph for agent recall, snapshots, and cross-session search without blocking the interaction work.

## Acceptance criteria for the first slice

1. Opening a canvas always exposes the canvas-aware composer, even when the global quick-composer preference is off.
2. One activity ID produces one card that updates as its phase changes.
3. Distinct browser, sandbox, terminal, file, desktop, and planning work can produce distinct cards.
4. The first activity after a canvas submission is connected to the optimistic request card.
5. Explicit activity parent IDs are preserved as graph context.
6. Follow mode selects one primary card.
7. Quote mode supports multiple selected cards.
8. The submitted AI prompt contains readable selected-card context and the user's original request.
9. Agent cards can be moved and persist with the rest of the workspace canvas.
10. Active, successful, failed, and approval states are visually distinguishable without relying only on color.
11. Keyboard focus, selection buttons, and reduced-motion behavior remain available.

## Remaining phases

### Phase 2: durable semantic graph

- Mirror agent cards and edges to `CanvasCreateNode`, `CanvasUpdateNode`, and `CanvasConnectNodes`.
- Hydrate the universal canvas from `CanvasLoad`.
- Add idempotency for event replay and batch recovery.

### Phase 3: live-surface choreography

- Anchor activity cards to their browser/sandbox/terminal block.
- Trace the active edge and cursor identity during execution.
- Collapse completed live surfaces into evidence cards with resume controls.
- Add automatic branch and batch layout.

### Phase 4: recipes and checkpoints

- Represent plans, approvals, retries, and completion as first-class node types.
- Restart execution from a selected checkpoint.
- Expose remaining work and failure rerouting in the graph.

### Phase 5: library and recall

- Add recent canvases, reusable recipes, and starter playbooks.
- Index semantic cards for cross-canvas recall.
- Let agents read another canvas without moving the user's active view.
