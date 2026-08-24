# Kronos Agent Runtime

Kronos is KronTerm's built-in persistent agent. It uses Nous Research Hermes Agent as a compatibility runtime while
KronTerm owns its product identity, scoped authority, prompts, native tool registration, skill catalog, profile routing, and
workspace presentation. Internal `hermes` identifiers remain compatibility-sensitive and are not user-facing branding.

## Upstream

- Repository: `https://github.com/NousResearch/hermes-agent.git`
- Pinned commit: `fc9cbc872d8050c22f1192b16bc5ff4aed471e10`
- Local read-only checkout: `third_party/upstream/hermes-agent`
- Reproducible provenance: `third_party/source-imports/hermes-agent.lock.json`

The upstream checkout is ignored by KronTerm Git. Ported code belongs in KronTerm-owned modules; do not import production code directly from the checkout.

## Runtime Boundary

Kronos runs through the Hermes ACP/managed-server compatibility boundary (`hermes acp` or `hermes serve`). A bundled
Hermes backend plugin registers the KronTerm catalog as ordinary Hermes function tools. Its thin Python adapter invokes
the bundled TypeScript bridge directly, so KronTerm sessions do not depend on Hermes' optional Python MCP SDK.

The managed widget stores a temporary surface capability in a mode-`0600` file and refreshes it before expiry. The TypeScript
bridge rereads that file before every WSH action, so token rotation does not require persisting raw JWTs in profile config
or restarting Hermes. REST and WebSocket requests include the selected profile route, allowing the Kronos widget
to control named profiles through the unified backend.

The native TypeScript tool bridge is the control plane for:

- browser and widget inspection/input;
- terminal creation, scrollback, and commands;
- canvas graph inspection and mutation;
- sandbox desktop observation and input;
- native desktop accessibility/computer use;
- blocks, layout, files, connections, and workspace state.

Every ACP session and managed Kronos widget receives a system contract that establishes the Kronos identity, treats the
live TypeScript manifest as the complete tool source of truth, requires observe-act-verify behavior, and routes skill discovery
through `shared_skill_list` and `shared_skill_read`.

## Plugin and Micro-Widget Direction

Runtime plugins remain the inner extension layer for panes, routes, status items, commands, themes, and agent-side plugin
APIs. KronTerm blocks remain the outer workspace layer. The bundled `kronterm-surfaces` plugin renders compact live cards
for KronTerm blocks and opens or focuses the real block through the scoped control plane.

The bridge should exchange stable surface descriptors, not embed arbitrary Electron views across security boundaries:

```text
Kronos micro-widget <-> scoped KronTerm surface descriptor <-> KronTerm block
```

This keeps permissions, lifecycle, focus, screenshots, and input ownership in KronTerm while letting Hermes plugins compose lightweight views.

## Migration Order

1. Make Hermes the default ACP harness while retaining KronosCode as fallback.
2. Reach tool parity through the native TypeScript bridge and add verification evidence.
3. Add the `kronterm-surfaces` bundled Hermes plugin and runtime plugin capability grants.
4. Migrate KronosCode prompts, skills, memory, subagents, and provider configuration into Hermes-native packages.
5. Add session/profile migration and an in-app readiness report.
6. Remove KronosCode packaging only after parity gates pass.

## Parity Gates

- Hermes can receive the temporary surface token and register the complete TypeScript tool manifest without the Python MCP SDK.
- Browser, terminal, canvas, sandbox, desktop, file, and layout operations have read-after-write verification.
- Tool approval and capability expiry are visible in the UI.
- Existing KronosCode skills and prompts have an owned Hermes destination or a documented retirement reason.
- Hermes plugins can render a live KronTerm surface card without receiving raw unrestricted Electron access.
