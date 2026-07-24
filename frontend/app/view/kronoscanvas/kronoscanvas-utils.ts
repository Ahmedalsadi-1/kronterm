// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export type KronosCanvasNodeType = "text" | "image" | "frame" | "widget" | "appstream" | "aichat";

export type ArrowBindingLike = {
    fromId: string;
    toId: string;
    props?: {
        terminal?: "start" | "end";
    };
};

export function canvasNodeTitle(node: Pick<CanvasNode, "id" | "title" | "type">): string {
    const title = node.title?.trim();
    if (title) {
        return title;
    }
    return node.id || node.type || "node";
}

export function extractCanvasEdgesFromArrowBindings(
    arrowBindings: ArrowBindingLike[],
    shapeToNode: ReadonlyMap<string, string>
): CanvasEdge[] {
    const grouped = new Map<string, { start?: string; end?: string }>();
    for (const binding of arrowBindings) {
        const terminal = binding.props?.terminal;
        if (terminal !== "start" && terminal !== "end") {
            continue;
        }
        const nodeId = shapeToNode.get(binding.toId);
        if (!nodeId) {
            continue;
        }
        const entry = grouped.get(binding.fromId) ?? {};
        entry[terminal] = nodeId;
        grouped.set(binding.fromId, entry);
    }
    const edges: CanvasEdge[] = [];
    for (const [shapeId, binding] of grouped) {
        if (!binding.start || !binding.end || binding.start === binding.end) {
            continue;
        }
        edges.push({
            id: shapeId,
            shapeid: shapeId,
            fromnode: binding.start,
            tonode: binding.end,
        });
    }
    return edges;
}

export function extractCanvasEdgesFromNodeParents(nodes: CanvasNode[]): CanvasEdge[] {
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges: CanvasEdge[] = [];
    for (const node of nodes) {
        const parentNodeId = String((node.meta as Record<string, unknown> | undefined)?.kronosParentNodeId ?? "");
        if (!parentNodeId || parentNodeId === node.id || !nodeIds.has(parentNodeId)) {
            continue;
        }
        edges.push({
            id: `follow:${parentNodeId}:${node.id}`,
            shapeid: node.shapeid,
            fromnode: parentNodeId,
            tonode: node.id,
            label: "follow",
        });
    }
    return edges;
}

export function mergeCanvasEdges(...edgeGroups: CanvasEdge[][]): CanvasEdge[] {
    const seen = new Set<string>();
    const merged: CanvasEdge[] = [];
    for (const edge of edgeGroups.flat()) {
        const key = `${edge.fromnode}->${edge.tonode}:${edge.label ?? ""}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        merged.push(edge);
    }
    return merged;
}

export function summarizeCanvas(nodes: CanvasNode[], edges: CanvasEdge[]): string {
    const titles = new Map(nodes.map((node) => [node.id, canvasNodeTitle(node)]));
    const lines = ["Canvas Graph:"];

    if (nodes.length === 0) {
        lines.push("  (empty)");
    }

    const incomingEdges = new Map<string, string[]>();
    for (const edge of edges) {
        const sources = incomingEdges.get(edge.tonode) ?? [];
        sources.push(edge.fromnode);
        incomingEdges.set(edge.tonode, sources);
    }

    for (const node of nodes) {
        const sources = incomingEdges.get(node.id) || [];
        const sourceTitles = sources.map((source) => titles.get(source) || source).join(", ");

        lines.push(`  - [${node.type}] ${canvasNodeTitle(node)}${node.status ? ` (${node.status})` : ""}`);
        if (sources.length > 0) {
            lines.push(`      <- Receives context from: ${sourceTitles}`);
        }

        if (node.content && node.content.trim()) {
            const preview = node.content.trim().split("\n")[0].slice(0, 80);
            lines.push(`      Content: ${preview}${node.content.length > 80 ? "..." : ""}`);
        }
    }

    if (edges.length > 0) {
        lines.push("Connections:");
        for (const edge of edges) {
            lines.push(
                `  ${titles.get(edge.fromnode) ?? edge.fromnode} -> ${titles.get(edge.tonode) ?? edge.tonode}${edge.label ? ` (${edge.label})` : ""}`
            );
        }
    }

    return lines.join("\n");
}
