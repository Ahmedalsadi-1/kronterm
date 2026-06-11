// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * ACP (Agent Client Protocol) types and backend configurations.
 * Adapted from AionUi's acpTypes.ts for kronterm integration.
 *
 * ACP is an open standard (JSON-RPC 2.0 over stdio) for communication
 * between code editors/clients and AI coding agents.
 */

// ── ACP Backend Types ────────────────────────────────────────────────

export type AcpBackendId =
    | "auggie"
    | "claude"
    | "codebuddy"
    | "codex"
    | "copilot"
    | "cursor"
    | "droid"
    | "gemini"
    | "goose"
    | "hermes"
    | "kimi"
    | "kiro"
    | "kronoscode"
    | "opencode"
    | "qoder"
    | "qwen"
    | "snow"
    | "vibe"
    | "custom";

export interface AcpBackendConfig {
    /** Unique backend identifier */
    id: AcpBackendId | string;
    /** Display name in UI */
    name: string;
    /** CLI executable name for detection via `which` */
    cliCommand?: string;
    /** Full CLI path with optional args (space-separated) */
    defaultCliPath?: string;
    /** Whether this backend requires auth before use */
    authRequired?: boolean;
    /** Whether this backend is enabled and visible in UI */
    enabled?: boolean;
    /** Whether this backend supports streaming responses */
    supportsStreaming?: boolean;
    /** Prefer defaultCliPath for spawning even when cliCommand is found */
    preferDefaultCliPath?: boolean;
    /** Arguments to enable ACP mode when spawning the CLI */
    acpArgs?: string[];
    /** Custom environment variables to inject */
    env?: Record<string, string>;
    /** Skill discovery directories (relative to workspace root) */
    skillsDirs?: string[];
    /** Avatar emoji or icon name */
    avatar?: string;
    /** Short description */
    description?: string;
}

/** Default ACP launch arguments if not specified */
const DEFAULT_ACP_ARGS = ["--experimental-acp"];
export const CODEX_ACP_BRIDGE_VERSION = "0.9.5";
export const CODEX_ACP_NPX_PACKAGE = `npx @zed-industries/codex-acp@${CODEX_ACP_BRIDGE_VERSION}`;
export const CODEBUDDY_ACP_BRIDGE_VERSION = "2.73.0";
export const CODEBUDDY_ACP_NPX_PACKAGE = `npx @tencent-ai/codebuddy-code@${CODEBUDDY_ACP_BRIDGE_VERSION}`;
export const KRONOSCODE_DEVELOPMENT_FALLBACK_BIN =
    "/Users/albsheralsadi/kronterm/kronoscoder/packages/kronoscode/bin/kronoscode";

/**
 * All known ACP backend configurations.
 * When adding a new CLI agent, just add an entry here.
 */
export const ACP_BACKENDS_ALL: Record<string, AcpBackendConfig> = {
    claude: {
        id: "claude",
        name: "Claude Code",
        cliCommand: "claude",
        authRequired: true,
        enabled: true,
        supportsStreaming: false,
        acpArgs: ["--experimental-acp"],
        skillsDirs: [".claude/skills"],
        avatar: "🧠",
        description: "Anthropic's Claude Code agent",
    },
    qwen: {
        id: "qwen",
        name: "Qwen Code",
        cliCommand: "qwen",
        defaultCliPath: "npx @qwen-code/qwen-code",
        authRequired: true,
        enabled: true,
        supportsStreaming: true,
        acpArgs: ["--acp"],
        skillsDirs: [".qwen/skills"],
        avatar: "🔮",
        description: "Alibaba Qwen Code agent",
    },
    codex: {
        id: "codex",
        name: "Codex",
        cliCommand: "codex",
        defaultCliPath: CODEX_ACP_NPX_PACKAGE,
        preferDefaultCliPath: true,
        authRequired: true,
        enabled: true,
        supportsStreaming: false,
        acpArgs: [],
        skillsDirs: [".codex/skills"],
        avatar: "⚡",
        description: "OpenAI Codex via the Zed ACP bridge",
    },
    codebuddy: {
        id: "codebuddy",
        name: "CodeBuddy",
        cliCommand: "codebuddy",
        defaultCliPath: CODEBUDDY_ACP_NPX_PACKAGE,
        preferDefaultCliPath: true,
        authRequired: true,
        enabled: true,
        supportsStreaming: false,
        acpArgs: ["--acp"],
        skillsDirs: [".codebuddy/skills"],
        avatar: "🧩",
        description: "Tencent CodeBuddy Code CLI",
    },
    goose: {
        id: "goose",
        name: "Goose",
        cliCommand: "goose",
        authRequired: false,
        enabled: true,
        supportsStreaming: false,
        acpArgs: ["acp"],
        skillsDirs: [".goose/skills"],
        avatar: "🪶",
        description: "Block Goose CLI",
    },
    auggie: {
        id: "auggie",
        name: "Augment Code",
        cliCommand: "auggie",
        authRequired: false,
        enabled: true,
        supportsStreaming: false,
        acpArgs: ["--acp"],
        avatar: "🟣",
        description: "Augment Code CLI",
    },
    kimi: {
        id: "kimi",
        name: "Kimi CLI",
        cliCommand: "kimi",
        authRequired: false,
        enabled: true,
        supportsStreaming: false,
        acpArgs: ["acp"],
        skillsDirs: [".kimi/skills"],
        avatar: "🌙",
        description: "Moonshot Kimi CLI",
    },
    opencode: {
        id: "opencode",
        name: "OpenCode",
        cliCommand: "opencode",
        authRequired: false,
        enabled: true,
        supportsStreaming: false,
        acpArgs: ["acp"],
        skillsDirs: [".opencode/skills"],
        avatar: "◇",
        description: "Open-source AI coding agent",
    },
    droid: {
        id: "droid",
        name: "Factory Droid",
        cliCommand: "droid",
        authRequired: false,
        enabled: true,
        supportsStreaming: false,
        acpArgs: ["exec", "--output-format", "acp"],
        skillsDirs: [".factory/skills"],
        avatar: "▣",
        description: "Factory Droid CLI",
    },
    copilot: {
        id: "copilot",
        name: "GitHub Copilot",
        cliCommand: "copilot",
        authRequired: false,
        enabled: true,
        supportsStreaming: false,
        acpArgs: ["--acp", "--stdio"],
        avatar: "◆",
        description: "GitHub Copilot CLI",
    },
    qoder: {
        id: "qoder",
        name: "Qoder CLI",
        cliCommand: "qodercli",
        authRequired: false,
        enabled: true,
        supportsStreaming: false,
        acpArgs: ["--acp"],
        avatar: "⬡",
        description: "Qoder CLI",
    },
    vibe: {
        id: "vibe",
        name: "Mistral Vibe",
        cliCommand: "vibe-acp",
        authRequired: false,
        enabled: true,
        supportsStreaming: false,
        acpArgs: [],
        skillsDirs: [".vibe/skills"],
        avatar: "△",
        description: "Mistral Vibe ACP agent",
    },
    cursor: {
        id: "cursor",
        name: "Cursor Agent",
        cliCommand: "agent",
        authRequired: true,
        enabled: true,
        supportsStreaming: false,
        acpArgs: ["acp"],
        skillsDirs: [".cursor/skills"],
        avatar: "⌁",
        description: "Cursor CLI agent",
    },
    kiro: {
        id: "kiro",
        name: "Kiro",
        cliCommand: "kiro-cli",
        authRequired: true,
        enabled: true,
        supportsStreaming: false,
        acpArgs: ["acp"],
        avatar: "▱",
        description: "Kiro CLI",
    },
    hermes: {
        id: "hermes",
        name: "Hermes Agent",
        cliCommand: "hermes",
        authRequired: true,
        enabled: true,
        supportsStreaming: false,
        acpArgs: ["acp"],
        avatar: "✦",
        description: "Nous Research Hermes Agent",
    },
    snow: {
        id: "snow",
        name: "Snow CLI",
        cliCommand: "snow",
        authRequired: false,
        enabled: true,
        supportsStreaming: false,
        acpArgs: ["--acp"],
        avatar: "✧",
        description: "Snow AI CLI",
    },
    gemini: {
        id: "gemini",
        name: "Gemini CLI",
        cliCommand: "gemini",
        authRequired: true,
        enabled: true,
        supportsStreaming: true,
        acpArgs: ["--experimental-acp"],
        skillsDirs: [".gemini/skills"],
        avatar: "💎",
        description: "Google Gemini CLI agent. If startup fails, this installed CLI may not expose ACP stdio.",
    },
    kronoscode: {
        id: "kronoscode",
        name: "KronosCode",
        cliCommand: "kronoscode",
        defaultCliPath: KRONOSCODE_DEVELOPMENT_FALLBACK_BIN,
        preferDefaultCliPath: true,
        authRequired: false,
        enabled: true,
        supportsStreaming: true,
        acpArgs: ["acp"],
        skillsDirs: [".kronoscode/skills"],
        avatar: "🚀",
        description: "Primary KronosCode ACP agent",
    },
    custom: {
        id: "custom",
        name: "Custom Agent",
        cliCommand: undefined,
        authRequired: false,
        enabled: true,
        supportsStreaming: false,
        acpArgs: [],
        avatar: "+",
        description: "User-configured ACP-compatible command",
    },
};

/** Only enabled backends */
export const ACP_ENABLED_BACKENDS: Record<string, AcpBackendConfig> = Object.fromEntries(
    Object.entries(ACP_BACKENDS_ALL).filter(([_, config]) => config.enabled)
);

// ── ACP Protocol Types ───────────────────────────────────────────────

export const JSONRPC_VERSION = "2.0" as const;

export interface AcpJsonRpcRequest {
    jsonrpc: typeof JSONRPC_VERSION;
    id: number;
    method: string;
    params?: Record<string, unknown> | unknown[];
}

export interface AcpJsonRpcResponse {
    jsonrpc: typeof JSONRPC_VERSION;
    id: number;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}

export interface AcpJsonRpcNotification {
    jsonrpc: typeof JSONRPC_VERSION;
    method: string;
    params?: Record<string, unknown> | unknown[];
}

export type AcpJsonRpcMessage = AcpJsonRpcRequest | AcpJsonRpcResponse | AcpJsonRpcNotification;

// ── ACP Session Update Types ─────────────────────────────────────────

export interface AcpSessionUpdate {
    sessionId: string;
    update: AcpSessionUpdatePayload;
}

export type AcpSessionUpdatePayload =
    | AgentMessageChunkUpdate
    | AgentThoughtChunkUpdate
    | ToolCallUpdate
    | ToolCallUpdateStatus
    | PlanUpdate
    | FinishUpdate
    | ErrorUpdate
    | UserMessageChunkUpdate
    | ConfigOptionsUpdate
    | UsageUpdate
    | AvailableCommandsUpdate;

export interface AgentMessageChunkUpdate {
    sessionUpdate: "agent_message_chunk";
    content: {
        type: "text" | "image";
        text?: string;
        data?: string;
        mimeType?: string;
        uri?: string;
    };
}

export interface AgentThoughtChunkUpdate {
    sessionUpdate: "agent_thought_chunk";
    content: {
        type: "text";
        text: string;
    };
}

export interface ToolCallContentItem {
    type: "content" | "diff";
    content?: { type: "text"; text: string };
    path?: string;
    oldText?: string | null;
    newText?: string;
}

export interface ToolCallLocationItem {
    path: string;
}

export interface ToolCallUpdate {
    sessionUpdate: "tool_call";
    toolCallId: string;
    status: "pending" | "in_progress" | "completed" | "failed";
    title: string;
    kind: "read" | "edit" | "execute" | string;
    rawInput?: Record<string, unknown>;
    content?: ToolCallContentItem[];
    locations?: ToolCallLocationItem[];
}

export interface ToolCallUpdateStatus {
    sessionUpdate: "tool_call_update";
    toolCallId: string;
    status: "completed" | "failed";
    rawInput?: Record<string, unknown>;
    content?: Array<{ type: "content"; content: { type: "text"; text: string } }>;
}

export interface PlanUpdate {
    sessionUpdate: "plan";
    entries: Array<{
        content: string;
        status: "pending" | "in_progress" | "completed";
        priority?: "low" | "medium" | "high";
    }>;
}

export interface FinishUpdate {
    sessionUpdate: "finish";
}

export interface ErrorUpdate {
    sessionUpdate: "error";
    error: string;
}

export interface UserMessageChunkUpdate {
    sessionUpdate: "user_message_chunk";
    content: {
        type: "text" | "image";
        text?: string;
        data?: string;
        mimeType?: string;
        uri?: string;
    };
}

export interface ConfigOptionsUpdate {
    sessionUpdate: "config_option_update";
    configOptions: AcpConfigOption[];
}

export interface AcpConfigOption {
    id: string;
    name?: string;
    label?: string;
    description?: string;
    category?: string;
    type: "select" | "boolean" | "string";
    currentValue?: string;
    selectedValue?: string;
    options?: Array<{ value: string; name?: string; label?: string }>;
}

export interface UsageUpdate {
    sessionUpdate: "usage_update";
    used: number;
    size: number;
    cost?: { amount: number; currency: string };
}

export interface AvailableCommandsUpdate {
    sessionUpdate: "available_commands_update";
    availableCommands: Array<{
        name?: string;
        description?: string;
        input?: { hint?: string };
    }>;
}

// ── ACP Permission Types ─────────────────────────────────────────────

export interface AcpPermissionRequest {
    sessionId: string;
    options: AcpPermissionOption[];
    toolCall: {
        toolCallId: string;
        rawInput?: Record<string, unknown>;
        title?: string;
        kind?: string;
        content?: ToolCallContentItem[];
        locations?: ToolCallLocationItem[];
    };
}

export interface AcpPermissionOption {
    optionId: string;
    name: string;
    kind: "allow_once" | "allow_always" | "reject_once" | "reject_always";
}

// ── ACP Initialize Types ─────────────────────────────────────────────

export interface AcpInitializeResult {
    protocolVersion: number;
    capabilities: AcpAgentCapabilities;
    agentInfo: AcpAgentInfo | null;
    authMethods: AcpAuthMethod[];
    modes: AcpSessionModes | null;
}

export interface AcpAgentCapabilities {
    loadSession: boolean;
    promptCapabilities: { image: boolean; audio: boolean; embeddedContext: boolean };
    mcpCapabilities: { stdio: boolean; http: boolean; sse: boolean };
    sessionCapabilities: {
        fork: Record<string, unknown> | null;
        resume: Record<string, unknown> | null;
        list: Record<string, unknown> | null;
        close: Record<string, unknown> | null;
    };
    _meta: Record<string, unknown>;
}

export interface AcpAgentInfo {
    name: string;
    version: string;
    title?: string;
}

export interface AcpAuthMethod {
    id: string;
    name: string;
    description?: string;
    [key: string]: unknown;
}

export interface AcpSessionModes {
    currentModeId?: string;
    availableModes?: AcpAvailableMode[];
}

export interface AcpAvailableMode {
    id: string;
    name?: string;
    description?: string;
}

export interface AcpModelInfo {
    currentModelId?: string | null;
    currentModelLabel?: string | null;
    canSwitch?: boolean;
    availableModels?: Array<{ id: string; label?: string }>;
    source?: string;
    sourceDetail?: string;
}

// ── ACP Agent Manager State ──────────────────────────────────────────

export type AcpAgentStatus = "idle" | "connecting" | "connected" | "running" | "finished" | "error" | "disconnected";

export interface AcpAgentState {
    conversationId: string;
    backend: AcpBackendId | string;
    status: AcpAgentStatus;
    sessionId: string | null;
    workspace: string | null;
    pendingConfirmations: AcpPendingConfirmation[];
    error: string | null;
}

export interface AcpPendingConfirmation {
    id: string;
    msgId: string;
    requestId: number;
    callId: string;
    title: string;
    description?: string;
    options: AcpPermissionOption[];
}

// ── IPC Message Types (Frontend ↔ Electron) ──────────────────────────

export interface AcpIpcInitializeRequest {
    conversationId: string;
    backend: AcpBackendId | string;
    workspace?: string;
    cliPath?: string;
    customArgs?: string[];
    customEnv?: Record<string, string>;
    surfaceContext?: {
        tabId: string;
        blockId?: string;
    };
}

export interface AcpIpcSendMessageRequest {
    conversationId: string;
    content: string;
    msgId?: string;
}

export interface AcpIpcConfirmToolRequest {
    conversationId: string;
    msgId: string;
    callId: string;
    optionId: string;
}

export interface AcpIpcStopRequest {
    conversationId: string;
}

export interface AcpIpcSetModeRequest {
    conversationId: string;
    mode: string;
}

export interface AcpIpcSetConfigOptionRequest {
    conversationId: string;
    configId: string;
    value: string;
}

export interface AcpIpcSetModelRequest {
    conversationId: string;
    modelId: string;
}

export interface AcpIpcDetectAgentsRequest {
    workspace?: string;
}

export interface AcpDetectedAgent {
    backend: AcpBackendId | string;
    name: string;
    cliPath: string;
    available: boolean;
    avatar?: string;
    description?: string;
    authRequired?: boolean;
    supportsStreaming?: boolean;
    acpArgs?: string[];
    skillsDirs?: string[];
}

// ── ACP Event Types (Electron → Frontend via IPC) ────────────────────

export type AcpEventType =
    | "status"
    | "agent_message_chunk"
    | "agent_thought_chunk"
    | "tool_call"
    | "tool_call_update"
    | "tool_permission"
    | "plan"
    | "finish"
    | "error"
    | "user_message"
    | "config_option"
    | "usage"
    | "session_id"
    | "agent_info"
    | "slash_commands";

export interface AcpEvent {
    conversationId: string;
    type: AcpEventType;
    msgId: string;
    data?: unknown;
    timestamp: number;
}

// ── Utility Functions ────────────────────────────────────────────────

/** Check if a backend supports native skill discovery */
export function hasNativeSkillSupport(backend: string | undefined): boolean {
    if (!backend) return false;
    const config = ACP_BACKENDS_ALL[backend];
    return config?.skillsDirs?.length ? true : false;
}

/** Get skill directories for a backend */
export function getSkillsDirsForBackend(backend: string | undefined): string[] | undefined {
    if (!backend) return undefined;
    return ACP_BACKENDS_ALL[backend]?.skillsDirs;
}

/** Parse the initialize result from an ACP agent response */
export function parseInitializeResult(result: unknown): AcpInitializeResult {
    const raw = result as Record<string, unknown>;
    return {
        protocolVersion: (raw?.protocolVersion as number) ?? 1,
        capabilities: ((raw?.agentCapabilities ?? raw?.capabilities) as AcpAgentCapabilities) ?? {
            loadSession: false,
            promptCapabilities: { image: false, audio: false, embeddedContext: false },
            mcpCapabilities: { stdio: false, http: false, sse: false },
            sessionCapabilities: { fork: null, resume: null, list: null, close: null },
            _meta: {},
        },
        agentInfo: (raw?.agentInfo as AcpAgentInfo) ?? null,
        authMethods: (raw?.authMethods as AcpAuthMethod[]) ?? [],
        modes: (raw?.modes as AcpSessionModes) ?? null,
    };
}
