import {
    Activity,
    ArrowLeft,
    ArrowRight,
    AtSign,
    Bot,
    Boxes,
    Braces,
    Check,
    ChevronDown,
    CircleDot,
    Cloud,
    Code2,
    Command,
    Cpu,
    ExternalLink,
    File,
    FileCode2,
    Folder,
    GitBranch,
    Globe2,
    Grid2X2,
    HardDrive,
    Laptop,
    Layers3,
    LoaderCircle,
    MoreHorizontal,
    PanelLeft,
    Play,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Send,
    Sparkles,
    SquareTerminal,
    TerminalSquare,
    Wifi,
    X,
    Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
    loadLocalWorkspace,
    routeRuntimeIntent,
    runLocalCommand,
    saveLocalWorkspace,
    updateWorkspaceFile,
    type KronLocalFile,
    type KronLocalWorkspace,
    type RoutedAgentObjective,
    type RuntimeTarget,
} from "../lib/kron-local-workspace";
import {
    cleanTerminalOutput,
    getLocalShellStatus,
    isKronosCodeCommand,
    runNativeLocalCommand,
    type LocalShellStatus,
} from "../lib/local-shell";
import type { ClosedSurface, HostRuntimeState, Surface } from "../types";

export type SurfaceWidget = "browser" | "terminal" | "kronoscode" | "file" | "app" | "sandbox";

type WorkspaceTabType = "agent" | "browser" | "code" | "devices" | "files" | "preview" | "terminal" | "workspace";

interface WorkspaceTab {
    id: WorkspaceTabType;
    title: string;
    type: WorkspaceTabType;
}

interface DockItem {
    type: WorkspaceTabType;
    label: string;
    icon: ReactNode;
}

interface SurfaceBrowserProps {
    hosts: HostRuntimeState[];
    surfaces: Surface[];
    closedSurfaces: ClosedSurface[];
    selectedHostId: string;
    refreshing: boolean;
    onSelectHost: (hostId: string) => void;
    onOpenHosts: () => void;
    onRefresh: () => Promise<void>;
    onOpenSurface: (surface: Surface) => void;
    onCloseSurface: (surface: Surface) => void;
    onRestoreSurface: (closed: ClosedSurface) => void;
    onCreateSandbox: () => Promise<void>;
    onAgentSubmit: (objective: RoutedAgentObjective) => Promise<boolean>;
    onBrowserNavigate: (value: string) => Promise<void>;
    onOpenWidget: (widget: SurfaceWidget) => Promise<void>;
    onOpenChat: () => void;
}

const InitialTabs: WorkspaceTab[] = [
    { id: "browser", title: "YouTube", type: "browser" },
    { id: "code", title: "input-pipeline.ts", type: "code" },
    { id: "terminal", title: "Terminal", type: "terminal" },
];

const DockItems: DockItem[] = [
    { type: "browser", label: "Browser", icon: <Globe2 /> },
    { type: "agent", label: "KronosChamber", icon: <Sparkles /> },
    { type: "workspace", label: "Workspace", icon: <GitBranch /> },
    { type: "files", label: "Files", icon: <Folder /> },
    { type: "code", label: "Code", icon: <Code2 /> },
    { type: "terminal", label: "Terminal", icon: <SquareTerminal /> },
    { type: "preview", label: "Preview", icon: <Play /> },
];

const TabLabels: Record<WorkspaceTabType, string> = {
    agent: "KronosChamber",
    browser: "YouTube",
    code: "input-pipeline.ts",
    devices: "Runtimes",
    files: "Files",
    preview: "Preview",
    terminal: "Terminal",
    workspace: "Workspace",
};

const RuntimeIcons: Record<RuntimeTarget, ReactNode> = {
    local: <Cpu />,
    "local-linux": <HardDrive />,
    sandbox: <Cloud />,
    "remote-device": <Laptop />,
};

const iconForTab = (type: WorkspaceTabType): ReactNode => {
    switch (type) {
        case "agent":
            return <Sparkles />;
        case "browser":
            return <Globe2 />;
        case "code":
            return <FileCode2 />;
        case "devices":
            return <Cpu />;
        case "files":
            return <Folder />;
        case "preview":
            return <Play />;
        case "terminal":
            return <TerminalSquare />;
        case "workspace":
            return <GitBranch />;
    }
};

const tabTypeForSurface = (surface: Surface): WorkspaceTabType => {
    if (surface.kind === "run") {
        return "agent";
    }
    if (surface.kind === "app") {
        return "preview";
    }
    if (surface.kind === "file") {
        return "files";
    }
    return surface.kind;
};

const makeTab = (type: WorkspaceTabType): WorkspaceTab => ({ id: type, title: TabLabels[type], type });

const normalizeBrowserUrl = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
        return "https://www.youtube.com";
    }
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    if (trimmed.includes(".") && !trimmed.includes(" ")) {
        return `https://${trimmed}`;
    }
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
};

const isYoutubeUrl = (url: string): boolean => /(?:youtube\.com|youtu\.be)/i.test(url);

const groupedFileRows = (files: KronLocalFile[]): Array<{ label: string; path?: string; depth: number }> => {
    const rows: Array<{ label: string; path?: string; depth: number }> = [
        { label: ".github", depth: 0 },
        { label: "docs", depth: 0 },
        { label: "packages", depth: 0 },
        { label: "agent", depth: 1 },
        { label: "src", depth: 2 },
    ];
    const nestedFile = files.find((file) => file.path.includes("input-pipeline.ts"));
    if (nestedFile) {
        rows.push({ label: "input-pipeline.ts", path: nestedFile.path, depth: 3 });
    }
    rows.push({ label: "tests", depth: 0 });
    for (const file of files.filter((candidate) => !candidate.path.includes("/"))) {
        rows.push({ label: file.path, path: file.path, depth: 0 });
    }
    return rows;
};

const highlightLine = (line: string): ReactNode[] => {
    const pieces = line.split(/(\/\/.*|"[^"\n]*"|'[^'\n]*'|\b(?:const|export|import|from|return|type)\b|\b\d+\b)/g);
    return pieces.map((piece, index) => {
        const key = `${index}:${piece}`;
        if (piece.startsWith("//")) {
            return (
                <span className="syntax-comment" key={key}>
                    {piece}
                </span>
            );
        }
        if (/^["']/.test(piece)) {
            return (
                <span className="syntax-string" key={key}>
                    {piece}
                </span>
            );
        }
        if (/^(const|export|import|from|return|type)$/.test(piece)) {
            return (
                <span className="syntax-keyword" key={key}>
                    {piece}
                </span>
            );
        }
        if (/^\d+$/.test(piece)) {
            return (
                <span className="syntax-number" key={key}>
                    {piece}
                </span>
            );
        }
        return <span key={key}>{piece}</span>;
    });
};

export const SurfaceBrowser = ({
    hosts,
    surfaces,
    closedSurfaces,
    selectedHostId,
    refreshing,
    onSelectHost,
    onOpenHosts,
    onRefresh,
    onOpenSurface,
    onCloseSurface,
    onRestoreSurface,
    onCreateSandbox,
    onAgentSubmit,
    onBrowserNavigate,
    onOpenWidget,
    onOpenChat,
}: SurfaceBrowserProps) => {
    const [workspace, setWorkspace] = useState<KronLocalWorkspace>(loadLocalWorkspace);
    const [selectedPath, setSelectedPath] = useState("packages/agent/src/input-pipeline.ts");
    const [openTabs, setOpenTabs] = useState<WorkspaceTab[]>(InitialTabs);
    const [activeTabId, setActiveTabId] = useState<WorkspaceTabType>("browser");
    const [newTabOpen, setNewTabOpen] = useState(false);
    const [objective, setObjective] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [browserInput, setBrowserInput] = useState("youtube.com");
    const [browserUrl, setBrowserUrl] = useState("https://www.youtube.com");
    const [browserHistory, setBrowserHistory] = useState(["https://www.youtube.com"]);
    const [browserHistoryIndex, setBrowserHistoryIndex] = useState(0);
    const [browserLoading, setBrowserLoading] = useState(false);
    const [editingCode, setEditingCode] = useState(false);
    const [terminalInput, setTerminalInput] = useState("");
    const [terminalBusy, setTerminalBusy] = useState(false);
    const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
    const [terminalHistoryIndex, setTerminalHistoryIndex] = useState(0);
    const [localShellStatus, setLocalShellStatus] = useState<LocalShellStatus | null>();
    const [terminalLines, setTerminalLines] = useState<string[]>([
        "Kron iPhone shell · persistent app sandbox",
        "Type `help`, or `kronoscode` to launch the connected KronosCode TUI.",
        "",
    ]);
    const [runtimeRoute, setRuntimeRoute] = useState(() => routeRuntimeIntent("edit files"));

    useEffect(() => {
        saveLocalWorkspace(workspace);
    }, [workspace]);

    useEffect(() => {
        let cancelled = false;
        void getLocalShellStatus().then((status) => {
            if (!cancelled) {
                setLocalShellStatus(status);
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const selectedFile =
        workspace.files.find((file) => file.path === selectedPath) ??
        workspace.files.find((file) => file.language === "typescript");
    const fileRows = useMemo(() => groupedFileRows(workspace.files), [workspace.files]);
    const onlineHosts = hosts.filter((host) => host.connection === "online").length;
    const selectedHost = hosts.find((host) => host.profile.id === selectedHostId);

    const openTab = (type: WorkspaceTabType) => {
        setOpenTabs((current) => {
            if (current.some((tab) => tab.id === type)) {
                return current;
            }
            const next = [...current, makeTab(type)];
            return next.length > 3 ? next.slice(next.length - 3) : next;
        });
        setActiveTabId(type);
        setNewTabOpen(false);
    };

    const closeTab = (type: WorkspaceTabType) => {
        setOpenTabs((current) => {
            const next = current.filter((tab) => tab.id !== type);
            if (type === activeTabId) {
                setActiveTabId(next.at(-1)?.id ?? "workspace");
            }
            return next;
        });
    };

    const selectFile = (path: string) => {
        setSelectedPath(path);
        openTab("code");
    };

    const submitAgent = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const value = objective.trim();
        if (!value || submitting) {
            return;
        }
        setSubmitting(true);
        const route = routeRuntimeIntent(value);
        setRuntimeRoute(route);
        try {
            const accepted = await onAgentSubmit({
                text: value,
                route,
                workspace: {
                    id: workspace.id,
                    name: workspace.name,
                    branch: workspace.branch,
                    files: workspace.files.map((file) => file.path),
                    selectedFile,
                },
            });
            if (accepted) {
                setObjective("");
            }
        } finally {
            setSubmitting(false);
        }
    };

    const navigateLocalBrowser = (nextUrl: string) => {
        setBrowserHistory((current) => [...current.slice(0, browserHistoryIndex + 1), nextUrl]);
        setBrowserHistoryIndex((current) => current + 1);
        setBrowserUrl(nextUrl);
    };

    const submitBrowser = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const nextUrl = normalizeBrowserUrl(browserInput);
        setBrowserLoading(true);
        try {
            if (hosts.some((host) => host.profile.capabilities.includes("browser"))) {
                await onBrowserNavigate(nextUrl);
                return;
            }
            navigateLocalBrowser(nextUrl);
        } finally {
            window.setTimeout(() => setBrowserLoading(false), 420);
        }
    };

    const moveBrowserHistory = (offset: -1 | 1) => {
        const nextIndex = browserHistoryIndex + offset;
        const nextUrl = browserHistory[nextIndex];
        if (!nextUrl) {
            return;
        }
        setBrowserHistoryIndex(nextIndex);
        setBrowserUrl(nextUrl);
        setBrowserInput(nextUrl.replace(/^https?:\/\//, ""));
    };

    const submitTerminal = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const command = terminalInput.trim();
        if (!command || terminalBusy) {
            return;
        }
        setTerminalInput("");
        setTerminalHistory((current) => [...current.filter((item) => item !== command), command]);
        setTerminalHistoryIndex(terminalHistory.length + 1);
        const prompt = localShellStatus?.available ? "iphone:KronTerm $" : "kronterm git:(main) ✗";
        setTerminalLines((current) => [...current, `${prompt} ${command}`]);

        if (isKronosCodeCommand(command)) {
            setTerminalLines((current) => [...current, "Opening KronosCode TUI on the connected runtime…"]);
            setTerminalBusy(true);
            try {
                await onOpenWidget("kronoscode");
            } finally {
                setTerminalBusy(false);
            }
            return;
        }

        if (command === "clear") {
            setTerminalLines([]);
            return;
        }
        if (command === "help" && localShellStatus?.available) {
            setTerminalLines((current) => [
                ...current,
                `Available on iPhone: ${localShellStatus.commands.join(", ")}`,
                "Use `kronoscode` or `kc` to open the connected KronosCode TUI.",
            ]);
            return;
        }

        setTerminalBusy(true);
        try {
            const nativeResult = await runNativeLocalCommand(command);
            if (nativeResult) {
                const output = cleanTerminalOutput(nativeResult.output);
                setTerminalLines((current) => [
                    ...current,
                    ...output,
                    ...(nativeResult.exitCode === 0 ? [] : [`command exited with status ${nativeResult.exitCode}`]),
                ]);
                setLocalShellStatus((current) => (current ? { ...current, cwd: nativeResult.cwd } : current));
                return;
            }
            const result = runLocalCommand(workspace, command);
            setTerminalLines((current) => (result.clear ? [] : [...current, ...result.output]));
        } catch (reason) {
            setTerminalLines((current) => [
                ...current,
                reason instanceof Error ? reason.message : "The iPhone shell command failed",
            ]);
        } finally {
            setTerminalBusy(false);
        }
    };

    const moveTerminalHistory = (offset: -1 | 1) => {
        const nextIndex = Math.max(0, Math.min(terminalHistory.length, terminalHistoryIndex + offset));
        setTerminalHistoryIndex(nextIndex);
        setTerminalInput(terminalHistory[nextIndex] ?? "");
    };

    const renderBrowser = () => (
        <div className="workspace-view browser-view">
            <form className="browser-chrome" onSubmit={submitBrowser}>
                <div className="browser-nav-actions">
                    <button
                        type="button"
                        aria-label="Back"
                        disabled={browserHistoryIndex === 0}
                        onClick={() => moveBrowserHistory(-1)}
                    >
                        <ArrowLeft />
                    </button>
                    <button
                        type="button"
                        aria-label="Forward"
                        disabled={browserHistoryIndex >= browserHistory.length - 1}
                        onClick={() => moveBrowserHistory(1)}
                    >
                        <ArrowRight />
                    </button>
                    <button
                        type="button"
                        aria-label="Refresh"
                        onClick={() => {
                            setBrowserLoading(true);
                            window.setTimeout(() => setBrowserLoading(false), 420);
                        }}
                    >
                        <RefreshCw className={browserLoading ? "spin" : ""} />
                    </button>
                </div>
                <label className="browser-address">
                    <Globe2 />
                    <input
                        value={browserInput}
                        onChange={(event) => setBrowserInput(event.target.value)}
                        aria-label="Browser address"
                        autoCapitalize="none"
                        autoCorrect="off"
                    />
                </label>
                <button className="browser-menu-button" type="button" aria-label="Browser page controls">
                    <MoreHorizontal />
                </button>
            </form>
            {isYoutubeUrl(browserUrl) ? (
                <div className="youtube-mobile-demo">
                    <header>
                        <strong>
                            <span>▶</span> YouTube
                        </strong>
                        <div>
                            <Search />
                            <CircleDot />
                        </div>
                    </header>
                    <div className="youtube-player">
                        <div className="video-signal">
                            <span>K</span>
                            <i />
                            <i />
                            <i />
                        </div>
                        <button type="button" aria-label="Play KronTerm demo">
                            <Play />
                        </button>
                        <small>12:48</small>
                    </div>
                    <article>
                        <h2>Building KronTerm Mobile — a hostless AI workspace</h2>
                        <p>14K views · 2 hours ago</p>
                        <div className="youtube-channel">
                            <span>K</span>
                            <div>
                                <strong>KronTerm</strong>
                                <small>8.2K subscribers</small>
                            </div>
                            <button type="button">Subscribe</button>
                        </div>
                        <div className="youtube-actions">
                            <button type="button">⌃ 1.2K</button>
                            <button type="button">Share</button>
                            <button type="button">Save</button>
                        </div>
                        <div className="youtube-comment">
                            <span />
                            <p>Auto routing between iPhone and Kron Sandbox changes everything.</p>
                        </div>
                    </article>
                </div>
            ) : (
                <iframe
                    className="browser-frame"
                    src={browserUrl}
                    title={browserUrl}
                    sandbox="allow-forms allow-scripts allow-same-origin"
                />
            )}
        </div>
    );

    const renderCode = () => {
        if (!selectedFile) {
            return <div className="empty-pane">Choose a file to begin.</div>;
        }
        const lines = selectedFile.content.split("\n");
        return (
            <div className="workspace-view code-view">
                <div className="editor-toolbar">
                    <div className="editor-breadcrumbs">
                        <span>packages</span>
                        <i>/</i>
                        <span>agent</span>
                        <i>/</i>
                        <strong>{selectedFile.path.split("/").at(-1)}</strong>
                    </div>
                    <button type="button" onClick={() => setEditingCode((current) => !current)}>
                        {editingCode ? <Check /> : <Braces />}
                        {editingCode ? "Done" : "Edit"}
                    </button>
                </div>
                {editingCode ? (
                    <div className="editor-editing-shell">
                        <pre aria-hidden="true">{lines.map((_, index) => `${index + 1}\n`)}</pre>
                        <textarea
                            value={selectedFile.content}
                            onChange={(event) =>
                                setWorkspace((current) =>
                                    updateWorkspaceFile(current, selectedFile.path, event.target.value)
                                )
                            }
                            spellCheck={false}
                            aria-label={`Edit ${selectedFile.path}`}
                        />
                    </div>
                ) : (
                    <pre className="syntax-editor">
                        {lines.map((line, index) => (
                            <span className="syntax-line" key={`${index}:${line}`}>
                                <i>{index + 1}</i>
                                <code>{highlightLine(line)}</code>
                            </span>
                        ))}
                    </pre>
                )}
                <footer className="editor-status">
                    <span>Ln 1, Col 1</span>
                    <span>UTF-8</span>
                    <span>TypeScript</span>
                    <strong>Kron Local</strong>
                </footer>
            </div>
        );
    };

    const renderTerminal = () => (
        <div className="workspace-view terminal-view">
            <header>
                <span>
                    <i /> {localShellStatus?.available ? "iOS shell" : "Kron Local"}
                </span>
                <small>
                    {localShellStatus === undefined
                        ? "Checking native runtime…"
                        : localShellStatus?.available
                          ? "On this iPhone · ios_system"
                          : "Web preview · virtual shell"}
                </small>
                <button
                    className="terminal-kronoscode-launch"
                    type="button"
                    disabled={terminalBusy}
                    onClick={() => void onOpenWidget("kronoscode")}
                >
                    <Sparkles /> KronosCode TUI
                </button>
            </header>
            <div className="terminal-output" aria-live="polite">
                {terminalLines.map((line, index) => (
                    <div
                        className={line.startsWith(" ✓") || line.includes("passed") ? "is-success" : ""}
                        key={`${index}:${line}`}
                    >
                        {line || "\u00a0"}
                    </div>
                ))}
                <form onSubmit={(event) => void submitTerminal(event)}>
                    <span>{localShellStatus?.available ? "iphone:KronTerm $" : "kronterm git:(main) ✗"}</span>
                    <input
                        value={terminalInput}
                        onChange={(event) => setTerminalInput(event.target.value)}
                        aria-label="Terminal command"
                        disabled={terminalBusy}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                    />
                </form>
            </div>
            <div className="terminal-keys" aria-label="Terminal shortcuts">
                <button type="button" onClick={() => setTerminalInput("")}>
                    esc
                </button>
                <button type="button" onClick={() => setTerminalInput((current) => `${current}^`)}>
                    ctrl
                </button>
                <button type="button" onClick={() => setTerminalInput((current) => `${current}\t`)}>
                    tab
                </button>
                <button type="button" onClick={() => setTerminalInput((current) => `${current}⌘`)}>
                    ⌘
                </button>
                <button type="button" onClick={() => moveTerminalHistory(-1)}>
                    ↑
                </button>
                <button type="button" onClick={() => moveTerminalHistory(1)}>
                    ↓
                </button>
            </div>
        </div>
    );

    const renderFiles = () => (
        <div className="workspace-view files-view">
            <header className="pane-heading">
                <div>
                    <span>Project files</span>
                    <strong>~/code/kronterm</strong>
                </div>
                <button type="button" aria-label="File options">
                    <MoreHorizontal />
                </button>
            </header>
            <div className="file-list">
                {fileRows.map((row) => (
                    <button
                        className={row.path === selectedPath ? "is-selected" : ""}
                        type="button"
                        key={`${row.depth}:${row.label}`}
                        style={{ paddingLeft: 15 + row.depth * 16 }}
                        onClick={() => row.path && selectFile(row.path)}
                    >
                        {row.path ? <File /> : <Folder />}
                        <span>{row.label}</span>
                        {row.path === selectedPath ? <i>M</i> : null}
                    </button>
                ))}
            </div>
            <footer className="local-storage-meter">
                <span>
                    <HardDrive /> On this iPhone
                </span>
                <strong>4 files · saved</strong>
            </footer>
        </div>
    );

    const renderPreview = () => {
        const preview = workspace.files.find((file) => file.path === "index.html")?.content ?? "";
        return (
            <div className="workspace-view preview-view">
                <header>
                    <span>
                        <i /> localhost:4173
                    </span>
                    <div>
                        <button type="button" aria-label="Refresh preview">
                            <RefreshCw />
                        </button>
                        <button type="button" aria-label="Open preview externally">
                            <ExternalLink />
                        </button>
                    </div>
                </header>
                <iframe srcDoc={preview} title="Kron Local preview" sandbox="allow-scripts" />
                <footer>
                    <Zap /> Live · rendered on iPhone
                </footer>
            </div>
        );
    };

    const renderWorkspace = () => (
        <div className="workspace-view git-view">
            <header className="pane-heading">
                <div>
                    <span>Workspace</span>
                    <strong>{workspace.name}</strong>
                </div>
                <button type="button">
                    <RefreshCw /> Sync
                </button>
            </header>
            <div className="branch-summary">
                <span>
                    <GitBranch /> {workspace.branch}
                </span>
                <i>Auto</i>
                <strong>+18 −4</strong>
            </div>
            <section className="workspace-section">
                <header>
                    <span>Changes</span>
                    <small>2</small>
                </header>
                <button type="button" onClick={() => selectFile("packages/agent/src/input-pipeline.ts")}>
                    <i>M</i>
                    <span>packages/agent/src/input-pipeline.ts</span>
                    <small>+12 −3</small>
                </button>
                <button type="button" onClick={() => selectFile("README.md")}>
                    <i>M</i>
                    <span>README.md</span>
                    <small>+6 −1</small>
                </button>
            </section>
            <section className="workspace-section">
                <header>
                    <span>Tasks</span>
                    <small>3</small>
                </header>
                {[
                    ["Terminal input research", "In progress"],
                    ["Refactor input pipeline", "Ready"],
                    ["Fix mobile latency", "Queued"],
                ].map(([title, state], index) => (
                    <button type="button" key={title}>
                        <Check className={index === 0 ? "is-active" : ""} />
                        <span>{title}</span>
                        <small>{state}</small>
                    </button>
                ))}
            </section>
        </div>
    );

    const liveAgentSurfaces = surfaces.filter((surface) => surface.kind === "run");

    const renderAgent = () => (
        <div className="workspace-view agent-view">
            <header className="agent-intro">
                <span className="kronos-orbit">
                    <Sparkles />
                </span>
                <div>
                    <small>KronosChamber</small>
                    <h2>One agent, every workspace</h2>
                    <p>Kronos sees the browser, code, terminal, files, and runtime state in this workspace.</p>
                </div>
            </header>
            {liveAgentSurfaces.length ? (
                <div className="agent-activity">
                    {liveAgentSurfaces.map((surface) => (
                        <button
                            className="activity-row is-active"
                            type="button"
                            key={surface.id}
                            onClick={() => onOpenSurface(surface)}
                        >
                            <span>{surface.status === "working" ? <LoaderCircle className="spin" /> : <Check />}</span>
                            <strong>{surface.title}</strong>
                            <small>{surface.status}</small>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="agent-empty-state">
                    <Bot />
                    <strong>No active KronosCode run</strong>
                    <p>Start an objective below, or open the live chamber to resume a real session.</p>
                </div>
            )}
            <div className="agent-result">
                <span>Auto route for the current draft</span>
                <strong>{runtimeRoute.label}</strong>
                <p>{runtimeRoute.reason}</p>
                <div>
                    <button type="button" onClick={onOpenChat}>
                        <Bot /> Open live chamber
                    </button>
                    <button type="button" onClick={() => openTab("code")}>
                        <FileCode2 /> Affected files
                    </button>
                </div>
            </div>
        </div>
    );

    const renderDevices = () => (
        <div className="workspace-view devices-view">
            <header className="pane-heading">
                <div>
                    <span>Execution</span>
                    <strong>Auto routing</strong>
                </div>
                <button type="button" onClick={onOpenHosts}>
                    <Plus /> Device
                </button>
            </header>
            <section className="runtime-featured">
                <span>{RuntimeIcons[runtimeRoute.target]}</span>
                <div>
                    <small>Planned for the current draft</small>
                    <strong>{runtimeRoute.label}</strong>
                    <p>{runtimeRoute.reason}</p>
                </div>
                <i>Auto</i>
            </section>
            <div className="runtime-list">
                {[
                    ["local", "Kron Local", "Ready", "Files · JS · WASM · Preview"],
                    ["local-linux", "Local Linux", "Optional", "ARM64 Alpine · Python"],
                    ["sandbox", "Kron Sandbox", hosts.length ? "Available" : "Connect", "Docker · Node · PostgreSQL"],
                    ["remote-device", "Remote Device", "Optional", "Mac · Windows · Linux · SSH"],
                ].map(([target, label, status, detail]) => (
                    <button
                        className={runtimeRoute.target === target ? "is-selected" : ""}
                        type="button"
                        key={target}
                        onClick={() => {
                            if (target !== "sandbox") {
                                return;
                            }
                            if (hosts.some((host) => host.profile.capabilities.includes("sandbox"))) {
                                void onCreateSandbox();
                            } else {
                                onOpenHosts();
                            }
                        }}
                    >
                        <span>{RuntimeIcons[target as RuntimeTarget]}</span>
                        <div>
                            <strong>{label}</strong>
                            <small>{detail}</small>
                        </div>
                        <i>{status}</i>
                    </button>
                ))}
            </div>
            <div className="runtime-quick-actions">
                <button type="button" onClick={() => void onOpenWidget("terminal")}>
                    <TerminalSquare /> Open shell
                </button>
                <button type="button" onClick={() => void onCreateSandbox()}>
                    <Boxes /> New sandbox
                </button>
            </div>
            {hosts.length ? (
                <section className="connected-hosts">
                    <header>{selectedHost ? `Selected · ${selectedHost.profile.label}` : "Connected targets"}</header>
                    {hosts.map((host) => (
                        <button type="button" key={host.profile.id} onClick={() => onSelectHost(host.profile.id)}>
                            <i style={{ background: host.profile.color }} />
                            <span>
                                <strong>{host.profile.label}</strong>
                                <small>{host.detail}</small>
                            </span>
                            <em className={`host-${host.connection}`}>{host.connection}</em>
                        </button>
                    ))}
                </section>
            ) : null}
            {surfaces.length ? (
                <section className="connected-hosts">
                    <header>Live remote surfaces</header>
                    {surfaces
                        .filter((surface) => selectedHostId === "all" || surface.hostId === selectedHostId)
                        .slice(0, 5)
                        .map((surface) => (
                            <button type="button" key={surface.id} onClick={() => onOpenSurface(surface)}>
                                {iconForTab(tabTypeForSurface(surface))}
                                <span>
                                    <strong>{surface.title}</strong>
                                    <small>{surface.hostLabel}</small>
                                </span>
                                <i
                                    className="surface-row-close"
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Close ${surface.title}`}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onCloseSurface(surface);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.stopPropagation();
                                            onCloseSurface(surface);
                                        }
                                    }}
                                >
                                    <X />
                                </i>
                            </button>
                        ))}
                </section>
            ) : null}
            {closedSurfaces.length ? (
                <section className="connected-hosts">
                    <header>Recently closed</header>
                    {closedSurfaces.slice(0, 3).map((closed) => (
                        <button
                            type="button"
                            key={`${closed.surface.id}:${closed.closedAt}`}
                            onClick={() => onRestoreSurface(closed)}
                        >
                            <RotateCcw />
                            <span>
                                <strong>{closed.surface.title}</strong>
                                <small>{closed.surface.hostLabel}</small>
                            </span>
                            <small>Restore</small>
                        </button>
                    ))}
                </section>
            ) : null}
        </div>
    );

    const renderPanel = (tab: WorkspaceTab): ReactNode => {
        switch (tab.type) {
            case "agent":
                return renderAgent();
            case "browser":
                return renderBrowser();
            case "code":
                return renderCode();
            case "devices":
                return renderDevices();
            case "files":
                return renderFiles();
            case "preview":
                return renderPreview();
            case "terminal":
                return renderTerminal();
            case "workspace":
                return renderWorkspace();
        }
    };

    return (
        <main className="surface-browser kron-workbench">
            <header className="kron-appbar">
                <div className="brand-lockup kron-brand-lockup">
                    <span className="brand-mark">K</span>
                    <div>
                        <strong>KronTerm</strong>
                        <small className="desktop-only">Workspace</small>
                    </div>
                </div>
                <button className="project-identity" type="button" onClick={() => openTab("workspace")}>
                    <span>{workspace.name}</span>
                    <small>
                        <GitBranch /> {workspace.branch}
                    </small>
                    <ChevronDown />
                </button>
                <div className="appbar-actions">
                    <button className="runtime-pill" type="button" onClick={() => openTab("devices")}>
                        <i />
                        <span>Auto</span>
                        <small>{runtimeRoute.label}</small>
                    </button>
                    <button type="button" onClick={() => void onRefresh()} aria-label="Refresh workspace">
                        <RotateCcw className={refreshing ? "spin" : ""} />
                    </button>
                    <button
                        className="connectivity-button"
                        type="button"
                        onClick={onOpenHosts}
                        aria-label="Runtime connections"
                    >
                        <Wifi />
                        <span>{onlineHosts ? `${onlineHosts} online` : "On device"}</span>
                    </button>
                </div>
            </header>

            <div className="workbench-body">
                <aside className="desktop-sidebar">
                    <button className="sidebar-heading" type="button">
                        <PanelLeft /> Projects <Plus />
                    </button>
                    <strong>Sessions</strong>
                    {[
                        ["Terminal Input Research", "active"],
                        ["Refactor input pipeline", ""],
                        ["Fix mobile latency", ""],
                    ].map(([label, state]) => (
                        <button className={state ? "is-active" : ""} type="button" key={label}>
                            <Activity /> {label}
                        </button>
                    ))}
                    <strong>Projects</strong>
                    <button type="button">
                        <Folder /> kronterm
                    </button>
                    <button type="button">
                        <Folder /> kronoschamber
                    </button>
                    <strong>Quick access</strong>
                    <button type="button" onClick={() => openTab("workspace")}>
                        <GitBranch /> Pull Requests
                    </button>
                    <button type="button" onClick={onOpenChat}>
                        <Sparkles /> KronosChamber
                    </button>
                </aside>

                <section className="workbench-center">
                    <nav className="workspace-dock" aria-label="KronTerm sections">
                        {DockItems.map((item) => (
                            <button
                                className={activeTabId === item.type ? "is-active" : ""}
                                type="button"
                                key={item.type}
                                onClick={() => (item.type === "agent" ? openTab("agent") : openTab(item.type))}
                                aria-label={item.label}
                                title={item.label}
                            >
                                <span>{item.icon}</span>
                                <small>{item.label}</small>
                            </button>
                        ))}
                    </nav>

                    <div className="open-tab-row">
                        <div className="open-tab-scroll">
                            {openTabs.map((tab) => (
                                <button
                                    className={tab.id === activeTabId ? "is-active" : ""}
                                    type="button"
                                    key={tab.id}
                                    onClick={() => setActiveTabId(tab.id)}
                                >
                                    {iconForTab(tab.type)}
                                    <span>{tab.title}</span>
                                    <i
                                        role="button"
                                        aria-label={`Close ${tab.title}`}
                                        tabIndex={0}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            closeTab(tab.id);
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.stopPropagation();
                                                closeTab(tab.id);
                                            }
                                        }}
                                    >
                                        <X />
                                    </i>
                                </button>
                            ))}
                        </div>
                        <button
                            className="new-tab-button"
                            type="button"
                            onClick={() => setNewTabOpen((current) => !current)}
                            aria-label="New tab"
                        >
                            <Plus />
                        </button>
                        <button
                            className="layout-button"
                            type="button"
                            onClick={() => openTab("devices")}
                            aria-label="Tabs and runtimes"
                        >
                            <Grid2X2 />
                        </button>
                        {newTabOpen ? (
                            <div className="new-tab-menu">
                                {DockItems.filter((item) => !openTabs.some((tab) => tab.type === item.type)).map(
                                    (item) => (
                                        <button type="button" key={item.type} onClick={() => openTab(item.type)}>
                                            {item.icon}
                                            <span>{item.label}</span>
                                        </button>
                                    )
                                )}
                                <button type="button" onClick={() => openTab("devices")}>
                                    <Cpu />
                                    <span>Runtimes</span>
                                </button>
                            </div>
                        ) : null}
                    </div>

                    {openTabs.length ? (
                        <div className={`workspace-panels tabs-${Math.min(openTabs.length, 3)}`}>
                            {openTabs.slice(0, 3).map((tab) => (
                                <section
                                    className={`workspace-panel ${tab.id === activeTabId ? "is-active" : ""}`}
                                    key={tab.id}
                                    aria-label={tab.title}
                                >
                                    <header className="pane-tab-header">
                                        <span>
                                            {iconForTab(tab.type)} {tab.title}
                                        </span>
                                        <button type="button" aria-label={`${tab.title} pane controls`}>
                                            <MoreHorizontal />
                                        </button>
                                    </header>
                                    {renderPanel(tab)}
                                </section>
                            ))}
                        </div>
                    ) : (
                        <section className="no-tabs-view">
                            <Layers3 />
                            <h2>Open a workspace</h2>
                            <p>Choose Browser, Code, Files, Terminal, or Preview from the dock.</p>
                            <button type="button" onClick={() => openTab("browser")}>
                                <Plus /> New tab
                            </button>
                        </section>
                    )}
                </section>

                <aside className="desktop-context-panel">
                    <header>
                        <span>Context</span>
                        <MoreHorizontal />
                    </header>
                    <div className="context-branch">
                        <GitBranch />
                        <span>
                            <small>Branch</small>
                            <strong>main</strong>
                        </span>
                        <i>+18 −4</i>
                    </div>
                    <strong>Runtime</strong>
                    <button type="button" onClick={() => openTab("devices")}>
                        <span>{RuntimeIcons[runtimeRoute.target]}</span>
                        <div>
                            <strong>{runtimeRoute.label}</strong>
                            <small>Planned by Auto</small>
                        </div>
                    </button>
                    <strong>Recent commits</strong>
                    <p>
                        <i /> fix: reduce input latency <small>2h</small>
                    </p>
                    <p>
                        <i /> feat: mobile runtime router <small>1d</small>
                    </p>
                </aside>
            </div>

            <form className="kron-composer" onSubmit={submitAgent}>
                <div className="composer-topline">
                    <span className="composer-kron">
                        <Sparkles />
                    </span>
                    <input
                        value={objective}
                        onChange={(event) => {
                            setObjective(event.target.value);
                            setRuntimeRoute(routeRuntimeIntent(event.target.value));
                        }}
                        placeholder="Ask KronosChamber anything…"
                        aria-label="Ask KronosChamber anything"
                        autoCapitalize="sentences"
                    />
                    <button
                        className="composer-send"
                        type="submit"
                        disabled={!objective.trim() || submitting}
                        aria-label="Send to KronosChamber"
                    >
                        {submitting ? <LoaderCircle className="spin" /> : <Send />}
                    </button>
                </div>
                <div className="composer-controls">
                    <button type="button" aria-label="Add context">
                        <Plus />
                    </button>
                    <button type="button" aria-label="Reference a file or tab">
                        <AtSign />
                    </button>
                    <button type="button" aria-label="Use a command">
                        <Command />
                    </button>
                    <button className="composer-model" type="button">
                        KronosCode <ChevronDown />
                    </button>
                    <span className="composer-route">
                        {RuntimeIcons[runtimeRoute.target]} {runtimeRoute.label}
                    </span>
                </div>
            </form>
        </main>
    );
};
