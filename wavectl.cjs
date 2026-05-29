#!/usr/bin/env node
/**
 * wavectl — WaveTerm Widget Control CLI
 * Connects to the local WaveTerm daemon via WebSocket RPC.
 * Controls blocks, widgets, splits, and layout.
 *
 * Usage: node wavectl.js <command> [args]
 */

const WebSocket = require("ws");
const AUTH_KEY = "ef809fae-00bf-4e20-a4ca-509a7c18a049";
const WS_PORT = 53859;

class WaveTermCtl {
    constructor() {
        this.ws = null;
        this.pending = new Map();
        this.connected = false;
        this.stableId = crypto.randomUUID();
    }

    async connect() {
        return new Promise((resolve, reject) => {
            const url = `ws://127.0.0.1:${WS_PORT}/ws?stableid=${this.stableId}`;
            this.ws = new WebSocket(url, { headers: { "X-AuthKey": AUTH_KEY } });
            this.ws.on("open", () => {
                this.connected = true;
                resolve();
            });
            this.ws.on("message", (data) => this._handleMessage(data));
            this.ws.on("error", (err) => reject(err));
            this.ws.on("close", () => {
                this.connected = false;
            });
        });
    }

    _handleMessage(data) {
        try {
            const parsed = JSON.parse(data.toString());
            if (parsed.type === "ping") return;
            if (parsed.eventtype === "rpc" && parsed.data) {
                const resid = parsed.data.resid;
                if (resid && this.pending.has(resid)) {
                    const { resolve, timeout } = this.pending.get(resid);
                    clearTimeout(timeout);
                    this.pending.delete(resid);
                    resolve(parsed.data);
                }
            }
        } catch (e) {
            /* ignore */
        }
    }

    async rpc(command, data = {}, timeout = 10000) {
        if (!this.connected) throw new Error("Not connected");
        return new Promise((resolve, reject) => {
            const reqid = crypto.randomUUID();
            const msg = JSON.stringify({ wscommand: "rpc", message: { command, reqid, data } });
            const timer = setTimeout(() => {
                this.pending.delete(reqid);
                reject(new Error(`Timeout: ${command}`));
            }, timeout);
            this.pending.set(reqid, { resolve, timeout: timer });
            this.ws.send(msg);
        });
    }

    async close() {
        if (this.ws) this.ws.close();
    }

    // ── High-level operations ──

    /** List all blocks in the active tab */
    async listBlocks() {
        const res = await this.rpc("blockslist", {});
        return res.data;
    }

    /** Get block info */
    async blockInfo(blockId) {
        return await this.rpc("blockinfo", blockId);
    }

    /** Create a new block */
    async createBlock(view, opts = {}) {
        const blocks = await this.listBlocks();
        const tabId = blocks[0].tabid;
        const blockdef = { meta: { view, ...opts } };
        const res = await this.rpc("createblock", {
            tabid: tabId,
            blockdef,
            magnified: opts.magnified || false,
            ephemeral: opts.ephemeral || false,
            focused: opts.focused !== false,
        });
        return res.data; // e.g. "block:uuid"
    }

    /** Close a block */
    async closeBlock(blockId) {
        return await this.rpc("controllerdestroy", blockId);
    }

    /** Focus a block */
    async focusBlock(blockId) {
        return await this.rpc("controllerresync", { blockid: blockId });
    }

    /** Get widget snapshot (interactive elements in a block) */
    async widgetSnapshot(blockId) {
        const res = await this.rpc("widgetsnapshot", { blockid: blockId });
        return res.data;
    }

    /** Capture block screenshot (returns base64 data URI or object) */
    async widgetScreenshot(blockId) {
        const res = await this.rpc("captureblockscreenshot", { blockid: blockId });
        return res.data;
    }

    /** Click at coordinates in a block */
    async widgetClick(blockId, x, y, button = "left") {
        return await this.rpc("widgetclick", { blockid: blockId, x, y, button });
    }

    /** Type text into a block */
    async widgetType(blockId, text) {
        return await this.rpc("widgettype", { blockid: blockId, text });
    }

    /** Send input to a terminal block */
    async sendInput(blockId, input) {
        return await this.rpc("controllerinput", { blockid: blockId, input });
    }

    /** Set block metadata (title, icon, etc.) */
    async setMeta(blockId, key, value) {
        const block = await this.blockInfo(blockId);
        return await this.rpc("setmeta", {
            oref: { otype: "block", oid: block.blockid || blockId },
            meta: { [key]: value },
        });
    }

    /** Execute a command in a terminal block */
    async runCommand(blockId, command) {
        return await this.sendInput(blockId, command + "\n");
    }

    /** Get workspace info */
    async workspaceInfo() {
        const blocks = await this.listBlocks();
        if (!blocks.length) return {};
        return {
            windowId: blocks[0].windowid,
            workspaceId: blocks[0].workspaceid,
            tabId: blocks[0].tabid,
        };
    }
}

// ── CLI ──
async function main() {
    const [, , command, ...args] = process.argv;
    const ctl = new WaveTermCtl();
    await ctl.connect();

    try {
        switch (command) {
            case "blocks":
            case "list": {
                const blocks = await ctl.listBlocks();
                console.log(JSON.stringify(blocks, null, 2));
                break;
            }
            case "info": {
                const [blockId] = args;
                const info = await ctl.blockInfo(blockId);
                console.log(JSON.stringify(info, null, 2));
                break;
            }
            case "create": {
                const [view, ...rest] = args;
                const opts = {};
                for (const arg of rest) {
                    const [k, v] = arg.split("=");
                    opts[k] = v || true;
                }
                const result = await ctl.createBlock(view, opts);
                console.log("Created:", result);
                break;
            }
            case "close": {
                const [blockId] = args;
                await ctl.closeBlock(blockId);
                console.log("Closed:", blockId);
                break;
            }
            case "snapshot": {
                const [blockId] = args;
                const snap = await ctl.widgetSnapshot(blockId);
                console.log(JSON.stringify(snap, null, 2));
                break;
            }
            case "screenshot": {
                const [blockId] = args;
                const shot = await ctl.widgetScreenshot(blockId);
                // If it's base64, show length; otherwise print
                if (typeof shot === "string" && shot.length > 100) {
                    console.log(`Screenshot data URI (${shot.length} chars)`);
                } else {
                    console.log(shot);
                }
                break;
            }
            case "click": {
                const [blockId, x, y] = args;
                await ctl.widgetClick(blockId, parseInt(x), parseInt(y));
                console.log(`Clicked at (${x}, ${y}) in ${blockId}`);
                break;
            }
            case "type": {
                const [blockId, ...textParts] = args;
                const text = textParts.join(" ");
                await ctl.widgetType(blockId, text);
                console.log(`Typed "${text}" into ${blockId}`);
                break;
            }
            case "run": {
                const [blockId, ...cmdParts] = args;
                const cmd = cmdParts.join(" ");
                await ctl.runCommand(blockId, cmd);
                console.log(`Ran "${cmd}" in ${blockId}`);
                break;
            }
            case "meta": {
                const [blockId, key, value] = args;
                await ctl.setMeta(blockId, key, value);
                console.log(`Set ${key}=${value} on ${blockId}`);
                break;
            }
            case "shell": {
                // Interactive shell mode
                console.log("WaveTerm Control Shell");
                console.log(
                    "Commands: blocks, info <id>, create <view>, close <id>, snapshot <id>, screenshot <id>, click <id> <x> <y>, type <id> <text>, run <id> <cmd>, meta <id> <key> <value>, exit"
                );
                process.stdin.setEncoding("utf8");
                process.stdin.on("data", async (line) => {
                    const parts = line.trim().split(/\s+/);
                    if (!parts.length || parts[0] === "exit") {
                        ctl.close();
                        process.exit(0);
                    }
                    try {
                        await mainCmd(ctl, parts);
                    } catch (e) {
                        console.error("Error:", e.message);
                    }
                    process.stdout.write("> ");
                });
                process.stdout.write("> ");
                break;
            }
            default:
                console.log(`
WaveTerm Widget Control Commands:
  blocks                  List all blocks
  info <blockId>         Get block details
  create <view> [opts]   Create block (views: term, web, preview, waveai, help, sandbox)
  close <blockId>        Close/delete a block
  snapshot <blockId>     Get interactive elements in a block
  screenshot <blockId>   Capture block screenshot
  click <id> <x> <y>     Click at coordinates in a block
  type <id> <text>       Type text into a block
  run <id> <command>     Execute a command in a terminal block
  meta <id> <key> <val>  Set block metadata
  shell                  Enter interactive mode
`);
        }
    } finally {
        ctl.close();
    }
}

main().catch((err) => {
    console.error("Fatal:", err.message);
    process.exit(1);
});
