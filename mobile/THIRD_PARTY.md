# Third-party foundations

This app is an adaptation layer over existing sources rather than a greenfield mobile chatbot.

- **Hermes Desktop** ([NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent), MIT; imported at `third_party/source-imports/hermes-desktop`): interaction patterns for streaming tool activity, sessions, composer, previews, files, terminal continuity, settings, overlays, and haptics. The JSON-RPC gateway client is directly adapted with attribution in source.
- **KronosChamber Web** (`third_party/kronoschamber-web`, project source): real KronosCode gateway, session, Browser Runtime, and Desktop Sandbox API contracts.
- **KronTerm desktop** (`frontend/app/components/hermes-ui`, `frontend/app/aipanel/kronoscode-v2`): adapted Hermes components and structured KronosCode message-part behavior.
- **ios_system** ([holzschu/ios_system](https://github.com/holzschu/ios_system), BSD-3-Clause): embedded command engine for the sandboxed native iPhone terminal. KronTerm uses its packaged iOS commands and keeps all local execution inside the app container.
- **[Qalti / AIQA](https://github.com/qalti/qalti)** (MIT): observe, decide, act, verify loop and screenshot-backed visual fallback.
- **[PhoneAgent](https://github.com/rounak/PhoneAgent)** (MIT): compact screen/tree/open/tap/type/scroll/swipe/stop control vocabulary and developer-device separation.
- **[iGentic iPhone](https://github.com/pokekarten/igentic-iphone)** (Apache-2.0): phone-as-trust-plane model for local identity, policy, approval, delegation, verification, and audit.

See the repository `NOTICE` and upstream licenses before copying additional implementation.
