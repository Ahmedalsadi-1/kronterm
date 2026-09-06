import type { LiveAgentSurfaceActivity } from "../../../types/agent-activity";

export type ChatHubV2ActivityKind =
    "queued" | "running" | "approval" | "blocked" | "failed" | "recovery" | "completed" | "evidence";

export type ChatHubV2ActivityIdentity = {
    blockId: string;
    runIds?: ReadonlySet<string>;
    sessionIds?: ReadonlySet<string>;
    surfaceId: string;
};

export type ChatHubV2ActivityStatus = {
    activity: LiveAgentSurfaceActivity;
    detail: string;
    dismissAfterMs?: number;
    kind: ChatHubV2ActivityKind;
    label: string;
    recovery?: string;
};

const ErrorCopy: Record<NonNullable<LiveAgentSurfaceActivity["errorcode"]>, string> = {
    "invalid-target": "The target is not valid anymore.",
    "stale-target": "The target changed before the action finished.",
    permission: "KronosCode does not have permission for this action.",
    unavailable: "The requested surface is unavailable.",
    timeout: "The action timed out before it could finish.",
    "action-failed": "The tool could not complete the action.",
};

function activityDetail(activity: LiveAgentSurfaceActivity): string {
    return activity.detail?.trim() || activity.thought?.trim() || `${activity.action} ${activity.surface}`;
}

function approvalDetail(activity: LiveAgentSurfaceActivity): string {
    const target = activityDetail(activity);
    if (activity.risk === "dangerous") {
        return `${target} This action may be difficult to reverse.`;
    }
    if (activity.risk === "sensitive") {
        return `${target} This action may expose private data.`;
    }
    if (activity.risk === "write") {
        return `${target} This action can change workspace data.`;
    }
    return `${target} This action is read-only.`;
}

function failureDetail(activity: LiveAgentSurfaceActivity): string {
    const error = activity.errorcode ? ErrorCopy[activity.errorcode] : "The action did not complete.";
    const detail = activityDetail(activity);
    return detail === `${activity.action} ${activity.surface}` ? error : `${detail} ${error}`;
}

export function isActivityForChatHubSurface(
    activity: LiveAgentSurfaceActivity,
    context: ChatHubV2ActivityIdentity
): boolean {
    if (activity.surfaceid) {
        return activity.surfaceid === context.surfaceId;
    }
    if (activity.sessionid && context.sessionIds?.has(activity.sessionid)) {
        return true;
    }
    if (activity.runid && context.runIds?.has(activity.runid)) {
        return true;
    }
    if (activity.blockid) {
        return activity.blockid === context.blockId;
    }
    return false;
}

export function rememberChatHubActivityIdentity(
    activity: LiveAgentSurfaceActivity,
    identity: { runIds: Set<string>; sessionIds: Set<string> }
): void {
    if (activity.runid) {
        identity.runIds.add(activity.runid);
    }
    if (activity.sessionid) {
        identity.sessionIds.add(activity.sessionid);
    }
}

export function projectChatHubActivity(activity: LiveAgentSurfaceActivity): ChatHubV2ActivityStatus {
    if (activity.phase === "queued") {
        return {
            activity,
            detail: activityDetail(activity),
            dismissAfterMs: 10_000,
            kind: "queued",
            label: "Queued",
        };
    }
    if (activity.phase === "awaiting-approval") {
        return {
            activity,
            detail: approvalDetail(activity),
            kind: "approval",
            label: "Approval needed",
            recovery: "Review the target and consequence in KronosChamber before approving.",
        };
    }
    if (activity.phase === "running" || activity.phase === "verifying") {
        return {
            activity,
            detail: activityDetail(activity),
            dismissAfterMs: 10_000,
            kind: "running",
            label: activity.phase === "verifying" ? "Verifying result" : "KronosCode is working",
        };
    }
    if (activity.phase === "degraded") {
        return {
            activity,
            detail: activityDetail(activity),
            kind: "blocked",
            label: "Agent blocked",
            recovery: "Inspect the action details, restore the unavailable dependency, then retry.",
        };
    }
    if (activity.phase === "failed") {
        return {
            activity,
            detail: failureDetail(activity),
            kind: "failed",
            label: "Action failed",
            recovery: "Adjust the target or permissions, then ask KronosCode to retry.",
        };
    }
    if (activity.phase === "paused" || activity.phase === "cancelled") {
        return {
            activity,
            detail: activityDetail(activity),
            kind: "recovery",
            label: activity.phase === "paused" ? "Agent paused" : "Run cancelled",
            recovery:
                activity.phase === "paused"
                    ? "Resume when you are ready."
                    : "Your work is preserved. Start again when ready.",
        };
    }

    const hasEvidence =
        activity.verificationstatus != null ||
        activity.previewimageurl != null ||
        activity.path != null ||
        activity.blockid != null;
    return {
        activity,
        detail: hasEvidence ? activityDetail(activity) : "The action completed successfully.",
        dismissAfterMs: 6_000,
        kind: hasEvidence ? "evidence" : "completed",
        label: activity.verificationstatus === "verified" ? "Evidence verified" : "Action completed",
    };
}
