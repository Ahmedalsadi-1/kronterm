// Copyright (c) 2026 KronTerm. Licensed under the Apache License, Version 2.0 (the "License").

export function shouldIncludeDragPreviewNode(node: HTMLElement): boolean {
    if (!(node instanceof HTMLImageElement)) {
        return true;
    }
    const source = node.currentSrc || node.src;
    if (!source || source.startsWith("data:") || source.startsWith("blob:")) {
        return true;
    }
    try {
        return new URL(source, window.location.href).origin === window.location.origin;
    } catch {
        return false;
    }
}
