// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import * as electron from "electron";
import { FastAverageColor } from "fast-average-color";
import fs from "fs";
import * as child_process from "node:child_process";
import * as path from "path";
import { PNG } from "pngjs";
import { pipeline, Readable, Transform } from "stream";
import { RpcApi } from "../frontend/app/store/wshclientapi";
import { getWebServerEndpoint } from "../frontend/util/endpoints";
import * as keyutil from "../frontend/util/keyutil";
import { fireAndForget, parseDataUrl } from "../frontend/util/util";
import {
    AcpAgentManager,
    AcpDetectedAgent,
    AcpEvent,
    createAgentManager,
    getAgentManager,
    listAgentManagers,
    rehomeIdleKronosCodeAgents,
    removeAgentManager,
} from "./acp";
import {
    getChatHubV2RuntimeHealth,
    getChatHubV2ServerStatus,
    startChatHubV2Server,
    stopChatHubV2Server,
} from "./chathubv2-server";
import {
    incrementTermCommandsDurable,
    incrementTermCommandsRemote,
    incrementTermCommandsRun,
    incrementTermCommandsWsl,
    setWasActive,
} from "./emain-activity";

import {
    audioGetStatus,
    audioSetWakeWord,
    audioShutdown,
    audioSpeak,
    audioStartListening,
    audioStopListening,
    registerAudioCallbacks,
    runAudioEngine,
} from "./emain-audio";
import { getKrondesignProc, getKrondesignUrl, isKrondesignHealthy, runKrondesignDaemon } from "./emain-krondesign";
import { sendLspMessage, startLanguageServer, stopLanguageServer } from "./emain-lsp";
import {
    getDesktopPetClickThroughStatus,
    notifyDesktopPetActivity,
    notifyDesktopPetNotification,
    resumeDesktopPetContext,
    submitDesktopPetChat,
    toggleDesktopPetClickThrough,
    updateDesktopPetOptions,
} from "./emain-pet";
import { callWithOriginalXdgCurrentDesktopAsync, unamePlatform } from "./emain-platform";
import { getWaveTabViewByWebContentsId } from "./emain-tabview";
import { handleCtrlShiftState } from "./emain-util";
import { getWaveVersion } from "./emain-wavesrv";
import { createNewWaveWindow, getWaveWindowByWebContentsId } from "./emain-window";
import { ElectronWshClient } from "./emain-wsh";
import { HermesRuntime } from "./hermes-runtime";
import {
    isKronosCodeLoopbackUrl,
    KronosCodeRuntime,
    withKronosCodeAttachArgs,
    type KronosCodeApiRequest,
    type KronosCodeBootProgress,
    type KronosCodeConnectionDescriptor,
} from "./kronoscode-runtime";

const electronApp = electron.app;

let webviewFocusId: number = null;
let webviewKeys: string[] = [];

const MaxImageDownloadBytes = 50 * 1024 * 1024;
const ImageHeadersTimeoutMs = 15_000;
const SystemSearchLimit = 36;
const SystemSearchTimeoutMs = 2_500;

function execFileLines(command: string, args: string[]): Promise<string[]> {
    return new Promise((resolve) => {
        child_process.execFile(
            command,
            args,
            { timeout: SystemSearchTimeoutMs, maxBuffer: 2 * 1024 * 1024 },
            (error, stdout) => {
                if (error && !stdout) {
                    resolve([]);
                    return;
                }
                resolve(
                    stdout
                        .split(/\r?\n/)
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .slice(0, SystemSearchLimit)
                );
            }
        );
    });
}

async function searchSystemPaths(query: string): Promise<string[]> {
    const homeDir = electronApp.getPath("home");
    if (process.platform === "darwin") {
        const safeQuery = query.replace(/[\\"*?]/g, " ").trim();
        if (!safeQuery) {
            return [];
        }
        return execFileLines("mdfind", ["-onlyin", homeDir, `kMDItemFSName == "*${safeQuery}*"cd`]);
    }
    if (process.platform === "win32") {
        const safeQuery = query.replace(/[[\]'"`$]/g, "").trim();
        return execFileLines("powershell.exe", [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            `Get-ChildItem -LiteralPath '${homeDir.replace(/'/g, "''")}' -Recurse -Force -ErrorAction SilentlyContinue -Filter '*${safeQuery}*' | Select-Object -First ${SystemSearchLimit} -ExpandProperty FullName`,
        ]);
    }
    return execFileLines("find", [homeDir, "-maxdepth", "6", "-iname", `*${query.replace(/[\\*?[\]]/g, "")}*`]);
}

async function makeSystemSearchItems(query: string): Promise<SystemSearchItem[]> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
        return [];
    }
    const homeDir = electronApp.getPath("home");
    const paths = await searchSystemPaths(normalizedQuery);
    const uniquePaths = Array.from(new Set(paths)).slice(0, SystemSearchLimit);
    const items = await Promise.all(
        uniquePaths.map(async (filePath): Promise<SystemSearchItem | null> => {
            try {
                const stat = await fs.promises.stat(filePath);
                const extension = path.extname(filePath).toLowerCase();
                const isImage = [".avif", ".gif", ".heic", ".jpeg", ".jpg", ".png", ".webp"].includes(extension);
                const looksLikeWallpaper = /(?:wallpaper|background|desktop pictures)/i.test(filePath);
                return {
                    kind: stat.isDirectory() ? "folder" : isImage && looksLikeWallpaper ? "wallpaper" : "file",
                    name: path.basename(filePath),
                    path: filePath,
                    detail: filePath.startsWith(homeDir) ? `~${filePath.slice(homeDir.length)}` : filePath,
                };
            } catch {
                return null;
            }
        })
    );
    return items.filter((item): item is SystemSearchItem => item != null);
}

type UrlInSessionResult = {
    stream: Readable;
    mimeType: string;
    fileName: string;
};

function getSingleHeaderVal(headers: Record<string, string | string[]>, key: string): string {
    const val = headers[key];
    if (val == null) {
        return null;
    }
    if (Array.isArray(val)) {
        return val[0];
    }
    return val;
}

function cleanMimeType(mimeType: string): string {
    if (mimeType == null) {
        return null;
    }
    const parts = mimeType.split(";");
    return parts[0].trim();
}

function getFileNameFromUrl(url: string): string {
    try {
        const pathname = new URL(url).pathname;
        const filename = pathname.substring(pathname.lastIndexOf("/") + 1);
        return filename;
    } catch (e) {
        return null;
    }
}

function getUrlInSession(session: Electron.Session, url: string): Promise<UrlInSessionResult> {
    return new Promise((resolve, reject) => {
        if (url.startsWith("data:")) {
            try {
                const parsed = parseDataUrl(url);
                const buffer = Buffer.from(parsed.buffer);
                if (buffer.byteLength > MaxImageDownloadBytes) {
                    throw new Error("Image exceeds the 50 MB download limit");
                }
                const readable = Readable.from(buffer);
                resolve({ stream: readable, mimeType: parsed.mimeType, fileName: "image" });
            } catch (err) {
                return reject(err);
            }
            return;
        }
        const request = electron.net.request({
            url,
            method: "GET",
            session,
        });
        let readable: Transform;
        let settled = false;
        const headersTimeout = setTimeout(() => {
            request.abort();
            if (!settled) {
                settled = true;
                reject(new Error("Timed out waiting for image response headers"));
            }
        }, ImageHeadersTimeoutMs);
        request.on("response", (response) => {
            clearTimeout(headersTimeout);
            const statusCode = response.statusCode;
            if (statusCode < 200 || statusCode >= 300) {
                request.abort();
                settled = true;
                reject(new Error(`HTTP request failed with status ${statusCode}: ${response.statusMessage || ""}`));
                return;
            }

            const mimeType = cleanMimeType(getSingleHeaderVal(response.headers, "content-type"));
            const fileName = getFileNameFromUrl(url) || "image";
            const contentLength = Number(getSingleHeaderVal(response.headers, "content-length"));
            if (Number.isFinite(contentLength) && contentLength > MaxImageDownloadBytes) {
                request.abort();
                settled = true;
                reject(new Error("Image exceeds the 50 MB download limit"));
                return;
            }

            let receivedBytes = 0;
            readable = new Transform({
                transform(chunk, _encoding, callback) {
                    receivedBytes += chunk.length;
                    if (receivedBytes > MaxImageDownloadBytes) {
                        callback(new Error("Image exceeds the 50 MB download limit"));
                        return;
                    }
                    callback(null, chunk);
                },
            });
            pipeline(response as unknown as Readable, readable, (err) => {
                if (err && !readable.destroyed) {
                    readable.destroy(err);
                }
            });
            settled = true;
            resolve({ stream: readable, mimeType, fileName });
        });
        request.on("error", (err) => {
            clearTimeout(headersTimeout);
            if (readable && !readable.destroyed) {
                readable.destroy(err);
            }
            if (!settled) {
                settled = true;
                reject(err);
            }
        });
        request.end();
    });
}

function saveImageFileWithNativeDialog(
    sender: electron.WebContents,
    defaultFileName: string,
    mimeType: string,
    readStream: Readable
) {
    if (defaultFileName == null || defaultFileName == "") {
        defaultFileName = "image";
    }
    const ww = electron.BrowserWindow.fromWebContents(sender);
    if (ww == null) {
        readStream.destroy();
        return;
    }
    const mimeToExtension: { [key: string]: string } = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/gif": "gif",
        "image/webp": "webp",
        "image/bmp": "bmp",
        "image/tiff": "tiff",
        "image/heic": "heic",
        "image/svg+xml": "svg",
    };
    function addExtensionIfNeeded(fileName: string, mimeType: string): string {
        const extension = mimeToExtension[mimeType];
        if (!path.extname(fileName) && extension) {
            return `${fileName}.${extension}`;
        }
        return fileName;
    }
    defaultFileName = addExtensionIfNeeded(defaultFileName, mimeType);
    electron.dialog
        .showSaveDialog(ww, {
            title: "Save Image",
            defaultPath: defaultFileName,
            filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff", "heic"] }],
        })
        .then((file) => {
            if (file.canceled) {
                readStream.destroy();
                return;
            }
            const writeStream = fs.createWriteStream(file.filePath);
            readStream.pipe(writeStream);
            writeStream.on("finish", () => {
                console.log("saved file", file.filePath);
            });
            writeStream.on("error", (err) => {
                console.log("error saving file (writeStream)", err);
                readStream.destroy();
            });
            readStream.on("error", (err) => {
                console.error("error saving file (readStream)", err);
                writeStream.destroy();
            });
        })
        .catch((err) => {
            console.log("error trying to save file", err);
        });
}

export function initIpcHandlers() {
    const broadcastKronosCodeEvent = (channel: string, payload: unknown) => {
        for (const webContents of electron.webContents.getAllWebContents()) {
            if (!webContents.isDestroyed()) {
                webContents.send(channel, payload);
            }
        }
    };
    KronosCodeRuntime.on("boot-progress", (payload: KronosCodeBootProgress) =>
        broadcastKronosCodeEvent("kronoscode-boot-progress", payload)
    );
    KronosCodeRuntime.on("exit", (payload) => broadcastKronosCodeEvent("kronoscode-exit", payload));
    HermesRuntime.on("connection", (payload) => broadcastKronosCodeEvent("hermes-connection", payload));
    electron.ipcMain.on("desktop-pet-options", (_event, options) => {
        updateDesktopPetOptions(options ?? {});
    });

    electron.ipcMain.on("desktop-pet-chat", (_event, text) => {
        if (typeof text === "string") {
            submitDesktopPetChat(text);
        }
    });

    electron.ipcMain.on("desktop-pet-resume", () => {
        resumeDesktopPetContext();
    });

    electron.ipcMain.on("desktop-pet-clickthrough-toggle", () => {
        toggleDesktopPetClickThrough();
    });

    electron.ipcMain.handle("desktop-pet-clickthrough-status", () => {
        return getDesktopPetClickThroughStatus();
    });

    electron.ipcMain.on("desktop-pet-activity", (event, notification) => {
        if (notification?.kind === "idle" || notification?.kind === "thinking" || notification?.kind === "tool") {
            const tabView = getWaveTabViewByWebContentsId(event.sender.id);
            const bounds = tabView?.getBounds();
            const localTarget = notification.target;
            const localCursorPoint = notification.cursorPoint;
            const target =
                bounds != null &&
                localTarget != null &&
                Number.isFinite(localTarget.x) &&
                Number.isFinite(localTarget.y) &&
                Number.isFinite(localTarget.width) &&
                Number.isFinite(localTarget.height)
                    ? {
                          x: bounds.x + localTarget.x,
                          y: bounds.y + localTarget.y,
                          width: localTarget.width,
                          height: localTarget.height,
                      }
                    : undefined;
            const hasBlockLocalCoordinates = typeof notification.surfaceActivity?.blockid === "string";
            const cursorPoint =
                hasBlockLocalCoordinates &&
                bounds != null &&
                localCursorPoint != null &&
                Number.isFinite(localCursorPoint.x) &&
                Number.isFinite(localCursorPoint.y)
                    ? {
                          x: bounds.x + localCursorPoint.x,
                          y: bounds.y + localCursorPoint.y,
                      }
                    : localCursorPoint;
            notifyDesktopPetNotification({ ...notification, target, cursorPoint });
            const petActivityUrl = notification.petActivityUrl;
            if (
                typeof petActivityUrl === "string" &&
                /^http:\/\/(127\.0\.0\.1|localhost):\d+\/pet\/activity$/.test(petActivityUrl) &&
                notification.surfaceActivity != null
            ) {
                void fetch(petActivityUrl, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ ...notification.surfaceActivity, target }),
                }).catch(() => undefined);
            }
        }
    });

    electron.ipcMain.on("open-external", (event, url) => {
        if (url && typeof url === "string") {
            fireAndForget(() =>
                callWithOriginalXdgCurrentDesktopAsync(() =>
                    electron.shell.openExternal(url).catch((err) => {
                        console.error(`Failed to open URL ${url}:`, err);
                    })
                )
            );
        } else {
            console.error("Invalid URL received in open-external event:", url);
        }
    });

    electron.ipcMain.on("webview-image-contextmenu", (event: electron.IpcMainEvent, payload: { src: string }) => {
        const menu = new electron.Menu();
        const win = getWaveWindowByWebContentsId(event.sender.hostWebContents?.id);
        if (win == null) {
            return;
        }
        menu.append(
            new electron.MenuItem({
                label: "Save Image",
                click: () => {
                    const resultP = getUrlInSession(event.sender.session, payload.src);
                    resultP
                        .then((result) => {
                            saveImageFileWithNativeDialog(
                                event.sender.hostWebContents,
                                result.fileName,
                                result.mimeType,
                                result.stream
                            );
                        })
                        .catch((e) => {
                            console.log("error getting image", e);
                        });
                },
            })
        );
        menu.popup();
    });

    electron.ipcMain.on("download", (event, payload) => {
        const baseName = encodeURIComponent(path.basename(payload.filePath));
        const streamingUrl =
            getWebServerEndpoint() + "/wave/stream-file/" + baseName + "?path=" + encodeURIComponent(payload.filePath);
        event.sender.downloadURL(streamingUrl);
    });

    electron.ipcMain.on("get-cursor-point", (event) => {
        const tabView = getWaveTabViewByWebContentsId(event.sender.id);
        if (tabView == null) {
            event.returnValue = null;
            return;
        }
        const screenPoint = electron.screen.getCursorScreenPoint();
        const windowRect = tabView.getBounds();
        const retVal: Electron.Point = {
            x: screenPoint.x - windowRect.x,
            y: screenPoint.y - windowRect.y,
        };
        event.returnValue = retVal;
    });

    electron.ipcMain.handle("capture-screenshot", async (event, rect) => {
        const tabView = getWaveTabViewByWebContentsId(event.sender.id);
        if (!tabView) {
            throw new Error("No tab view found for the given webContents id");
        }
        const image = await tabView.webContents.capturePage(rect);
        const base64String = image.toPNG().toString("base64");
        return `data:image/png;base64,${base64String}`;
    });

    electron.ipcMain.on("get-env", (event, varName) => {
        event.returnValue = process.env[varName] ?? null;
    });

    electron.ipcMain.on("get-about-modal-details", (event) => {
        event.returnValue = getWaveVersion() as AboutModalDetails;
    });

    electron.ipcMain.on("get-zoom-factor", (event) => {
        event.returnValue = event.sender.getZoomFactor();
    });

    const hasBeforeInputRegisteredMap = new Map<number, boolean>();

    electron.ipcMain.on("webview-focus", (event: Electron.IpcMainEvent, focusedId: number) => {
        webviewFocusId = focusedId;
        console.log("webview-focus", focusedId);
        if (focusedId == null) {
            return;
        }
        const parentWc = event.sender;
        const webviewWc = electron.webContents.fromId(focusedId);
        if (webviewWc == null) {
            webviewFocusId = null;
            return;
        }
        if (!hasBeforeInputRegisteredMap.get(focusedId)) {
            hasBeforeInputRegisteredMap.set(focusedId, true);
            webviewWc.on("before-input-event", (e, input) => {
                let waveEvent = keyutil.adaptFromElectronKeyEvent(input);
                handleCtrlShiftState(parentWc, waveEvent);
                if (webviewFocusId != focusedId) {
                    return;
                }
                if (input.type != "keyDown") {
                    return;
                }
                for (let keyDesc of webviewKeys) {
                    if (keyutil.checkKeyPressed(waveEvent, keyDesc)) {
                        e.preventDefault();
                        parentWc.send("reinject-key", waveEvent);
                        console.log("webview reinject-key", keyDesc);
                        return;
                    }
                }
            });
            webviewWc.on("destroyed", () => {
                hasBeforeInputRegisteredMap.delete(focusedId);
            });
        }
    });

    electron.ipcMain.on("register-global-webview-keys", (event, keys: string[]) => {
        webviewKeys = keys ?? [];
    });

    electron.ipcMain.on("set-keyboard-chord-mode", (event) => {
        event.returnValue = null;
        const tabView = getWaveTabViewByWebContentsId(event.sender.id);
        tabView?.setKeyboardChordMode(true);
    });

    electron.ipcMain.handle("set-is-active", () => {
        setWasActive(true);
    });

    const fac = new FastAverageColor();
    electron.ipcMain.on("update-window-controls-overlay", async (event, rect: Dimensions) => {
        if (unamePlatform === "darwin") return;
        try {
            const fullConfig = await RpcApi.GetFullConfigCommand(ElectronWshClient);
            if (fullConfig?.settings?.["window:nativetitlebar"] && unamePlatform !== "win32") return;

            const zoomFactor = event.sender.getZoomFactor();
            const electronRect: Electron.Rectangle = {
                x: rect.left * zoomFactor,
                y: rect.top * zoomFactor,
                height: rect.height * zoomFactor,
                width: rect.width * zoomFactor,
            };
            const overlay = await event.sender.capturePage(electronRect);
            const overlayBuffer = overlay.toPNG();
            const png = PNG.sync.read(overlayBuffer);
            const color = fac.prepareResult(fac.getColorFromArray4(png.data));
            const ww = getWaveWindowByWebContentsId(event.sender.id);
            if (ww == null) return;
            ww.setTitleBarOverlay({
                color: unamePlatform === "linux" ? color.rgba : "#00000000",
                symbolColor: color.isDark ? "white" : "black",
            });
        } catch (e) {
            console.error("Error updating window controls overlay:", e);
        }
    });

    electron.ipcMain.on("quicklook", (event, filePath: string) => {
        if (unamePlatform !== "darwin") return;
        child_process.execFile("/usr/bin/qlmanage", ["-p", filePath], (error, stdout, stderr) => {
            if (error) {
                console.error(`Error opening Quick Look: ${error}`);
            }
        });
    });

    electron.ipcMain.handle("clear-webview-storage", async (event, webContentsId: number) => {
        try {
            const wc = electron.webContents.fromId(webContentsId);
            if (wc && wc.session) {
                await wc.session.clearStorageData();
                console.log("Cleared cookies and storage for webContentsId:", webContentsId);
            }
        } catch (e) {
            console.error("Failed to clear cookies and storage:", e);
            throw e;
        }
    });

    electron.ipcMain.on("open-native-path", (event, filePath: string) => {
        console.log("open-native-path", filePath);
        filePath = filePath.replace("~", electronApp.getPath("home"));
        fireAndForget(() =>
            callWithOriginalXdgCurrentDesktopAsync(() =>
                electron.shell.openPath(filePath).then((excuse) => {
                    if (excuse) console.error(`Failed to open ${filePath} in native application: ${excuse}`);
                })
            )
        );
    });

    electron.ipcMain.on("set-window-init-status", (event, status: "ready" | "wave-ready") => {
        const tabView = getWaveTabViewByWebContentsId(event.sender.id);
        if (tabView != null && tabView.initResolve != null) {
            if (status === "ready") {
                tabView.initResolve();
                if (tabView.savedInitOpts) {
                    console.log("savedInitOpts calling wave-init", tabView.waveTabId);
                    tabView.webContents.send("wave-init", tabView.savedInitOpts);
                }
            } else if (status === "wave-ready") {
                tabView.waveReadyResolve();
            }
            return;
        }

        console.log("set-window-init-status: no window found for webContentsId", event.sender.id);
    });

    electron.ipcMain.on("fe-log", (event, logStr: string) => {
        console.log("fe-log", logStr);
    });

    electron.ipcMain.on(
        "increment-term-commands",
        (event, opts?: { isRemote?: boolean; isWsl?: boolean; isDurable?: boolean }) => {
            incrementTermCommandsRun();
            if (opts?.isRemote) {
                incrementTermCommandsRemote();
            }
            if (opts?.isWsl) {
                incrementTermCommandsWsl();
            }
            if (opts?.isDurable) {
                incrementTermCommandsDurable();
            }
        }
    );

    electron.ipcMain.on("native-paste", (event) => {
        event.sender.paste();
    });

    electron.ipcMain.on("open-new-window", () => fireAndForget(createNewWaveWindow));

    electron.ipcMain.on("do-refresh", (event) => {
        event.sender.reloadIgnoringCache();
    });

    electron.ipcMain.handle("save-text-file", async (event, fileName: string, content: string) => {
        const ww = electron.BrowserWindow.fromWebContents(event.sender);
        if (ww == null) {
            return false;
        }
        const result = await electron.dialog.showSaveDialog(ww, {
            title: "Save Scrollback",
            defaultPath: fileName || "session.log",
            filters: [{ name: "Text Files", extensions: ["txt", "log"] }],
        });
        if (result.canceled || !result.filePath) {
            return false;
        }
        try {
            await fs.promises.writeFile(result.filePath, content, "utf-8");
            console.log("saved scrollback to", result.filePath);
            return true;
        } catch (err) {
            console.error("error saving scrollback file", err);
            return false;
        }
    });

    electron.ipcMain.handle("select-directory", async (event): Promise<string | null> => {
        const ww = electron.BrowserWindow.fromWebContents(event.sender);
        if (ww == null) {
            return null;
        }
        const result = await electron.dialog.showOpenDialog(ww, {
            title: "Select ACP Workspace",
            properties: ["openDirectory"],
        });
        if (result.canceled) {
            return null;
        }
        return result.filePaths[0] ?? null;
    });

    electron.ipcMain.handle("select-files", async (event): Promise<string[]> => {
        const ww = electron.BrowserWindow.fromWebContents(event.sender);
        if (ww == null) {
            return [];
        }
        const result = await electron.dialog.showOpenDialog(ww, {
            title: "Reference Files in ACP Chat",
            properties: ["openFile", "multiSelections"],
        });
        if (result.canceled) {
            return [];
        }
        return result.filePaths;
    });

    electron.ipcMain.handle("search-system-items", async (_event, query: string): Promise<SystemSearchItem[]> => {
        return makeSystemSearchItems(typeof query === "string" ? query : "");
    });

    electron.ipcMain.handle(
        "acp-apply-git-identity",
        async (
            _event,
            opts: {
                workspace: string;
                userName: string;
                userEmail: string;
            }
        ): Promise<{ success: boolean; error?: string }> => {
            const workspace = opts.workspace?.trim();
            const userName = opts.userName?.trim();
            const userEmail = opts.userEmail?.trim();
            if (!workspace || !userName || !userEmail) {
                return { success: false, error: "Workspace, Git user name, and Git email are required." };
            }
            const runGitConfig = (key: string, value: string): Promise<void> =>
                new Promise((resolve, reject) => {
                    child_process.execFile("git", ["-C", workspace, "config", "--local", key, value], (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve();
                    });
                });
            try {
                await runGitConfig("user.name", userName);
                await runGitConfig("user.email", userEmail);
                return { success: true };
            } catch (err) {
                return { success: false, error: err instanceof Error ? err.message : String(err) };
            }
        }
    );

    electron.ipcMain.handle("acp-detect-agents", async (): Promise<AcpDetectedAgent[]> => {
        return AcpAgentManager.detectAgents();
    });

    electron.ipcMain.handle(
        "acp-initialize",
        async (
            event,
            opts: {
                conversationId: string;
                backend: string;
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
                surfaceContext?: {
                    tabId: string;
                    blockId?: string;
                };
            }
        ) => {
            if (opts.backend === "kronoscode") {
                const connection = await KronosCodeRuntime.ensure();
                const internal = KronosCodeRuntime.getInternalConnection();
                const allowDesktopCapabilities = isKronosCodeLoopbackUrl(connection.baseUrl);
                opts = {
                    ...opts,
                    surfaceContext: allowDesktopCapabilities ? opts.surfaceContext : undefined,
                    customArgs: withKronosCodeAttachArgs(opts.customArgs, connection.baseUrl),
                    customEnv: {
                        ...opts.customEnv,
                        KRONOSCODE_SERVER_USERNAME: internal?.username ?? "kronoscode",
                        ...(internal?.password ? { KRONOSCODE_SERVER_PASSWORD: internal.password } : {}),
                    },
                };
            }
            const manager = createAgentManager(opts);

            const senderWc = event.sender;
            manager.on("event", (acpEvent: AcpEvent) => {
                notifyDesktopPetActivity(acpEvent);
                if (!senderWc.isDestroyed()) {
                    senderWc.send("acp-event", acpEvent);
                }
            });

            try {
                await manager.initialize(opts);
                return {
                    success: true,
                    conversationId: opts.conversationId,
                    state: {
                        status: manager.status,
                        sessionId: manager.sessionId,
                        backend: manager.backend,
                        error: manager.error,
                        confirmations: manager.confirmations,
                        modes: manager.modes,
                        currentMode: manager.currentMode,
                        configOptions: manager.configOptions,
                        modelInfo: manager.modelInfo,
                        capabilities: manager.capabilities,
                        harnessProfile: manager.harnessProfile,
                        capabilityLease: manager.capabilityLease,
                    },
                };
            } catch (err) {
                return { success: false, error: err instanceof Error ? err.message : String(err) };
            }
        }
    );

    electron.ipcMain.handle(
        "acp-send-message",
        async (
            event,
            opts: {
                conversationId: string;
                content: string;
            }
        ) => {
            const manager = getAgentManager(opts.conversationId);
            if (!manager) {
                return { success: false, error: "Agent not initialized" };
            }
            try {
                await manager.sendMessage(opts);
                return { success: true };
            } catch (err) {
                return { success: false, error: err instanceof Error ? err.message : String(err) };
            }
        }
    );

    electron.ipcMain.handle(
        "acp-confirm-tool",
        async (
            event,
            opts: {
                conversationId: string;
                msgId: string;
                callId: string;
                optionId: string;
            }
        ) => {
            const manager = getAgentManager(opts.conversationId);
            if (!manager) {
                return { success: false, error: "Agent not found" };
            }
            try {
                await manager.confirmTool(opts);
                return { success: true };
            } catch (err) {
                return { success: false, error: err instanceof Error ? err.message : String(err) };
            }
        }
    );

    electron.ipcMain.handle("acp-stop", async (event, opts: { conversationId: string }) => {
        const manager = getAgentManager(opts.conversationId);
        if (!manager) {
            return { success: false, error: "Agent not found" };
        }
        try {
            await manager.stop();
            removeAgentManager(opts.conversationId);
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    });

    electron.ipcMain.handle("acp-get-status", async (event, opts: { conversationId: string }) => {
        const manager = getAgentManager(opts.conversationId);
        if (!manager) {
            return { status: "idle", found: false };
        }
        return {
            found: true,
            status: manager.status,
            sessionId: manager.sessionId,
            backend: manager.backend,
            error: manager.error,
            confirmations: manager.confirmations,
            modes: manager.modes,
            currentMode: manager.currentMode,
            configOptions: manager.configOptions,
            modelInfo: manager.modelInfo,
            capabilities: manager.capabilities,
            harnessProfile: manager.harnessProfile,
            capabilityLease: manager.capabilityLease,
        };
    });

    electron.ipcMain.handle("acp-list-runtimes", async () => {
        return listAgentManagers();
    });

    electron.ipcMain.handle("acp-get-mode", async (event, opts: { conversationId: string }) => {
        const manager = getAgentManager(opts.conversationId);
        if (!manager) {
            return { success: false, error: "Agent not initialized" };
        }
        return { success: true, data: manager.getMode() };
    });

    electron.ipcMain.handle("acp-set-mode", async (event, opts: { conversationId: string; mode: string }) => {
        const manager = getAgentManager(opts.conversationId);
        if (!manager) {
            return { success: false, error: "Agent not initialized" };
        }
        try {
            await manager.setMode(opts);
            return { success: true, data: manager.getMode() };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    });

    electron.ipcMain.handle("acp-get-config-options", async (event, opts: { conversationId: string }) => {
        const manager = getAgentManager(opts.conversationId);
        if (!manager) {
            return { success: false, error: "Agent not initialized" };
        }
        return { success: true, data: manager.getConfigOptions() };
    });

    electron.ipcMain.handle(
        "acp-set-config-option",
        async (event, opts: { conversationId: string; configId: string; value: string }) => {
            const manager = getAgentManager(opts.conversationId);
            if (!manager) {
                return { success: false, error: "Agent not initialized" };
            }
            try {
                const data = await manager.setConfigOption(opts);
                return { success: true, data };
            } catch (err) {
                return { success: false, error: err instanceof Error ? err.message : String(err) };
            }
        }
    );

    electron.ipcMain.handle("acp-get-model-info", async (event, opts: { conversationId: string }) => {
        const manager = getAgentManager(opts.conversationId);
        if (!manager) {
            return { success: false, error: "Agent not initialized" };
        }
        return { success: true, data: manager.getModelInfo() };
    });

    electron.ipcMain.handle("acp-set-model", async (event, opts: { conversationId: string; modelId: string }) => {
        const manager = getAgentManager(opts.conversationId);
        if (!manager) {
            return { success: false, error: "Agent not initialized" };
        }
        try {
            await manager.setModel(opts);
            return { success: true, data: manager.getModelInfo() };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    });

    // ── LSP (Language Server Protocol) IPC ─────────────────────────────

    electron.ipcMain.handle("lsp-start", async (event, language: string) => {
        try {
            const sessionId = startLanguageServer(event.sender, language);
            return { success: true, sessionId };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    });

    electron.ipcMain.on("lsp-send", (event, sessionId: string, content: string) => {
        try {
            sendLspMessage(sessionId, content);
        } catch (err) {
            console.error("[lsp] send error:", err);
        }
    });

    electron.ipcMain.on("lsp-stop", (event, sessionId: string) => {
        stopLanguageServer(sessionId);
    });

    // ── Krondesign Daemon IPC ──────────────────────────────────────────

    electron.ipcMain.handle("krondesign-status", async () => {
        const proc = getKrondesignProc();
        const healthy = await isKrondesignHealthy();
        return {
            running: healthy,
            url: getKrondesignUrl(),
            pid: healthy ? (proc?.pid ?? null) : null,
        };
    });

    electron.ipcMain.handle("krondesign-start", async () => {
        try {
            await runKrondesignDaemon();
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    });

    // ── Audio / Voice Engine IPC ──────────────────────────────────────

    electron.ipcMain.handle("audio-start", async () => {
        const audioReady = await runAudioEngine();
        registerAudioCallbacks({
            onStatusChange: (status) => {
                for (const wc of electron.BrowserWindow.getAllWindows().map((w) => w.webContents)) {
                    if (!wc.isDestroyed()) {
                        wc.send("audio-status-change", status);
                    }
                }
            },
            onTranscript: (text) => {
                for (const wc of electron.BrowserWindow.getAllWindows().map((w) => w.webContents)) {
                    if (!wc.isDestroyed()) {
                        wc.send("audio-transcript", text);
                    }
                }
            },
            onError: (msg) => {
                for (const wc of electron.BrowserWindow.getAllWindows().map((w) => w.webContents)) {
                    if (!wc.isDestroyed()) {
                        wc.send("audio-error", msg);
                    }
                }
            },
        });
        return audioReady;
    });

    electron.ipcMain.handle("audio-status", async () => {
        return audioGetStatus();
    });

    electron.ipcMain.on("audio-shutdown", () => {
        audioShutdown();
    });

    electron.ipcMain.on("audio-start-listening", () => {
        audioStartListening();
    });

    electron.ipcMain.on("audio-stop-listening", () => {
        audioStopListening();
    });

    electron.ipcMain.on("audio-speak", (_event, text: string) => {
        audioSpeak(text);
    });

    electron.ipcMain.on("audio-set-wake-word", (_event, enabled: boolean) => {
        audioSetWakeWord(enabled);
    });

    // ── ChatHub V2 / KronosChamber backend IPC ────────────────────────

    electron.ipcMain.handle(
        "chathubv2-start",
        async (_event, context?: { tabId?: string; blockId?: string; surfaceId?: string }) => {
            try {
                const data = await startChatHubV2Server(context);
                return { success: true, data, health: data.health };
            } catch (err) {
                return {
                    success: false,
                    error: err instanceof Error ? err.message : String(err),
                    health: getChatHubV2RuntimeHealth(),
                };
            }
        }
    );

    electron.ipcMain.handle("chathubv2-status", async () => {
        return { success: true, data: getChatHubV2ServerStatus(), health: getChatHubV2RuntimeHealth() };
    });

    electron.ipcMain.handle("chathubv2-stop", async () => {
        stopChatHubV2Server();
        return { success: true };
    });

    electron.ipcMain.handle("kronoscode-get-connection", async () => {
        return KronosCodeRuntime.ensure();
    });

    electron.ipcMain.handle("hermes-get-connection", async (_event, context?: { tabId?: string; blockId?: string }) => {
        return HermesRuntime.ensureSurface(context);
    });

    electron.ipcMain.handle("kronoscode-revalidate-connection", async () => {
        return KronosCodeRuntime.revalidate();
    });

    electron.ipcMain.handle("kronoscode-touch-backend", async () => {
        return KronosCodeRuntime.touch();
    });

    electron.ipcMain.handle(
        "kronoscode-get-gateway-ws-url",
        async (_event, input?: { directory?: string; surfaceId?: string }) => {
            return KronosCodeRuntime.getGatewayWsUrl(input);
        }
    );

    electron.ipcMain.handle("kronoscode-api", async (_event, input: KronosCodeApiRequest) => {
        return KronosCodeRuntime.api(input);
    });

    electron.ipcMain.handle(
        "kronoscode-apply-connection",
        async (
            _event,
            input: { endpoint?: string; binary?: string; username?: string; password?: string }
        ): Promise<KronosCodeConnectionDescriptor> => {
            const descriptor = await KronosCodeRuntime.applyConnection(input);
            const internal = KronosCodeRuntime.getInternalConnection();
            stopChatHubV2Server();
            await rehomeIdleKronosCodeAgents({
                baseUrl: descriptor.baseUrl,
                username: internal?.username ?? "kronoscode",
                password: internal?.password,
                allowDesktopCapabilities: isKronosCodeLoopbackUrl(descriptor.baseUrl),
            });
            broadcastKronosCodeEvent("kronoscode-connection-applied", descriptor);
            return descriptor;
        }
    );

    electron.ipcMain.handle("kronoscode-get-boot-progress", async () => {
        return KronosCodeRuntime.progress;
    });
}
