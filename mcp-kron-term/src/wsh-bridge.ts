import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Bridge to KronTerm's wsh CLI and daemon.
 * Executes `wsh` commands to control blocks, layout, widgets, and more.
 */
type ListedBlock = {
    blockid?: string;
    blockId?: string;
    view?: string;
    meta?: Record<string, unknown>;
    focused?: boolean;
};

type RecentWebOpen = {
    blockId: string;
    timestamp: number;
};

type SurfaceCapability = {
    token: string;
    tabId: string;
    blockId?: string;
};

export function readSurfaceCapability(filePath: string): SurfaceCapability {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<SurfaceCapability>;
    if (typeof parsed.token !== "string" || !parsed.token || typeof parsed.tabId !== "string" || !parsed.tabId) {
        throw new Error("surface capability file is missing token or tabId");
    }
    return {
        token: parsed.token,
        tabId: parsed.tabId,
        ...(typeof parsed.blockId === "string" && parsed.blockId ? { blockId: parsed.blockId } : {}),
    };
}

export type WorkspaceSurfaceControl = {
    action: string;
    presentation?: string;
    blockId?: string;
    targetBlockId?: string;
    position?: string;
    direction?: string;
    size?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    objectId?: string;
    fromObjectId?: string;
    toObjectId?: string;
    text?: string;
    color?: string;
};

export function makeWorkspaceSurfaceControlArgs(input: WorkspaceSurfaceControl): string[] {
    const blockId = (value: string) => (value.startsWith("block:") ? value.slice("block:".length) : value);
    const args = ["workspace-surface", "control", input.action];
    if (input.presentation) args.push("--presentation", input.presentation);
    if (input.blockId) args.push("--block", blockId(input.blockId));
    if (input.targetBlockId) args.push("--target-block", blockId(input.targetBlockId));
    if (input.position) args.push("--position", input.position);
    if (input.direction) args.push("--direction", input.direction);
    if (input.size != null) args.push("--size", String(input.size));
    if (input.x != null) args.push("--x", String(input.x));
    if (input.y != null) args.push("--y", String(input.y));
    if (input.width != null) args.push("--width", String(input.width));
    if (input.height != null) args.push("--height", String(input.height));
    if (input.objectId) args.push("--object", input.objectId);
    if (input.fromObjectId) args.push("--from-object", input.fromObjectId);
    if (input.toObjectId) args.push("--to-object", input.toObjectId);
    if (input.text != null) args.push("--text", input.text);
    if (input.color) args.push("--color", input.color);
    return args;
}

const RecentWebOpenWindowMs = 30_000;
const RefusedBrowserHosts = new Set(["example.cpm"]);

export function makeWshBlockRef(blockId: string): string {
    return blockId.startsWith("block:") ? blockId : `block:${blockId}`;
}

export function makeSandboxArgs(sessionId: string, command: string): string[] {
    return ["sandbox", "--session-id", sessionId, command];
}

export function makeLspArgs(
    workspacePath: string,
    filePath: string,
    language: string,
    query: string,
    line?: number,
    character?: number,
    maxResults?: number
): string[] {
    const args = ["lsp", workspacePath, filePath, language, query];
    if (line != null) args.push("--line", String(line));
    if (character != null) args.push("--character", String(character));
    if (maxResults != null) args.push("--max-results", String(maxResults));
    return args;
}

export function makeWidgetClickArgs(
    blockId: string,
    elementRef?: string,
    x?: number,
    y?: number,
    button?: string,
    clickType?: string
): string[] {
    const hasElementRef = elementRef != null && elementRef !== "";
    const hasCoordinates = x != null && y != null;
    if ((x == null) !== (y == null)) {
        throw new Error("widget click requires both x and y, or neither");
    }
    if ((hasElementRef && hasCoordinates) || (!hasElementRef && !hasCoordinates)) {
        throw new Error("widget click requires exactly one target: elementRef or both x and y");
    }
    const args = ["-b", makeWshBlockRef(blockId), "widget", "click"];
    if (hasElementRef) args.push("--element-ref", elementRef);
    if (x != null) args.push("--x", String(x));
    if (y != null) args.push("--y", String(y));
    if (button) args.push("--button", button);
    if (clickType) args.push("--click-type", clickType);
    return args;
}

export function makeWidgetHoverArgs(blockId: string, elementRef?: string, x?: number, y?: number): string[] {
    const args = ["-b", makeWshBlockRef(blockId), "widget", "hover"];
    if (elementRef) args.push("--element-ref", elementRef);
    if (x != null) args.push("--x", String(x));
    if (y != null) args.push("--y", String(y));
    return args;
}

export function makeSandboxClickArgs(
    sessionId: string,
    x?: number,
    y?: number,
    button?: string,
    count?: number
): string[] {
    const args = makeSandboxArgs(sessionId, "click");
    if (x != null && y != null) args.push("--at", "--x", String(x), "--y", String(y));
    if (button) args.push("--button", button);
    if (count != null) args.push("--count", String(count));
    return args;
}

export function makeSandboxDragArgs(
    sessionId: string,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    button?: string
): string[] {
    const args = [...makeSandboxArgs(sessionId, "drag"), String(startX), String(startY), String(endX), String(endY)];
    if (button) args.push("--button", button);
    return args;
}

export class WshBridge {
    private wshPath: string;
    private recentWebOpens = new Map<string, RecentWebOpen>();
    private pendingWebOpen: Promise<string> | null = null;

    constructor() {
        this.wshPath = this.resolveWsh();
    }

    private resolveWsh(): string {
        const configuredPath = process.env.KRONTERM_WSH;
        if (configuredPath) {
            if (!existsSync(configuredPath)) {
                throw new Error(`KRONTERM_WSH does not exist: ${configuredPath}`);
            }
            return configuredPath;
        }
        const repoWsh = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "wsh");
        const resourcesPath = (process as typeof process & { resourcesPath?: string }).resourcesPath;
        const packagedBinDir = resourcesPath ? join(resourcesPath, "app.asar.unpacked", "dist", "bin") : null;
        const packagedWsh =
            packagedBinDir && existsSync(packagedBinDir)
                ? readdirSync(packagedBinDir).find((filename) => filename === "wsh" || filename.startsWith("wsh-"))
                : null;
        const candidates = [
            repoWsh,
            process.env.KRONTERM_WSHBINDIR ? join(process.env.KRONTERM_WSHBINDIR, "wsh") : null,
            process.env.WAVETERM_WSH ? process.env.WAVETERM_WSH : null,
            packagedBinDir && packagedWsh ? join(packagedBinDir, packagedWsh) : null,
            join(homedir(), "kronterm", "dist", "bin", "wsh"),
            "/Applications/Wave Terminal.app/Contents/Resources/bin/wsh",
            join(homedir(), "Applications/Wave Terminal.app/Contents/Resources/bin/wsh"),
            "/usr/local/bin/wsh",
            "/opt/homebrew/bin/wsh",
            join(homedir(), "bin/wsh"),
        ];
        for (const p of candidates) {
            if (p && existsSync(p)) return p;
        }
        return "wsh"; // fallback to PATH
    }

    private async run(args: string[]): Promise<string> {
        try {
            const env = { ...process.env };
            const capabilityFile = process.env.KRONTERM_SURFACE_CAPABILITY_FILE;
            if (capabilityFile) {
                const capability = readSurfaceCapability(capabilityFile);
                env.KRONTERM_JWT = capability.token;
                env.WAVETERM_JWT = capability.token;
                env.KRONTERM_TABID = capability.tabId;
                env.WAVETERM_TABID = capability.tabId;
                if (capability.blockId) {
                    env.KRONTERM_BLOCKID = capability.blockId;
                    env.WAVETERM_BLOCKID = capability.blockId;
                } else {
                    delete env.KRONTERM_BLOCKID;
                    delete env.WAVETERM_BLOCKID;
                }
            }
            const output = execFileSync(this.wshPath, args, {
                encoding: "utf-8",
                timeout: 15000,
                env,
                maxBuffer: 16 * 1024 * 1024,
            });
            return output.trim();
        } catch (err: any) {
            throw new Error(`wsh ${args[0] ?? ""} failed: ${err.stderr?.trim() || err.message}`);
        }
    }

    getDiagnostics(): string {
        const capabilityFile = process.env.KRONTERM_SURFACE_CAPABILITY_FILE;
        let fileCapability: SurfaceCapability | null = null;
        if (capabilityFile) {
            try {
                fileCapability = readSurfaceCapability(capabilityFile);
            } catch {
                fileCapability = null;
            }
        }
        return JSON.stringify(
            {
                wshPath: this.wshPath,
                hasJwt: Boolean(process.env.KRONTERM_JWT || process.env.WAVETERM_JWT || fileCapability?.token),
                hasTabId: Boolean(process.env.KRONTERM_TABID || process.env.WAVETERM_TABID || fileCapability?.tabId),
                hasBlockId: Boolean(
                    process.env.KRONTERM_BLOCKID || process.env.WAVETERM_BLOCKID || fileCapability?.blockId
                ),
                configuredWsh: process.env.KRONTERM_WSH ?? process.env.WAVETERM_WSH ?? null,
                capabilityFile: capabilityFile ?? null,
            },
            null,
            2
        );
    }

    private blockRef(blockId: string): string {
        return makeWshBlockRef(blockId);
    }

    private blockId(blockId: string): string {
        return blockId.startsWith("block:") ? blockId.slice("block:".length) : blockId;
    }

    private normalizeBrowserUrl(url: string): string {
        const parsed = new URL(url);
        if (RefusedBrowserHosts.has(parsed.hostname.toLowerCase())) {
            throw new Error(`refusing to open likely typo URL ${parsed.href}`);
        }
        return parsed.href;
    }

    private blockIdFromOutput(output: string): string | null {
        return (
            output.match(/block:([a-z0-9-]+)/i)?.[1] ?? output.match(/\b([a-f0-9]{8}-[a-f0-9-]{20,})\b/i)?.[1] ?? null
        );
    }

    private sameBrowserUrl(left: string | undefined, right: string): boolean {
        if (!left) {
            return false;
        }
        try {
            return new URL(left).href === right;
        } catch {
            return left === right;
        }
    }

    private getBrowserBlockUrl(block: ListedBlock): string | undefined {
        const metaUrl = typeof block.meta?.url === "string" ? block.meta.url : undefined;
        if (metaUrl) {
            return metaUrl;
        }
        const tabs = block.meta?.["web:tabs"];
        const activeTabId = typeof block.meta?.["web:activetabid"] === "string" ? block.meta["web:activetabid"] : "";
        if (!Array.isArray(tabs)) {
            return undefined;
        }
        const activeTab = tabs.find(
            (tab) => tab && typeof tab === "object" && "id" in tab && (tab as { id?: unknown }).id === activeTabId
        );
        const fallbackTab = tabs.find((tab) => tab && typeof tab === "object");
        const tab = activeTab ?? fallbackTab;
        if (!tab || typeof tab !== "object" || !("url" in tab)) {
            return undefined;
        }
        const tabUrl = (tab as { url?: unknown }).url;
        return typeof tabUrl === "string" ? tabUrl : undefined;
    }

    private async findExistingWebBlock(normalizedUrl: string): Promise<string | null> {
        const now = Date.now();
        const recent = this.recentWebOpens.get(normalizedUrl);
        if (recent && now - recent.timestamp < RecentWebOpenWindowMs) {
            return recent.blockId;
        }

        let blocks: ListedBlock[] = [];
        try {
            const rawBlocks = await this.listBlocks(undefined, true);
            blocks = JSON.parse(rawBlocks) as ListedBlock[];
        } catch {
            return null;
        }
        const webBlocks = blocks.filter((block) => block.view === "web" || block.meta?.view === "web");
        const match =
            webBlocks.find((block) => {
                return this.sameBrowserUrl(this.getBrowserBlockUrl(block), normalizedUrl);
            }) ??
            webBlocks.find((block) => block.focused || block.meta?.focused === true) ??
            webBlocks[0];
        const blockId = match?.blockid ?? match?.blockId ?? null;
        if (blockId) {
            this.recentWebOpens.set(normalizedUrl, { blockId, timestamp: now });
        }
        return blockId;
    }

    private async findBrowserBlock(blockId?: string): Promise<ListedBlock | null> {
        let blocks: ListedBlock[] = [];
        try {
            blocks = JSON.parse(await this.listBlocks(undefined, true)) as ListedBlock[];
        } catch {
            return null;
        }
        const webBlocks = blocks.filter((block) => block.view === "web" || block.meta?.view === "web");
        if (blockId) {
            const normalizedBlockId = this.blockId(blockId);
            return webBlocks.find((block) => (block.blockid ?? block.blockId) === normalizedBlockId) ?? null;
        }
        return webBlocks.find((block) => block.focused || block.meta?.focused === true) ?? webBlocks[0] ?? null;
    }

    // ── Workspace ──────────────────────────────────────────────────────

    async getWorkspaceInfo(): Promise<string> {
        return this.run(["workspace", "list"]);
    }

    async workspaceSurfaceSnapshot(): Promise<string> {
        return this.run(["workspace-surface", "snapshot"]);
    }

    async workspaceSurfaceScreenshot(): Promise<string> {
        return this.run(["workspace-surface", "screenshot"]);
    }

    async workspaceSurfaceControl(input: WorkspaceSurfaceControl): Promise<string> {
        return this.run(makeWorkspaceSurfaceControlArgs(input));
    }

    async listBlocks(tabId?: string, json = false): Promise<string> {
        const args = ["blocks", "list"];
        if (tabId) args.push("--tab", tabId);
        if (json) args.push("--json");
        return this.run(args);
    }

    async getBlockInfo(blockId: string): Promise<string> {
        return this.run(["-b", this.blockRef(blockId), "getmeta"]);
    }

    async getBlockContent(blockId?: string): Promise<string> {
        const args = ["content"];
        if (blockId && blockId !== "this") args.push(this.blockRef(blockId));
        args.push("--json");
        return this.run(args);
    }

    async closeBlock(blockId: string): Promise<string> {
        return this.run(["-b", this.blockRef(blockId), "deleteblock"]);
    }

    async focusBlock(blockId: string): Promise<string> {
        return this.run(["-b", this.blockRef(blockId), "focusblock"]);
    }

    async createBlock(
        view: string,
        meta: Record<string, string> = {},
        magnified?: boolean,
        ephemeral?: boolean
    ): Promise<string> {
        const args = ["createblock", view];
        for (const [key, value] of Object.entries(meta)) {
            if (value != null) {
                args.push(`${key}=${value}`);
            }
        }
        if (magnified) args.push("--magnified");
        if (ephemeral) args.push("--ephemeral");
        return this.run(args);
    }

    async setBlockMeta(blockId: string, meta: Record<string, string>): Promise<string> {
        const pairs = Object.entries(meta).map(([k, v]) => `${k}=${v}`);
        return this.run(["-b", this.blockRef(blockId), "setmeta", ...pairs]);
    }

    // ── Terminal ───────────────────────────────────────────────────────

    async openTerminal(cwd?: string, magnified?: boolean): Promise<string> {
        const args = ["term"];
        if (cwd) args.push(cwd);
        if (magnified) args.push("--magnified");
        return this.run(args);
    }

    async terminalScrollback(blockId: string, start?: number, end?: number, lastCommand?: boolean): Promise<string> {
        const args = ["-b", this.blockRef(blockId), "termscrollback"];
        if (start != null) args.push("--start", String(start));
        if (end != null) args.push("--end", String(end));
        if (lastCommand) args.push("--lastcommand");
        return this.run(args);
    }

    async terminalInput(blockId: string, text: string, submit?: boolean): Promise<string> {
        const args = ["-b", this.blockRef(blockId), "terminput", text];
        if (submit) args.push("--submit");
        return this.run(args);
    }

    // ── Web ────────────────────────────────────────────────────────────

    async openWeb(url: string, magnified?: boolean, newSurface = false): Promise<string> {
        const normalizedUrl = this.normalizeBrowserUrl(url);
        if (this.pendingWebOpen && !magnified && !newSurface) {
            await this.pendingWebOpen;
        }
        const operation = (async () => {
            const existingBlockId = magnified || newSurface ? null : await this.findExistingWebBlock(normalizedUrl);
            if (existingBlockId) {
                await this.navigateWeb(existingBlockId, normalizedUrl);
                await this.focusBlock(existingBlockId).catch(() => undefined);
                this.recentWebOpens.set(normalizedUrl, { blockId: existingBlockId, timestamp: Date.now() });
                return `reused block block:${existingBlockId}`;
            }

            const args = ["web", "open", normalizedUrl];
            if (magnified) args.push("--magnified");
            const result = await this.run(args);
            const blockId = this.blockIdFromOutput(result);
            if (blockId) {
                this.recentWebOpens.set(normalizedUrl, { blockId, timestamp: Date.now() });
            }
            return result;
        })();
        if (!magnified && !newSurface) this.pendingWebOpen = operation;
        try {
            return await operation;
        } finally {
            if (this.pendingWebOpen === operation) this.pendingWebOpen = null;
        }
    }

    async navigateWeb(blockId: string, url: string): Promise<string> {
        return this.setBlockMeta(blockId, { url });
    }

    /** Browser widgets hold a single page; "opening a tab" navigates the
     *  widget in place. Kept as a distinct entry point so agent flows that
     *  ask for a second tab keep working against the current page. */
    async openWebTab(url: string, blockId?: string): Promise<string> {
        const normalizedUrl = this.normalizeBrowserUrl(url);
        const browserBlock = await this.findBrowserBlock(blockId);
        if (!browserBlock) {
            if (blockId) {
                throw new Error(`browser block not found: ${blockId}`);
            }
            return this.openWeb(normalizedUrl);
        }
        const browserBlockId = browserBlock.blockid ?? browserBlock.blockId;
        if (!browserBlockId) {
            throw new Error("browser block is missing its block ID");
        }
        await this.setBlockMeta(browserBlockId, { url: normalizedUrl });
        await this.focusBlock(browserBlockId).catch(() => undefined);
        this.recentWebOpens.set(normalizedUrl, { blockId: browserBlockId, timestamp: Date.now() });
        return `navigated browser block:block:${browserBlockId} to ${normalizedUrl}`;
    }

    async browserGetHtml(blockId: string, selector: string, inner?: boolean, all?: boolean): Promise<string> {
        const args = ["-b", this.blockRef(blockId), "web", "get", "--json"];
        if (inner) args.push("--inner");
        if (all) args.push("--all");
        args.push(selector);
        return this.run(args);
    }

    // ── File ───────────────────────────────────────────────────────────

    async openPath(filePath: string, edit?: boolean, magnified?: boolean): Promise<string> {
        const args = [edit ? "edit" : "view", filePath];
        if (magnified) args.push("--magnified");
        return this.run(args);
    }

    async fileList(filePath?: string): Promise<string> {
        const args = ["file", "ls"];
        if (filePath) args.push(filePath);
        return this.run(args);
    }

    async fileRead(filePath: string): Promise<string> {
        return this.run(["file", "cat", filePath]);
    }

    async fileInfo(filePath: string): Promise<string> {
        return this.run(["file", "info", filePath]);
    }

    async lspQuery(
        filePath: string,
        language: string,
        query: string,
        line?: number,
        character?: number,
        maxResults?: number
    ): Promise<string> {
        const workspacePath = process.env.KRONTERM_WORKSPACE;
        if (!workspacePath) {
            throw new Error("KRONTERM_WORKSPACE is unavailable; start this tool through a KronTerm agent session");
        }
        return this.run(makeLspArgs(workspacePath, filePath, language, query, line, character, maxResults));
    }

    async canvasLoad(workspaceId: string, blockId: string): Promise<string> {
        return this.run(["canvas", "load", workspaceId, this.blockId(blockId)]);
    }

    async canvasSnapshot(workspaceId: string, blockId: string, includeContent?: boolean): Promise<string> {
        const args = ["canvas", "snapshot", workspaceId, this.blockId(blockId)];
        if (includeContent) args.push("--include-content");
        return this.run(args);
    }

    async canvasSave(workspaceId: string, blockId: string, document: Record<string, unknown>): Promise<string> {
        return this.run(["canvas", "save", workspaceId, this.blockId(blockId), JSON.stringify(document)]);
    }

    async canvasCreateNode(workspaceId: string, blockId: string, node: Record<string, unknown>): Promise<string> {
        return this.run(["canvas", "create-node", workspaceId, this.blockId(blockId), JSON.stringify(node)]);
    }

    async canvasUpdateNode(workspaceId: string, blockId: string, node: Record<string, unknown>): Promise<string> {
        return this.run(["canvas", "update-node", workspaceId, this.blockId(blockId), JSON.stringify(node)]);
    }

    async canvasDeleteNode(workspaceId: string, blockId: string, nodeId: string): Promise<string> {
        return this.run(["canvas", "delete-node", workspaceId, this.blockId(blockId), nodeId]);
    }

    async canvasConnectNodes(
        workspaceId: string,
        blockId: string,
        fromNode: string,
        toNode: string,
        label?: string
    ): Promise<string> {
        const args = ["canvas", "connect", workspaceId, this.blockId(blockId), fromNode, toNode];
        if (label) args.push(label);
        return this.run(args);
    }

    async canvasLaunchNode(workspaceId: string, blockId: string, nodeId: string, tabId: string): Promise<string> {
        return this.run(["canvas", "launch-node", workspaceId, this.blockId(blockId), nodeId, tabId]);
    }

    async canvasUploadAsset(
        workspaceId: string,
        blockId: string,
        filePath: string,
        mimeType?: string
    ): Promise<string> {
        const args = ["canvas", "upload-asset", workspaceId, this.blockId(blockId), filePath];
        if (mimeType) args.push("--mime-type", mimeType);
        return this.run(args);
    }

    // ── Widget Human Simulation ────────────────────────────────────────

    async widgetSnapshot(blockId: string): Promise<string> {
        return this.run(["-b", this.blockRef(blockId), "widget", "snapshot", "--json"]);
    }

    async widgetFind(
        blockId: string,
        role?: string,
        name?: string,
        value?: string,
        text?: string,
        maxCount?: number
    ): Promise<string> {
        const args = ["-b", this.blockRef(blockId), "widget", "find", "--json"];
        if (role) args.push("--role", role);
        if (name) args.push("--name", name);
        if (value) args.push("--value", value);
        if (text) args.push("--text", text);
        if (maxCount) args.push("--max-count", String(maxCount));
        return this.run(args);
    }

    async widgetInspect(blockId: string, elementRef: string): Promise<string> {
        return this.run(["-b", this.blockRef(blockId), "widget", "inspect", elementRef, "--json"]);
    }

    async widgetElementAt(blockId: string, x: number, y: number): Promise<string> {
        return this.run([
            "-b",
            this.blockRef(blockId),
            "widget",
            "element-at",
            "--x",
            String(x),
            "--y",
            String(y),
            "--json",
        ]);
    }

    async widgetScreenshot(blockId: string): Promise<string> {
        return this.run(["-b", this.blockRef(blockId), "widget", "screenshot"]);
    }

    async widgetScreenshotAnnotated(blockId: string, showElements?: boolean): Promise<string> {
        const args = ["-b", this.blockRef(blockId), "widget", "screenshot-annotated", "--json"];
        if (showElements === false) args.push("--no-elements");
        return this.run(args);
    }

    async widgetClick(
        blockId: string,
        elementRef?: string,
        x?: number,
        y?: number,
        button?: string,
        clickType?: string
    ): Promise<string> {
        return this.run(makeWidgetClickArgs(blockId, elementRef, x, y, button, clickType));
    }

    async widgetHover(blockId: string, elementRef?: string, x?: number, y?: number): Promise<string> {
        return this.run(makeWidgetHoverArgs(blockId, elementRef, x, y));
    }

    async widgetMouseMove(blockId: string, elementRef?: string, x?: number, y?: number): Promise<string> {
        return this.widgetHover(blockId, elementRef, x, y);
    }

    async widgetType(blockId: string, text: string, delayMs?: number): Promise<string> {
        const args = ["-b", this.blockRef(blockId), "widget", "type", text];
        if (delayMs != null) args.push("--delay", String(delayMs));
        return this.run(args);
    }

    async widgetPress(blockId: string, keys: string[]): Promise<string> {
        return this.run(["-b", this.blockRef(blockId), "widget", "press", ...keys]);
    }

    async widgetScrollTo(blockId: string, elementRef?: string, x?: number, y?: number): Promise<string> {
        const args = ["-b", this.blockRef(blockId), "widget", "scroll-to"];
        if (elementRef) args.push("--element-ref", elementRef);
        if (x != null) args.push("--x", String(x));
        if (y != null) args.push("--y", String(y));
        return this.run(args);
    }

    async widgetDrag(
        blockId: string,
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        button?: string
    ): Promise<string> {
        const args = [
            "-b",
            this.blockRef(blockId),
            "widget",
            "drag",
            "--start-x",
            String(startX),
            "--start-y",
            String(startY),
            "--end-x",
            String(endX),
            "--end-y",
            String(endY),
        ];
        if (button) args.push("--button", button);
        return this.run(args);
    }

    async widgetLongPress(
        blockId: string,
        elementRef?: string,
        x?: number,
        y?: number,
        duration?: number
    ): Promise<string> {
        const args = ["-b", this.blockRef(blockId), "widget", "long-press"];
        if (elementRef) args.push("--element-ref", elementRef);
        if (x != null) args.push("--x", String(x));
        if (y != null) args.push("--y", String(y));
        if (duration != null) args.push("--duration", String(duration));
        return this.run(args);
    }

    async widgetGetValue(blockId: string, elementRef: string): Promise<string> {
        return this.run(["-b", this.blockRef(blockId), "widget", "get-value", "--element-ref", elementRef, "--json"]);
    }

    async widgetSetValue(blockId: string, elementRef: string, value: string): Promise<string> {
        return this.run([
            "-b",
            this.blockRef(blockId),
            "widget",
            "set-value",
            "--element-ref",
            elementRef,
            "--value",
            value,
        ]);
    }

    async widgetClear(blockId: string, elementRef: string): Promise<string> {
        return this.run(["-b", this.blockRef(blockId), "widget", "clear", "--element-ref", elementRef]);
    }

    async widgetSelect(blockId: string, elementRef: string, option: string): Promise<string> {
        return this.run([
            "-b",
            this.blockRef(blockId),
            "widget",
            "select",
            "--element-ref",
            elementRef,
            "--option",
            option,
        ]);
    }

    async widgetToggle(blockId: string, elementRef: string): Promise<string> {
        return this.run(["-b", this.blockRef(blockId), "widget", "toggle", "--element-ref", elementRef]);
    }

    async widgetWaitFor(blockId: string, condition: string, elementRef?: string, timeoutMs?: number): Promise<string> {
        const args = ["-b", this.blockRef(blockId), "widget", "wait-for", "--condition", condition, "--json"];
        if (elementRef) args.push("--element-ref", elementRef);
        if (timeoutMs != null) args.push("--timeout", String(timeoutMs));
        return this.run(args);
    }

    async widgetGetState(blockId: string): Promise<string> {
        return this.run(["-b", this.blockRef(blockId), "widget", "get-state", "--json"]);
    }

    async widgetClipboardGet(blockId: string): Promise<string> {
        return this.run(["-b", this.blockRef(blockId), "widget", "clipboard-get", "--json"]);
    }

    async widgetClipboardSet(blockId: string, text: string): Promise<string> {
        return this.run(["-b", this.blockRef(blockId), "widget", "clipboard-set", "--text", text]);
    }

    // ── Sandbox VM ─────────────────────────────────────────────────────

    private sandboxArgs(sessionId: string, command: string): string[] {
        return makeSandboxArgs(sessionId, command);
    }

    async sandboxStart(sessionId = "default", mode?: string, browserUrl?: string): Promise<string> {
        const args = this.sandboxArgs(sessionId, "start");
        if (mode) args.push("--mode", mode);
        if (browserUrl) args.push("--browser-url", browserUrl);
        return this.run(args);
    }

    async sandboxStatus(sessionId = "default"): Promise<string> {
        return this.run(this.sandboxArgs(sessionId, "status"));
    }

    async sandboxStop(sessionId = "default"): Promise<string> {
        return this.run(this.sandboxArgs(sessionId, "stop"));
    }

    async sandboxScreenshot(sessionId = "default"): Promise<string> {
        return this.run(this.sandboxArgs(sessionId, "screenshot"));
    }

    async sandboxMouseMove(sessionId: string, x: number, y: number): Promise<string> {
        return this.run([...this.sandboxArgs(sessionId, "mouse-move"), String(x), String(y)]);
    }

    async sandboxClick(sessionId: string, x?: number, y?: number, button?: string, count?: number): Promise<string> {
        return this.run(makeSandboxClickArgs(sessionId, x, y, button, count));
    }

    async sandboxType(sessionId: string, text: string, delayMs?: number): Promise<string> {
        const args = [...this.sandboxArgs(sessionId, "type"), text];
        if (delayMs != null) args.push("--delay", String(delayMs));
        return this.run(args);
    }

    async sandboxPaste(sessionId: string, text: string): Promise<string> {
        return this.run([...this.sandboxArgs(sessionId, "paste"), text]);
    }

    async sandboxPress(sessionId: string, keys: string[]): Promise<string> {
        return this.run([...this.sandboxArgs(sessionId, "press"), ...keys]);
    }

    async sandboxScroll(
        sessionId: string,
        direction?: string,
        count?: number,
        x?: number,
        y?: number
    ): Promise<string> {
        const args = this.sandboxArgs(sessionId, "scroll");
        if (direction) args.push("--direction", direction);
        if (count != null) args.push("--count", String(count));
        if (x != null && y != null) args.push("--at", "--x", String(x), "--y", String(y));
        return this.run(args);
    }

    async sandboxDrag(
        sessionId: string,
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        button?: string
    ): Promise<string> {
        return this.run(makeSandboxDragArgs(sessionId, startX, startY, endX, endY, button));
    }

    // ── New: Widget Registry ────────────────────────────────────────────

    async listWidgets(): Promise<string> {
        return this.run(["widgets", "--json"]);
    }

    // ── New: Launch Widget ──────────────────────────────────────────────

    async launchWidget(widgetKey: string, magnified?: boolean): Promise<string> {
        const args = ["launch", widgetKey];
        if (magnified) args.push("--magnify");
        return this.run(args);
    }

    // ── New: Notifications ─────────────────────────────────────────────

    async notify(message: string, title?: string, silent?: boolean): Promise<string> {
        const args = ["notify", message];
        if (title) args.push("-t", title);
        if (silent) args.push("-s");
        return this.run(args);
    }

    // ── New: Badge Management ───────────────────────────────────────────

    async setBadge(blockId: string, icon: string, color?: string, priority?: number, beep?: boolean): Promise<string> {
        const args = ["-b", this.blockRef(blockId), "badge", icon];
        if (color) args.push("--color", color);
        if (priority != null) args.push("--priority", String(priority));
        if (beep) args.push("--beep");
        return this.run(args);
    }

    async clearBadge(blockId: string): Promise<string> {
        return this.run(["-b", this.blockRef(blockId), "badge", "--clear"]);
    }

    // ── New: Tab Background ────────────────────────────────────────────

    async setTabBackground(pathOrColor: string, opacity?: number, tile?: boolean, center?: boolean): Promise<string> {
        const args = ["setbg", pathOrColor];
        if (opacity != null) args.push("--opacity", String(opacity));
        if (tile) args.push("--tile");
        if (center) args.push("--center");
        return this.run(args);
    }

    async clearTabBackground(): Promise<string> {
        return this.run(["setbg", "--clear"]);
    }

    // ── New: Connections ───────────────────────────────────────────────

    async connectionStatus(): Promise<string> {
        return this.run(["conn", "status"]);
    }

    async connectionConnect(name: string): Promise<string> {
        return this.run(["conn", "connect", name]);
    }

    async connectionDisconnect(name: string): Promise<string> {
        return this.run(["conn", "disconnect", name]);
    }

    async connectionDisconnectAll(): Promise<string> {
        return this.run(["conn", "disconnectall"]);
    }

    // ── New: AI Sidebar ────────────────────────────────────────────────

    async aiAppend(message: string, files?: string[], submit?: boolean): Promise<string> {
        const args = ["ai"];
        if (files) {
            for (const f of files) args.push(f);
        }
        args.push("-m", message);
        if (submit) args.push("-s");
        return this.run(args);
    }

    // ── New: Run Command in Block ──────────────────────────────────────

    async runCommand(
        command: string,
        cwd?: string,
        magnified?: boolean,
        exitOnSuccess?: boolean,
        forceExit?: boolean
    ): Promise<string> {
        const args = ["run", "-c", command];
        if (cwd) args.push("--cwd", cwd);
        if (magnified) args.push("--magnified");
        if (exitOnSuccess) args.push("-x");
        if (forceExit) args.push("-X");
        return this.run(args);
    }

    // ── New: Block Variables ───────────────────────────────────────────

    async getVariables(blockId: string, varFileName?: string): Promise<string> {
        const args = ["-b", this.blockRef(blockId), "getvar"];
        if (varFileName) args.push("--varfile", varFileName);
        return this.run(args);
    }

    async setVariables(
        blockId: string,
        vars: Record<string, string>,
        local?: boolean,
        varFileName?: string
    ): Promise<string> {
        const args = ["-b", this.blockRef(blockId), "setvar"];
        if (local) args.push("--local");
        if (varFileName) args.push("--varfile", varFileName);
        for (const [k, v] of Object.entries(vars)) {
            args.push(`${k}=${v}`);
        }
        return this.run(args);
    }

    async removeVariables(blockId: string, keys: string[], varFileName?: string): Promise<string> {
        const args = ["-b", this.blockRef(blockId), "setvar", "-r"];
        if (varFileName) args.push("--varfile", varFileName);
        args.push(...keys);
        return this.run(args);
    }

    // ── New: App Config ────────────────────────────────────────────────

    async setConfig(pairs: Record<string, string>): Promise<string> {
        const args = ["setconfig"];
        for (const [k, v] of Object.entries(pairs)) {
            if (v != null) args.push(`${k}=${v}`);
        }
        return this.run(args);
    }

    // ── New: Secrets Management ────────────────────────────────────────

    async secretList(): Promise<string> {
        return this.run(["secret", "list"]);
    }

    async secretGet(name: string): Promise<string> {
        return this.run(["secret", "get", name]);
    }

    async secretSet(name: string, value: string): Promise<string> {
        return this.run(["secret", "set", name, value]);
    }

    async secretDelete(name: string): Promise<string> {
        return this.run(["secret", "delete", name]);
    }

    // ── Agent Activity (for KronosCode integration) ────────────────────

    async publishAgentSurfaceActivity(activity: Record<string, unknown>): Promise<void> {
        const waveActivity = { ...activity };
        if (typeof waveActivity.previewimageurl === "string" && waveActivity.previewimageurl.length > 64 * 1024) {
            delete waveActivity.previewimageurl;
        }
        spawn(this.wshPath, ["agentactivity", JSON.stringify(waveActivity)], {
            stdio: "ignore",
            env: { ...process.env },
            detached: true,
        }).unref();
        const petActivityUrl =
            process.env.KRONTERM_PET_ACTIVITY_URL ??
            process.env.KRONOSCODE_PET_ACTIVITY_URL ??
            "http://127.0.0.1:4097/pet/activity";
        const phase = activity.phase;
        const action = activity.action;
        fetch(petActivityUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                kind: phase === "finish" || phase === "error" ? "idle" : "tool",
                detail: typeof activity.detail === "string" ? activity.detail : action,
                cursorPoint: activity.point,
                surfaceActivity: activity,
            }),
        }).catch(() => undefined);
    }
}
