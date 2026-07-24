export type ChatHubV2State =
    | { status: "idle"; url?: string; error?: never; health?: ChatHubV2RuntimeHealth }
    | { status: "starting"; url?: string; error?: never; health?: ChatHubV2RuntimeHealth }
    | { status: "ready"; url: string; error?: never; health?: ChatHubV2RuntimeHealth }
    | { status: "error"; url?: string; error: string; health?: ChatHubV2RuntimeHealth };

export function resolveBackendStateFromStatus(
    status: Awaited<ReturnType<ElectronApi["chathubv2Status"]>>
): ChatHubV2State {
    if (status.success && status.data?.ready && status.data.url) {
        return { status: "ready", url: status.data.url, health: status.health ?? status.data.health };
    }
    if (status.success && status.data?.url) {
        return { status: "starting", url: status.data.url, health: status.health ?? status.data.health };
    }
    return { status: "idle", health: status.health };
}

export function resolveBackendStateFromStartResult(
    result: Awaited<ReturnType<ElectronApi["chathubv2Start"]>>
): ChatHubV2State {
    if (!result.success || !result.data?.url) {
        return {
            status: "error",
            error: result.error ?? result.health?.startupError ?? "KronosChamber backend did not return a URL",
            health: result.health,
        };
    }
    return result.data.ready
        ? { status: "ready", url: result.data.url, health: result.health ?? result.data.health }
        : { status: "starting", url: result.data.url, health: result.health ?? result.data.health };
}
