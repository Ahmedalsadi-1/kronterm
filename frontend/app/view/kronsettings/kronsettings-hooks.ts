// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { getSettingsKeyAtom } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";

export function useSettingField(key: Parameters<typeof getSettingsKeyAtom>[0]): [string, (v: string) => void] {
    const stored = useAtomValue(getSettingsKeyAtom(key));
    const [val, setVal] = useState(stored != null ? String(stored) : "");
    useEffect(() => {
        setVal(stored != null ? String(stored) : "");
    }, [stored]);
    const save = (v: string) => {
        setVal(v);
        RpcApi.SetConfigCommand(TabRpcClient, { [key]: v || undefined });
    };
    return [val, save];
}

export function useToggleField(key: Parameters<typeof getSettingsKeyAtom>[0]): [boolean, (v: boolean) => void] {
    const stored = useAtomValue(getSettingsKeyAtom(key));
    const [val, setVal] = useState(Boolean(stored));
    useEffect(() => {
        setVal(Boolean(stored));
    }, [stored]);
    const save = (v: boolean) => {
        setVal(v);
        RpcApi.SetConfigCommand(TabRpcClient, { [key]: v });
    };
    return [val, save];
}

export function useNumberField(
    key: Parameters<typeof getSettingsKeyAtom>[0],
    defaultValue: number = 0
): [number, (v: number) => void] {
    const stored = useAtomValue(getSettingsKeyAtom(key));
    const [val, setVal] = useState(stored != null ? Number(stored) : defaultValue);
    useEffect(() => {
        setVal(stored != null ? Number(stored) : defaultValue);
    }, [stored, defaultValue]);
    const save = (v: number) => {
        setVal(v);
        RpcApi.SetConfigCommand(TabRpcClient, { [key]: v });
    };
    return [val, save];
}