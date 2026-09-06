export type InteractionSurface = "kronterm" | "sandbox" | "desktop";

export type InteractionAction =
    | "observe"
    | "move"
    | "click"
    | "drag"
    | "scroll"
    | "type"
    | "paste"
    | "press"
    | "wait"
    | "inspect";

export type InteractionPoint = { x: number; y: number };

export type InteractionRequest = {
    surface: InteractionSurface;
    surfaceId: string;
    action: InteractionAction;
    point?: InteractionPoint;
    targetRef?: string;
    expected?: string;
    maxAttempts?: number;
};

export type InteractionEvidence = {
    observedBefore: boolean;
    verifiedAfter: boolean;
    previewImageUrl?: string;
    summary?: string;
};

export type InteractionResult = {
    ok: boolean;
    surface: InteractionSurface;
    surfaceId: string;
    action: InteractionAction;
    point?: InteractionPoint;
    targetRef?: string;
    attempts: number;
    startedAt: string;
    finishedAt: string;
    evidence: InteractionEvidence;
    errorCode?: "invalid-target" | "stale-target" | "permission" | "unavailable" | "timeout" | "action-failed";
    error?: string;
};

const MutatingActions = new Set<InteractionAction>(["click", "drag", "scroll", "type", "paste", "press"]);

export function normalizeShortcut(keys: string | string[]): string {
    const parts = Array.isArray(keys) ? keys : keys.split(/[+\s]+/);
    const aliases: Record<string, string> = {
        cmd: "Meta",
        command: "Meta",
        super: "Meta",
        ctrl: "Control",
        control: "Control",
        option: "Alt",
        esc: "Escape",
        return: "Enter",
    };
    return parts
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => aliases[part.toLowerCase()] ?? (part.length === 1 ? part.toLowerCase() : part))
        .join("+");
}

export function validateInteraction(request: InteractionRequest): void {
    if (!request.surfaceId.trim()) {
        throw new Error("surfaceId is required");
    }
    if (request.point && (!Number.isFinite(request.point.x) || !Number.isFinite(request.point.y))) {
        throw new Error("interaction coordinates must be finite numbers");
    }
    if (request.point && (request.point.x < 0 || request.point.y < 0)) {
        throw new Error("interaction coordinates must be non-negative");
    }
}

export function classifyInteractionError(error: unknown): InteractionResult["errorCode"] {
    const message = String(error).toLowerCase();
    if (/stale|not found|unknown element|invalid ref/.test(message)) return "stale-target";
    if (/permission|accessibility|screen recording|not authorized/.test(message)) return "permission";
    if (/timeout|timed out|deadline/.test(message)) return "timeout";
    if (/not running|unavailable|connection|econnrefused|missing/.test(message)) return "unavailable";
    if (/coordinate|target|surfaceid/.test(message)) return "invalid-target";
    return "action-failed";
}

export async function runInteraction<T>(
    request: InteractionRequest,
    execute: (attempt: number) => Promise<T>,
    options: {
        preflight?: () => Promise<void>;
        verify?: (value: T) => Promise<InteractionEvidence>;
    } = {}
): Promise<{ value?: T; result: InteractionResult }> {
    const startedAt = new Date().toISOString();
    let attempts = 0;
    try {
        validateInteraction(request);
        await options.preflight?.();
        const requestedAttempts = Math.max(1, Math.min(request.maxAttempts ?? 2, 3));
        const maxAttempts = MutatingActions.has(request.action) ? 1 : requestedAttempts;
        let lastError: unknown;
        for (attempts = 1; attempts <= maxAttempts; attempts++) {
            try {
                const value = await execute(attempts);
                const evidence = options.verify
                    ? await options.verify(value)
                    : { observedBefore: true, verifiedAfter: true };
                return {
                    value,
                    result: {
                        ok: true,
                        ...request,
                        attempts,
                        startedAt,
                        finishedAt: new Date().toISOString(),
                        evidence,
                    },
                };
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError;
    } catch (error) {
        return {
            result: {
                ok: false,
                ...request,
                attempts,
                startedAt,
                finishedAt: new Date().toISOString(),
                evidence: { observedBefore: options.preflight != null, verifiedAfter: false },
                errorCode: classifyInteractionError(error),
                error: error instanceof Error ? error.message : String(error),
            },
        };
    }
}
