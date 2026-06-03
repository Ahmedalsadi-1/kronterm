import { getApi } from "@/store/global";
import {
    createAgentActivityTimeline,
    cursorActionForAgentActivity,
    inferAgentActivityAction,
    inferAgentActivitySurface,
    normalizeAgentActivity,
    pointFromAgentActivityInput,
    type AgentActivityEvent,
    type AgentActivityPhase,
} from "../../types/agent-activity";

type DesktopPetNotification = Parameters<ReturnType<typeof getApi>["setDesktopPetActivity"]>[0];

export type AgentWidgetActivity = {
    blockId: string;
    action: "browse" | "cursor" | "typing" | "scroll" | "view";
    detail: string;
    point?: { x: number; y: number };
    previewImageUrl?: string;
    typingText?: string;
    typingIndex?: number;
};

export type AgentSurfaceActivity = AgentActivityEvent;

export type LiveAgentSurfaceActivity = ReturnType<typeof normalizeAgentActivity> & {
    timestamp: number;
};

const DefaultTuiPetActivityUrl = "http://127.0.0.1:4096/pet/activity";
export const AgentSurfaceUiActivityEvent = "agent-surface-ui-activity";
export const agentActivityTimeline = createAgentActivityTimeline();

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

function widgetActionForActivity(activity: Pick<AgentActivityEvent, "action">): AgentWidgetActivity["action"] {
    if (activity.action === "screenshot" || activity.action === "inspect") {
        return "view";
    }
    if (activity.action === "type" || activity.action === "press") {
        return "typing";
    }
    if (activity.action === "scroll") {
        return "scroll";
    }
    if (
        activity.action === "move" ||
        activity.action === "click" ||
        activity.action === "doubleClick" ||
        activity.action === "drag"
    ) {
        return "cursor";
    }
    return "browse";
}

function dispatchSurfaceUiActivity(activity: AgentSurfaceActivity) {
    const normalized = agentActivityTimeline.record(activity);
    window.dispatchEvent(
        new CustomEvent<LiveAgentSurfaceActivity>(AgentSurfaceUiActivityEvent, {
            detail: normalized,
        })
    );
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
    input?: Record<string, unknown>,
    explicitActivity?: Partial<AgentSurfaceActivity>
) {
    const detail = notification.detail ?? "Using widget";
    const inferredAction = notification.kind === "thinking" ? ("thinking" as const) : inferAgentActivityAction(detail);
    const point = explicitActivity?.point ?? pointFromAgentActivityInput(input);
    const surfaceActivity: AgentSurfaceActivity = {
        source: "acp",
        phase: notification.kind === "idle" ? "succeeded" : "running",
        blockid: blockId,
        surface: inferAgentActivitySurface(detail, blockId),
        action: inferredAction,
        detail,
        thought: notification.thought,
        point,
        previewimageurl: notification.previewImageUrl,
        ...explicitActivity,
    };
    const action = widgetActionForActivity(surfaceActivity);
    const typingText = action === "typing" ? detail : undefined;
    getApi().setDesktopPetActivity({
        ...notification,
        target: targetForBlock(blockId) ?? (notification.kind === "idle" ? undefined : targetForPanel()),
        cursorAction: notification.kind === "tool" ? cursorActionForAgentActivity(surfaceActivity) : undefined,
        cursorPoint: point,
        petActivityUrl: DefaultTuiPetActivityUrl,
        surfaceActivity,
    });
    dispatchSurfaceUiActivity(surfaceActivity);
    if (notification.kind === "tool" && blockId) {
        window.dispatchEvent(
            new CustomEvent<AgentWidgetActivity>("agent-widget-activity", {
                detail: {
                    blockId,
                    action,
                    detail,
                    point,
                    previewImageUrl: notification.previewImageUrl,
                    typingText,
                },
            })
        );
    }
}

export function blockIdFromToolInput(input: Record<string, unknown> | undefined): string | undefined {
    if (!input) {
        return undefined;
    }
    const target =
        input.blockId ?? input.blockid ?? input.block_id ?? input.sessionId ?? input.sessionid ?? input.session_id;
    return typeof target === "string" ? target : undefined;
}

function petNotificationKindForPhase(phase: AgentActivityPhase): DesktopPetNotification["kind"] {
    if (phase === "succeeded" || phase === "failed" || phase === "cancelled") {
        return "idle";
    }
    return "tool";
}

export function reportAgentSurfaceActivity(activity: AgentSurfaceActivity) {
    const normalized = normalizeAgentActivity(activity);
    const action = widgetActionForActivity(normalized);
    const target = targetForBlock(normalized.blockid) ?? targetForPanel();
    const typingText = action === "typing" ? normalized.detail : undefined;
    getApi().setDesktopPetActivity({
        kind: petNotificationKindForPhase(normalized.phase),
        detail: normalized.detail ?? normalized.action,
        thought: normalized.thought,
        reasoningLog: normalized.reasoningSteps ?? (normalized.thought ? [normalized.thought] : undefined),
        target,
        cursorAction: cursorActionForAgentActivity(normalized),
        cursorPoint: normalized.point,
        previewImageUrl: normalized.previewimageurl,
        petActivityUrl: normalized.petactivityurl ?? DefaultTuiPetActivityUrl,
        surfaceActivity: normalized,
    });
    dispatchSurfaceUiActivity(normalized);
    if (!normalized.blockid) {
        return;
    }
    window.dispatchEvent(
        new CustomEvent<AgentWidgetActivity>("agent-widget-activity", {
            detail: {
                blockId: normalized.blockid,
                action,
                detail: normalized.detail ?? normalized.action,
                point: normalized.point,
                previewImageUrl: normalized.previewimageurl,
                typingText: typingText,
            },
        })
    );
}
