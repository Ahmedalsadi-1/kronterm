# KronTerm Mobile

KronTerm Mobile is the iPhone-first shell for KronTerm/KronosCode. It is designed to work without a Mac or PC host.

## Execution model

- **Kron Local** — persistent files, virtual shell, JavaScript, WebAssembly, offline PWA.
- **Local Linux** — native QEMU-SE/UTM-SE style ARM64 Alpine backend through the `KronQemu` Capacitor plugin. The bridge is present; native QEMU libraries still need to be linked in the iOS project.
- **Kron Sandbox** — direct HTTPS API from the iPhone for heavier Linux workloads.
- **Remote** — optional SSH/Mac/PC execution, never required.

The runtime selector supports `auto`, `local`, `sandbox`, and `qemu`.

## Current local commands

`help`, `pwd`, `ls`, `cd`, `cat`, `touch`, `mkdir`, `write`, `rm`, `clear`, `date`, `whoami`, `files`, `runtime`, `wasm-demo`, `js`.

Examples:

```text
wasm-demo
js 6*7
write notes.txt hello
cat notes.txt
runtime sandbox
```

## Kron Sandbox contract

Configure the gateway from the Devices screen. The initial contract is:

```http
GET /health
POST /exec
Content-Type: application/json
Authorization: Bearer <short-lived-session-token>

{"command":"npm run dev","cwd":"/workspace"}
```

The response may expose `output` or `stdout`.

Production builds should authenticate to a Kron-owned gateway and use short-lived session tokens. Do not embed provider master keys in the app.

## PWA on iPhone

Deploy `www/` over HTTPS, open it in Safari, then use **Share → Add to Home Screen**. The service worker caches the shell for offline use.

## Native iOS

The app uses the same Capacitor 8 model as OpenChamber's mobile shell.

```bash
cd mobile/kronterm-mobile
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
```

A GitHub Actions workflow builds an unsigned iOS Simulator `.app` automatically. A physical iPhone build requires Apple signing credentials in the `ios-signing` GitHub environment.

Required secrets for the signed archive job:

- `IOS_CERTIFICATE_BASE64`
- `IOS_CERTIFICATE_PASSWORD`
- `IOS_PROVISION_PROFILE_BASE64`
- `IOS_KEYCHAIN_PASSWORD`
- `IOS_DEVELOPMENT_TEAM`

## Local Linux/QEMU milestone

The native plugin contract is at `native/ios-plugin/KronQemuPlugin.swift`.

Target implementation:

1. Link an iOS-compatible QEMU/UTM-SE interpreter build.
2. Boot an ARM64 Alpine disk image stored in the app container.
3. Connect the guest serial console to KronTerm's terminal widget.
4. Add start/stop/snapshot APIs.
5. Optionally expose the framebuffer as a Desktop widget.

QEMU is intentionally not bundled in the initial branch because native libraries and the guest image must be compiled/packaged under their applicable licenses and verified on an actual signed iOS build.
