// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

declare module "@novnc/novnc" {
    export interface RFBOptions {
        credentials?: {
            username?: string;
            password?: string;
            domain?: string;
        };
        ws?: WebSocket;
        repeater?: number;
        screen?: {
            width: number;
            height: number;
        };
        qualityLevel?: number;
        compressionLevel?: number;
        dragEndThreshold?: number;
        focusOnClick?: boolean;
        camera?: boolean;
        clipboard?: boolean;
        cursor?: boolean;
        dotCursor?: boolean;
        viewport?: boolean;
        scaleViewport?: boolean;
        resizing?: boolean;
        bell?: boolean;
        viewOnly?: boolean;
        disableClipboard?: boolean;
        autoscroll?: boolean;
        forceUniUTF8?: boolean;
        localcursor?: boolean;
        reconnect?: boolean;
        reconnectDelay?: number;
        reconnectFreq?: number;
        reconnectAttempts?: number;
        logging?: string;
        showDotWhenNoCursor?: boolean;
        shared?: boolean;
    }

    export interface RFBEventMap {
        connect: void;
        disconnect: void;
        securityfailure: { reason: string };
        clipboard: { text: string };
        bell: void;
        desktopname: { name: string };
        capabilities: { capabilities: Record<string, boolean> };
        clipboardPaste: { text: string };
    }

    export class RFB extends EventTarget {
        constructor(target: HTMLElement, url: string, options?: RFBOptions);

        disconnect(): void;
        sendPassword(password: string): void;
        sendCredentials(credentials: { username?: string; password?: string; domain?: string }): void;
        sendKey(keysym: number, code: string, down: boolean): void;
        sendCtrlAltDel(): void;
        sendAltTab(): void;
        sendEsc(): void;
        sendTab(): void;
        sendRightTab(): void;
        sendUpArrow(): void;
        sendDownArrow(): void;
        sendLeftArrow(): void;
        sendRightArrow(): void;
        sendDown(): void;
        sendUp(): void;
        sendChar(char: string): void;
        clipboardPaste(text: string): void;
        getDesktopName(callback: (name: string) => void): void;
        getClipboard(callback: (text: string) => void): void;
        getCapabilities(callback: (capabilities: Record<string, boolean>) => void): void;
        getQualityLevel(callback: (quality: number) => void): void;
        setQualityLevel(quality: number): void;
        getCompressionLevel(callback: (level: number) => void): void;
        setCompressionLevel(level: number): void;
        getViewportDrag(callback: (drag: boolean) => void): void;
        setViewportDrag(drag: boolean): void;
        getCursor(callback: (cursor: boolean) => void): void;
        setCursor(cursor: boolean): void;
        getDotWhenNoCursor(callback: (dot: boolean) => void): void;
        setDotWhenNoCursor(dot: boolean): void;
        getLocalCursor(callback: (cursor: boolean) => void): void;
        setLocalCursor(cursor: boolean): void;
        getClipboardText(callback: (text: string) => void): void;
        setClipboardText(text: string): void;
        getBell(callback: (bell: boolean) => void): void;
        setBell(bell: boolean): void;
        getViewOnly(callback: (viewOnly: boolean) => void): void;
        setViewOnly(viewOnly: boolean): void;
        getDisableClipboard(callback: (disable: boolean) => void): void;
        setDisableClipboard(disable: boolean): void;
        getAutoscroll(callback: (autoscroll: boolean) => void): void;
        setAutoscroll(autoscroll: boolean): void;
        getScaleViewport(callback: (scale: boolean) => void): void;
        setScaleViewport(scale: boolean): void;
        getResizing(callback: (resizing: boolean) => void): void;
        setResizing(resizing: boolean): void;
        getViewport(callback: (viewport: boolean) => void): void;
        setViewport(viewport: boolean): void;
        getCamera(callback: (camera: boolean) => void): void;
        setCamera(camera: boolean): void;

        addEventListener<K extends keyof RFBEventMap>(
            type: K,
            listener: (this: RFB, ev: RFBEventMap[K]) => void,
            options?: boolean | AddEventListenerOptions
        ): void;
        addEventListener(
            type: string,
            listener: EventListenerOrEventListenerObject,
            options?: boolean | AddEventListenerOptions
        ): void;
        removeEventListener<K extends keyof RFBEventMap>(
            type: K,
            listener: (this: RFB, ev: RFBEventMap[K]) => void,
            options?: boolean | EventListenerOptions
        ): void;
        removeEventListener(
            type: string,
            listener: EventListenerOrEventListenerObject,
            options?: boolean | EventListenerOptions
        ): void;

        readonly viewOnly: boolean;
        readonly qualityLevel: number;
        readonly compressionLevel: number;
        scaleViewport: boolean;
        resizeSession: boolean;
    }

    export default RFB;
    export function createRFBSession(url: string, options?: RFBOptions): RFB;
}
