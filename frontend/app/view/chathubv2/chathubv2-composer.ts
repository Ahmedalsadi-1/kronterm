export type ComposerGuardPresentation = "full" | "mini";

export type ComposerGuardOptions = {
    onSubmit?: (value: string) => void;
    presentation?: ComposerGuardPresentation;
    transformSubmit?: (value: string) => string;
};

type ComposerBridgeState = {
    options: ComposerGuardOptions;
    resubmitting: boolean;
};

const ComposerBridgeStates = new WeakMap<HTMLFormElement, ComposerBridgeState>();

function findComposer(form: HTMLFormElement): HTMLTextAreaElement | HTMLInputElement | HTMLElement | null {
    return form.querySelector<HTMLTextAreaElement | HTMLInputElement | HTMLElement>(
        '[data-chat-input="true"], textarea:not([readonly]):not([disabled]), input[type="text"]:not([readonly]):not([disabled]), [contenteditable="true"]'
    );
}

function readComposerValue(form: HTMLFormElement): string {
    const composer = findComposer(form);
    if (composer?.tagName === "TEXTAREA" || composer?.tagName === "INPUT") {
        return (composer as HTMLTextAreaElement | HTMLInputElement).value.trim();
    }
    return composer?.textContent?.trim() ?? "";
}

function writeComposerValue(form: HTMLFormElement, value: string): void {
    const composer = findComposer(form);
    if (!composer) {
        return;
    }
    const frameWindow = form.ownerDocument.defaultView;
    if (composer.tagName === "TEXTAREA") {
        const setter = Object.getOwnPropertyDescriptor(frameWindow?.HTMLTextAreaElement.prototype ?? {}, "value")?.set;
        setter?.call(composer, value);
    } else if (composer.tagName === "INPUT") {
        const setter = Object.getOwnPropertyDescriptor(frameWindow?.HTMLInputElement.prototype ?? {}, "value")?.set;
        setter?.call(composer, value);
    } else {
        composer.textContent = value;
    }
    const EventConstructor = frameWindow?.Event ?? Event;
    composer.dispatchEvent(new EventConstructor("input", { bubbles: true }));
    composer.dispatchEvent(new EventConstructor("change", { bubbles: true }));
}

function handleComposerSubmit(event: SubmitEvent): void {
    const form = event.currentTarget as HTMLFormElement;
    const state = ComposerBridgeStates.get(form);
    if (!state) {
        return;
    }
    if (state.resubmitting) {
        state.resubmitting = false;
        return;
    }
    const value = readComposerValue(form);
    if (!value) {
        return;
    }
    const transformed = state.options.transformSubmit?.(value)?.trim() || value;
    state.options.onSubmit?.(value);
    if (transformed === value) {
        return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    writeComposerValue(form, transformed);
    state.resubmitting = true;
    form.ownerDocument.defaultView?.setTimeout(() => form.requestSubmit(), 0);
}

function setMiniComposerPath(doc: Document, form: HTMLFormElement): void {
    doc.documentElement.setAttribute("data-kronterm-mini-composer", "true");
    doc.querySelectorAll("[data-kronterm-composer-path], [data-kronterm-composer-hidden]").forEach((element) => {
        element.removeAttribute("data-kronterm-composer-path");
        element.removeAttribute("data-kronterm-composer-hidden");
    });
    let current: HTMLElement | null = form;
    while (current && current !== doc.body) {
        current.setAttribute("data-kronterm-composer-path", "true");
        const parent: HTMLElement | null = current.parentElement;
        if (!parent) {
            break;
        }
        Array.from(parent.children).forEach((sibling) => {
            if (sibling !== current) {
                sibling.setAttribute("data-kronterm-composer-hidden", "true");
            }
        });
        current = parent;
    }
}

function clearMiniComposerPath(doc: Document): void {
    doc.documentElement.removeAttribute("data-kronterm-mini-composer");
    doc.querySelectorAll("[data-kronterm-composer-path], [data-kronterm-composer-hidden]").forEach((element) => {
        element.removeAttribute("data-kronterm-composer-path");
        element.removeAttribute("data-kronterm-composer-hidden");
    });
}

export function makeComposerGuardStyleText(presentation: ComposerGuardPresentation = "full"): string {
    const miniStyles =
        presentation === "mini"
            ? `
        html[data-kronterm-mini-composer="true"],
        html[data-kronterm-mini-composer="true"] body {
            overflow: hidden !important;
            background: transparent !important;
        }
        html[data-kronterm-mini-composer="true"] [data-kronterm-composer-hidden="true"] {
            display: none !important;
        }
        html[data-kronterm-mini-composer="true"] [data-kronterm-composer-path="true"] {
            position: static !important;
            inset: auto !important;
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            transform: none !important;
        }
        html[data-kronterm-mini-composer="true"] form[data-kronterm-composer="true"] {
            position: relative !important;
            right: auto !important;
            left: auto !important;
            bottom: auto !important;
            width: 100% !important;
            max-width: none !important;
            transform: none !important;
        }
    `
            : "";
    return `
        html, body, #root {
            height: 100% !important;
            min-height: 0 !important;
        }
        textarea:not([readonly]):not([disabled]),
        input[type="text"]:not([readonly]):not([disabled]),
        [contenteditable="true"] {
            visibility: visible !important;
            opacity: 1 !important;
        }
        form[data-kronterm-composer="true"] {
            position: fixed !important;
            right: auto !important;
            left: 50% !important;
            bottom: 24px !important;
            z-index: 40 !important;
            display: block !important;
            width: min(680px, calc(100% - 32px)) !important;
            max-width: min(680px, calc(100% - 32px)) !important;
            margin: 0 !important;
            padding-bottom: 0 !important;
            transform: translateX(-50%) !important;
        }
        ${miniStyles}
    `;
}

export function installComposerGuard(doc: Document, options: ComposerGuardOptions = {}): void {
    doc.querySelectorAll(".kron-siri-root").forEach((element) => element.remove());
    const presentation = options.presentation ?? "full";
    let style = doc.getElementById("kronterm-composer-guard") as HTMLStyleElement | null;
    if (!style) {
        style = doc.createElement("style");
        style.id = "kronterm-composer-guard";
        doc.head.appendChild(style);
    }
    style.textContent = makeComposerGuardStyleText(presentation);

    const composer = doc.querySelector<HTMLElement>(
        '[data-chat-input="true"], textarea:not([readonly]):not([disabled]), input[type="text"]:not([readonly]):not([disabled]), [contenteditable="true"]'
    );
    const form = composer?.closest<HTMLFormElement>('form[data-keyboard-avoid="true"]') ?? composer?.closest("form");
    if (!form) {
        return;
    }

    doc.querySelectorAll('form[data-kronterm-composer="true"]').forEach((element) => {
        if (element !== form) {
            element.removeAttribute("data-kronterm-composer");
        }
    });
    form.setAttribute("data-kronterm-composer", "true");
    if (presentation === "mini") {
        setMiniComposerPath(doc, form);
    } else {
        clearMiniComposerPath(doc);
    }
    const existingState = ComposerBridgeStates.get(form);
    if (existingState) {
        existingState.options = options;
        return;
    }
    ComposerBridgeStates.set(form, { options, resubmitting: false });
    form.addEventListener("submit", handleComposerSubmit, true);
}
