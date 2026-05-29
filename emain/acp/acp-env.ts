// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from "child_process";
import * as os from "os";
import * as path from "path";

export async function prepareCleanEnv(customEnv?: Record<string, string>): Promise<Record<string, string | undefined>> {
    const merged: Record<string, string | undefined> = { ...process.env };

    delete merged.NODE_OPTIONS;
    delete merged.NODE_INSPECT;
    delete merged.NODE_DEBUG;
    delete merged.CLAUDECODE;

    for (const key of Object.keys(merged)) {
        if (key.startsWith("npm_")) {
            delete merged[key];
        }
    }

    if (customEnv) {
        Object.assign(merged, customEnv);
    }

    return merged;
}

export function ensureMinNodeVersion(
    env: Record<string, string | undefined>,
    minMajor: number,
    minMinor: number,
    backendLabel: string
): void {
    const isWindows = process.platform === "win32";
    let versionTooOld = false;

    try {
        const detectedVersion = execFileSync(isWindows ? "node.exe" : "node", ["--version"], {
            env,
            encoding: "utf-8",
            timeout: 5000,
            stdio: ["pipe", "pipe", "pipe"],
        }).trim();

        const match = detectedVersion.match(/^v(\d+)\.(\d+)\./);
        if (match) {
            const major = parseInt(match[1], 10);
            const minor = parseInt(match[2], 10);
            if (major < minMajor || (major === minMajor && minor < minMinor)) {
                versionTooOld = true;
            }
        }
    } catch {
        return;
    }

    if (versionTooOld) {
        throw new Error(
            `Node.js version is too old for ${backendLabel}. Minimum required: v${minMajor}.${minMinor}.0.`
        );
    }
}

export function createSpawnConfig(
    cliPath: string,
    workingDir: string,
    acpArgs?: string[],
    customEnv?: Record<string, string>
): { command: string; args: string[]; options: Record<string, any> } {
    const isWindows = process.platform === "win32";
    const env = customEnv ? { ...process.env, ...customEnv } : { ...process.env };
    delete (env as any).NODE_OPTIONS;

    const effectiveAcpArgs = acpArgs === undefined ? ["--experimental-acp"] : acpArgs;

    let spawnCommand: string;
    let spawnArgs: string[];

    if (isWindows) {
        spawnCommand = `chcp 65001 >nul && "${cliPath}"`;
        spawnArgs = effectiveAcpArgs;
    } else {
        const parts = cliPath.split(/\s+/);
        spawnCommand = parts[0];
        spawnArgs = [...parts.slice(1), ...effectiveAcpArgs];
    }

    return {
        command: spawnCommand,
        args: spawnArgs,
        options: {
            cwd: workingDir,
            stdio: ["pipe", "pipe", "pipe"],
            env,
            shell: isWindows,
        },
    };
}

export function getHomeDir(): string {
    return os.homedir();
}

export function resolveCliPath(cliPath: string): string {
    if (path.isAbsolute(cliPath)) {
        return cliPath;
    }
    return cliPath;
}
