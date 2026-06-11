import { atoms, getBlockMetaKeyAtom, getFocusedBlockId, globalStore } from "@/app/store/global";
import { useWaveEnv } from "@/app/waveenv/waveenv";
import { getLayoutModelForStaticTab } from "@/layout/index";
import { isLocalConnName } from "@/util/util";
import { useCallback, useEffect, useMemo, useState } from "react";
import { v7 as uuidv7 } from "uuid";
import { blockIdFromToolInput, previewImageFromToolUpdate, reportDesktopPetActivity } from "./desktop-pet-activity";

export type AcpBackendInfo = {
    backend: string;
    name: string;
    cliPath: string;
    available: boolean;
    avatar?: string;
    description?: string;
    authRequired?: boolean;
    supportsStreaming?: boolean;
    acpArgs?: string[];
    skillsDirs?: string[];
};

export type AcpAgentProfile = {
    model?: string;
    mode?: string;
    workspace?: string;
    executable?: string;
    configoptions?: Record<string, string>;
    mcpserverids?: string[];
    skillsdirs?: string[];
};

export type AcpConfigChoice = {
    value: string;
    name?: string;
    label?: string;
};

export type AcpConfigOption = {
    id: string;
    name?: string;
    label?: string;
    category?: string;
    type: "select" | "boolean" | "string";
    currentValue?: string;
    selectedValue?: string;
    options?: AcpConfigChoice[];
};

export type AcpModeInfo = {
    currentModeId?: string;
    availableModes?: Array<{ id: string; name?: string; description?: string }>;
};

export type AcpModelInfo = {
    currentModelId?: string | null;
    currentModelLabel?: string | null;
    canSwitch?: boolean;
    availableModels?: Array<{ id: string; label?: string }>;
    source?: string;
    sourceDetail?: string;
};

export type AcpCapabilities = {
    loadSession?: boolean;
    mcpCapabilities?: { stdio?: boolean; http?: boolean; sse?: boolean };
    promptCapabilities?: { image?: boolean; audio?: boolean; embeddedContext?: boolean };
    sessionCapabilities?: { resume?: unknown; list?: unknown; close?: unknown; fork?: unknown };
};

export type AcpAgentMessage = {
    msgId: string;
    type: string;
    data?: unknown;
    timestamp: number;
};

export type AcpSlashCommand = {
    name?: string;
    description?: string;
    hint?: string;
    template?: string;
};

export type AcpPendingConfirmation = {
    id: string;
    callId: string;
    title: string;
    options: Array<{ optionId: string; name: string; kind: string }>;
    toolCall?: unknown;
};

export type AcpSessionState = {
    conversationId: string;
    status: string;
    sessionId: string | null;
    backend: string | null;
    error: string | null;
    messages: AcpAgentMessage[];
    pendingConfirmations: AcpPendingConfirmation[];
    configOptions: AcpConfigOption[];
    modes: AcpModeInfo | null;
    currentMode: string;
    modelInfo: AcpModelInfo | null;
    usage: unknown | null;
    agentInfo: unknown | null;
    capabilities: AcpCapabilities | null;
    slashCommands: Record<string, AcpSlashCommand>;
};

export type AcpRuntimeRecord = AcpSessionState & {
    agentName: string;
    workspace: string;
    title: string;
    referencedFiles: string[];
    isLive: boolean;
    resumeState: "live" | "resumable" | "restart-required" | "archived";
    createdTs: number;
    updatedTs: number;
};

export type AcpProfileAction =
    | { type: "model"; value: string }
    | { type: "mode"; value: string }
    | { type: "config"; id: string; value: string };

type AcpRuntimeStore = {
    activeConversationId: string;
    sessionsById: Record<string, AcpRuntimeRecord>;
    orderedSessionIds: string[];
    hydrated: boolean;
};

type AcpEvent = {
    conversationId: string;
    type: string;
    msgId: string;
    data?: unknown;
    timestamp: number;
};

function textFromAcpEvent(data: unknown): string | undefined {
    if (typeof data === "string") {
        return data;
    }
    const content = data as { text?: unknown } | undefined;
    return typeof content?.text === "string" ? content.text : undefined;
}

const initialState: AcpSessionState = {
    conversationId: "",
    status: "idle",
    sessionId: null,
    backend: null,
    error: null,
    messages: [],
    pendingConfirmations: [],
    configOptions: [],
    modes: null,
    currentMode: "default",
    modelInfo: null,
    usage: null,
    agentInfo: null,
    capabilities: null,
    slashCommands: {},
};

const initialRuntimeStore: AcpRuntimeStore = {
    activeConversationId: "",
    sessionsById: {},
    orderedSessionIds: [],
    hydrated: false,
};

const ActiveSessionStorageKey = "kronoscode:active-session-id";

function readStoredActiveSessionId(): string {
    try {
        return localStorage.getItem(ActiveSessionStorageKey) ?? "";
    } catch {
        return "";
    }
}

function writeStoredActiveSessionId(conversationId: string) {
    try {
        if (conversationId) {
            localStorage.setItem(ActiveSessionStorageKey, conversationId);
        } else {
            localStorage.removeItem(ActiveSessionStorageKey);
        }
    } catch {
        return;
    }
}

function normalizeText(data: unknown): string {
    if (typeof data === "string") {
        return data;
    }
    const raw = data as any;
    return raw?.text ?? raw?.content?.text ?? "";
}

function getFocusedLocalWorkspace(): string | undefined {
    try {
        // First, try the currently focused block
        const focusedBlockId = getFocusedBlockId();
        if (focusedBlockId) {
            const connection = globalStore.get(getBlockMetaKeyAtom(focusedBlockId, "connection"));
            const cwd = globalStore.get(getBlockMetaKeyAtom(focusedBlockId, "cmd:cwd"));
            if (isLocalConnName(connection) && cwd) {
                return cwd;
            }
        }
        // Fallback: scan all blocks for the first local terminal that has a CWD.
        // This handles the case where the AI panel is focused (not a terminal),
        // so the focused block won't have a cmd:cwd — but a terminal block elsewhere
        // in the workspace still has the user's working directory.
        const layoutModel = getLayoutModelForStaticTab();
        if (layoutModel) {
            const entries = globalStore.get(layoutModel.leafOrder);
            for (const entry of entries) {
                if (!entry.blockid) continue;
                const connection = globalStore.get(getBlockMetaKeyAtom(entry.blockid, "connection"));
                if (!isLocalConnName(connection)) continue;
                const cwd = globalStore.get(getBlockMetaKeyAtom(entry.blockid, "cmd:cwd"));
                if (cwd) return cwd;
            }
        }
    } catch {
        return undefined;
    }
    return undefined;
}

function getSurfaceContext(): { tabId: string; blockId?: string } | undefined {
    try {
        const tabId = globalStore.get(atoms.staticTabId);
        if (!tabId) {
            return undefined;
        }
        const blockId = getFocusedBlockId();
        return { tabId, ...(blockId ? { blockId } : {}) };
    } catch {
        return undefined;
    }
}

function parseStoredJson<T>(value: string | undefined, fallback: T): T {
    if (!value) {
        return fallback;
    }
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

function makeRuntime(opts: {
    conversationId: string;
    backend: string;
    agentName?: string;
    workspace?: string;
    title?: string;
    messages?: AcpAgentMessage[];
    referencedFiles?: string[];
    createdTs?: number;
}): AcpRuntimeRecord {
    const now = Date.now();
    return {
        ...initialState,
        conversationId: opts.conversationId,
        backend: opts.backend,
        agentName: opts.agentName ?? opts.backend,
        workspace: opts.workspace ?? "",
        title: opts.title ?? "New chat",
        referencedFiles: opts.referencedFiles ?? [],
        messages: opts.messages ?? [],
        status: "connecting",
        isLive: true,
        resumeState: "live",
        createdTs: opts.createdTs ?? now,
        updatedTs: now,
    };
}

export function applyAcpEvent(runtime: AcpRuntimeRecord, event: AcpEvent): AcpRuntimeRecord {
    const next: AcpRuntimeRecord = {
        ...runtime,
        messages: [...runtime.messages],
        updatedTs: event.timestamp,
    };
    switch (event.type) {
        case "status":
            next.status = (event.data as any)?.status ?? runtime.status;
            break;
        case "tool_permission": {
            const confirmation = (event.data as any)?.confirmation;
            const toolCall = (event.data as any)?.toolCall;
            if (confirmation) {
                next.pendingConfirmations = [...runtime.pendingConfirmations, { ...confirmation, toolCall }];
            }
            break;
        }
        case "error":
            next.error = (event.data as any)?.error ?? runtime.error;
            next.status = "error";
            break;
        case "session_id":
            next.sessionId = (event.data as any)?.sessionId ?? runtime.sessionId;
            break;
        case "finish":
            next.status = "finished";
            break;
        case "config_option": {
            const data = event.data as any;
            next.configOptions = data?.configOptions ?? runtime.configOptions;
            next.modes = data?.modes ?? runtime.modes;
            next.currentMode = data?.currentMode ?? data?.modes?.currentModeId ?? runtime.currentMode;
            break;
        }
        case "usage":
            next.usage = event.data ?? runtime.usage;
            break;
        case "agent_info": {
            const data = event.data as any;
            next.agentInfo = data?.agentInfo ?? event.data;
            next.modelInfo = data?.modelInfo ?? runtime.modelInfo;
            next.capabilities = data?.capabilities ?? runtime.capabilities;
            break;
        }
        case "slash_commands": {
            const commands = (event.data as any)?.commands;
            next.slashCommands = commands && typeof commands === "object" ? commands : runtime.slashCommands;
            break;
        }
    }
    if (event.type !== "slash_commands") {
        next.messages.push({
            msgId: event.msgId,
            type: event.type,
            data: event.data,
            timestamp: event.timestamp,
        });
    }
    return next;
}

export function getCompatibleProfileActions(runtime: AcpRuntimeRecord, profile: AcpAgentProfile): AcpProfileAction[] {
    if (!runtime.isLive) {
        return [];
    }
    const actions: AcpProfileAction[] = [];
    if (
        profile.model &&
        runtime.modelInfo?.canSwitch &&
        runtime.modelInfo.availableModels?.some((model) => model.id === profile.model)
    ) {
        actions.push({ type: "model", value: profile.model });
    }
    if (profile.mode && runtime.modes?.availableModes?.some((mode) => mode.id === profile.mode)) {
        actions.push({ type: "mode", value: profile.mode });
    }
    Object.entries(profile.configoptions ?? {}).forEach(([id, value]) => {
        if (runtime.configOptions.some((option) => option.id === id)) {
            actions.push({ type: "config", id, value });
        }
    });
    return actions;
}

function storedSessionToRuntime(session: AcpSession): AcpRuntimeRecord {
    return {
        ...initialState,
        conversationId: session.oid,
        sessionId: session.acpsessionid ?? null,
        backend: session.backend,
        agentName: session.agentname || session.backend,
        workspace: session.workspace ?? "",
        title: session.title || "Saved chat",
        status: session.status || "idle",
        messages: (session.events ?? []).map((event) => ({
            msgId: event.messageid,
            type: event.type,
            data: parseStoredJson(event.datajson, undefined),
            timestamp: event.timestamp,
        })),
        configOptions: parseStoredJson(session.configoptionsjson, []),
        modes: parseStoredJson(session.modesjson, null),
        modelInfo: parseStoredJson(session.modelinfojson, null),
        capabilities: parseStoredJson(session.capabilitiesjson, null),
        referencedFiles: session.referencedfiles ?? [],
        isLive: false,
        resumeState: (session.resumestate as AcpRuntimeRecord["resumeState"]) || "restart-required",
        createdTs: session.createdts,
        updatedTs: session.updatedts,
    };
}

function runtimeToStoredSession(runtime: AcpRuntimeRecord): AcpSession {
    return {
        otype: "acpsession",
        oid: runtime.conversationId,
        version: 0,
        backend: runtime.backend ?? "",
        agentname: runtime.agentName,
        workspace: runtime.workspace,
        title: runtime.title,
        acpsessionid: runtime.sessionId ?? undefined,
        status: runtime.status,
        resumestate: runtime.resumeState,
        createdts: runtime.createdTs,
        updatedts: runtime.updatedTs,
        modelinfojson: runtime.modelInfo ? JSON.stringify(runtime.modelInfo) : undefined,
        modesjson: runtime.modes ? JSON.stringify(runtime.modes) : undefined,
        configoptionsjson: runtime.configOptions.length ? JSON.stringify(runtime.configOptions) : undefined,
        capabilitiesjson: runtime.capabilities ? JSON.stringify(runtime.capabilities) : undefined,
        referencedfiles: runtime.referencedFiles,
        events: runtime.messages.map((message) => ({
            messageid: message.msgId,
            type: message.type,
            datajson: message.data == null ? undefined : JSON.stringify(message.data),
            timestamp: message.timestamp,
        })),
        meta: {},
    };
}

export function useAcpSession() {
    const { electron, services } = useWaveEnv();
    const [runtimeStore, setRuntimeStore] = useState<AcpRuntimeStore>(initialRuntimeStore);
    const activeRuntime = runtimeStore.sessionsById[runtimeStore.activeConversationId];
    const state: AcpSessionState = activeRuntime ?? initialState;

    const updateRuntime = useCallback(
        (conversationId: string, updater: (runtime: AcpRuntimeRecord) => AcpRuntimeRecord) => {
            setRuntimeStore((previous) => {
                const runtime = previous.sessionsById[conversationId];
                if (!runtime) {
                    return previous;
                }
                return {
                    ...previous,
                    sessionsById: {
                        ...previous.sessionsById,
                        [conversationId]: updater(runtime),
                    },
                };
            });
        },
        []
    );

    useEffect(() => {
        if (!runtimeStore.hydrated) {
            return;
        }
        runtimeStore.orderedSessionIds.forEach((conversationId) => {
            const runtime = runtimeStore.sessionsById[conversationId];
            if (runtime) {
                void services.acp.SaveSession(runtimeToStoredSession(runtime)).catch(() => {});
            }
        });
    }, [runtimeStore.hydrated, runtimeStore.orderedSessionIds, runtimeStore.sessionsById, services.acp]);

    useEffect(() => {
        let cancelled = false;
        const hydrate = async () => {
            const [storedSessions, liveRuntimes] = await Promise.all([
                services.acp
                    .ListSessions()
                    .then((sessions) => sessions ?? [])
                    .catch(() => [] as AcpSession[]),
                electron.acpListRuntimes().catch(() => []),
            ]);
            if (cancelled) {
                return;
            }
            const sessionsById: Record<string, AcpRuntimeRecord> = {};
            storedSessions.forEach((session) => {
                sessionsById[session.oid] = storedSessionToRuntime(session);
            });
            liveRuntimes.forEach((live) => {
                const prior =
                    sessionsById[live.conversationId] ??
                    makeRuntime({
                        conversationId: live.conversationId,
                        backend: live.backend,
                        workspace: live.workspace,
                    });
                sessionsById[live.conversationId] = {
                    ...prior,
                    sessionId: live.sessionId ?? prior.sessionId,
                    status: live.status,
                    error: live.error ?? prior.error,
                    configOptions: live.configOptions ?? prior.configOptions,
                    modes: live.modes ?? prior.modes,
                    currentMode: live.currentMode ?? prior.currentMode,
                    modelInfo: live.modelInfo ?? prior.modelInfo,
                    capabilities: live.capabilities ?? prior.capabilities,
                    isLive: true,
                    resumeState: "live",
                };
            });
            const orderedSessionIds = Object.values(sessionsById)
                .sort((left, right) => right.updatedTs - left.updatedTs)
                .map((runtime) => runtime.conversationId);
            const storedActiveId = readStoredActiveSessionId();
            const activeConversationId =
                (storedActiveId && sessionsById[storedActiveId]?.resumeState !== "archived" && storedActiveId) ||
                orderedSessionIds.find((id) => sessionsById[id].resumeState !== "archived") ||
                "";
            setRuntimeStore({
                activeConversationId,
                sessionsById,
                orderedSessionIds,
                hydrated: true,
            });
        };
        void hydrate();
        return () => {
            cancelled = true;
        };
    }, [electron, services.acp]);

    const detectAgents = useCallback(async (): Promise<AcpBackendInfo[]> => electron.acpDetectAgents(), [electron]);

    const initialize = useCallback(
        async (opts: {
            conversationId?: string;
            backend: string;
            agentName?: string;
            workspace?: string;
            cliPath?: string;
            customArgs?: string[];
            customEnv?: Record<string, string>;
            resumeSessionId?: string;
            resumeSessionConversationId?: string;
            mcpServers?: Array<
                | {
                      type?: "stdio";
                      name: string;
                      command: string;
                      args: string[];
                      env: Array<{ name: string; value: string }>;
                  }
                | {
                      type: "http" | "sse";
                      name: string;
                      url: string;
                      headers?: Array<{ name: string; value: string }>;
                  }
            >;
            title?: string;
            referencedFiles?: string[];
            messages?: AcpAgentMessage[];
            profile?: AcpAgentProfile;
        }) => {
            const conversationId = opts.conversationId || uuidv7();
            const workspace = opts.workspace ?? opts.profile?.workspace ?? getFocusedLocalWorkspace() ?? "";
            const runtime = makeRuntime({
                conversationId,
                backend: opts.backend,
                agentName: opts.agentName,
                workspace,
                title: opts.title,
                referencedFiles: opts.referencedFiles,
                messages: opts.messages,
            });
            setRuntimeStore((previous) => ({
                ...previous,
                activeConversationId: conversationId,
                orderedSessionIds: [
                    conversationId,
                    ...previous.orderedSessionIds.filter((id) => id !== conversationId),
                ],
                sessionsById: { ...previous.sessionsById, [conversationId]: runtime },
            }));
            const result = await electron.acpInitialize({
                conversationId,
                backend: opts.backend,
                workspace: workspace || undefined,
                cliPath: opts.profile?.executable || opts.cliPath,
                customArgs: opts.customArgs,
                customEnv: opts.customEnv,
                resumeSessionId: opts.resumeSessionId,
                resumeSessionConversationId: opts.resumeSessionConversationId,
                mcpServers: opts.mcpServers,
                surfaceContext: getSurfaceContext(),
            });
            if (!result.success) {
                updateRuntime(conversationId, (current) => ({
                    ...current,
                    status: "error",
                    error: result.error ?? "Failed to initialize ACP agent",
                    isLive: false,
                    resumeState: "restart-required",
                }));
                return { conversationId, success: false, error: result.error };
            }
            const status = await electron.acpGetStatus({ conversationId }).catch((err) => ({
                status: "connected",
                error: err instanceof Error ? err.message : String(err),
                sessionId: null,
                backend: opts.backend,
                found: true,
                confirmations: [],
                modelInfo: null,
                configOptions: [],
                modes: null,
                currentMode: "default",
                capabilities: null,
            }));
            const modelInfoResult = await electron.acpGetModelInfo({ conversationId }).catch(() => null);
            const modelInfo = status.modelInfo ?? modelInfoResult?.data?.modelInfo ?? null;
            updateRuntime(conversationId, (current) => ({
                ...current,
                status: status.status ?? current.status,
                error: status.error ?? current.error,
                sessionId: status.sessionId ?? current.sessionId,
                configOptions: status.configOptions ?? current.configOptions,
                modes: status.modes ?? current.modes,
                currentMode: status.currentMode ?? current.currentMode,
                modelInfo: modelInfo ?? current.modelInfo,
                capabilities: status.capabilities ?? current.capabilities,
            }));
            if (
                opts.profile?.mode &&
                status.modes?.availableModes?.some((mode: any) => mode.id === opts.profile?.mode)
            ) {
                await electron.acpSetMode({ conversationId, mode: opts.profile.mode }).catch(() => null);
            }
            if (
                opts.profile?.model &&
                status.modelInfo?.availableModels?.some((model: any) => model.id === opts.profile?.model)
            ) {
                await electron.acpSetModel({ conversationId, modelId: opts.profile.model }).catch(() => null);
            }
            for (const [configId, value] of Object.entries(opts.profile?.configoptions ?? {})) {
                if (status.configOptions?.some((option: any) => option.id === configId)) {
                    await electron.acpSetConfigOption({ conversationId, configId, value }).catch(() => null);
                }
            }
            return { conversationId, success: true, error: undefined };
        },
        [electron, updateRuntime]
    );

    const selectSession = useCallback((conversationId: string) => {
        setRuntimeStore((previous) => {
            if (!previous.sessionsById[conversationId]) {
                return previous;
            }
            writeStoredActiveSessionId(conversationId);
            return { ...previous, activeConversationId: conversationId };
        });
    }, []);

    useEffect(() => {
        if (!runtimeStore.hydrated || !runtimeStore.activeConversationId) {
            return;
        }
        writeStoredActiveSessionId(runtimeStore.activeConversationId);
    }, [runtimeStore.hydrated, runtimeStore.activeConversationId]);

    const updateSessionContext = useCallback(
        (workspace: string, referencedFiles: string[]) => {
            const conversationId = runtimeStore.activeConversationId;
            if (!conversationId) {
                return;
            }
            updateRuntime(conversationId, (runtime) => ({
                ...runtime,
                workspace,
                referencedFiles,
                updatedTs: Date.now(),
            }));
        },
        [runtimeStore.activeConversationId, updateRuntime]
    );

    const sendMessage = useCallback(
        async (content: string, targetConversationId?: string) => {
            const conversationId = targetConversationId ?? runtimeStore.activeConversationId;
            if (!conversationId) {
                return;
            }
            updateRuntime(conversationId, (runtime) => ({
                ...runtime,
                status: "running",
                error: null,
                title: runtime.title === "New chat" ? content.slice(0, 52) : runtime.title,
                messages: [
                    ...runtime.messages,
                    {
                        msgId: `${conversationId}-local-${Date.now()}`,
                        type: "user_message",
                        data: { text: content },
                        timestamp: Date.now(),
                    },
                ],
                updatedTs: Date.now(),
            }));
            const result = await electron.acpSendMessage({ conversationId, content }).catch((err) => ({
                success: false,
                error: err instanceof Error ? err.message : String(err),
            }));
            if (!result.success) {
                updateRuntime(conversationId, (runtime) => ({
                    ...runtime,
                    status: "error",
                    error: result.error ?? "Failed to send message",
                }));
            }
        },
        [electron, runtimeStore.activeConversationId, updateRuntime]
    );

    const confirmTool = useCallback(
        async (callId: string, optionId: string) => {
            const conversationId = runtimeStore.activeConversationId;
            const runtime = runtimeStore.sessionsById[conversationId];
            const confirmation = runtime?.pendingConfirmations.find((item) => item.callId === callId);
            if (!confirmation) {
                return;
            }
            await electron.acpConfirmTool({ conversationId, msgId: confirmation.id, callId, optionId });
            updateRuntime(conversationId, (current) => ({
                ...current,
                pendingConfirmations: current.pendingConfirmations.filter((item) => item.callId !== callId),
            }));
        },
        [electron, runtimeStore.activeConversationId, runtimeStore.sessionsById, updateRuntime]
    );

    const closeSession = useCallback(
        async (conversationId: string) => {
            const runtime = runtimeStore.sessionsById[conversationId];
            if (runtime?.isLive) {
                await electron.acpStop({ conversationId }).catch(() => null);
            }
            updateRuntime(conversationId, (current) => ({
                ...current,
                status: "archived",
                isLive: false,
                resumeState: "archived",
                updatedTs: Date.now(),
            }));
            if (runtimeStore.activeConversationId === conversationId) {
                setRuntimeStore((previous) => ({
                    ...previous,
                    activeConversationId:
                        previous.orderedSessionIds.find(
                            (id) => id !== conversationId && previous.sessionsById[id].resumeState !== "archived"
                        ) ?? "",
                }));
            }
        },
        [electron, runtimeStore.activeConversationId, runtimeStore.sessionsById, updateRuntime]
    );

    const stop = useCallback(async () => {
        const conversationId = runtimeStore.activeConversationId;
        if (!conversationId) {
            return;
        }
        await electron.acpStop({ conversationId }).catch(() => null);
        updateRuntime(conversationId, (runtime) => ({
            ...runtime,
            status: "idle",
            isLive: false,
            resumeState: runtime.capabilities?.loadSession ? "resumable" : "restart-required",
        }));
    }, [electron, runtimeStore.activeConversationId, updateRuntime]);

    const setMode = useCallback(
        async (mode: string, targetConversationId?: string) => {
            const conversationId = targetConversationId ?? runtimeStore.activeConversationId;
            if (!conversationId) {
                return;
            }
            const result = await electron.acpSetMode({ conversationId, mode });
            updateRuntime(conversationId, (runtime) =>
                result.success
                    ? { ...runtime, currentMode: mode, error: null }
                    : { ...runtime, error: result.error ?? "Failed to set ACP mode" }
            );
        },
        [electron, runtimeStore.activeConversationId, updateRuntime]
    );

    const setConfigOption = useCallback(
        async (configId: string, value: string, targetConversationId?: string) => {
            const conversationId = targetConversationId ?? runtimeStore.activeConversationId;
            if (!conversationId) {
                return;
            }
            const result = await electron.acpSetConfigOption({ conversationId, configId, value });
            updateRuntime(conversationId, (runtime) => ({
                ...runtime,
                error: result.success ? null : (result.error ?? "Failed to set ACP option"),
                configOptions:
                    result.data?.configOptions ??
                    runtime.configOptions.map((option) =>
                        option.id === configId ? { ...option, currentValue: value, selectedValue: value } : option
                    ),
            }));
        },
        [electron, runtimeStore.activeConversationId, updateRuntime]
    );

    const setModel = useCallback(
        async (modelId: string, targetConversationId?: string) => {
            const conversationId = targetConversationId ?? runtimeStore.activeConversationId;
            if (!conversationId) {
                return;
            }
            const result = await electron.acpSetModel({ conversationId, modelId }).catch((err) => ({
                success: false,
                error: err instanceof Error ? err.message : String(err),
                data: undefined,
            }));
            updateRuntime(conversationId, (runtime) => ({
                ...runtime,
                error: result.success ? null : (result.error ?? "Failed to set ACP model"),
                modelInfo: result.data?.modelInfo ?? runtime.modelInfo,
            }));
        },
        [electron, runtimeStore.activeConversationId, updateRuntime]
    );

    const applyProfileToLiveSessions = useCallback(
        async (backend: string, profile: AcpAgentProfile) => {
            const runtimes = Object.values(runtimeStore.sessionsById).filter(
                (runtime) => runtime.backend === backend && runtime.isLive
            );
            let applied = 0;
            for (const runtime of runtimes) {
                const actions = getCompatibleProfileActions(runtime, profile);
                for (const action of actions) {
                    if (action.type === "model") {
                        const result = await electron.acpSetModel({
                            conversationId: runtime.conversationId,
                            modelId: action.value,
                        });
                        if (result.success) {
                            applied += 1;
                            updateRuntime(runtime.conversationId, (current) => ({
                                ...current,
                                modelInfo: result.data?.modelInfo ?? current.modelInfo,
                                error: null,
                            }));
                        }
                        continue;
                    }
                    if (action.type === "mode") {
                        const result = await electron.acpSetMode({
                            conversationId: runtime.conversationId,
                            mode: action.value,
                        });
                        if (result.success) {
                            applied += 1;
                            updateRuntime(runtime.conversationId, (current) => ({
                                ...current,
                                currentMode: action.value,
                                error: null,
                            }));
                        }
                        continue;
                    }
                    const result = await electron.acpSetConfigOption({
                        conversationId: runtime.conversationId,
                        configId: action.id,
                        value: action.value,
                    });
                    if (result.success) {
                        applied += 1;
                        updateRuntime(runtime.conversationId, (current) => ({
                            ...current,
                            configOptions:
                                result.data?.configOptions ??
                                current.configOptions.map((option) =>
                                    option.id === action.id
                                        ? { ...option, currentValue: action.value, selectedValue: action.value }
                                        : option
                                ),
                            error: null,
                        }));
                    }
                }
            }
            return { applied, runtimes: runtimes.length };
        },
        [electron, runtimeStore.sessionsById, updateRuntime]
    );

    useEffect(() => {
        return electron.onAcpEvent((event: AcpEvent) => {
            if (event.type === "status") {
                const status = (event.data as { status?: string } | undefined)?.status;
                if (status === "running" || status === "connecting") {
                    reportDesktopPetActivity({ kind: "thinking", detail: "KronosCode working" }, undefined, undefined, {
                        phase: "running",
                        surface: "panel",
                        action: "thinking",
                    });
                } else {
                    reportDesktopPetActivity({ kind: "idle" }, undefined, undefined, {
                        phase: status === "error" ? "failed" : "succeeded",
                        surface: "panel",
                        action: "focus",
                    });
                }
            }
            if (event.type === "agent_thought_chunk") {
                reportDesktopPetActivity(
                    {
                        kind: "thinking",
                        detail: "Reasoning",
                        thought: textFromAcpEvent(event.data),
                    },
                    undefined,
                    undefined,
                    { phase: "running", surface: "panel", action: "thinking" }
                );
            }
            if (event.type === "tool_call") {
                const data = event.data as
                    | { title?: string; rawInput?: Record<string, unknown>; status?: string }
                    | undefined;
                const blockId = blockIdFromToolInput(data?.rawInput);
                reportDesktopPetActivity(
                    { kind: "tool", detail: data?.title ?? "Using tool" },
                    blockId,
                    data?.rawInput,
                    {
                        phase: data?.status === "pending" ? "queued" : "running",
                        blockid: blockId,
                    }
                );
            }
            if (event.type === "tool_call_update") {
                const data = event.data as
                    | { title?: string; rawInput?: Record<string, unknown>; status?: string }
                    | undefined;
                const previewImageUrl = previewImageFromToolUpdate(data);
                if (data?.title || previewImageUrl) {
                    const blockId = blockIdFromToolInput(data?.rawInput);
                    reportDesktopPetActivity(
                        {
                            kind: "tool",
                            detail: previewImageUrl ? "Computer use screenshot" : (data?.title ?? "Using tool"),
                            previewImageUrl,
                        },
                        blockId,
                        data?.rawInput,
                        {
                            phase: data?.status === "failed" ? "failed" : "verifying",
                            blockid: blockId,
                        }
                    );
                }
            }
            if (event.type === "tool_permission") {
                const data = event.data as
                    | { confirmation?: { title?: string }; toolCall?: { title?: string } }
                    | undefined;
                reportDesktopPetActivity(
                    { kind: "tool", detail: data?.confirmation?.title ?? data?.toolCall?.title ?? "Review required" },
                    undefined,
                    undefined,
                    { phase: "awaiting-approval", surface: "panel", action: "wait" }
                );
            }
            if (event.type === "finish" || event.type === "error") {
                reportDesktopPetActivity(
                    {
                        kind: "idle",
                        detail: event.type === "finish" ? "Task complete" : "Task ended",
                    },
                    undefined,
                    undefined,
                    {
                        phase: event.type === "finish" ? "succeeded" : "failed",
                        surface: "panel",
                        action: "focus",
                    }
                );
            }
            updateRuntime(event.conversationId, (runtime) => applyAcpEvent(runtime, event));
        });
    }, [electron, updateRuntime]);

    const sessions = useMemo(
        () => runtimeStore.orderedSessionIds.map((id) => runtimeStore.sessionsById[id]).filter(Boolean),
        [runtimeStore.orderedSessionIds, runtimeStore.sessionsById]
    );
    const agentMessages = useMemo(
        () => state.messages.filter((message) => message.type === "agent_message_chunk"),
        [state.messages]
    );
    const thoughtMessages = useMemo(
        () => state.messages.filter((message) => message.type === "agent_thought_chunk"),
        [state.messages]
    );
    const toolCalls = useMemo(
        () => state.messages.filter((message) => message.type === "tool_call" || message.type === "tool_call_update"),
        [state.messages]
    );
    const plans = useMemo(() => state.messages.filter((message) => message.type === "plan"), [state.messages]);
    const fullText = useMemo(
        () => agentMessages.map((message) => normalizeText(message.data)).join(""),
        [agentMessages]
    );

    return {
        state,
        activeRuntime,
        sessions,
        hydrated: runtimeStore.hydrated,
        detectAgents,
        initialize,
        selectSession,
        updateSessionContext,
        sendMessage,
        confirmTool,
        closeSession,
        stop,
        setMode,
        setConfigOption,
        setModel,
        applyProfileToLiveSessions,
        agentMessages,
        thoughtMessages,
        toolCalls,
        plans,
        fullText,
    };
}
