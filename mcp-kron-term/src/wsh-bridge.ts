import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Bridge to KronTerm's wsh CLI and daemon.
 * Executes `wsh` commands to control blocks, layout, widgets, and more.
 */
export class WshBridge {
    private wshPath: string;

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
                ? readdirSync(packagedBinDir)
                      .find((filename) => filename === "wsh" || filename.startsWith("wsh-"))
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
            const output = execFileSync(this.wshPath, args, {
                encoding: "utf-8",
                timeout: 15000,
                env: { ...process.env },
                maxBuffer: 16 * 1024 * 1024,
            });
            return output.trim();
        } catch (err: any) {
            throw new Error(`wsh ${args[0] ?? ""} failed: ${err.stderr?.trim() || err.message}`);
        }
    }

    getDiagnostics(): string {
        return JSON.stringify(
            {
                wshPath: this.wshPath,
                hasJwt: Boolean(process.env.KRONTERM_JWT || process.env.WAVETERM_JWT),
                hasTabId: Boolean(process.env.KRONTERM_TABID || process.env.WAVETERM_TABID),
                hasBlockId: Boolean(process.env.KRONTERM_BLOCKID || process.env.WAVETERM_BLOCKID),
                configuredWsh: process.env.KRONTERM_WSH ?? process.env.WAVETERM_WSH ?? null,
            },
            null,
            2
        );
    }

    private blockRef(blockId: string): string {
        return blockId.startsWith("block:") ? blockId : `block:${blockId}`;
    }

    private blockId(blockId: string): string {
        return blockId.startsWith("block:") ? blockId.slice("block:".length) : blockId;
    }

    // ── Workspace ──────────────────────────────────────────────────────

    async getWorkspaceInfo(): Promise<string> {
        return this.run(["workspace", "list"]);
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

    // ── Web ────────────────────────────────────────────────────────────

    async openWeb(url: string, magnified?: boolean): Promise<string> {
        const args = ["web", "open", url];
        if (magnified) args.push("--magnified");
        return this.run(args);
    }

    async navigateWeb(blockId: string, url: string): Promise<string> {
        return this.setBlockMeta(blockId, { url });
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

    // ── Widget Human Simulation ────────────────────────────────────────

    async widgetSnapshot(blockId: string): Promise<string> {
        return this.run(["-b", this.blockRef(blockId), "widget", "snapshot", "--json"]);
    }

    async widgetFind(blockId: string, role?: string, name?: string, value?: string, text?: string, maxCount?: number): Promise<string> {
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
        return this.run(["-b", this.blockRef(blockId), "widget", "element-at", "--x", String(x), "--y", String(y), "--json"]);
    }

    async widgetScreenshot(blockId: string): Promise<string> {
        return this.run(["-b", this.blockRef(blockId), "widget", "screenshot"]);
    }

    async widgetScreenshotAnnotated(blockId: string, showElements?: boolean): Promise<string> {
        const args = ["-b", this.blockRef(blockId), "widget", "screenshot-annotated", "--json"];
        if (showElements === false) args.push("--no-elements");
        return this.run(args);
    }

    async widgetClick(blockId: string, elementRef?: string, x?: number, y?: number, button?: string, clickType?: string): Promise<string> {
        const args = ["-b", this.blockRef(blockId), "widget", "click"];
        if (elementRef) args.push("--element-ref", elementRef);
        if (x != null) args.push("--x", String(x));
        if (y != null) args.push("--y", String(y));
        if (button) args.push("--button", button);
        if (clickType) args.push("--click-type", clickType);
        return this.run(args);
    }

    async widgetHover(blockId: string, elementRef?: string, x?: number, y?: number): Promise<string> {
        const args = ["-b", this.blockRef(blockId), "widget", "hover"];
        if (elementRef) args.push("--element-ref", elementRef);
        if (x != null) args.push("--x", String(x));
        if (y != null) args.push("--y", String(y));
        return this.run(args);
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

    async widgetDrag(blockId: string, startX: number, startY: number, endX: number, endY: number, button?: string): Promise<string> {
        const args = ["-b", this.blockRef(blockId), "widget", "drag", "--start-x", String(startX), "--start-y", String(startY), "--end-x", String(endX), "--end-y", String(endY)];
        if (button) args.push("--button", button);
        return this.run(args);
    }

    async widgetLongPress(blockId: string, elementRef?: string, x?: number, y?: number, duration?: number): Promise<string> {
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
        return this.run(["-b", this.blockRef(blockId), "widget", "set-value", "--element-ref", elementRef, "--value", value]);
    }

    async widgetClear(blockId: string, elementRef: string): Promise<string> {
        return this.run(["-b", this.blockRef(blockId), "widget", "clear", "--element-ref", elementRef]);
    }

    async widgetSelect(blockId: string, elementRef: string, option: string): Promise<string> {
        return this.run(["-b", this.blockRef(blockId), "widget", "select", "--element-ref", elementRef, "--option", option]);
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

    async runCommand(command: string, cwd?: string, magnified?: boolean, exitOnSuccess?: boolean, forceExit?: boolean): Promise<string> {
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

    async setVariables(blockId: string, vars: Record<string, string>, local?: boolean, varFileName?: string): Promise<string> {
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
        await this.run(["agentactivity", JSON.stringify(activity)]);
        const petActivityUrl = process.env.KRONOSCODE_PET_ACTIVITY_URL;
        if (!petActivityUrl) {
            return;
        }
        await fetch(petActivityUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(activity),
        }).catch(() => undefined);
    }
}
