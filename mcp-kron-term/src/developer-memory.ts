import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type DeveloperMemoryLayer = "short_term" | "long_term" | "archive";
export type DeveloperMemoryStatus = "active" | "superseded" | "tombstoned";
export type DeveloperMemoryProcessingState = "pending" | "processed" | "blocked";
export type DeveloperMemoryCategory = "project" | "system" | "manual" | "workflow" | "integration" | "other";
export type DeveloperMemorySourceType =
    | "workspace_session"
    | "terminal"
    | "browser"
    | "file"
    | "agent"
    | "sandbox"
    | "desktop"
    | "manual";

export type DeveloperMemoryScope = {
    workspaceId?: string;
    tabId?: string;
    blockId?: string;
    repoPath?: string;
    branch?: string;
};

export type DeveloperMemoryEvidence = {
    sourceType: DeveloperMemorySourceType;
    sourceId?: string;
    blockId?: string;
    path?: string;
    url?: string;
    command?: string;
    excerpt?: string;
    createdAt: string;
};

export type DeveloperMemoryRecord = {
    id: string;
    content: string;
    layer: DeveloperMemoryLayer;
    status: DeveloperMemoryStatus;
    processingState: DeveloperMemoryProcessingState;
    category: DeveloperMemoryCategory;
    scope: DeveloperMemoryScope;
    evidence: DeveloperMemoryEvidence[];
    sourceId?: string;
    promotion?: {
        fromLayer: DeveloperMemoryLayer;
        toLayer: DeveloperMemoryLayer;
        reason: string;
        at: string;
        by: "user" | "agent" | "system";
    };
    ttl?: string;
    expiresAt?: string;
    createdAt: string;
    updatedAt: string;
};

export type DeveloperSessionStatus = "in_progress" | "processing" | "completed" | "discarded";
export type DeveloperSessionEventType =
    | "terminal_command"
    | "terminal_error"
    | "browser_navigation"
    | "file_change"
    | "agent_tool"
    | "sandbox_event"
    | "manual_note";

export type DeveloperSessionEvent = {
    id: string;
    type: DeveloperSessionEventType;
    title?: string;
    detail?: string;
    blockId?: string;
    command?: string;
    path?: string;
    url?: string;
    exitCode?: number;
    createdAt: string;
};

export type DeveloperWorkspaceSession = {
    id: string;
    title: string;
    status: DeveloperSessionStatus;
    scope: DeveloperMemoryScope;
    summary?: string;
    events: DeveloperSessionEvent[];
    memoryIds: string[];
    actionItemIds: string[];
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
};

export type DeveloperActionItemStatus = "pending" | "in_progress" | "done" | "cancelled";
export type DeveloperActionItemPriority = "low" | "medium" | "high" | "urgent";

export type DeveloperActionItem = {
    id: string;
    title: string;
    description?: string;
    status: DeveloperActionItemStatus;
    priority: DeveloperActionItemPriority;
    dueAt?: string;
    scope: DeveloperMemoryScope;
    sourceSessionId?: string;
    sourceMemoryId?: string;
    evidence: DeveloperMemoryEvidence[];
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
};

type DeveloperMemoryStoreState = {
    version: 1;
    memories: DeveloperMemoryRecord[];
    sessions: DeveloperWorkspaceSession[];
    actionItems: DeveloperActionItem[];
};

type ListMemoryOptions = {
    limit?: number;
    offset?: number;
    layers?: DeveloperMemoryLayer[];
    categories?: DeveloperMemoryCategory[];
    includeArchived?: boolean;
    includeTombstoned?: boolean;
};

type SearchOptions = {
    limit?: number;
    includeArchived?: boolean;
};

export type DeveloperActionDefinition = {
    id: string;
    surface: "workspace" | "terminal" | "browser" | "file" | "sandbox" | "desktop" | "agent";
    title: string;
    description: string;
    risk: "read" | "write" | "sensitive" | "dangerous";
    examples: string[];
    requiresApproval: boolean;
};

export const DeveloperActionRegistry: DeveloperActionDefinition[] = [
    {
        id: "memory.get",
        surface: "workspace",
        title: "Get Memories",
        description: "List scoped developer memories.",
        risk: "read",
        examples: ["Show long-term memories for this repo."],
        requiresApproval: false,
    },
    {
        id: "memory.search",
        surface: "workspace",
        title: "Search Memories",
        description: "Search saved developer memories.",
        risk: "read",
        examples: ["Search memories for deploy workaround."],
        requiresApproval: false,
    },
    {
        id: "memory.create",
        surface: "workspace",
        title: "Create Memory",
        description: "Save a fact or observation with provenance evidence.",
        risk: "write",
        examples: ["Remember that this repo uses task quickdev for local startup."],
        requiresApproval: false,
    },
    {
        id: "memory.promote",
        surface: "workspace",
        title: "Promote Memory",
        description: "Promote a short-term memory into durable long-term memory.",
        risk: "write",
        examples: ["Promote the successful release command to project memory."],
        requiresApproval: false,
    },
    {
        id: "session.append_event",
        surface: "workspace",
        title: "Append Session Event",
        description: "Record terminal, browser, file, sandbox, or agent activity in a workspace session.",
        risk: "write",
        examples: ["Record that npm test failed with exit code 1."],
        requiresApproval: false,
    },
    {
        id: "session.complete",
        surface: "workspace",
        title: "Complete Session",
        description: "Close a workspace session with a summary and linked outputs.",
        risk: "write",
        examples: ["Complete this debugging session with a summary."],
        requiresApproval: false,
    },
    {
        id: "action_item.create",
        surface: "workspace",
        title: "Create Action Item",
        description: "Create a task linked to workspace evidence.",
        risk: "write",
        examples: ["Create a task to add a regression test for widget_snapshot."],
        requiresApproval: false,
    },
    {
        id: "terminal.run",
        surface: "terminal",
        title: "Run Command",
        description: "Run a shell command in a terminal block.",
        risk: "dangerous",
        examples: ["Run npm test in the repo root."],
        requiresApproval: true,
    },
    {
        id: "browser.navigate",
        surface: "browser",
        title: "Navigate Browser",
        description: "Navigate a browser block to a URL.",
        risk: "write",
        examples: ["Open the local dev server in a browser block."],
        requiresApproval: false,
    },
    {
        id: "file.read",
        surface: "file",
        title: "Read File",
        description: "Read a local file for context.",
        risk: "sensitive",
        examples: ["Read package.json and summarize scripts."],
        requiresApproval: true,
    },
    {
        id: "sandbox.control",
        surface: "sandbox",
        title: "Control Sandbox",
        description: "Observe and control an isolated sandbox desktop session.",
        risk: "write",
        examples: ["Click through the sandbox browser and verify the app."],
        requiresApproval: false,
    },
];

function defaultStorePath(): string {
    return (
        process.env.KRONTERM_MEMORY_STORE ??
        process.env.WAVETERM_MEMORY_STORE ??
        path.join(os.homedir(), ".kronterm", "developer-memory.json")
    );
}

function nowIso(): string {
    return new Date().toISOString();
}

function emptyState(): DeveloperMemoryStoreState {
    return {
        version: 1,
        memories: [],
        sessions: [],
        actionItems: [],
    };
}

function assertLegalMemoryState(
    layer: DeveloperMemoryLayer,
    status: DeveloperMemoryStatus,
    processingState: DeveloperMemoryProcessingState
): void {
    if (layer === "short_term") {
        return;
    }
    if (layer === "long_term" && processingState === "processed") {
        return;
    }
    if (layer === "archive" && status !== "superseded" && processingState === "processed") {
        return;
    }
    throw new Error(`illegal memory state: layer=${layer}, status=${status}, processingState=${processingState}`);
}

function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9./:_-]+/g, " ")
        .trim();
}

function scoreText(query: string, text: string): number {
    const normalizedQuery = normalizeText(query);
    const normalizedText = normalizeText(text);
    if (!normalizedQuery || !normalizedText) {
        return 0;
    }
    if (normalizedText.includes(normalizedQuery)) {
        return normalizedQuery.length + 10;
    }
    return normalizedQuery
        .split(/\s+/)
        .filter(Boolean)
        .reduce((score, token) => score + (normalizedText.includes(token) ? token.length : 0), 0);
}

function applyLimit<T>(items: T[], limit = 100, offset = 0): T[] {
    return items.slice(Math.max(0, offset), Math.max(0, offset) + Math.max(0, limit));
}

export class DeveloperMemoryStore {
    private readonly storePath: string;
    private pendingWrite = Promise.resolve();

    constructor(storePath = defaultStorePath()) {
        this.storePath = storePath;
    }

    get diagnostics(): { storePath: string } {
        return { storePath: this.storePath };
    }

    async listMemories(options: ListMemoryOptions = {}): Promise<DeveloperMemoryRecord[]> {
        const state = await this.readState();
        const includeArchived = options.includeArchived ?? false;
        const includeTombstoned = options.includeTombstoned ?? false;
        const filtered = state.memories
            .filter((memory) => includeTombstoned || memory.status !== "tombstoned")
            .filter((memory) => includeArchived || memory.layer !== "archive")
            .filter((memory) => !options.layers?.length || options.layers.includes(memory.layer))
            .filter((memory) => !options.categories?.length || options.categories.includes(memory.category))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return applyLimit(filtered, options.limit, options.offset);
    }

    async getMemory(id: string): Promise<DeveloperMemoryRecord> {
        const state = await this.readState();
        const memory = state.memories.find((item) => item.id === id);
        if (!memory) {
            throw new Error(`memory not found: ${id}`);
        }
        return memory;
    }

    async createMemory(input: {
        content: string;
        layer?: DeveloperMemoryLayer;
        category?: DeveloperMemoryCategory;
        scope?: DeveloperMemoryScope;
        evidence?: DeveloperMemoryEvidence[];
        sourceId?: string;
        ttl?: string;
        expiresAt?: string;
    }): Promise<DeveloperMemoryRecord> {
        const timestamp = nowIso();
        const layer = input.layer ?? "short_term";
        const processingState: DeveloperMemoryProcessingState = "processed";
        assertLegalMemoryState(layer, "active", processingState);
        const memory: DeveloperMemoryRecord = {
            id: `mem_${randomUUID()}`,
            content: input.content,
            layer,
            status: "active",
            processingState,
            category: input.category ?? "manual",
            scope: input.scope ?? {},
            evidence: input.evidence ?? [],
            sourceId: input.sourceId,
            ttl: input.ttl,
            expiresAt: input.expiresAt,
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        await this.updateState((state) => {
            state.memories.unshift(memory);
        });
        return memory;
    }

    async editMemory(
        id: string,
        updates: {
            content?: string;
            layer?: DeveloperMemoryLayer;
            category?: DeveloperMemoryCategory;
            status?: DeveloperMemoryStatus;
            evidence?: DeveloperMemoryEvidence[];
        }
    ): Promise<DeveloperMemoryRecord> {
        let updated: DeveloperMemoryRecord | undefined;
        await this.updateState((state) => {
            const memory = state.memories.find((item) => item.id === id);
            if (!memory) {
                throw new Error(`memory not found: ${id}`);
            }
            const nextLayer = updates.layer ?? memory.layer;
            const nextStatus = updates.status ?? memory.status;
            assertLegalMemoryState(nextLayer, nextStatus, memory.processingState);
            Object.assign(memory, {
                ...updates,
                layer: nextLayer,
                status: nextStatus,
                updatedAt: nowIso(),
            });
            updated = memory;
        });
        return updated!;
    }

    async deleteMemory(id: string): Promise<DeveloperMemoryRecord> {
        return this.editMemory(id, { status: "tombstoned" });
    }

    async promoteMemory(
        id: string,
        reason: string,
        by: "user" | "agent" | "system" = "user"
    ): Promise<DeveloperMemoryRecord> {
        let updated: DeveloperMemoryRecord | undefined;
        await this.updateState((state) => {
            const memory = state.memories.find((item) => item.id === id);
            if (!memory) {
                throw new Error(`memory not found: ${id}`);
            }
            const fromLayer = memory.layer;
            memory.layer = "long_term";
            memory.processingState = "processed";
            memory.status = "active";
            memory.promotion = {
                fromLayer,
                toLayer: "long_term",
                reason,
                at: nowIso(),
                by,
            };
            memory.updatedAt = memory.promotion.at;
            updated = memory;
        });
        return updated!;
    }

    async searchMemories(query: string, options: SearchOptions = {}): Promise<DeveloperMemoryRecord[]> {
        const memories = await this.listMemories({
            limit: 1000,
            includeArchived: options.includeArchived,
        });
        return memories
            .map((memory) => ({
                memory,
                score: scoreText(
                    query,
                    [
                        memory.content,
                        memory.category,
                        memory.layer,
                        ...memory.evidence.map((evidence) =>
                            [evidence.command, evidence.excerpt, evidence.path, evidence.url].filter(Boolean).join(" ")
                        ),
                    ].join(" ")
                ),
            }))
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score || b.memory.updatedAt.localeCompare(a.memory.updatedAt))
            .slice(0, options.limit ?? 10)
            .map((entry) => entry.memory);
    }

    async createSession(input: { title?: string; scope?: DeveloperMemoryScope }): Promise<DeveloperWorkspaceSession> {
        const timestamp = nowIso();
        const session: DeveloperWorkspaceSession = {
            id: `sess_${randomUUID()}`,
            title: input.title ?? "Workspace Session",
            status: "in_progress",
            scope: input.scope ?? {},
            events: [],
            memoryIds: [],
            actionItemIds: [],
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        await this.updateState((state) => {
            state.sessions.unshift(session);
        });
        return session;
    }

    async listSessions(
        options: { limit?: number; offset?: number; includeDiscarded?: boolean } = {}
    ): Promise<DeveloperWorkspaceSession[]> {
        const state = await this.readState();
        const sessions = state.sessions
            .filter((session) => options.includeDiscarded || session.status !== "discarded")
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return applyLimit(sessions, options.limit, options.offset);
    }

    async getSession(id: string): Promise<DeveloperWorkspaceSession> {
        const state = await this.readState();
        const session = state.sessions.find((item) => item.id === id);
        if (!session) {
            throw new Error(`workspace session not found: ${id}`);
        }
        return session;
    }

    async appendSessionEvent(
        sessionId: string,
        input: Omit<DeveloperSessionEvent, "id" | "createdAt">
    ): Promise<DeveloperWorkspaceSession> {
        let updated: DeveloperWorkspaceSession | undefined;
        await this.updateState((state) => {
            const session = state.sessions.find((item) => item.id === sessionId);
            if (!session) {
                throw new Error(`workspace session not found: ${sessionId}`);
            }
            const timestamp = nowIso();
            session.events.push({
                id: `evt_${randomUUID()}`,
                ...input,
                createdAt: timestamp,
            });
            session.updatedAt = timestamp;
            updated = session;
        });
        return updated!;
    }

    async completeSession(id: string, summary?: string): Promise<DeveloperWorkspaceSession> {
        let updated: DeveloperWorkspaceSession | undefined;
        await this.updateState((state) => {
            const session = state.sessions.find((item) => item.id === id);
            if (!session) {
                throw new Error(`workspace session not found: ${id}`);
            }
            const timestamp = nowIso();
            session.status = "completed";
            session.summary = summary ?? session.summary;
            session.completedAt = timestamp;
            session.updatedAt = timestamp;
            updated = session;
        });
        return updated!;
    }

    async searchSessions(query: string, options: { limit?: number } = {}): Promise<DeveloperWorkspaceSession[]> {
        const sessions = await this.listSessions({ limit: 1000 });
        return sessions
            .map((session) => ({
                session,
                score: scoreText(
                    query,
                    [
                        session.title,
                        session.summary,
                        ...session.events.map((event) =>
                            [event.title, event.detail, event.command, event.path, event.url].filter(Boolean).join(" ")
                        ),
                    ].join(" ")
                ),
            }))
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score || b.session.updatedAt.localeCompare(a.session.updatedAt))
            .slice(0, options.limit ?? 10)
            .map((entry) => entry.session);
    }

    async createActionItem(input: {
        title: string;
        description?: string;
        priority?: DeveloperActionItemPriority;
        dueAt?: string;
        scope?: DeveloperMemoryScope;
        sourceSessionId?: string;
        sourceMemoryId?: string;
        evidence?: DeveloperMemoryEvidence[];
    }): Promise<DeveloperActionItem> {
        const timestamp = nowIso();
        const actionItem: DeveloperActionItem = {
            id: `act_${randomUUID()}`,
            title: input.title,
            description: input.description,
            status: "pending",
            priority: input.priority ?? "medium",
            dueAt: input.dueAt,
            scope: input.scope ?? {},
            sourceSessionId: input.sourceSessionId,
            sourceMemoryId: input.sourceMemoryId,
            evidence: input.evidence ?? [],
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        await this.updateState((state) => {
            state.actionItems.unshift(actionItem);
            if (input.sourceSessionId) {
                const session = state.sessions.find((item) => item.id === input.sourceSessionId);
                if (session && !session.actionItemIds.includes(actionItem.id)) {
                    session.actionItemIds.push(actionItem.id);
                    session.updatedAt = timestamp;
                }
            }
        });
        return actionItem;
    }

    async listActionItems(
        options: { limit?: number; offset?: number; status?: DeveloperActionItemStatus } = {}
    ): Promise<DeveloperActionItem[]> {
        const state = await this.readState();
        const items = state.actionItems
            .filter((item) => !options.status || item.status === options.status)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return applyLimit(items, options.limit, options.offset);
    }

    async updateActionItem(
        id: string,
        updates: {
            title?: string;
            description?: string;
            status?: DeveloperActionItemStatus;
            priority?: DeveloperActionItemPriority;
            dueAt?: string;
        }
    ): Promise<DeveloperActionItem> {
        let updated: DeveloperActionItem | undefined;
        await this.updateState((state) => {
            const actionItem = state.actionItems.find((item) => item.id === id);
            if (!actionItem) {
                throw new Error(`action item not found: ${id}`);
            }
            Object.assign(actionItem, updates, { updatedAt: nowIso() });
            if (updates.status === "done" && !actionItem.completedAt) {
                actionItem.completedAt = actionItem.updatedAt;
            }
            updated = actionItem;
        });
        return updated!;
    }

    async deleteActionItem(id: string): Promise<DeveloperActionItem> {
        return this.updateActionItem(id, { status: "cancelled" });
    }

    async searchActionItems(query: string, options: { limit?: number } = {}): Promise<DeveloperActionItem[]> {
        const items = await this.listActionItems({ limit: 1000 });
        return items
            .map((item) => ({
                item,
                score: scoreText(
                    query,
                    [item.title, item.description, item.priority, item.status].filter(Boolean).join(" ")
                ),
            }))
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score || b.item.updatedAt.localeCompare(a.item.updatedAt))
            .slice(0, options.limit ?? 10)
            .map((entry) => entry.item);
    }

    async ingestWorkspaceEvent(input: {
        sessionId?: string;
        sessionTitle?: string;
        scope?: DeveloperMemoryScope;
        type: DeveloperSessionEventType;
        title?: string;
        detail?: string;
        blockId?: string;
        command?: string;
        path?: string;
        url?: string;
        exitCode?: number;
        rememberContent?: string;
        actionTitle?: string;
        actionDescription?: string;
        autoCreateActionItem?: boolean;
    }): Promise<{
        session: DeveloperWorkspaceSession;
        memory?: DeveloperMemoryRecord;
        actionItem?: DeveloperActionItem;
    }> {
        const session = input.sessionId
            ? await this.getSession(input.sessionId)
            : await this.createSession({ title: input.sessionTitle ?? "MCP Workspace Session", scope: input.scope });
        const eventEvidence = this.evidenceFromEvent(session.id, input);
        let updatedSession = await this.appendSessionEvent(session.id, {
            type: input.type,
            title: input.title,
            detail: input.detail,
            blockId: input.blockId,
            command: input.command,
            path: input.path,
            url: input.url,
            exitCode: input.exitCode,
        });
        const memory = input.rememberContent
            ? await this.createMemory({
                  content: input.rememberContent,
                  layer: "short_term",
                  category: "manual",
                  scope: input.scope ?? session.scope,
                  sourceId: session.id,
                  evidence: [eventEvidence],
              })
            : undefined;
        if (memory) {
            await this.updateState((state) => {
                const currentSession = state.sessions.find((item) => item.id === session.id);
                if (currentSession && !currentSession.memoryIds.includes(memory.id)) {
                    currentSession.memoryIds.push(memory.id);
                    currentSession.updatedAt = nowIso();
                    updatedSession = currentSession;
                }
            });
        }
        const shouldCreateAction = input.actionTitle || input.autoCreateActionItem;
        const actionItem = shouldCreateAction
            ? await this.createActionItem({
                  title:
                      input.actionTitle ??
                      (input.command
                          ? `Investigate failed command: ${input.command}`
                          : (input.title ?? "Review workspace event")),
                  description: input.actionDescription ?? input.detail,
                  priority: input.type === "terminal_error" ? "high" : "medium",
                  scope: input.scope ?? session.scope,
                  sourceSessionId: session.id,
                  sourceMemoryId: memory?.id,
                  evidence: [eventEvidence],
              })
            : undefined;
        if (actionItem) {
            updatedSession = await this.getSession(session.id);
        }
        return { session: updatedSession, memory, actionItem };
    }

    private evidenceFromEvent(
        sessionId: string,
        input: {
            type: DeveloperSessionEventType;
            blockId?: string;
            command?: string;
            path?: string;
            url?: string;
            detail?: string;
        }
    ): DeveloperMemoryEvidence {
        const sourceTypeByEvent: Record<DeveloperSessionEventType, DeveloperMemorySourceType> = {
            terminal_command: "terminal",
            terminal_error: "terminal",
            browser_navigation: "browser",
            file_change: "file",
            agent_tool: "agent",
            sandbox_event: "sandbox",
            manual_note: "manual",
        };
        return {
            sourceType: sourceTypeByEvent[input.type],
            sourceId: sessionId,
            blockId: input.blockId,
            command: input.command,
            path: input.path,
            url: input.url,
            excerpt: input.detail,
            createdAt: nowIso(),
        };
    }

    private async readState(): Promise<DeveloperMemoryStoreState> {
        try {
            const raw = await readFile(this.storePath, "utf8");
            const parsed = JSON.parse(raw) as DeveloperMemoryStoreState;
            return {
                ...emptyState(),
                ...parsed,
                memories: Array.isArray(parsed.memories) ? parsed.memories : [],
                sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
                actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
            };
        } catch (err: any) {
            if (err?.code === "ENOENT") {
                return emptyState();
            }
            throw err;
        }
    }

    private async writeState(state: DeveloperMemoryStoreState): Promise<void> {
        await mkdir(path.dirname(this.storePath), { recursive: true });
        const tmpPath = `${this.storePath}.${process.pid}.${Date.now()}.tmp`;
        await writeFile(tmpPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
        await rename(tmpPath, this.storePath);
    }

    private async updateState(mutator: (state: DeveloperMemoryStoreState) => void): Promise<void> {
        this.pendingWrite = this.pendingWrite.then(async () => {
            const state = await this.readState();
            mutator(state);
            await this.writeState(state);
        });
        await this.pendingWrite;
    }
}
