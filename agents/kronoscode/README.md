# Bundled KronosCode Agent

This directory is the packaging boundary for KronTerm's primary ACP agent.

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
