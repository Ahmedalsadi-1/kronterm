import { Keyboard as CapacitorKeyboard } from "@capacitor/keyboard";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import {
    ArrowLeft,
    ArrowRight,
    Bot,
    ChevronLeft,
    CircleStop,
    Eye,
    Keyboard,
    ListTree,
    LoaderCircle,
    LockKeyhole,
    MessageSquareText,
    MousePointer2,
    RefreshCw,
    RotateCcw,
    Send,
    ShieldCheck,
    X,
} from "lucide-react";
import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";
import type { BrowserSnapshot, BrowserSnapshotItem, Surface, SurfaceControlMode, TerminalStreamEvent } from "../types";

interface FocusedSurfaceProps {
    surface?: Surface;
    previewUrl?: string;
    loading: boolean;
    controlMode: SurfaceControlMode;
    leaseEndsAt?: number;
    onBack: () => void;
    onRefresh: () => Promise<void>;
    onBrowserSnapshot: () => Promise<BrowserSnapshot>;
    onBrowserAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
    onSandboxAction: (action: Record<string, unknown>) => Promise<void>;
    onTerminalSubscribe: (onEvent: (event: TerminalStreamEvent) => void) => () => void;
    onTerminalInput: (data: string) => Promise<void>;
    onTerminalResize: (cols: number, rows: number) => Promise<void>;
    onControlMode: (mode: SurfaceControlMode) => void;
    onAskKronos: () => void;
    onStop: () => Promise<void>;
}

const formatLease = (leaseEndsAt: number | undefined, now: number): string => {
    if (!leaseEndsAt) {
        return "";
    }
    const remaining = Math.max(0, Math.ceil((leaseEndsAt - now) / 1_000));
    return `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
};

export const FocusedSurface = ({
    surface,
    previewUrl,
    loading,
    controlMode,
    leaseEndsAt,
    onBack,
    onRefresh,
    onBrowserSnapshot,
    onBrowserAction,
    onSandboxAction,
    onTerminalSubscribe,
    onTerminalInput,
    onTerminalResize,
    onControlMode,
    onAskKronos,
    onStop,
}: FocusedSurfaceProps) => {
    const [address, setAddress] = useState("");
    const [keyboardText, setKeyboardText] = useState("");
    const [now, setNow] = useState(Date.now());
    const [browserControlsOpen, setBrowserControlsOpen] = useState(false);
    const [browserControlsLoading, setBrowserControlsLoading] = useState(false);
    const [browserControlsError, setBrowserControlsError] = useState("");
    const [browserSnapshot, setBrowserSnapshot] = useState<BrowserSnapshot>();
    const [browserValues, setBrowserValues] = useState<Record<string, string>>({});
    const [terminalInput, setTerminalInput] = useState("");
    const [terminalStatus, setTerminalStatus] = useState("Connecting…");
    const previewRef = useRef<HTMLImageElement>(null);
    const pointerStartRef = useRef<{ x: number; y: number } | undefined>(undefined);
    const terminalElementRef = useRef<HTMLDivElement>(null);
    const sandboxKeyboardInputRef = useRef<HTMLInputElement>(null);
    const launchedTerminalSessionsRef = useRef(new Set<string>());

    useEffect(() => {
        setAddress(surface?.url ?? "");
        setKeyboardText("");
        setBrowserControlsOpen(false);
        setBrowserControlsError("");
        setBrowserSnapshot(undefined);
        setBrowserValues({});
    }, [surface?.id, surface?.url]);

    useEffect(() => {
        if (!surface?.terminalSessionId || !terminalElementRef.current) {
            return;
        }
        const terminalSessionId = surface.terminalSessionId;
        const initialCommand = surface.initialCommand;
        setTerminalInput("");
        setTerminalStatus("Connecting…");
        const terminal = new Terminal({
            cursorBlink: true,
            cursorStyle: "bar",
            fontFamily: '"IBM Plex Mono", "SFMono-Regular", Menlo, monospace',
            fontSize: 11,
            lineHeight: 1.35,
            scrollback: 5_000,
            theme: {
                background: "#090a09",
                foreground: "#d8d8d4",
                cursor: "#edb449",
                selectionBackground: "#4a3d2788",
            },
        });
        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(terminalElementRef.current);
        let lastSize = "";
        const fit = () => {
            fitAddon.fit();
            const size = `${terminal.cols}:${terminal.rows}`;
            if (size === lastSize) {
                return;
            }
            lastSize = size;
            void onTerminalResize(terminal.cols, terminal.rows).catch(() => undefined);
        };
        const resizeObserver = new ResizeObserver(fit);
        resizeObserver.observe(terminalElementRef.current);
        window.requestAnimationFrame(() => {
            fit();
            terminal.focus();
        });
        const inputSubscription = terminal.onData((data) => {
            void onTerminalInput(data).catch((reason) => {
                setTerminalStatus(reason instanceof Error ? reason.message : "Terminal input failed");
            });
        });
        const launchInitialCommand = () => {
            if (!initialCommand || launchedTerminalSessionsRef.current.has(terminalSessionId)) {
                return;
            }
            launchedTerminalSessionsRef.current.add(terminalSessionId);
            setTerminalStatus("Launching KronosCode…");
            void onTerminalInput(`${initialCommand}\r`).catch((reason) => {
                launchedTerminalSessionsRef.current.delete(terminalSessionId);
                setTerminalStatus(reason instanceof Error ? reason.message : "KronosCode launch failed");
            });
        };
        const unsubscribe = onTerminalSubscribe((event) => {
            if (event.type === "connected") {
                setTerminalStatus("Live project shell");
                launchInitialCommand();
                return;
            }
            if (event.type === "data" && event.data) {
                terminal.write(event.data);
                return;
            }
            if (event.type === "exit") {
                setTerminalStatus(`Exited${event.exitCode != null ? ` · ${event.exitCode}` : ""}`);
                return;
            }
            if (event.type === "error") {
                setTerminalStatus(event.message || "Terminal connection failed");
            }
        });
        return () => {
            resizeObserver.disconnect();
            inputSubscription.dispose();
            unsubscribe();
            terminal.dispose();
        };
    }, [onTerminalInput, onTerminalResize, onTerminalSubscribe, surface?.initialCommand, surface?.terminalSessionId]);

    useEffect(() => {
        if (controlMode !== "takeover") {
            return;
        }
        const timer = window.setInterval(() => setNow(Date.now()), 1_000);
        return () => window.clearInterval(timer);
    }, [controlMode]);

    if (!surface) {
        return null;
    }

    const navigate = async (event: FormEvent) => {
        event.preventDefault();
        const value = address.trim();
        if (!value || !surface.sessionId) {
            return;
        }
        const url = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value) ? value : `https://${value}`;
        await onBrowserAction("navigate", { type: "url", url });
    };

    const typeIntoSandbox = async (event: FormEvent) => {
        event.preventDefault();
        if (!keyboardText.trim()) {
            return;
        }
        const text = keyboardText;
        setKeyboardText("");
        await onSandboxAction({ action: "type", text });
    };

    const submitTerminalInput = async (event: FormEvent) => {
        event.preventDefault();
        if (!terminalInput) {
            return;
        }
        const command = terminalInput;
        setTerminalInput("");
        await onTerminalInput(`${command}\r`);
    };

    const loadBrowserControls = async () => {
        setBrowserControlsLoading(true);
        setBrowserControlsError("");
        try {
            const nextSnapshot = await onBrowserSnapshot();
            setBrowserSnapshot(nextSnapshot);
            setBrowserValues(
                Object.fromEntries(
                    nextSnapshot.items.map((item) => [item.uid, item.value ?? browserValues[item.uid] ?? ""])
                )
            );
        } catch (reason) {
            setBrowserControlsError(reason instanceof Error ? reason.message : "Could not read the page controls");
        } finally {
            setBrowserControlsLoading(false);
        }
    };

    const toggleBrowserControls = () => {
        const open = !browserControlsOpen;
        setBrowserControlsOpen(open);
        if (open && !browserSnapshot && !browserControlsLoading) {
            void loadBrowserControls();
        }
    };

    const clickBrowserControl = async (item: BrowserSnapshotItem) => {
        await onBrowserAction("click", { uid: item.uid });
        await loadBrowserControls();
    };

    const fillBrowserControl = async (event: FormEvent, item: BrowserSnapshotItem) => {
        event.preventDefault();
        await onBrowserAction("fill", { uid: item.uid, value: browserValues[item.uid] ?? "" });
        await loadBrowserControls();
    };

    const previewCoordinate = (event: PointerEvent<HTMLImageElement>): [number, number] => {
        if (!previewRef.current) {
            return [0, 0];
        }
        const rect = previewRef.current.getBoundingClientRect();
        const naturalWidth = previewRef.current.naturalWidth || 1280;
        const naturalHeight = previewRef.current.naturalHeight || 800;
        return [
            Math.round(((event.clientX - rect.left) / rect.width) * naturalWidth),
            Math.round(((event.clientY - rect.top) / rect.height) * naturalHeight),
        ];
    };

    const startDirectInteraction = (event: PointerEvent<HTMLImageElement>) => {
        pointerStartRef.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const finishDirectInteraction = async (event: PointerEvent<HTMLImageElement>) => {
        if (controlMode !== "takeover" || !previewRef.current) {
            return;
        }
        const start = pointerStartRef.current;
        pointerStartRef.current = undefined;
        const coordinate = previewCoordinate(event);
        const deltaX = event.clientX - (start?.x ?? event.clientX);
        const deltaY = event.clientY - (start?.y ?? event.clientY);
        if (surface.phoneControl && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 36) {
            const direction =
                Math.abs(deltaX) > Math.abs(deltaY) ? (deltaX > 0 ? "right" : "left") : deltaY > 0 ? "down" : "up";
            await onSandboxAction({ action: "swipe", coordinate, direction });
            return;
        }
        await onSandboxAction({ action: "left_click", coordinate });
    };

    const directTerminal = Boolean(surface.terminalSessionId);
    const hasDirectControl = Boolean(surface.sandboxId || surface.phoneControl);
    const hasLease = controlMode === "takeover";

    return (
        <section className="focused-surface" aria-label={`${surface.title} focused surface`}>
            <header className="focus-header">
                <button type="button" className="focus-back" onClick={onBack} aria-label="Back to surfaces">
                    <ChevronLeft />
                </button>
                <div className="focus-title">
                    <span style={{ background: surface.hostColor }} />
                    <div>
                        <strong>{surface.title}</strong>
                        <small>{surface.hostLabel}</small>
                    </div>
                </div>
                <button type="button" onClick={() => void onRefresh()} aria-label="Refresh surface">
                    <RefreshCw className={loading ? "spin" : ""} />
                </button>
                <button type="button" onClick={onBack} aria-label="Close focused surface">
                    <X />
                </button>
            </header>

            {surface.kind === "browser" ? (
                <form className="browser-toolbar" onSubmit={navigate}>
                    <button
                        type="button"
                        disabled={!surface.canGoBack || loading}
                        onClick={() => void onBrowserAction("back")}
                        aria-label="Go back"
                    >
                        <ArrowLeft />
                    </button>
                    <button
                        type="button"
                        disabled={!surface.canGoForward || loading}
                        onClick={() => void onBrowserAction("forward")}
                        aria-label="Go forward"
                    >
                        <ArrowRight />
                    </button>
                    <button
                        type="button"
                        disabled={loading}
                        onClick={() => void onBrowserAction("reload")}
                        aria-label="Reload"
                    >
                        <RotateCcw />
                    </button>
                    <label>
                        <ShieldCheck />
                        <input
                            value={address}
                            onChange={(event) => setAddress(event.target.value)}
                            autoCapitalize="none"
                            autoCorrect="off"
                            inputMode="url"
                            aria-label="Address"
                        />
                    </label>
                    <button
                        type="button"
                        className={browserControlsOpen ? "is-selected" : ""}
                        onClick={toggleBrowserControls}
                        aria-label="Show page controls"
                    >
                        <ListTree />
                    </button>
                </form>
            ) : null}

            {directTerminal ? (
                <section className="terminal-workspace" aria-label="Interactive project terminal">
                    <header>
                        <span className="terminal-live-dot" />
                        <strong>{terminalStatus}</strong>
                        <small>{surface.subtitle}</small>
                    </header>
                    <div
                        ref={terminalElementRef}
                        className="terminal-emulator"
                        role="application"
                        aria-label="Project shell output"
                    />
                    <form onSubmit={submitTerminalInput}>
                        <span>$</span>
                        <input
                            value={terminalInput}
                            onChange={(event) => setTerminalInput(event.target.value)}
                            placeholder="Type a shell command"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            enterKeyHint="send"
                        />
                        <button type="button" onClick={() => void onTerminalInput(String.fromCharCode(3))}>
                            Ctrl-C
                        </button>
                        <button type="submit" disabled={!terminalInput} aria-label="Run command">
                            <Send />
                        </button>
                    </form>
                </section>
            ) : (
                <div className={`focus-canvas ${hasLease ? "is-controlling" : "is-watching"}`}>
                    {surface.kind === "terminal" && surface.terminalUrl ? (
                        <iframe src={surface.terminalUrl} title={surface.title} />
                    ) : previewUrl ? (
                        <img
                            ref={previewRef}
                            src={previewUrl}
                            alt={`Live view of ${surface.title}`}
                            onPointerDown={hasDirectControl ? startDirectInteraction : undefined}
                            onPointerUp={hasDirectControl ? (event) => void finishDirectInteraction(event) : undefined}
                        />
                    ) : (
                        <div className="focus-empty-preview">
                            {loading ? <LoaderCircle className="spin" /> : <Eye />}
                            <strong>{loading ? "Observing surface…" : "No live frame yet"}</strong>
                            <p>
                                {surface.kind === "browser"
                                    ? "Refresh to request the active browser frame."
                                    : "The host has not returned a screenshot."}
                            </p>
                        </div>
                    )}
                    {hasDirectControl && hasLease && previewUrl ? (
                        <span className="touch-cursor-hint">
                            <MousePointer2 />{" "}
                            {surface.phoneControl ? "Tap or swipe the iPhone" : "Tap the desktop to click"}
                        </span>
                    ) : null}
                    {loading ? <span className="focus-loading-line" /> : null}
                </div>
            )}

            {surface.kind === "browser" && browserControlsOpen ? (
                <section className="browser-control-panel" aria-label="Page controls">
                    <header>
                        <span>
                            <ListTree />
                            <strong>Page controls</strong>
                            <small>
                                {browserSnapshot ? `${browserSnapshot.items.length} found` : "Readable controls"}
                            </small>
                        </span>
                        <button
                            type="button"
                            onClick={() => void loadBrowserControls()}
                            disabled={browserControlsLoading}
                        >
                            <RefreshCw className={browserControlsLoading ? "spin" : ""} /> Refresh
                        </button>
                    </header>
                    {browserControlsError ? <p className="browser-control-error">{browserControlsError}</p> : null}
                    {browserControlsLoading && !browserSnapshot ? (
                        <div className="browser-control-empty">
                            <LoaderCircle className="spin" /> Reading this page…
                        </div>
                    ) : null}
                    {browserSnapshot && !browserSnapshot.items.length ? (
                        <div className="browser-control-empty">No interactive controls found on this page.</div>
                    ) : null}
                    <div className="browser-control-list">
                        {browserSnapshot?.items.slice(0, 80).map((item) => {
                            const isField = ["input", "textarea", "textbox", "searchbox", "combobox"].includes(
                                item.role
                            );
                            return (
                                <article key={item.uid} className="browser-control-item">
                                    <button
                                        type="button"
                                        className="browser-control-target"
                                        onClick={() => void clickBrowserControl(item)}
                                        title={item.href}
                                    >
                                        <span>@{item.uid}</span>
                                        <div>
                                            <strong>{item.name || item.href || `Unnamed ${item.role}`}</strong>
                                            <small>{item.role}</small>
                                        </div>
                                    </button>
                                    {isField ? (
                                        <form onSubmit={(event) => void fillBrowserControl(event, item)}>
                                            <input
                                                value={browserValues[item.uid] ?? ""}
                                                onChange={(event) =>
                                                    setBrowserValues((current) => ({
                                                        ...current,
                                                        [item.uid]: event.target.value,
                                                    }))
                                                }
                                                aria-label={`Value for ${item.name || item.role}`}
                                            />
                                            <button type="submit">Fill</button>
                                        </form>
                                    ) : null}
                                </article>
                            );
                        })}
                    </div>
                </section>
            ) : null}

            {hasDirectControl && hasLease ? (
                <form className="sandbox-keyboard" onSubmit={typeIntoSandbox}>
                    <Keyboard />
                    <input
                        ref={sandboxKeyboardInputRef}
                        value={keyboardText}
                        onChange={(event) => setKeyboardText(event.target.value)}
                        placeholder="Type into the focused app"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        enterKeyHint="send"
                    />
                    <button
                        type="button"
                        className="sandbox-keyboard-done"
                        onClick={() => {
                            sandboxKeyboardInputRef.current?.blur();
                            void CapacitorKeyboard.hide().catch(() => undefined);
                        }}
                        aria-label="Dismiss keyboard"
                    >
                        Done
                    </button>
                    <button type="submit" disabled={!keyboardText.trim()} aria-label="Type text">
                        <Send />
                    </button>
                </form>
            ) : null}

            <footer className="focus-controls">
                {!directTerminal ? (
                    <div className="control-segment" aria-label="Surface control mode">
                        <button
                            type="button"
                            className={controlMode === "watch" ? "is-selected" : ""}
                            onClick={() => onControlMode("watch")}
                        >
                            <Eye /> Watch
                        </button>
                        <button
                            type="button"
                            className={controlMode === "takeover" ? "is-selected" : ""}
                            onClick={() => onControlMode("takeover")}
                        >
                            <MousePointer2 /> Control
                        </button>
                    </div>
                ) : null}
                <button type="button" className="ask-kronos-button" onClick={onAskKronos}>
                    <Bot />
                    <span>
                        <strong>Ask Kronos</strong>
                        <small>Act on this surface</small>
                    </span>
                    <MessageSquareText />
                </button>
                <div className="focus-safety-row">
                    <span>
                        <LockKeyhole />
                        {directTerminal
                            ? "Direct terminal input"
                            : hasLease
                              ? `Direct control · ${formatLease(leaseEndsAt, now)}`
                              : "Read-only observation"}
                    </span>
                    {surface.capabilities.includes("stop") ? (
                        <button type="button" onClick={() => void onStop()}>
                            <CircleStop /> Stop
                        </button>
                    ) : null}
                </div>
            </footer>
        </section>
    );
};
