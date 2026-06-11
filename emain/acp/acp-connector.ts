// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { ChildProcess, spawn, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { createSpawnConfig, prepareCleanEnv } from "./acp-env";
import { ACP_BACKENDS_ALL } from "./acp-types";

export interface AcpSpawnResult {
    child: ChildProcess;
    isDetached: boolean;
}

export async function spawnAcpAgent(
    backend: string,
    cliPath: string,
    workingDir: string,
    customArgs?: string[],
    customEnv?: Record<string, string>
): Promise<AcpSpawnResult> {
    const config = ACP_BACKENDS_ALL[backend];
    const acpArgs = customArgs ?? config?.acpArgs;
    const runtimeEnv = {
        ...(config?.env ?? {}),
        ...customEnv,
    };
    if (backend === "kronoscode") {
        runtimeEnv.KRONOSCODE_CLIENT ??= "acp";
        runtimeEnv.KRONOSCODE_DISABLE_AUTOUPDATE ??= "1";
        runtimeEnv.KRONOSCODE_DISABLE_EXTERNAL_SKILLS ??= "1";
    }
    const bunBinary = path.join(process.env.HOME || "", ".bun", "bin", "bun");
    if (!runtimeEnv.BUN_BINARY && !process.env.BUN_BINARY && isExecutablePath(bunBinary)) {
        runtimeEnv.BUN_BINARY = bunBinary;
    }

    const cleanEnv = await prepareCleanEnv(runtimeEnv);
    const spawnConfig = createSpawnConfig(cliPath, workingDir, acpArgs, cleanEnv as Record<string, string>);

    const detached = process.platform !== "win32";
    const child = spawn(spawnConfig.command, spawnConfig.args, {
        ...spawnConfig.options,
        detached,
    });

    if (detached) {
        child.unref();
    }

    return { child, isDetached: detached };
}

function isExecutablePath(filePath: string): boolean {
    try {
        fs.accessSync(filePath, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

function detectKronosCodeCli(defaultCliPath?: string): string | null {
    const resourcesPath = (process as typeof process & { resourcesPath?: string }).resourcesPath;
    const candidates = [
        process.env.KRONOSCODE_BIN,
        process.env.KRONTERM_KRONOSCODE_BIN,
        resourcesPath ? path.join(resourcesPath, "agents", "kronoscode", "bin", "kronoscode") : null,
        path.resolve(import.meta.dirname, "..", "..", "agents", "kronoscode", "bin", "kronoscode"),
        path.join(process.cwd(), "kronoscoder", "packages", "kronoscode", "bin", "kronoscode"),
        path.join(process.cwd(), "kronoscode", "bin", "kronoscode"),
        process.env.HOME ? path.join(process.env.HOME, ".kronoscode", "bin", "kronoscode") : null,
        process.env.HOME ? path.join(process.env.HOME, "bin", "kronoscode") : null,
        defaultCliPath,
    ].filter((candidate): candidate is string => Boolean(candidate));
    return candidates.find((candidate) => isExecutablePath(candidate)) ?? null;
}

export async function detectInstalledAgents(): Promise<
    Array<{
        backend: string;
        name: string;
        cliPath: string;
        available: boolean;
        avatar?: string;
        description?: string;
        authRequired?: boolean;
        supportsStreaming?: boolean;
        acpArgs?: string[];
        skillsDirs?: string[];
    }>
> {
    const results: Array<{
        backend: string;
        name: string;
        cliPath: string;
        available: boolean;
        avatar?: string;
        description?: string;
        authRequired?: boolean;
        supportsStreaming?: boolean;
        acpArgs?: string[];
        skillsDirs?: string[];
    }> = [];

    for (const [id, config] of Object.entries(ACP_BACKENDS_ALL)) {
        if (id === "custom" || !config.enabled) continue;

        const cliCommand = config.cliCommand;
        if (!cliCommand) {
            results.push({
                backend: id,
                name: config.name,
                cliPath: config.defaultCliPath || "",
                available: false,
                avatar: config.avatar,
                description: config.description,
                authRequired: config.authRequired,
                supportsStreaming: config.supportsStreaming,
                acpArgs: config.acpArgs,
                skillsDirs: config.skillsDirs,
            });
            continue;
        }

        let available = false;
        let cliPath = config.defaultCliPath || cliCommand;

        if (id === "kronoscode") {
            const detectedCliPath = detectKronosCodeCli(config.defaultCliPath);
            if (detectedCliPath) {
                available = true;
                cliPath = detectedCliPath;
            }
        }

        if (config.defaultCliPath && isExecutablePath(config.defaultCliPath)) {
            if (!available) {
                available = true;
                cliPath = config.defaultCliPath;
            }
        }

        if (!available) {
            try {
                const whichCmd = process.platform === "win32" ? "where" : "which";
                const result = spawnSync(whichCmd, [cliCommand], { stdio: ["pipe", "pipe", "pipe"] });
                available = result.status === 0;
                if (available && result.stdout) {
                    cliPath = result.stdout.toString().trim().split("\n")[0];
                }
            } catch {
                available = false;
            }
        }

        if (!available && config.defaultCliPath) {
            const parts = config.defaultCliPath.split(/\s+/);
            const defaultCommand = parts[0];
            if (defaultCommand && !defaultCommand.includes("/") && defaultCommand !== cliCommand) {
                try {
                    const whichCmd = process.platform === "win32" ? "where" : "which";
                    const result = spawnSync(whichCmd, [defaultCommand], { stdio: ["pipe", "pipe", "pipe"] });
                    available = result.status === 0;
                } catch {
                    available = false;
                }
            }
            cliPath = config.defaultCliPath;
        }

        if (available && config.preferDefaultCliPath && config.defaultCliPath) {
            cliPath = config.defaultCliPath;
        }

        results.push({
            backend: id,
            name: config.name,
            cliPath,
            available,
            avatar: config.avatar,
            description: config.description,
            authRequired: config.authRequired,
            supportsStreaming: config.supportsStreaming,
            acpArgs: config.acpArgs,
            skillsDirs: config.skillsDirs,
        });
    }

    return results;
}
