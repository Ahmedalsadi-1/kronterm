// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * LSP language-server configuration.
 * Maps a Monaco language ID → the CLI command to start its language server.
 */
export type LspLanguageConfig = {
    /** Monaco language identifier (e.g. "go", "python", "typescript") */
    language: string;
    /** Display name (e.g. "Go", "Python") */
    displayName: string;
    /** Shell command to start the LSP server (e.g. "gopls") */
    command: string;
    /** CLI arguments */
    args: string[];
    /** Environment variables */
    env?: Record<string, string>;
    /** File extensions that trigger this language server */
    fileExtensions: string[];
};

/**
 * Pre-defined language server configurations.
 * Users can customize via settings later.
 */
export const BUILTIN_LSP_CONFIGS: LspLanguageConfig[] = [
    {
        language: "go",
        displayName: "Go",
        command: "gopls",
        args: [],
        fileExtensions: [".go"],
    },
    {
        language: "typescript",
        displayName: "TypeScript",
        command: "typescript-language-server",
        args: ["--stdio"],
        fileExtensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    },
    {
        language: "python",
        displayName: "Python",
        command: "pyright-langserver",
        args: ["--stdio"],
        fileExtensions: [".py"],
    },
    {
        language: "rust",
        displayName: "Rust",
        command: "rust-analyzer",
        args: [],
        fileExtensions: [".rs"],
    },
    {
        language: "cpp",
        displayName: "C/C++",
        command: "clangd",
        args: [],
        fileExtensions: [".c", ".cpp", ".h", ".hpp", ".cxx", ".cc"],
    },
];

/**
 * Internal message envelope for IPC transport between renderer and LSP server.
 */
export type LspIpcMessage = {
    sessionId: string;
    content: string;
};

export type LspStartResult = {
    sessionId: string;
};

export type LspStatusEvent = {
    sessionId: string;
    status: "started" | "stopped" | "error";
    error?: string;
};
