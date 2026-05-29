// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { AcpChatPanel } from "@/app/aipanel/acp-chat-panel";
import { WaveEnvContext } from "@/app/waveenv/waveenv";
import { makeMockWaveEnv } from "@/preview/mock/mockwaveenv";
import { installPreviewElectronApi } from "@/preview/mock/preview-electron-api";
import "overlayscrollbars/overlayscrollbars.css";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import "./app/app.scss";

// Keep this import after app.scss so Tailwind sees frontend/app classes in dev-browser preview.
import "./tailwindsetup.css";

installPreviewElectronApi();

function showPreviewError(message: string) {
    const elem = document.getElementById("main");
    if (!elem) return;
    elem.innerHTML = `<pre style="padding:24px;color:#991b1b;background:#fff1f2;height:100vh;white-space:pre-wrap;font:13px ui-monospace,monospace">${message}</pre>`;
}

window.addEventListener("error", (event) => {
    showPreviewError(event.error?.stack || event.message || "ACP preview failed");
});

window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    showPreviewError(reason?.stack || reason?.message || String(reason));
});

document.title = "ACP Agents Preview";
document.body.style.visibility = null;
document.body.style.opacity = null;
document.body.classList.remove("is-transparent");

const elem = document.getElementById("main");
const root = createRoot(elem);
const waveEnv = makeMockWaveEnv();

root.render(
    createElement(
        WaveEnvContext.Provider,
        { value: waveEnv },
        createElement("div", { className: "flex h-screen min-h-0 w-screen bg-[#f6f7f9]" }, createElement(AcpChatPanel))
    )
);
