// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0
//
// Copied from Hermes Desktop and adapted for Kronterm. Hermes renders gateway
// password/secret prompts from nanostores; Kronterm keeps this as an integration
// slot so ACP can provide prompt state without importing the Hermes runtime.

import type { ReactNode } from "react";

export type PromptOverlayRequest = {
    description?: string;
    id: string;
    kind: "secret" | "sudo";
    title: string;
};

export function PromptOverlays({
    renderPrompt,
    request,
}: {
    renderPrompt?: (request: PromptOverlayRequest) => ReactNode;
    request?: PromptOverlayRequest | null;
}) {
    if (request == null || renderPrompt == null) {
        return null;
    }
    return <>{renderPrompt(request)}</>;
}
