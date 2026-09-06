---
name: kronoschamber-mobile-quality
description: Improve the KronTerm for iPhone Labs client built with React 19, Vite, Capacitor 8, UIKit shell code, secure storage, WebSockets, and xterm. Use for `mobile/` UI, host pairing, remote workspace control, terminal behavior, keyboard handling, lifecycle, accessibility, performance, or iOS build and test work.
---

# KronosChamber Mobile Quality

Build a focused companion for directing and reviewing work, not a compressed desktop clone. Keep the product labeled Labs until release criteria say otherwise.

## Workflow

1. Identify the mobile moment: connect, launch, direct, approve, inspect, recover, or continue.
2. Inspect the React component, connection/state model, Capacitor plugin boundary, iOS shell, and nearest tests.
3. Design for one-handed use, Dynamic Type, safe areas, keyboard transitions, reduced motion, VoiceOver, and interrupted connectivity.
4. Treat background/foreground, network changes, host disappearance, token expiry, and duplicate messages as normal states.
5. Keep credentials in secure storage and validate host identities and deep links.
6. Add targeted Vitest or Node host tests, run `npm --prefix mobile run build`, and use iOS validation only when native files change.

## Product rules

- Prefer concise task status, approvals, diffs, artifacts, and remote terminal control.
- Preserve user work across suspension and reconnect without duplicating commands.
- Use native-feeling sheets, navigation, haptics, and feedback through existing Capacitor primitives.
- Do not apply React Native patterns; this project is React DOM inside Capacitor.

Key paths: `mobile/src/`, `mobile/host/`, `mobile/plugins/`, and `mobile/ios/`.
