import { getApi } from "@/store/global";

type DesktopPetNotification = Parameters<ReturnType<typeof getApi>["setDesktopPetActivity"]>[0];

export type AgentWidgetActivity = {
    blockId: string;
    action: "browse" | "cursor" | "typing" | "scroll" | "view";
    detail: string;
    point?: { x: number; y: number };
    previewImageUrl?: string;
};

export type AgentSurfaceActivity = {
    sessionid?: string;
    source: "acp" | "kronoscode-tui";
    phase: "start" | "update" | "finish" | "error";
    blockid?: string;
    surface: "browser" | "sandbox" | "terminal" | "file" | "panel";
    action:
        | "open"
        | "focus"
        | "inspect"
        | "move"
        | "click"
        | "doubleClick"
        | "type"
        | "press"
        | "scroll"
        | "drag"
        | "screenshot"
        | "thinking";
    detail?: string;
    thought?: string;
    point?: { x: number; y: number };
    target?: { x: number; y: number; width: number; height: number };
    previewimageurl?: string;
    petactivityurl?: string;
};

const DefaultTuiPetActivityUrl = "http://127.0.0.1:4096/pet/activity";

function targetForBlock(blockId: string | undefined): DesktopPetNotification["target"] {
    if (!blockId) {
        return undefined;
    }
    const element = document.querySelector<HTMLElement>(`div[data-blockid="${CSS.escape(blockId)}"]`);
    if (!element) {
        return undefined;
    }
    const rect = element.getBoundingClientRect();
    return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
    };
}

function targetForPanel(): DesktopPetNotification["target"] {
    const element = document.querySelector<HTMLElement>("[data-waveai-panel='true']");
    if (!element) {
        return undefined;
    }
    const rect = element.getBoundingClientRect();
    return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
    };
}

function toolAction(detail: string): AgentWidgetActivity["action"] {
    if (/screenshot|snapshot|capture/i.test(detail)) {
        return "view";
    }
    if (/type|paste|keyboard|press/i.test(detail)) {
        return "typing";
    }
    if (/scroll/i.test(detail)) {
        return "scroll";
    }
    if (/click|hover|drag|mouse|pointer/i.test(detail)) {
        return "cursor";
    }
    return "browse";
}

function pointFromToolInput(input: Record<string, unknown> | undefined): AgentWidgetActivity["point"] {
    const x = input?.x ?? input?.originX ?? input?.startX ?? input?.endX;
    const y = input?.y ?? input?.originY ?? input?.startY ?? input?.endY;
    return typeof x === "number" && typeof y === "number" ? { x, y } : undefined;
}

function cursorActionForTool(action: AgentWidgetActivity["action"], detail: string) {
    if (action === "typing") {
        return "type" as const;
    }
    if (action === "scroll") {
        return "scroll" as const;
    }
    if (action === "cursor") {
        return /click/i.test(detail) ? ("click" as const) : ("hover" as const);
    }
    return "idle" as const;
}

function imageDataUrl(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const direct = value.match(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\r\n]+/i)?.[0];
    if (direct) {
        return direct.replace(/\s+/g, "");
    }
    try {
        const parsed = JSON.parse(value) as {
            image?: unknown;
            imageurl?: unknown;
            imageUrl?: unknown;
            encoding?: unknown;
        };
        const nestedUrl = parsed.imageurl ?? parsed.imageUrl;
        if (typeof nestedUrl === "string" && nestedUrl.startsWith("data:image/")) {
            return nestedUrl;
        }
        if (parsed.encoding === "base64" && typeof parsed.image === "string") {
            return `data:image/png;base64,${parsed.image.replace(/\s+/g, "")}`;
        }
    } catch {
        return undefined;
    }
    return undefined;
}

export function previewImageFromToolUpdate(data: unknown): string | undefined {
    const update = data as {
        content?: Array<{
            content?: { type?: string; text?: string; data?: string; mimeType?: string };
        }>;
    };
    for (const item of update?.content ?? []) {
        const content = item?.content;
        if (content?.type === "image" && typeof content.data === "string") {
            return `data:${content.mimeType ?? "image/png"};base64,${content.data.replace(/\s+/g, "")}`;
        }
        const result = imageDataUrl(content?.text);
        if (result) {
            return result;
        }
    }
    return undefined;
}

export function reportDesktopPetActivity(
    notification: DesktopPetNotification,
    blockId?: string,
    input?: Record<string, unknown>
) {
    const detail = notification.detail ?? "Using widget";
    const action = toolAction(detail);
    getApi().setDesktopPetActivity({
        ...notification,
        target: targetForBlock(blockId) ?? (notification.kind === "idle" ? undefined : targetForPanel()),
        cursorAction: notification.kind === "tool" ? cursorActionForTool(action, detail) : undefined,
        petActivityUrl: DefaultTuiPetActivityUrl,
        surfaceActivity: {
            source: "acp",
            phase: notification.kind === "idle" ? "finish" : "update",
            blockid: blockId,
            surface: blockId ? "browser" : "panel",
            action:
                notification.kind === "thinking"
                    ? "thinking"
                    : action === "typing"
                      ? "type"
                      : action === "scroll"
                        ? "scroll"
                        : action === "cursor"
                          ? "click"
                          : action === "view"
                            ? "screenshot"
                            : "focus",
            detail,
            thought: notification.thought,
            point: pointFromToolInput(input),
            previewimageurl: notification.previewImageUrl,
        },
    });
    if (notification.kind === "tool" && blockId) {
        window.dispatchEvent(
            new CustomEvent<AgentWidgetActivity>("agent-widget-activity", {
                detail: {
                    blockId,
                    action,
                    detail,
                    point: pointFromToolInput(input),
                    previewImageUrl: notification.previewImageUrl,
                },
            })
        );
    }
}

export function blockIdFromToolInput(input: Record<string, unknown> | undefined): string | undefined {
    if (!input) {
        return undefined;
    }
    const target = input.blockId ?? input.blockid ?? input.sessionId ?? input.sessionid;
    return typeof target === "string" ? target : undefined;
}

function widgetActivityFromSurface(activity: AgentSurfaceActivity): AgentWidgetActivity["action"] {
    if (activity.action === "type" || activity.action === "press") {
        return "typing";
    }
    if (activity.action === "scroll") {
        return "scroll";
    }
    if (activity.action === "move" || activity.action === "click" || activity.action === "doubleClick" || activity.action === "drag") {
        return "cursor";
    }
    if (activity.action === "screenshot" || activity.action === "inspect") {
        return "view";
    }
    return "browse";
}

export function reportAgentSurfaceActivity(activity: AgentSurfaceActivity) {
    const action = widgetActivityFromSurface(activity);
    const target = targetForBlock(activity.blockid) ?? targetForPanel();
    getApi().setDesktopPetActivity({
        kind: activity.phase === "finish" && activity.action === "thinking" ? "idle" : "tool",
        detail: activity.detail ?? activity.action,
        thought: activity.thought,
        target,
        cursorAction: cursorActionForTool(action, activity.action),
        previewImageUrl: activity.previewimageurl,
        petActivityUrl: activity.petactivityurl ?? DefaultTuiPetActivityUrl,
        surfaceActivity: activity,
    });
    if (!activity.blockid) {
        return;
    }
    window.dispatchEvent(
        new CustomEvent<AgentWidgetActivity>("agent-widget-activity", {
            detail: {
                blockId: activity.blockid,
                action,
                detail: activity.detail ?? activity.action,
                point: activity.point,
                previewImageUrl: activity.previewimageurl,
            },
        })
    );
}
