export function makeKronTermRuntimeTokenBody(surface) {
    return {
        token: surface.token,
        tabId: surface.tabId,
        ...(surface.blockId ? { blockId: surface.blockId } : {}),
        ...(surface.surfaceId ? { surfaceId: surface.surfaceId } : {}),
    };
}

export function makeKronTermSurfaceMcpBody(serverPath, environment, electronExecPath = process.execPath) {
    return {
        name: "wave-surface",
        config: {
            type: "local",
            command: [electronExecPath, serverPath],
            environment,
            enabled: true,
        },
    };
}
