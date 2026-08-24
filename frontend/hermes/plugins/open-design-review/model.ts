import type { KronTermInspectableElement, KronTermSurface } from "@hermes/plugin-sdk";

export type DesignReviewComment = {
    id: string;
    surfaceId: string;
    surfaceTitle: string;
    url: string;
    element: KronTermInspectableElement;
    text: string;
    createdAt: number;
    status: "queued" | "sent";
};

export function pickInspectableElement(
    elements: KronTermInspectableElement[],
    x: number,
    y: number
): KronTermInspectableElement | null {
    return (
        elements
            .filter(
                (element) =>
                    element.visible &&
                    x >= element.x &&
                    x <= element.x + element.width &&
                    y >= element.y &&
                    y <= element.y + element.height
            )
            .sort((left, right) => left.width * left.height - right.width * right.height)[0] ?? null
    );
}

export function activeSurfaceUrl(surface?: KronTermSurface): string {
    return surface?.browserTabs?.find((tab) => tab.active)?.url ?? "";
}

export function formatReviewComments(comments: DesignReviewComment[]): string {
    if (comments.length === 0) {
        return "";
    }

    const entries = comments.map((comment, index) => {
        const element = comment.element;
        const identity = [element.role, element.name ? `“${element.name}”` : "", element.ref]
            .filter(Boolean)
            .join(" · ");
        const rect = `${element.x},${element.y} ${element.width}×${element.height}`;

        return `${index + 1}. ${comment.text}\n   UI target: ${identity}; rect ${rect}; page ${comment.url || comment.surfaceTitle}`;
    });

    return [
        "Open Design review comments from components I selected in the live KronTerm browser.",
        "Treat these as user-provided UI targets. Locate the owning source in the open repository, make the requested edits, and verify them in the live browser.",
        "",
        ...entries,
    ].join("\n");
}
