# KronTerm Documentation

This directory contains the Docusaurus source for [docs.kronterm.dev](https://docs.kronterm.dev). The product website
lives in [`../website`](../website); this site contains setup, workflow, configuration, and reference documentation.

## Install dependencies

From the repository root:

```bash
task init
```

To install only this package's dependencies:

```bash
npm --prefix docs install
```

## Run locally

```bash
task docsite
```

This starts the documentation server with live reload. You can also run `npm --prefix docs start` directly.

## Validate

```bash
npm --prefix docs run typecheck
npm --prefix docs run build
```

The production build writes static output to `docs/build`. Broken internal links fail the build; broken Markdown links are
reported as warnings by the current Docusaurus configuration.

## Writing rules

- Use KronTerm, KronosCode, and KronosChamber in user-facing copy.
- Preserve `Wave`, `WaveAI`, `waveai:*`, `.waveterm`, and related names when they identify compatibility-sensitive config,
  commands, paths, or historical releases.
- Mark the Python voice engine as experimental and the iPhone client as Labs.
- Verify behavior in the current code before documenting availability.
- Keep examples small, runnable, and explicit about the operating surface they affect.

Deployments run through [the documentation workflow](../.github/workflows/deploy-docsite.yml).
