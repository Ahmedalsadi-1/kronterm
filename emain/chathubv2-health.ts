type KronosChamberHealthPayload = {
    status?: unknown;
    openCodeRunning?: unknown;
    isOpenCodeReady?: unknown;
};

export function isKronosChamberReady(value: unknown): boolean {
    if (typeof value !== "object" || value == null) {
        return false;
    }
    const health = value as KronosChamberHealthPayload;
    return health.status === "ok" && health.openCodeRunning === true && health.isOpenCodeReady === true;
}
