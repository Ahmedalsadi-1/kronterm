// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { cn } from "@/util/util";
import {
    AlertCircle,
    Archive,
    ArrowUp,
    Bot,
    Check,
    ChevronDown,
    Command,
    Copy,
    Expand,
    Files,
    FileText,
    ImageIcon,
    Loader2,
    Music,
    Plus,
    Terminal,
    Video,
    X,
} from "lucide-react";
import type React from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FileWithPreview {
    id: string;
    file: File;
    preview?: string;
    type: string;
    uploadStatus: "pending" | "uploading" | "complete" | "error";
    uploadProgress?: number;
    abortController?: AbortController;
    textContent?: string;
}

export interface PastedContent {
    id: string;
    content: string;
    timestamp: Date;
    wordCount: number;
}

export interface ModelOption {
    id: string;
    name: string;
    description: string;
    badge?: string;
}

export interface KronAgentOption {
    id: string;
    label: string;
    description?: string;
    icon?: React.ReactNode;
    available?: boolean;
    status?: string;
    kind?: string;
}

export interface CommandDeckSuggestion {
    id: string;
    label: string;
    description?: string;
    badge?: string;
    available?: boolean;
}

export interface WidgetMentionOption {
    id: string;
    label: string;
    description?: string;
    badge?: string;
}

export interface ImprovedChatInputProps {
    onSendMessage?: (message: string, files: FileWithPreview[], pastedContent: PastedContent[]) => void;
    disabled?: boolean;
    placeholder?: string;
    maxFiles?: number;
    maxFileSize?: number; // in bytes
    acceptedFileTypes?: string[];
    models?: ModelOption[];
    defaultModel?: string;
    onModelChange?: (modelId: string) => void;
    selectedKronAgent?: string;
    onKronAgentChange?: (agent: string) => void;
    kronAgents?: KronAgentOption[];
    slashCommands?: CommandDeckSuggestion[];
    referencedFiles?: string[];
    openWidgets?: WidgetMentionOption[];
    agentSelector?: React.ReactNode;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_FILES = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const PASTE_THRESHOLD = 200; // characters threshold for showing as pasted content
const DEFAULT_MODELS_INTERNAL: ModelOption[] = [
    {
        id: "claude-sonnet-4",
        name: "Claude Sonnet 4",
        description: "Balanced model",
        badge: "Latest",
    },
    {
        id: "claude-opus-3.5",
        name: "Claude Opus 3.5",
        description: "Highest intelligence",
    },
    {
        id: "claude-haiku-3",
        name: "Claude Haiku 3",
        description: "Fastest responses",
    },
];

type DeckMenuState = {
    trigger: "/" | "@";
    query: string;
    start: number;
    end: number;
};

type DeckMenuItem = CommandDeckSuggestion & {
    kind: "command" | "agent" | "file" | "widget";
};

// ─── File Type Helpers ──────────────────────────────────────────────────────

const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-[#8a8580]" />;
    if (type.startsWith("video/")) return <Video className="h-5 w-5 text-[#8a8580]" />;
    if (type.startsWith("audio/")) return <Music className="h-5 w-5 text-[#8a8580]" />;
    if (type.includes("zip") || type.includes("rar") || type.includes("tar"))
        return <Archive className="h-5 w-5 text-[#8a8580]" />;
    return <FileText className="h-5 w-5 text-[#8a8580]" />;
};

const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const getFileTypeLabel = (type: string): string => {
    const parts = type.split("/");
    let label = parts[parts.length - 1].toUpperCase();
    if (label.length > 7 && label.includes("-")) {
        label = label.substring(0, label.indexOf("-"));
    }
    if (label.length > 10) {
        label = label.substring(0, 10) + "...";
    }
    return label;
};

const getFileExtension = (filename: string): string => {
    const extension = filename.split(".").pop()?.toUpperCase() || "FILE";
    return extension.length > 8 ? extension.substring(0, 8) + "..." : extension;
};

const isTextualFile = (file: File): boolean => {
    const textualTypes = [
        "text/",
        "application/json",
        "application/xml",
        "application/javascript",
        "application/typescript",
    ];

    const textualExtensions = [
        "txt",
        "md",
        "py",
        "js",
        "ts",
        "jsx",
        "tsx",
        "html",
        "htm",
        "css",
        "scss",
        "sass",
        "json",
        "xml",
        "yaml",
        "yml",
        "csv",
        "sql",
        "sh",
        "bash",
        "php",
        "rb",
        "go",
        "java",
        "c",
        "cpp",
        "h",
        "hpp",
        "cs",
        "rs",
        "swift",
        "kt",
        "scala",
        "r",
        "vue",
        "svelte",
        "astro",
        "config",
        "conf",
        "ini",
        "toml",
        "log",
        "gitignore",
        "dockerfile",
        "makefile",
        "readme",
    ];

    const isTextualMimeType = textualTypes.some((type) => file.type.toLowerCase().startsWith(type));

    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const isTextualExtension =
        textualExtensions.includes(extension) ||
        file.name.toLowerCase().includes("readme") ||
        file.name.toLowerCase().includes("dockerfile") ||
        file.name.toLowerCase().includes("makefile");

    return isTextualMimeType || isTextualExtension;
};

const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || "");
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
};

// ─── FilePreviewCard Component ──────────────────────────────────────────────

const FilePreviewCard: React.FC<{
    file: FileWithPreview;
    onRemove: (id: string) => void;
}> = memo(({ file, onRemove }) => {
    const isImage = file.type.startsWith("image/");
    const isTextual = isTextualFile(file.file);

    if (isTextual) {
        return <TextualFilePreviewCard file={file} onRemove={onRemove} />;
    }

    return (
        <div
            className={cn(
                "relative group bg-[#1e1e1c] border w-fit border-[#2a2a2a] rounded-lg p-3 size-[125px] shadow-md flex-shrink-0 overflow-hidden",
                isImage ? "p-0" : "p-3"
            )}
        >
            <div className="flex items-start gap-3 size-[125px] overflow-hidden">
                {isImage && file.preview ? (
                    <div className="relative size-full rounded-md overflow-hidden bg-[#2a2a2a]">
                        <img
                            src={file.preview || "/placeholder.svg"}
                            alt={file.file.name}
                            className="w-full h-full object-cover"
                        />
                    </div>
                ) : (
                    <></>
                )}
                {!isImage && (
                    <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="group absolute flex justify-start items-end p-2 inset-0 bg-gradient-to-b to-[#30302E] from-transparent overflow-hidden">
                                <p className="absolute bottom-2 left-2 capitalize text-[#eeeeee] text-xs bg-[#1e1e1c] border border-[#2a2a2a] px-2 py-1 rounded-md">
                                    {getFileTypeLabel(file.type)}
                                </p>
                            </div>
                            {file.uploadStatus === "uploading" && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#5b9ef5]" />
                            )}
                            {file.uploadStatus === "error" && <AlertCircle className="h-3.5 w-3.5 text-[#dc7668]" />}
                        </div>

                        <p className="max-w-[90%] text-xs font-medium text-[#d4d4d4] truncate" title={file.file.name}>
                            {file.file.name}
                        </p>
                        <p className="text-[10px] text-[#8a8580] mt-1">{formatFileSize(file.file.size)}</p>
                    </div>
                )}
            </div>
            <button
                onClick={() => onRemove(file.id)}
                className="absolute top-1 right-1 h-6 w-6 p-0 flex items-center justify-center rounded-md border border-[#2a2a2a] bg-[#1e1e1c] hover:bg-[#2a2a2a] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[#8a8580] hover:text-[#d4d4d4]"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
});

FilePreviewCard.displayName = "FilePreviewCard";

// ─── TextualFilePreviewCard Component ───────────────────────────────────────

const TextualFilePreviewCard: React.FC<{
    file: FileWithPreview;
    onRemove: (id: string) => void;
}> = memo(({ file, onRemove }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const previewText = file.textContent?.slice(0, 150) || "";
    const needsTruncation = (file.textContent?.length || 0) > 150;
    const fileExtension = getFileExtension(file.file.name);

    return (
        <div className="bg-[#1e1e1c] border border-[#2a2a2a] relative rounded-lg p-3 size-[125px] shadow-md flex-shrink-0 overflow-hidden">
            <div className="text-[8px] text-[#9e9a93] whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                {file.textContent ? (
                    <>
                        {isExpanded || !needsTruncation ? file.textContent : previewText}
                        {!isExpanded && needsTruncation && "..."}
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-[#8a8580]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                )}
            </div>
            <div className="group absolute flex justify-start items-end p-2 inset-0 bg-gradient-to-b to-[#30302E] from-transparent overflow-hidden">
                <p className="capitalize text-[#eeeeee] text-xs bg-[#1e1e1c] border border-[#2a2a2a] px-2 py-1 rounded-md">
                    {fileExtension}
                </p>
                {file.uploadStatus === "uploading" && (
                    <div className="absolute top-2 left-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#5b9ef5]" />
                    </div>
                )}
                {file.uploadStatus === "error" && (
                    <div className="absolute top-2 left-2">
                        <AlertCircle className="h-3.5 w-3.5 text-[#dc7668]" />
                    </div>
                )}
                <div className="group-hover:opacity-100 opacity-0 transition-opacity duration-300 flex items-center gap-0.5 absolute top-2 right-2">
                    {file.textContent && (
                        <button
                            onClick={() => navigator.clipboard.writeText(file.textContent || "")}
                            className="size-6 flex items-center justify-center rounded-md border border-[#2a2a2a] bg-[#1e1e1c] hover:bg-[#2a2a2a] text-[#8a8580] hover:text-[#d4d4d4] transition-colors cursor-pointer"
                            title="Copy content"
                        >
                            <Copy className="h-3 w-3" />
                        </button>
                    )}
                    <button
                        onClick={() => onRemove(file.id)}
                        className="size-6 flex items-center justify-center rounded-md border border-[#2a2a2a] bg-[#1e1e1c] hover:bg-[#2a2a2a] text-[#8a8580] hover:text-[#d4d4d4] transition-colors cursor-pointer"
                        title="Remove file"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            </div>
        </div>
    );
});

TextualFilePreviewCard.displayName = "TextualFilePreviewCard";

// ─── PastedContentCard Component ────────────────────────────────────────────

const PastedContentCard: React.FC<{
    content: PastedContent;
    onRemove: (id: string) => void;
}> = memo(({ content, onRemove }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const previewText = content.content.slice(0, 150);
    const needsTruncation = content.content.length > 150;

    return (
        <div className="bg-[#1e1e1c] border border-[#2a2a2a] relative rounded-lg p-3 size-[125px] shadow-md flex-shrink-0 overflow-hidden">
            <div className="text-[8px] text-[#9e9a93] whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                {isExpanded || !needsTruncation ? content.content : previewText}
                {!isExpanded && needsTruncation && "..."}
            </div>
            <div className="group absolute flex justify-start items-end p-2 inset-0 bg-gradient-to-b to-[#30302E] from-transparent overflow-hidden">
                <p className="capitalize text-[#eeeeee] text-xs bg-[#1e1e1c] border border-[#2a2a2a] px-2 py-1 rounded-md">
                    PASTED
                </p>
                <div className="group-hover:opacity-100 opacity-0 transition-opacity duration-300 flex items-center gap-0.5 absolute top-2 right-2">
                    <button
                        onClick={() => navigator.clipboard.writeText(content.content)}
                        className="size-6 flex items-center justify-center rounded-md border border-[#2a2a2a] bg-[#1e1e1c] hover:bg-[#2a2a2a] text-[#8a8580] hover:text-[#d4d4d4] transition-colors cursor-pointer"
                        title="Copy content"
                    >
                        <Copy className="h-3 w-3" />
                    </button>
                    <button
                        onClick={() => onRemove(content.id)}
                        className="size-6 flex items-center justify-center rounded-md border border-[#2a2a2a] bg-[#1e1e1c] hover:bg-[#2a2a2a] text-[#8a8580] hover:text-[#d4d4d4] transition-colors cursor-pointer"
                        title="Remove content"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            </div>
        </div>
    );
});

PastedContentCard.displayName = "PastedContentCard";

// ─── KronAgentSelector Component ────────────────────────────────────────

const KronAgentSelector: React.FC<{
    selectedAgent: string;
    onAgentChange: (agent: string) => void;
    agents: KronAgentOption[];
}> = memo(({ selectedAgent, onAgentChange, agents }) => {
    const [open, setOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
    const selected = agents.find((agent) => agent.id === selectedAgent) ?? agents[0];

    if (!selected) {
        return null;
    }

    const toggleOpen = () => {
        setOpen((visible) => {
            if (!visible && buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                setPopupStyle({
                    position: "fixed",
                    left: Math.max(16, Math.min(rect.left, window.innerWidth - 440)),
                    bottom: window.innerHeight - rect.top + 8,
                });
            }
            return !visible;
        });
    };

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={toggleOpen}
                className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#1e1e1c] px-2 text-xs text-[#d4d4d4] transition-colors hover:bg-[#2a2a2a]"
                title="KronosCode agent"
            >
                <span className="text-sm">{selected.icon ?? "⬡"}</span>
                <span className="max-w-[120px] truncate">{selected.label}</span>
                <ChevronDown className="h-3 w-3 text-[#8a8580]" />
            </button>
            {open
                ? ReactDOM.createPortal(
                      <>
                          <button
                              type="button"
                              className="fixed inset-0 z-40 cursor-default bg-black/20"
                              onClick={() => setOpen(false)}
                              aria-label="Close KronosCode agent selector"
                          />
                          <div
                              className="z-50 flex max-h-[440px] w-[min(440px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#171717] p-3 shadow-2xl shadow-black/70"
                              style={popupStyle}
                          >
                              <div className="mb-2 flex items-center justify-between px-1">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8580]">
                                      KronosCode agents
                                  </div>
                                  <div className="text-[10px] text-[#6b6863]">{agents.length} available</div>
                              </div>
                              <div className="min-h-0 overflow-y-auto pr-1">
                                  {agents.map((agent) => (
                                      <button
                                          key={agent.id}
                                          type="button"
                                          disabled={agent.available === false}
                                          onClick={() => {
                                              onAgentChange(agent.id);
                                              setOpen(false);
                                          }}
                                          className={cn(
                                              "mb-1 flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors last:mb-0 disabled:opacity-45",
                                              selectedAgent === agent.id
                                                  ? "bg-[#1e2a3a] text-[#eeeeee]"
                                                  : "text-[#c6c1ba] hover:bg-[#1f1f1d]"
                                          )}
                                      >
                                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#101010] text-base">
                                              {agent.icon ?? "⬡"}
                                          </span>
                                          <span className="min-w-0 flex-1">
                                              <span className="flex items-center gap-2 text-sm font-semibold">
                                                  <span className="truncate">{agent.label}</span>
                                                  {agent.kind ? (
                                                      <span className="shrink-0 rounded border border-[#2a2a2a] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[#8a8580]">
                                                          {agent.kind}
                                                      </span>
                                                  ) : null}
                                              </span>
                                              {agent.description ? (
                                                  <span className="mt-1 block truncate text-xs text-[#8a8580]">
                                                      {agent.description}
                                                  </span>
                                              ) : null}
                                          </span>
                                          {selectedAgent === agent.id ? (
                                              <Check className="h-4 w-4 text-[#5b9ef5]" />
                                          ) : null}
                                      </button>
                                  ))}
                              </div>
                          </div>
                      </>,
                      document.body
                  )
                : null}
        </div>
    );
});
KronAgentSelector.displayName = "KronAgentSelector";

// ─── ModelSelectorDropdown Component ────────────────────────────────────────

const ModelSelectorPopup = memo(
    ({
        models,
        selectedModel,
        onClose,
        onSelect,
    }: {
        models: ModelOption[];
        selectedModel: string;
        onClose: () => void;
        onSelect: (modelId: string) => void;
    }) => {
        const [query, setQuery] = useState("");
        const normalizedQuery = query.trim().toLowerCase();
        const filteredModels = useMemo(() => {
            if (!normalizedQuery) {
                return models;
            }
            return models.filter((model) =>
                `${model.name} ${model.description ?? ""} ${model.id} ${model.badge ?? ""}`
                    .toLowerCase()
                    .includes(normalizedQuery)
            );
        }, [models, normalizedQuery]);
        const selectedModelData = models.find((m) => m.id === selectedModel) || models[0];

        return (
            <>
                <div
                    className="fixed inset-0 z-40 bg-black/40"
                    onClick={onClose}
                    onKeyDown={(e) => e.key === "Escape" && onClose()}
                />
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="flex max-h-[75vh] w-[min(540px,calc(100vw-48px))] flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#171717] p-3 shadow-2xl shadow-black/70">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8580]">
                                    Runtime model
                                </div>
                                <div className="mt-1 max-w-[340px] truncate text-xs text-[#d4d4d4]">
                                    {selectedModelData?.name ?? "Select a model"}
                                </div>
                            </div>
                            <div className="shrink-0 rounded border border-[#2a2a2a] px-2 py-1 text-[10px] text-[#8a8580]">
                                {models.length} models
                            </div>
                        </div>
                        <label className="relative mb-3 block">
                            <Command className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8580]" />
                            <input
                                autoFocus
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search model, provider, or capability"
                                className="h-10 w-full rounded-lg border border-[#2a2a2a] bg-[#101010] pl-9 pr-3 text-sm text-[#eeeeee] outline-none placeholder:text-[#6b6863] focus:border-[#5b9ef5]/50"
                            />
                        </label>
                        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                            {filteredModels.length ? (
                                filteredModels.map((model) => (
                                    <button
                                        key={model.id}
                                        className={cn(
                                            "mb-1 flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg p-3 text-left transition-colors last:mb-0 hover:bg-[#242422]",
                                            model.id === selectedModel && "bg-[#1e2a3a]"
                                        )}
                                        onClick={() => {
                                            onSelect(model.id);
                                        }}
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate text-sm font-medium text-[#eeeeee]">
                                                    {model.name}
                                                </span>
                                                {model.badge ? (
                                                    <span className="shrink-0 rounded bg-[#1e2a3a] px-1.5 py-0.5 text-[10px] text-[#5b9ef5]">
                                                        {model.badge}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="mt-1 truncate text-xs text-[#8a8580]">{model.id}</p>
                                        </div>
                                        {model.id === selectedModel ? (
                                            <Check className="h-4 w-4 flex-shrink-0 text-[#5b9ef5]" />
                                        ) : null}
                                    </button>
                                ))
                            ) : (
                                <div className="px-3 py-10 text-center text-sm text-[#8a8580]">No matching models.</div>
                            )}
                        </div>
                    </div>
                </div>
            </>
        );
    }
);
ModelSelectorPopup.displayName = "ModelSelectorPopup";

const ModelSelectorDropdown: React.FC<{
    models: ModelOption[];
    selectedModel: string;
    onModelChange: (modelId: string) => void;
}> = memo(({ models, selectedModel, onModelChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedModelData = models.find((m) => m.id === selectedModel) || models[0];

    const selectModel = useCallback(
        (modelId: string) => {
            onModelChange(modelId);
            setIsOpen(false);
        },
        [onModelChange]
    );

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(true)}
                className="h-9 px-2.5 text-sm font-medium text-[#8a8580] hover:text-[#d4d4d4] hover:bg-[#2a2a2a] rounded-md transition-colors cursor-pointer flex items-center gap-1"
            >
                <span className="truncate max-w-[150px] sm:max-w-[200px]">{selectedModelData.name}</span>
                <ChevronDown className={cn("ml-1 h-4 w-4 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen &&
                ReactDOM.createPortal(
                    <ModelSelectorPopup
                        models={models}
                        selectedModel={selectedModel}
                        onClose={() => setIsOpen(false)}
                        onSelect={selectModel}
                    />,
                    document.body
                )}
        </div>
    );
});

ModelSelectorDropdown.displayName = "ModelSelectorDropdown";

// ─── Main ImprovedChatInput Component ───────────────────────────────────────

export const ImprovedChatInput = memo<ImprovedChatInputProps>(
    ({
        onSendMessage,
        disabled = false,
        placeholder = "Ask KronosCode anything...",
        maxFiles = MAX_FILES,
        maxFileSize = MAX_FILE_SIZE,
        acceptedFileTypes,
        models = DEFAULT_MODELS_INTERNAL,
        defaultModel,
        onModelChange,
        selectedKronAgent,
        onKronAgentChange,
        kronAgents = [],
        slashCommands = [],
        referencedFiles = [],
        openWidgets = [],
        agentSelector,
    }) => {
        const [message, setMessage] = useState("");
        const [files, setFiles] = useState<FileWithPreview[]>([]);
        const [pastedContent, setPastedContent] = useState<PastedContent[]>([]);
        const [isDragging, setIsDragging] = useState(false);
        const [expanded, setExpanded] = useState(false);
        const [focused, setFocused] = useState(false);
        const [deckMenu, setDeckMenu] = useState<DeckMenuState | null>(null);
        const [selectedModel, setSelectedModel] = useState(defaultModel || models[0]?.id || "");

        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const fileInputRef = useRef<HTMLInputElement>(null);
        const selectedModelData = models.find((model) => model.id === selectedModel) ?? models[0];
        const selectedKronAgentData = kronAgents.find((agent) => agent.id === selectedKronAgent) ?? kronAgents[0];

        useEffect(() => {
            const nextModel = defaultModel || models[0]?.id || "";
            if (!nextModel) {
                return;
            }
            setSelectedModel((current) => (models.some((model) => model.id === current) ? current : nextModel));
        }, [defaultModel, models]);

        const detectDeckMenu = useCallback((value: string, cursor: number): DeckMenuState | null => {
            const beforeCursor = value.slice(0, cursor);
            const tokenMatch = beforeCursor.match(/(?:^|\s)([/@])([^\s]*)$/);
            if (!tokenMatch || tokenMatch.index == null) {
                return null;
            }
            const start = tokenMatch.index + (tokenMatch[0].startsWith(" ") ? 1 : 0);
            return {
                trigger: tokenMatch[1] as "/" | "@",
                query: tokenMatch[2] ?? "",
                start,
                end: cursor,
            };
        }, []);

        const updateDeckMenu = useCallback(
            (value: string, cursor: number) => {
                setDeckMenu(detectDeckMenu(value, cursor));
            },
            [detectDeckMenu]
        );

        const deckMenuItems = useMemo<DeckMenuItem[]>(() => {
            if (!deckMenu) {
                return [];
            }
            const query = deckMenu.query.toLowerCase();
            const items: DeckMenuItem[] =
                deckMenu.trigger === "/"
                    ? slashCommands.map((command) => ({ ...command, kind: "command" }))
                    : [
                          ...kronAgents.map((agent) => ({
                              id: agent.id,
                              label: agent.label,
                              description: agent.description,
                              badge: agent.kind ?? "agent",
                              available: agent.available,
                              kind: "agent" as const,
                          })),
                          ...referencedFiles.map((filePath) => ({
                              id: filePath,
                              label: filePath.split("/").pop() || filePath,
                              description: filePath,
                              badge: "file",
                              available: true,
                              kind: "file" as const,
                          })),
                          ...openWidgets.map((widget) => ({
                              ...widget,
                              available: true,
                              kind: "widget" as const,
                          })),
                      ];
            return items
                .filter((item) => {
                    const haystack = `${item.label} ${item.description ?? ""} ${item.badge ?? ""}`.toLowerCase();
                    return !query || haystack.includes(query);
                })
                .slice(0, 8);
        }, [deckMenu, kronAgents, openWidgets, referencedFiles, slashCommands]);

        // Auto-resize textarea
        useEffect(() => {
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
                const maxHeight = Number.parseInt(getComputedStyle(textareaRef.current).maxHeight, 10) || 120;
                textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`;
            }
        }, [message]);

        // Handle file selection
        const handleFileSelect = useCallback(
            (selectedFiles: FileList | null) => {
                if (!selectedFiles) return;

                const currentFileCount = files.length;
                if (currentFileCount >= maxFiles) {
                    alert(`Maximum ${maxFiles} files allowed. Please remove some files to add new ones.`);
                    return;
                }

                const availableSlots = maxFiles - currentFileCount;
                const filesToAdd = Array.from(selectedFiles).slice(0, availableSlots);

                if (selectedFiles.length > availableSlots) {
                    alert(
                        `You can only add ${availableSlots} more file(s). ${
                            selectedFiles.length - availableSlots
                        } file(s) were not added.`
                    );
                }

                const newFiles = filesToAdd
                    .filter((file) => {
                        if (file.size > maxFileSize) {
                            alert(
                                `File ${file.name} (${formatFileSize(
                                    file.size
                                )}) exceeds size limit of ${formatFileSize(maxFileSize)}.`
                            );
                            return false;
                        }
                        if (
                            acceptedFileTypes &&
                            !acceptedFileTypes.some(
                                (type) => file.type.includes(type) || type === file.name.split(".").pop()
                            )
                        ) {
                            alert(
                                `File type for ${
                                    file.name
                                } not supported. Accepted types: ${acceptedFileTypes.join(", ")}`
                            );
                            return false;
                        }
                        return true;
                    })
                    .map((file) => ({
                        id: Math.random().toString(36).substring(2, 11),
                        file,
                        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
                        type: file.type || "application/octet-stream",
                        uploadStatus: "pending" as const,
                        uploadProgress: 0,
                    }));

                setFiles((prev) => [...prev, ...newFiles]);

                // Handle textual files
                newFiles.forEach((fileToUpload) => {
                    if (isTextualFile(fileToUpload.file)) {
                        readFileAsText(fileToUpload.file)
                            .then((textContent) => {
                                setFiles((prev) =>
                                    prev.map((f) => (f.id === fileToUpload.id ? { ...f, textContent } : f))
                                );
                            })
                            .catch((error) => {
                                console.error("Error reading file content:", error);
                                setFiles((prev) =>
                                    prev.map((f) =>
                                        f.id === fileToUpload.id
                                            ? { ...f, textContent: "Error reading file content" }
                                            : f
                                    )
                                );
                            });
                    }

                    // Simulate upload
                    setFiles((prev) =>
                        prev.map((f) => (f.id === fileToUpload.id ? { ...f, uploadStatus: "uploading" } : f))
                    );

                    let progress = 0;
                    const interval = setInterval(() => {
                        progress += Math.random() * 20 + 5;
                        if (progress >= 100) {
                            progress = 100;
                            clearInterval(interval);
                            setFiles((prev) =>
                                prev.map((f) =>
                                    f.id === fileToUpload.id
                                        ? {
                                              ...f,
                                              uploadStatus: "complete",
                                              uploadProgress: 100,
                                          }
                                        : f
                                )
                            );
                        } else {
                            setFiles((prev) =>
                                prev.map((f) => (f.id === fileToUpload.id ? { ...f, uploadProgress: progress } : f))
                            );
                        }
                    }, 150);
                });
            },
            [files.length, maxFiles, maxFileSize, acceptedFileTypes]
        );

        // Remove file
        const removeFile = useCallback((id: string) => {
            setFiles((prev) => {
                const fileToRemove = prev.find((f) => f.id === id);
                if (fileToRemove?.preview) {
                    URL.revokeObjectURL(fileToRemove.preview);
                }
                return prev.filter((f) => f.id !== id);
            });
        }, []);

        // Handle paste
        const handlePaste = useCallback(
            (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
                const clipboardData = e.clipboardData;
                const items = clipboardData.items;

                const fileItems = Array.from(items).filter((item) => item.kind === "file");
                if (fileItems.length > 0 && files.length < maxFiles) {
                    e.preventDefault();
                    const pastedFiles = fileItems.map((item) => item.getAsFile()).filter(Boolean) as File[];
                    const dataTransfer = new DataTransfer();
                    pastedFiles.forEach((file) => dataTransfer.items.add(file));
                    handleFileSelect(dataTransfer.files);
                    return;
                }

                const textData = clipboardData.getData("text");
                if (textData && textData.length > PASTE_THRESHOLD && pastedContent.length < 5) {
                    e.preventDefault();
                    setMessage(message + textData.slice(0, PASTE_THRESHOLD) + "...");

                    const pastedItem: PastedContent = {
                        id: Math.random().toString(36).substring(2, 11),
                        content: textData,
                        timestamp: new Date(),
                        wordCount: textData.split(/\s+/).filter(Boolean).length,
                    };

                    setPastedContent((prev) => [...prev, pastedItem]);
                }
            },
            [handleFileSelect, files.length, maxFiles, pastedContent.length, message]
        );

        // Drag and drop handlers
        const handleDragOver = useCallback((e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(true);
        }, []);

        const handleDragLeave = useCallback((e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
        }, []);

        const handleDrop = useCallback(
            (e: React.DragEvent) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files) {
                    handleFileSelect(e.dataTransfer.files);
                }
            },
            [handleFileSelect]
        );

        // Send message
        const handleSend = useCallback(() => {
            if (disabled || (!message.trim() && files.length === 0 && pastedContent.length === 0)) return;
            if (files.some((f) => f.uploadStatus === "uploading")) {
                alert("Please wait for all files to finish uploading.");
                return;
            }

            onSendMessage?.(message, files, pastedContent);

            setMessage("");
            files.forEach((file) => {
                if (file.preview) URL.revokeObjectURL(file.preview);
            });
            setFiles([]);
            setPastedContent([]);
            if (textareaRef.current) textareaRef.current.style.height = "auto";
            setDeckMenu(null);
        }, [message, files, pastedContent, disabled, onSendMessage]);

        const applyDeckMenuItem = useCallback(
            (item: DeckMenuItem) => {
                if (!deckMenu) {
                    return;
                }
                const prefix = item.kind === "command" ? "/" : "@";
                const inserted =
                    item.kind === "file" && item.description
                        ? `${prefix}${item.description} `
                        : `${prefix}${item.label} `;
                const nextMessage = `${message.slice(0, deckMenu.start)}${inserted}${message.slice(deckMenu.end)}`;
                const nextCursor = deckMenu.start + inserted.length;
                setMessage(nextMessage);
                setDeckMenu(null);
                requestAnimationFrame(() => {
                    textareaRef.current?.focus();
                    textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
                });
            },
            [deckMenu, message]
        );

        const insertSlashCommand = useCallback((command: CommandDeckSuggestion) => {
            const nextMessage = `/${command.label} `;
            setMessage(nextMessage);
            setDeckMenu(null);
            requestAnimationFrame(() => {
                textareaRef.current?.focus();
                textareaRef.current?.setSelectionRange(nextMessage.length, nextMessage.length);
            });
        }, []);

        // Handle model change
        const handleModelChangeInternal = useCallback(
            (modelId: string) => {
                setSelectedModel(modelId);
                onModelChange?.(modelId);
            },
            [onModelChange]
        );

        // Handle keyboard
        const handleKeyDown = useCallback(
            (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (deckMenu && e.key === "Escape") {
                    e.preventDefault();
                    setDeckMenu(null);
                    return;
                }
                if (deckMenu && (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) && deckMenuItems[0]) {
                    e.preventDefault();
                    applyDeckMenuItem(deckMenuItems[0]);
                    return;
                }
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSend();
                }
            },
            [applyDeckMenuItem, deckMenu, deckMenuItems, handleSend]
        );

        const handleMessageChange = useCallback(
            (e: React.ChangeEvent<HTMLTextAreaElement>) => {
                const nextMessage = e.target.value;
                setMessage(nextMessage);
                updateDeckMenu(nextMessage, e.target.selectionStart ?? nextMessage.length);
            },
            [updateDeckMenu]
        );

        const handleTextareaSelect = useCallback(
            (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
                const target = e.currentTarget;
                updateDeckMenu(target.value, target.selectionStart ?? target.value.length);
            },
            [updateDeckMenu]
        );

        const hasContent = message.trim() || files.length > 0 || pastedContent.length > 0;
        const canSend = hasContent && !disabled && !files.some((f) => f.uploadStatus === "uploading");

        return (
            <div
                className="relative w-full"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {isDragging && (
                    <div className="absolute inset-0 z-50 bg-[#1C3F62] border-2 border-dashed border-[#5b9ef5] rounded-xl flex flex-col items-center justify-center pointer-events-none">
                        <p className="text-sm text-[#5b9ef5] flex items-center gap-2">
                            <ImageIcon className="size-4 opacity-50" />
                            Drop files here to add to chat
                        </p>
                    </div>
                )}

                {deckMenu && deckMenuItems.length > 0 ? (
                    <div className="absolute bottom-full left-0 z-40 mb-2 w-full overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#17171c] shadow-2xl shadow-black/60">
                        <div className="flex items-center gap-2 border-b border-[#2a2a2a] px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-[#8a8580]">
                            {deckMenu.trigger === "/" ? <Command className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                            {deckMenu.trigger === "/" ? "ACP Commands" : "Files, Widgets, and Agents"}
                        </div>
                        <div className="max-h-64 overflow-y-auto p-1.5">
                            {deckMenuItems.map((item) => (
                                <button
                                    key={`${item.kind}-${item.id}`}
                                    type="button"
                                    disabled={item.available === false}
                                    onClick={() => applyDeckMenuItem(item)}
                                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[#d4d4d4] transition-colors hover:bg-[#22202a] disabled:opacity-45"
                                >
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#101010] text-[#8a8580]">
                                        {item.kind === "command" ? (
                                            <Terminal className="h-3.5 w-3.5" />
                                        ) : item.kind === "file" ? (
                                            <Files className="h-3.5 w-3.5" />
                                        ) : item.kind === "widget" ? (
                                            <Expand className="h-3.5 w-3.5" />
                                        ) : (
                                            <Bot className="h-3.5 w-3.5" />
                                        )}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-2">
                                            <span className="truncate text-xs font-semibold">
                                                {item.kind === "command" ? "/" : "@"}
                                                {item.label}
                                            </span>
                                            {item.badge ? (
                                                <span className="rounded border border-[#2a2a2a] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[#8a8580]">
                                                    {item.badge}
                                                </span>
                                            ) : null}
                                        </span>
                                        {item.description ? (
                                            <span className="mt-0.5 block truncate text-[11px] text-[#8a8580]">
                                                {item.description}
                                            </span>
                                        ) : null}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}

                <div
                    className={cn(
                        "flex flex-col rounded-xl border border-[#2d2b35] bg-[#282631] shadow-2xl shadow-black/25 transition-[min-height,transform,border-color,box-shadow] duration-200",
                        focused && "translate-y-[-6px] border-[#4b5870] shadow-[0_18px_60px_rgba(0,0,0,0.38)]",
                        expanded ? "min-h-[260px]" : "min-h-[104px]"
                    )}
                >
                    {slashCommands.length ? (
                        <div className="flex min-h-9 items-center gap-1 overflow-x-auto border-b border-[#34313d] px-2 py-1">
                            {slashCommands.slice(0, 6).map((command) => (
                                <button
                                    type="button"
                                    key={command.id}
                                    disabled={disabled || command.available === false}
                                    onClick={() => insertSlashCommand(command)}
                                    className="flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#34313d] bg-[#1d1b24] px-2 text-[11px] font-medium text-[#c9c2bb] transition-colors hover:bg-[#2f2b3a] hover:text-[#eeeeee] disabled:cursor-not-allowed disabled:opacity-45"
                                    title={command.description}
                                >
                                    <Command className="h-3 w-3 text-[#8ab4f5]" />/{command.label}
                                </button>
                            ))}
                        </div>
                    ) : null}
                    <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={handleMessageChange}
                        onSelect={handleTextareaSelect}
                        onClick={handleTextareaSelect}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        onPaste={handlePaste}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        disabled={disabled}
                        className={cn(
                            "w-full resize-none border-0 bg-transparent px-3 py-3 text-sm text-[#dcd7d0] outline-none placeholder:text-[#8f8994] focus:border-none focus:outline-none focus:ring-0 disabled:opacity-60",
                            expanded ? "min-h-[196px] max-h-[320px]" : "min-h-[62px] max-h-[140px]"
                        )}
                        rows={1}
                    />
                    <div className="flex items-center gap-2 justify-between w-full px-2.5 pb-2">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={disabled || files.length >= maxFiles}
                                className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-md text-[#9a949f] transition-colors hover:bg-[#34313d] hover:text-[#eeeeee] disabled:cursor-not-allowed disabled:opacity-50"
                                title={files.length >= maxFiles ? `Max ${maxFiles} files reached` : "Attach files"}
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                    setExpanded((current) => !current);
                                    requestAnimationFrame(() => textareaRef.current?.focus());
                                }}
                                className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-md text-[#9a949f] transition-colors hover:bg-[#34313d] hover:text-[#eeeeee] disabled:cursor-not-allowed disabled:opacity-50"
                                title={expanded ? "Collapse chat area" : "Expand chat area"}
                            >
                                <Expand className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            {models && models.length > 0 && (
                                <div className="max-w-[180px] rounded-md border border-[#34313d] bg-[#1d1b24]">
                                    <ModelSelectorDropdown
                                        models={models}
                                        selectedModel={selectedModel}
                                        onModelChange={handleModelChangeInternal}
                                    />
                                </div>
                            )}
                            {agentSelector}
                            {agentSelector == null && selectedKronAgent != null && onKronAgentChange != null && (
                                <KronAgentSelector
                                    selectedAgent={selectedKronAgent}
                                    onAgentChange={onKronAgentChange}
                                    agents={kronAgents}
                                />
                            )}
                            {agentSelector == null && selectedKronAgent == null && selectedKronAgentData ? (
                                <span className="flex h-8 items-center gap-1.5 rounded-md border border-[#34313d] bg-[#1d1b24] px-2 text-xs text-[#d4d4d4]">
                                    <Bot className="h-3.5 w-3.5 text-[#f06f78]" />
                                    <span className="max-w-[120px] truncate">{selectedKronAgentData.label}</span>
                                </span>
                            ) : null}
                            {!selectedKronAgentData && selectedModelData ? (
                                <span className="hidden text-xs text-[#8f8994] sm:inline">
                                    {selectedModelData.name}
                                </span>
                            ) : null}

                            <button
                                type="button"
                                className={cn(
                                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md transition-colors",
                                    canSend
                                        ? "cursor-pointer text-[#c2c0c7] hover:bg-[#34313d] hover:text-[#eeeeee]"
                                        : "cursor-not-allowed text-[#6f6874]"
                                )}
                                onClick={handleSend}
                                disabled={!canSend}
                                aria-label="Send message"
                                title="Send message"
                            >
                                <ArrowUp className="h-4 w-4 rotate-90" />
                            </button>
                        </div>
                    </div>
                    {(files.length > 0 || pastedContent.length > 0) && (
                        <div className="overflow-x-auto border-t border-[#34313d] bg-[#211f29] p-3 w-full">
                            <div className="flex gap-3">
                                {pastedContent.map((content) => (
                                    <PastedContentCard
                                        key={content.id}
                                        content={content}
                                        onRemove={(id) => setPastedContent((prev) => prev.filter((c) => c.id !== id))}
                                    />
                                ))}
                                {files.map((file) => (
                                    <FilePreviewCard key={file.id} file={file} onRemove={removeFile} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept={acceptedFileTypes?.join(",")}
                    onChange={(e) => {
                        handleFileSelect(e.target.files);
                        if (e.target) e.target.value = "";
                    }}
                />
            </div>
        );
    }
);

ImprovedChatInput.displayName = "ImprovedChatInput";
