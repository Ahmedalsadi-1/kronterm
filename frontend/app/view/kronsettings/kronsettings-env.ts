// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { WaveEnv, WaveEnvSubset } from "@/app/waveenv/waveenv";

export type KronSettingsEnv = WaveEnvSubset<{
    isDev: WaveEnv["isDev"];
    isWindows: WaveEnv["isWindows"];
    isMac: WaveEnv["isMac"];
    electron: {
        getPlatform: WaveEnv["electron"]["getPlatform"];
        getConfigDir: WaveEnv["electron"]["getConfigDir"];
        openBuilder: WaveEnv["electron"]["openBuilder"];
    };
    rpc: {
        SetConfigCommand: WaveEnv["rpc"]["SetConfigCommand"];
        FileInfoCommand: WaveEnv["rpc"]["FileInfoCommand"];
        FileReadCommand: WaveEnv["rpc"]["FileReadCommand"];
        FileWriteCommand: WaveEnv["rpc"]["FileWriteCommand"];
    };
    atoms: {
        fullConfigAtom: WaveEnv["atoms"]["fullConfigAtom"];
        hasConfigErrors: WaveEnv["atoms"]["hasConfigErrors"];
        hasCustomAIPresetsAtom: WaveEnv["atoms"]["hasCustomAIPresetsAtom"];
    };
    createBlock: WaveEnv["createBlock"];
    showContextMenu: WaveEnv["showContextMenu"];
}>;
