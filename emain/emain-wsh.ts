// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { WindowService } from "@/app/store/services";
import { RpcResponseHelper, WshClient } from "@/app/store/wshclient";
import { RpcApi } from "@/app/store/wshclientapi";
import { Notification, net, safeStorage, shell } from "electron";
import { getResolvedUpdateChannel } from "emain/updater";
import { queryLanguageServer } from "./emain-lsp";
import { unamePlatform } from "./emain-platform";
import { getWebContentsByBlockId, webGetSelector } from "./emain-web";
import { createBrowserWindow, getWaveWindowById, getWaveWindowByWorkspaceId } from "./emain-window";

export class ElectronWshClientType extends WshClient {
    constructor() {
        super("electron");
    }

    async handle_webeval(rh: RpcResponseHelper, data: CommandWebEvalData): Promise<string> {
        if (!data.tabid || !data.blockid) {
            throw new Error("tabid and blockid are required");
        }
        const ww = getWaveWindowByWorkspaceId(data.workspaceid);
        if (ww == null) {
            throw new Error(`no window found with workspace ${data.workspaceid}`);
        }
        const wc = await getWebContentsByBlockId(ww, data.tabid, data.blockid);
        if (wc == null) {
            throw new Error(`no webcontents found with blockid ${data.blockid}`);
        }
        const result = await wc.executeJavaScript(data.script);
        const rtn = typeof result === "string" ? result : JSON.stringify(result, null, 2);
        return rtn;
    }

    async handle_lspquery(rh: RpcResponseHelper, data: CommandLspQueryData): Promise<CommandLspQueryRtnData> {
        return queryLanguageServer(data);
    }

    async handle_webselector(rh: RpcResponseHelper, data: CommandWebSelectorData): Promise<string[]> {
        if (!data.tabid || !data.blockid || !data.workspaceid) {
            throw new Error("tabid and blockid are required");
        }
        const ww = getWaveWindowByWorkspaceId(data.workspaceid);
        if (ww == null) {
            throw new Error(`no window found with workspace ${data.workspaceid}`);
        }
        const wc = await getWebContentsByBlockId(ww, data.tabid, data.blockid);
        if (wc == null) {
            throw new Error(`no webcontents found with blockid ${data.blockid}`);
        }
        const rtn = await webGetSelector(wc, data.selector, data.opts);
        return rtn;
    }

    async handle_notify(rh: RpcResponseHelper, notificationOptions: WaveNotificationOptions) {
        new Notification({
            title: notificationOptions.title,
            body: notificationOptions.body,
            silent: notificationOptions.silent,
        }).show();
    }

    async handle_getupdatechannel(rh: RpcResponseHelper): Promise<string> {
        return getResolvedUpdateChannel();
    }

    async handle_focuswindow(rh: RpcResponseHelper, windowId: string) {
        console.log(`focuswindow ${windowId}`);
        const fullConfig = await RpcApi.GetFullConfigCommand(ElectronWshClient);
        let ww = getWaveWindowById(windowId);
        if (ww == null) {
            const window = await WindowService.GetWindow(windowId);
            if (window == null) {
                throw new Error(`window ${windowId} not found`);
            }
            ww = await createBrowserWindow(window, fullConfig, {
                unamePlatform,
                isPrimaryStartupWindow: false,
            });
        }
        ww.focus();
    }

    async handle_electronencrypt(
        rh: RpcResponseHelper,
        data: CommandElectronEncryptData
    ): Promise<CommandElectronEncryptRtnData> {
        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error("encryption is not available");
        }
        const encrypted = safeStorage.encryptString(data.plaintext);
        const ciphertext = encrypted.toString("base64");

        let storagebackend = "";
        if (process.platform === "linux") {
            storagebackend = safeStorage.getSelectedStorageBackend();
        }

        return {
            ciphertext,
            storagebackend,
        };
    }

    async handle_electrondecrypt(
        rh: RpcResponseHelper,
        data: CommandElectronDecryptData
    ): Promise<CommandElectronDecryptRtnData> {
        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error("encryption is not available");
        }
        const encrypted = Buffer.from(data.ciphertext, "base64");
        const plaintext = safeStorage.decryptString(encrypted);

        let storagebackend = "";
        if (process.platform === "linux") {
            storagebackend = safeStorage.getSelectedStorageBackend();
        }

        return {
            plaintext,
            storagebackend,
        };
    }

    async handle_networkonline(rh: RpcResponseHelper): Promise<boolean> {
        return net.isOnline();
    }

    async handle_electronsystembell(rh: RpcResponseHelper): Promise<void> {
        shell.beep();
    }

    // --- Window Management Handlers ---

    async handle_windowlist(rh: RpcResponseHelper): Promise<WindowInfo[]> {
        const { waveWindowMap } = await import("./emain-window");
        const windows: WindowInfo[] = [];
        for (const [id, ww] of waveWindowMap) {
            windows.push({
                windowId: id,
                workspaceId: ww.workspaceId,
                tabCount: ww.allLoadedTabViews?.size ?? 0,
                activeTabId: ww.activeTabView?.waveTabId ?? "",
                focused: ww.isFocused(),
                title: ww.getTitle() ?? "",
            });
        }
        return windows;
    }

    async handle_createwindow(rh: RpcResponseHelper): Promise<string> {
        const fullConfig = await RpcApi.GetFullConfigCommand(ElectronWshClient);
        const { createBrowserWindow } = await import("./emain-window");
        const window = await createBrowserWindow(null, fullConfig, {
            unamePlatform,
            isPrimaryStartupWindow: false,
        });
        return window.waveWindowId;
    }

    async handle_closewindow(rh: RpcResponseHelper, windowId: string) {
        const { getWaveWindowById } = await import("./emain-window");
        const ww = getWaveWindowById(windowId);
        if (ww == null) {
            throw new Error(`window ${windowId} not found`);
        }
        ww.close();
    }

    async handle_activatewindow(rh: RpcResponseHelper, windowId: string) {
        const { getWaveWindowById } = await import("./emain-window");
        const ww = getWaveWindowById(windowId);
        if (ww != null) {
            ww.focus();
        }
    }
}

export let ElectronWshClient: ElectronWshClientType;

export function initElectronWshClient() {
    ElectronWshClient = new ElectronWshClientType();
}
