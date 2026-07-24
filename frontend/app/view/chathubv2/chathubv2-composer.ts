export function makeComposerGuardStyleText(): string {
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
    `;
}

export function installComposerGuard(doc: Document): void {
    doc.querySelectorAll(".kron-siri-root").forEach((element) => element.remove());
    if (!doc.getElementById("kronterm-composer-guard")) {
        const style = doc.createElement("style");
        style.id = "kronterm-composer-guard";
        style.textContent = makeComposerGuardStyleText();
        doc.head.appendChild(style);
    }

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

}
