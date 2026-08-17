# Bundled KronosCode Agent

This directory is the packaging boundary for KronTerm's primary ACP agent. The desktop's managed runtime locates this
artifact, starts it as a local process, checks its health, and connects KronosChamber to its JSON-RPC gateway.

Place a release-built KronosCode launcher or standalone binary at:

```text
agents/kronoscode/bin/kronoscode
```

KronTerm discovers the agent in this order:

1. `KRONTERM_KRONOSCODE_BIN`
2. the packaged `agents/kronoscode/bin/kronoscode` artifact
3. `agents/kronoscode/bin/kronoscode` in a development checkout
4. the current external development checkout fallback

Do not vendor a working KronosCode source tree here. It can contain environment
files, databases, generated artifacts, and unrelated applications. Package a
clean release artifact and its license instead.

## Runtime expectations

The packaged launcher must:

- start without writing interactive prompts to standard input;
- expose the gateway and health behavior expected by `emain/chathubv2-server.ts`;
- accept the short-lived credentials issued by the desktop runtime;
- keep user session data outside this packaging directory;
- return nonzero on startup failure so KronTerm can show repair guidance;
- shut down cleanly when the Electron main process stops it.

Use `scripts/validate-kronoscode-artifact.mjs` when preparing a release artifact. Keep source checkouts, `.env` files,
SQLite databases, logs, caches, and generated applications out of `agents/kronoscode/bin/`.

## Product boundary

KronosCode is the only AI engine used by the desktop and the iPhone Labs client. KronosChamber is a UI and gateway
client; it must not embed a second model runtime. Other ACP agents may be configured as specialist backends, but they do
not replace this package's role as the default bundled agent.
