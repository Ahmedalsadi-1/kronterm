export type ChatHubV2SurfaceContext = {
    tabId?: string;
    blockId?: string;
};

export function makeStartupSurfaceContext(context: ChatHubV2SurfaceContext): ChatHubV2SurfaceContext {
    return {
        ...(context.tabId ? { tabId: context.tabId } : {}),
        ...(context.blockId ? { blockId: context.blockId } : {}),
    };
}

export function makeSurfaceTokenRequest(context: ChatHubV2SurfaceContext): CommandCreateSurfaceTokenData {
    return {
        tabid: context.tabId ?? "",
        blockid: context.blockId ?? "",
    };
}

export function makeSurfaceEnvironment(token: CommandCreateSurfaceTokenRtnData): NodeJS.ProcessEnv {
    return {
        KRONTERM_JWT: token.token,
        WAVETERM_JWT: token.token,
        KRONTERM_TABID: token.tabid,
        WAVETERM_TABID: token.tabid,
        ...(token.blockid
            ? {
                  KRONTERM_BLOCKID: token.blockid,
                  WAVETERM_BLOCKID: token.blockid,
              }
            : {}),
    };
}

export function makeRuntimeTokenPayload(token: CommandCreateSurfaceTokenRtnData): {
    token: string;
    tabId: string;
    blockId: string;
} {
    return {
        token: token.token,
        tabId: token.tabid,
        blockId: token.blockid ?? "",
    };
}
