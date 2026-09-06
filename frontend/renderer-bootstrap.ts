// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

type WindowWithElectronApi = Window & { api?: unknown };

const hasElectronApi = (window as WindowWithElectronApi).api != null;

if (hasElectronApi) {
    import("./wave");
} else {
    import("./acp-browser-preview").catch((err) => {
        const elem = document.getElementById("main");
        if (elem) {
            elem.innerHTML = `<pre style="padding:24px;color:#991b1b;background:#fff1f2;height:100vh;white-space:pre-wrap;font:13px ui-monospace,monospace">${err?.stack || err?.message || err}</pre>`;
        }
    });
}
