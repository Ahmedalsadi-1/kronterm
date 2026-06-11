// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { RpcApi } from "../../frontend/app/store/wshclientapi";
import { ElectronWshClient } from "../emain-wsh";
import { detectInstalledAgents, spawnAcpAgent } from "./acp-connector";
import { NdjsonTransport } from "./acp-transport";
import {
    AcpAgentCapabilities,
    AcpAgentStatus,
    AcpDetectedAgent,
    AcpEvent,
    AcpEventType,
    AcpIpcConfirmToolRequest,
    AcpIpcSendMessageRequest,
    AcpIpcSetConfigOptionRequest,
    AcpIpcSetModeRequest,
    AcpIpcSetModelRequest,
    AcpModelInfo,
    AcpPendingConfirmation,
    AcpPermissionRequest,
    AcpSessionModes,
    AcpSessionUpdate,
} from "./acp-types";

interface AcpAgentManagerOptions {
    conversationId: string;
    backend: string;
    workspace?: string;
    cliPath?: string;
    customArgs?: string[];
    customEnv?: Record<string, string>;
    resumeSessionId?: string;
    resumeSessionConversationId?: string;
    surfaceContext?: {
        tabId: string;
        blockId?: string;
    };
    mcpServers?: AcpSessionMcpServer[];
    maxReconnectAttempts?: number;
    reconnectDelayMs?: number;
}

const DEFAULT_MAX_RECONNECT_ATTEMPTS = 3;
const DEFAULT_RECONNECT_DELAY_MS = 2000;

const waveSurfaceBootstrap = `[KronTerm Surface Capability]
This chat is connected to the kron-term MCP server with a temporary Wave surface-session capability. Prefer Wave surface tools for Kronterm tabs, widgets, terminals, the in-app browser, and host-scoped file context; use other desktop or browser tools only when the Wave surface cannot perform the operation. Use surface_status before diagnosing failures, list_blocks before block operations, and widget_snapshot before interacting with block content. Full guidance is available from the MCP prompt "kron-term-guide" or resource "kron-term://skill".`;

type AcpSessionMcpNameValue = {
    name: string;
    value: string;
};

type AcpSessionMcpServerStdio = {
    type?: "stdio";
    name: string;
    command: string;
    args: string[];
    env: AcpSessionMcpNameValue[];
};

type AcpSessionMcpServerHttpLike = {
    type: "http" | "sse";
    name: string;
    url: string;
    headers?: AcpSessionMcpNameValue[];
};

type AcpSessionMcpServer = AcpSessionMcpServerStdio | AcpSessionMcpServerHttpLike;

export class AcpAgentManager extends EventEmitter {
    conversationId: string;
    backend: string;
    workspace: string;
    status: AcpAgentStatus = "idle";
    sessionId: string | null = null;
    transport: NdjsonTransport | null = null;
    confirmations: AcpPendingConfirmation[] = [];
    error: string | null = null;
    modes: AcpSessionModes | null = null;
    currentMode: string | null = null;
    configOptions: unknown[] = [];
    modelInfo: AcpModelInfo | null = null;
    agentInfo: unknown = null;
    capabilities: AcpAgentCapabilities | null = null;
    private msgCounter = 0;
    private surfaceMcpAvailable = false;
    private surfaceInstructionsInjected = false;
    private hasReceivedUsageUpdate = false;
    private surfaceContext: { tabId: string; blockId?: string } | undefined;
    private requestedMcpServers: AcpSessionMcpServer[] = [];
    private savedOpts: AcpAgentManagerOptions | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts: number;
    private reconnectDelayMs: number;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private intentionalStop = false;

    constructor(opts: AcpAgentManagerOptions) {
        super();
        this.conversationId = opts.conversationId;
        this.backend = opts.backend;
        this.workspace = opts.workspace || process.cwd();
        this.surfaceContext = opts.surfaceContext;
        this.requestedMcpServers = opts.mcpServers ?? [];
        this.maxReconnectAttempts = opts.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;
        this.reconnectDelayMs = opts.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
    }

    async initialize(opts: AcpAgentManagerOptions): Promise<void> {
        this.setStatus("connecting");
        this.savedOpts = opts;
        this.intentionalStop = false;
        this.reconnectAttempts = 0;

        const cliPath = opts.cliPath || opts.backend;
        try {
            const { child, isDetached } = await spawnAcpAgent(
                opts.backend,
                cliPath,
                this.workspace,
                opts.customArgs,
                opts.customEnv
            );

            this.transport = new NdjsonTransport(child, isDetached, this.workspace);
            this.setupTransportHandlers();

            const initResult = await this.transport.initialize();
            this.capabilities = initResult.capabilities;
            this.modes = initResult.modes;
            this.currentMode = initResult.modes?.currentModeId ?? initResult.modes?.availableModes?.[0]?.id ?? null;
            this.agentInfo = initResult.agentInfo;
            if (initResult.agentInfo) {
                this.emitEvent("agent_info", {
                    agentInfo: initResult.agentInfo,
                    capabilities: this.capabilities,
                });
            }
            if (initResult.modes) {
                this.emitEvent("config_option", {
                    modes: initResult.modes,
                    currentMode: this.currentMode,
                    configOptions: this.configOptions,
                });
            }
            await this.ensureSession(opts.resumeSessionId, opts.resumeSessionConversationId);

            this.transport.startKeepalive();
            this.setStatus("connected");
        } catch (err) {
            this.transport?.kill();
            this.transport = null;
            this.sessionId = null;
            this.confirmations = [];
            this.error = err instanceof Error ? err.message : String(err);
            this.setStatus("error");
            throw err;
        }
    }

    private setupTransportHandlers(): void {
        if (!this.transport) return;
        const transport = this.transport;

        transport.on("session_update", (update: AcpSessionUpdate) => {
            this.handleSessionUpdate(update);
        });

        transport.on("permission_request", (data: { id: number; params: AcpPermissionRequest }) => {
            this.handlePermissionRequest(data.id, data.params);
        });

        transport.on("notification", (data: { method: string; params: any }) => {
            if (data.method.includes("model") && data.params) {
                this.modelInfo = data.params.modelInfo ?? data.params;
                this.emitEvent("agent_info", {
                    agentInfo: this.agentInfo,
                    modelInfo: this.modelInfo,
                });
            }
        });

        transport.on("stderr", (data: string) => {
            const message = data.trim();
            if (message) {
                console.debug(`[acp:${this.backend}] ${message}`);
            }
        });

        transport.on("error", (err: Error) => {
            this.error = err.message;
            this.setStatus("error");
            this.emitEvent("error", { error: err.message });
        });

        transport.on("disconnect", (data: { code: number | null; signal: NodeJS.Signals | string | null }) => {
            if (this.transport !== transport) {
                return;
            }
            const isKeepaliveTimeout = data.signal === "keepalive-timeout";
            const message = `ACP process exited unexpectedly (code=${data.code ?? "unknown"}, signal=${
                data.signal ?? "none"
            })`;
            this.transport = null;
            this.sessionId = null;
            this.confirmations = [];
            this.surfaceMcpAvailable = false;
            this.surfaceInstructionsInjected = false;
            this.error = message;
            this.setStatus("error");
            this.emitEvent("error", { error: message });

            if (!this.intentionalStop && this.reconnectAttempts < this.maxReconnectAttempts) {
                const delay = this.reconnectDelayMs * Math.pow(2, this.reconnectAttempts);
                this.reconnectAttempts++;
                this.reconnectTimer = setTimeout(() => {
                    this.reconnectTimer = null;
                    void this.tryReconnect();
                }, delay);
                this.reconnectTimer.unref();
            }
        });
    }

    private handleSessionUpdate(update: AcpSessionUpdate): void {
        const updateType = update.update?.sessionUpdate;
        if (!updateType) return;

        if (updateType === "finish") {
            this.setStatus("finished");
            this.emitEvent("finish", {});
            return;
        }

        if (updateType === "agent_message_chunk") {
            this.emitEvent("agent_message_chunk", update.update.content);
            return;
        }

        if (updateType === "agent_thought_chunk") {
            this.emitEvent("agent_thought_chunk", update.update.content);
            return;
        }

        if (updateType === "tool_call") {
            this.emitEvent("tool_call", update.update);
            return;
        }

        if (updateType === "tool_call_update") {
            this.emitEvent("tool_call_update", update.update);
            return;
        }

        if (updateType === "plan") {
            this.emitEvent("plan", update.update);
            return;
        }

        if (updateType === "user_message_chunk") {
            this.emitEvent("user_message", update.update.content);
            return;
        }

        if (updateType === "usage_update") {
            this.hasReceivedUsageUpdate = true;
            this.emitEvent("usage", update.update);
            return;
        }

        if (updateType === "available_commands_update") {
            const commands: Record<string, { name: string; description: string; hint?: string }> = {};
            for (const command of update.update.availableCommands ?? []) {
                const name = command.name?.trim();
                if (!name) {
                    continue;
                }
                commands[name] = {
                    name,
                    description: command.description?.trim() || name,
                    hint: command.input?.hint?.trim(),
                };
            }
            this.emitEvent("slash_commands", { commands });
            return;
        }

        if (updateType === "config_option_update") {
            this.configOptions = update.update.configOptions || [];
            this.emitEvent("config_option", update.update);
            return;
        }

        this.emitEvent(updateType as AcpEventType, update.update);
    }

    private handlePermissionRequest(requestId: number, params: AcpPermissionRequest): void {
        const confirmation: AcpPendingConfirmation = {
            id: uuidv4(),
            msgId: uuidv4(),
            requestId,
            callId: params.toolCall?.toolCallId || uuidv4(),
            title: params.toolCall?.title || "Tool Permission Request",
            options: params.options || [],
        };

        this.confirmations.push(confirmation);
        this.emitEvent("tool_permission", {
            requestId,
            confirmation,
            toolCall: params.toolCall,
        });
    }

    private setSessionModels(models: any): void {
        const rawModels =
            models?.availableModels ??
            models?.models ??
            models?.items ??
            models?.data ??
            (Array.isArray(models) ? models : undefined);
        if (!Array.isArray(rawModels)) {
            return;
        }
        const availableModels = rawModels
            .map((model: any) => ({
                id: model?.id ?? model?.modelId ?? model?.name ?? model?.value ?? "",
                label: model?.label ?? model?.displayName ?? model?.name ?? model?.id ?? model?.modelId ?? "",
            }))
            .filter((model: { id: string }) => model.id);
        const currentModelId =
            models?.currentModelId ??
            models?.selectedModelId ??
            models?.current ??
            models?.selected ??
            availableModels[0]?.id ??
            null;
        const current = availableModels.find((model: { id: string }) => model.id === currentModelId);
        this.modelInfo = {
            currentModelId,
            currentModelLabel: current?.label ?? currentModelId,
            canSwitch: availableModels.length > 0,
            availableModels,
        };
        this.emitEvent("agent_info", {
            agentInfo: this.agentInfo,
            modelInfo: this.modelInfo,
        });
    }

    private supportsMcpType(type: "stdio" | "http" | "sse"): boolean {
        if (type === "stdio" && this.backend === "kronoscode") {
            return true;
        }
        return Boolean(this.capabilities?.mcpCapabilities?.[type]);
    }

    private normalizeCwdForAgent(cwd?: string): string {
        if (!cwd) {
            return ".";
        }
        if (this.backend === "copilot" || this.backend === "codex") {
            return path.resolve(cwd);
        }
        try {
            const workspaceRoot = path.resolve(this.workspace);
            const requested = path.resolve(cwd);
            const relative = path.relative(workspaceRoot, requested);
            if (!relative) {
                return ".";
            }
            if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
                return relative;
            }
        } catch (err) {
            console.warn(
                `[acp:${this.backend}] failed to normalize cwd: ${err instanceof Error ? err.message : String(err)}`
            );
        }
        return ".";
    }

    private resolveSurfaceServerPath(): string | null {
        const resourcesPath = (process as typeof process & { resourcesPath?: string }).resourcesPath;
        const candidates = [
            process.env.KRONTERM_SURFACE_MCP,
            path.join(process.cwd(), "mcp-kron-term", "dist", "index.js"),
            path.resolve(import.meta.dirname, "..", "..", "mcp-kron-term", "dist", "index.js"),
            resourcesPath ? path.join(resourcesPath, "mcp-kron-term", "dist", "index.js") : null,
        ].filter((candidate): candidate is string => Boolean(candidate));
        return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
    }

    private normalizeMcpServers(servers: AcpSessionMcpServer[]): AcpSessionMcpServer[] {
        const normalized: AcpSessionMcpServer[] = [];
        for (const server of servers) {
            const rawType = (server as { type?: string })?.type ?? "stdio";
            const type = rawType === "streamable_http" ? "http" : rawType;
            if (type === "http" || type === "sse") {
                const httpServer = server as AcpSessionMcpServerHttpLike;
                if (!this.supportsMcpType(type) || !httpServer?.name || !httpServer.url) {
                    continue;
                }
                normalized.push({
                    type,
                    name: httpServer.name,
                    url: httpServer.url,
                    headers: Array.isArray(httpServer.headers)
                        ? httpServer.headers.filter(
                              (entry) => typeof entry?.name === "string" && typeof entry?.value === "string"
                          )
                        : undefined,
                });
                continue;
            }
            const stdioServer = server as AcpSessionMcpServerStdio;
            if (!this.supportsMcpType("stdio") || !stdioServer?.name || !stdioServer.command) {
                continue;
            }
            normalized.push({
                type: "stdio",
                name: stdioServer.name,
                command: stdioServer.command,
                args: Array.isArray(stdioServer.args) ? stdioServer.args.filter((arg) => typeof arg === "string") : [],
                env: Array.isArray(stdioServer.env)
                    ? stdioServer.env.filter(
                          (entry) => typeof entry?.name === "string" && typeof entry?.value === "string"
                      )
                    : [],
            });
        }
        return normalized;
    }

    private async buildSessionMcpServers(): Promise<AcpSessionMcpServer[]> {
        const mcpServers: AcpSessionMcpServer[] = [];
        const surfaceServerPath = this.resolveSurfaceServerPath();
        if (this.supportsMcpType("stdio") && surfaceServerPath) {
            const surfaceEnv: AcpSessionMcpNameValue[] = [{ name: "ELECTRON_RUN_AS_NODE", value: "1" }];
            if (this.surfaceContext?.tabId) {
                const sessionToken = await RpcApi.CreateSurfaceTokenCommand(ElectronWshClient, {
                    tabid: this.surfaceContext.tabId,
                    blockid: this.surfaceContext.blockId ?? "",
                });
                surfaceEnv.push({ name: "KRONTERM_JWT", value: sessionToken.token });
                surfaceEnv.push({ name: "WAVETERM_JWT", value: sessionToken.token });
                surfaceEnv.push({ name: "KRONTERM_TABID", value: sessionToken.tabid });
                surfaceEnv.push({ name: "WAVETERM_TABID", value: sessionToken.tabid });
                if (sessionToken.blockid) {
                    surfaceEnv.push({ name: "KRONTERM_BLOCKID", value: sessionToken.blockid });
                    surfaceEnv.push({ name: "WAVETERM_BLOCKID", value: sessionToken.blockid });
                }
            }
            if (process.env.KRONTERM_WSH) {
                surfaceEnv.push({ name: "KRONTERM_WSH", value: process.env.KRONTERM_WSH });
            }
            if (process.env.WAVETERM_WSH) {
                surfaceEnv.push({ name: "WAVETERM_WSH", value: process.env.WAVETERM_WSH });
            }
            mcpServers.push({
                type: "stdio",
                name: "kron-term",
                command: process.execPath,
                args: [surfaceServerPath],
                env: surfaceEnv,
            });
            this.surfaceMcpAvailable = true;
        } else {
            this.surfaceMcpAvailable = false;
        }

        mcpServers.push(...this.normalizeMcpServers(this.requestedMcpServers));
        return mcpServers;
    }

    private buildNewSessionParams(resumeSessionId: string | undefined, mcpServers: AcpSessionMcpServer[]) {
        const useMetaResume = Boolean(
            resumeSessionId && (this.backend === "claude" || (this.capabilities as any)?._meta?.claudeCode)
        );
        return {
            cwd: this.normalizeCwdForAgent(this.workspace),
            mcpServers,
            ...(useMetaResume
                ? { _meta: { claudeCode: { options: { resume: resumeSessionId } } } }
                : resumeSessionId
                  ? { resumeSessionId, forkSession: false }
                  : {}),
        };
    }

    private async ensureSession(resumeSessionId?: string, resumeSessionConversationId?: string): Promise<void> {
        if (!this.transport || this.sessionId) {
            return;
        }

        const mcpServers = await this.buildSessionMcpServers();
        let sessionResult: any;
        let usableResumeSessionId = resumeSessionId;
        if (resumeSessionId && resumeSessionConversationId && resumeSessionConversationId !== this.conversationId) {
            console.warn(
                `[acp:${this.backend}] skipping stale session ${resumeSessionId}; it belongs to ${resumeSessionConversationId}, not ${this.conversationId}`
            );
            usableResumeSessionId = undefined;
        }

        if (usableResumeSessionId && this.capabilities?.loadSession) {
            try {
                sessionResult = await this.transport.sendRequest("session/load", {
                    sessionId: usableResumeSessionId,
                    cwd: this.normalizeCwdForAgent(this.workspace),
                    mcpServers,
                });
            } catch (err) {
                console.warn(
                    `[acp:${this.backend}] session/load failed, falling back to session/new resume: ${
                        err instanceof Error ? err.message : String(err)
                    }`
                );
            }
        }
        if (!sessionResult) {
            sessionResult = await this.transport.sendRequest(
                "session/new",
                this.buildNewSessionParams(usableResumeSessionId, mcpServers)
            );
        }

        this.sessionId = sessionResult?.sessionId || sessionResult?.id || usableResumeSessionId || uuidv4();
        this.emitEvent("session_id", { sessionId: this.sessionId });
        this.modes = sessionResult?.modes ?? this.modes;
        this.configOptions = sessionResult?.configOptions ?? this.configOptions;
        this.setSessionModels(sessionResult?.models);
        this.currentMode = this.currentMode ?? this.modes?.currentModeId ?? this.modes?.availableModes?.[0]?.id ?? null;
        if (this.modes || this.configOptions.length > 0) {
            this.emitEvent("config_option", {
                modes: this.modes,
                currentMode: this.currentMode,
                configOptions: this.configOptions,
            });
        }
        if (this.currentMode) {
            try {
                await this.transport.sendRequest("session/set_mode", {
                    sessionId: this.sessionId,
                    modeId: this.currentMode,
                });
            } catch (err) {
                console.debug(
                    `[acp:${this.backend}] failed to restore mode ${this.currentMode}: ${
                        err instanceof Error ? err.message : String(err)
                    }`
                );
            }
        }
    }

    async sendMessage(opts: AcpIpcSendMessageRequest): Promise<void> {
        if (!this.transport || !this.transport.isInitialized()) {
            throw new Error("Agent not initialized");
        }

        this.setStatus("running");
        await this.ensureSession();

        let content = opts.content;
        if (this.surfaceMcpAvailable && !this.surfaceInstructionsInjected) {
            content = `${waveSurfaceBootstrap}\n\n[User Request]\n${content}`;
            this.surfaceInstructionsInjected = true;
        }
        const promptResult = await this.transport.sendRequest("session/prompt", {
            sessionId: this.sessionId,
            prompt: [{ type: "text", text: content }],
        });
        if (!this.hasReceivedUsageUpdate && typeof promptResult?.usage?.totalTokens === "number") {
            this.emitEvent("usage", promptResult.usage);
        }
        if (this.status === "running") {
            this.setStatus("finished");
            this.emitEvent("finish", { stopReason: promptResult?.stopReason });
        }
    }

    getMode() {
        return {
            mode: this.currentMode ?? "default",
            initialized: Boolean(this.transport?.isInitialized()),
            modes: this.modes,
        };
    }

    async setMode(opts: AcpIpcSetModeRequest): Promise<void> {
        if (this.transport?.isInitialized()) {
            await this.transport.sendRequest("session/set_mode", {
                sessionId: this.sessionId,
                modeId: opts.mode,
            });
        }
        this.currentMode = opts.mode;
        this.emitEvent("config_option", {
            modes: this.modes,
            currentMode: this.currentMode,
            configOptions: this.configOptions,
        });
    }

    getConfigOptions() {
        return { configOptions: this.configOptions };
    }

    async setConfigOption(opts: AcpIpcSetConfigOptionRequest) {
        if (this.transport?.isInitialized()) {
            const result = await this.transport.sendRequest("session/set_config_option", {
                sessionId: this.sessionId,
                configId: opts.configId,
                value: opts.value,
            });
            if (Array.isArray(result?.configOptions)) {
                this.configOptions = result.configOptions;
                return { configOptions: this.configOptions };
            }
        }
        this.configOptions = this.configOptions.map((option: any) =>
            option?.id === opts.configId ? { ...option, currentValue: opts.value, selectedValue: opts.value } : option
        );
        return { configOptions: this.configOptions };
    }

    getModelInfo() {
        return { modelInfo: this.modelInfo };
    }

    async setModel(opts: AcpIpcSetModelRequest): Promise<{ modelInfo: AcpModelInfo | null }> {
        if (this.transport?.isInitialized()) {
            await this.transport.sendRequest("session/set_model", {
                sessionId: this.sessionId,
                modelId: opts.modelId,
            });
        }
        if (this.modelInfo) {
            const selected = this.modelInfo.availableModels?.find((model) => model.id === opts.modelId);
            this.modelInfo = {
                ...this.modelInfo,
                currentModelId: opts.modelId,
                currentModelLabel: selected?.label ?? opts.modelId,
            };
        }
        this.emitEvent("agent_info", {
            agentInfo: this.agentInfo,
            modelInfo: this.modelInfo,
        });
        return { modelInfo: this.modelInfo };
    }

    async confirmTool(opts: AcpIpcConfirmToolRequest): Promise<void> {
        const confirmationIndex = this.confirmations.findIndex((c) => c.callId === opts.callId);
        if (confirmationIndex === -1) {
            return;
        }

        const confirmation = this.confirmations[confirmationIndex];
        this.confirmations.splice(confirmationIndex, 1);

        const selectedOption = confirmation.options.find((o) => o.optionId === opts.optionId);
        if (!selectedOption) {
            return;
        }

        if (this.transport) {
            this.transport.sendResponse(confirmation.requestId, {
                outcome: { outcome: "selected", optionId: opts.optionId },
            });
        }
    }

    async stop(): Promise<void> {
        this.intentionalStop = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.transport) {
            if (this.sessionId && (this.status === "running" || this.confirmations.length > 0)) {
                this.transport.sendNotification("session/cancel", {
                    sessionId: this.sessionId,
                });
            }
            for (const confirmation of this.confirmations) {
                this.transport.sendResponse(confirmation.requestId, {
                    outcome: { outcome: "cancelled" },
                });
            }
            if (this.sessionId && this.capabilities?.sessionCapabilities?.close) {
                const closeRequest = this.transport
                    .sendRequest("session/close", { sessionId: this.sessionId })
                    .catch(() => undefined);
                await Promise.race([
                    closeRequest,
                    new Promise((resolve) => {
                        setTimeout(resolve, 2000);
                    }),
                ]);
            }
            this.transport.kill();
            this.transport = null;
        }
        this.sessionId = null;
        this.surfaceMcpAvailable = false;
        this.surfaceInstructionsInjected = false;
        this.confirmations = [];
        this.currentMode = this.modes?.currentModeId ?? this.modes?.availableModes?.[0]?.id ?? null;
        this.configOptions = [];
        this.modelInfo = null;
        this.capabilities = null;
        this.setStatus("idle");
    }

    private async tryReconnect(): Promise<void> {
        if (this.intentionalStop || !this.savedOpts) {
            return;
        }
        this.setStatus("connecting");
        this.emitEvent("status", { status: "connecting", reconnectAttempt: this.reconnectAttempts });
        try {
            await this.initialize(this.savedOpts);
            if (this.status === "connected") {
                this.emitEvent("status", { status: "connected", reconnected: true });
                this.reconnectAttempts = 0;
            }
        } catch {
            this.emitEvent("error", {
                error: `Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} failed`,
            });
        }
    }

    private setStatus(status: AcpAgentStatus): void {
        this.status = status;
        this.emitEvent("status", { status });
    }

    private emitEvent(type: AcpEventType, data: unknown): void {
        const event: AcpEvent = {
            conversationId: this.conversationId,
            type,
            msgId: `${this.conversationId}-${++this.msgCounter}`,
            data,
            timestamp: Date.now(),
        };
        this.emit("event", event);
    }

    static async detectAgents(): Promise<AcpDetectedAgent[]> {
        const agents = await detectInstalledAgents();
        return agents.map((a) => ({
            backend: a.backend,
            name: a.name,
            cliPath: a.cliPath,
            available: a.available,
            avatar: a.avatar,
            description: a.description,
            authRequired: a.authRequired,
            supportsStreaming: a.supportsStreaming,
            acpArgs: a.acpArgs,
            skillsDirs: a.skillsDirs,
        }));
    }
}

const agentManagers = new Map<string, AcpAgentManager>();

export function getAgentManager(conversationId: string): AcpAgentManager | undefined {
    return agentManagers.get(conversationId);
}

export function createAgentManager(opts: AcpAgentManagerOptions): AcpAgentManager {
    const existing = agentManagers.get(opts.conversationId);
    if (existing) {
        existing.stop().catch(() => {});
        agentManagers.delete(opts.conversationId);
    }

    const manager = new AcpAgentManager(opts);
    agentManagers.set(opts.conversationId, manager);
    return manager;
}

export function removeAgentManager(conversationId: string): void {
    const manager = agentManagers.get(conversationId);
    if (manager) {
        manager.stop().catch(() => {});
        agentManagers.delete(conversationId);
    }
}

export function listAgentManagers() {
    return Array.from(agentManagers.values()).map((manager) => ({
        conversationId: manager.conversationId,
        sessionId: manager.sessionId,
        backend: manager.backend,
        workspace: manager.workspace,
        status: manager.status,
        error: manager.error,
        confirmations: manager.confirmations,
        modes: manager.modes,
        currentMode: manager.currentMode,
        configOptions: manager.configOptions,
        modelInfo: manager.modelInfo,
        capabilities: manager.capabilities,
    }));
}

export async function stopAllAgentManagers(): Promise<void> {
    const managers = Array.from(agentManagers.values());
    agentManagers.clear();
    await Promise.all(managers.map((manager) => manager.stop().catch(() => {})));
}
