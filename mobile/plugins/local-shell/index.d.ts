import type { Plugin } from "@capacitor/core";

export interface LocalShellStatus {
    available: boolean;
    engine: string;
    cwd: string;
    commands: string[];
}

export interface LocalShellResult {
    output: string;
    exitCode: number;
    cwd: string;
}

export interface KronTermLocalShellPlugin extends Plugin {
    status(): Promise<LocalShellStatus>;
    run(options: { command: string }): Promise<LocalShellResult>;
    interrupt(): Promise<void>;
}

export declare const KronTermLocalShell: KronTermLocalShellPlugin;
