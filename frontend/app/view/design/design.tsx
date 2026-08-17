// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { useWaveEnv } from "@/app/waveenv/waveenv";
import { cn } from "@/util/util";
import { atom } from "jotai";
import { memo, useCallback, useEffect, useState } from "react";

const KrondesignUrl = "http://127.0.0.1:7456";
const HealthPollMs = 5000;

type DaemonState = "checking" | "online" | "offline";

export class DesignViewModel implements ViewModel {
    viewType = "design";
    viewIcon = atom("palette");
    viewName = atom("Design");
    noPadding = atom(true);
    blockId: string;
    nodeModel: BlockNodeModel;
    tabModel: TabModel;

    constructor({ blockId, nodeModel, tabModel }: ViewModelInitType) {
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
    }

    giveFocus(): boolean {
        return true;
    }

    get viewComponent(): ViewComponent {
        return DesignView;
    }
}

const DesignView = memo((_props: ViewComponentProps<DesignViewModel>) => {
    const env = useWaveEnv();
    const [daemonState, setDaemonState] = useState<DaemonState>("checking");
    const [daemonUrl, setDaemonUrl] = useState(KrondesignUrl);
    const [starting, setStarting] = useState(false);
    const [startError, setStartError] = useState<string | null>(null);

    const checkDaemon = useCallback(async () => {
        try {
            const api = env.electron;
            if (api?.krondesignStatus != null) {
                const status = await api.krondesignStatus();
                setDaemonState(status.running ? "online" : "offline");
                if (status.url) {
                    setDaemonUrl(status.url);
                }
            } else {
                // preview / no-electron: fall back to a direct health probe
                const resp = await fetch(`${KrondesignUrl}/api/health`, { mode: "cors" });
                setDaemonState(resp.ok ? "online" : "offline");
            }
        } catch {
            setDaemonState("offline");
        }
    }, [env.electron]);

    useEffect(() => {
        void checkDaemon();
        const timer = setInterval(() => void checkDaemon(), HealthPollMs);
        return () => clearInterval(timer);
    }, [checkDaemon]);

    const handleStart = useCallback(async () => {
        setStarting(true);
        setStartError(null);
        try {
            const api = env.electron;
            if (api?.krondesignStart != null) {
                const result = await api.krondesignStart();
                if (!result.success) {
                    setStartError(result.error ?? "Failed to start the Krondesign daemon");
                }
            }
            await checkDaemon();
        } catch (err) {
            setStartError(err instanceof Error ? err.message : String(err));
        } finally {
            setStarting(false);
        }
    }, [env.electron, checkDaemon]);

    return (
        <div className="relative h-full w-full overflow-hidden bg-[var(--surface-base-color)]">
            {daemonState === "checking" && (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border-color)] border-t-[var(--accent-color)]" />
                    <span className="text-sm text-[var(--text-muted-color)]">Connecting to Krondesign…</span>
                </div>
            )}
            {daemonState === "offline" && (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
                    <h3 className="text-base font-medium text-[var(--text-primary-color)]">
                        Krondesign daemon not running
                    </h3>
                    <p className="max-w-md text-sm text-[var(--text-muted-color)]">
                        Start it to open the design workspace. If auto-start fails, run the manager script:
                    </p>
                    <code className="rounded-md bg-[var(--surface-raised-color)] px-3 py-1.5 font-mono text-xs text-[var(--text-secondary-color)]">
                        bash ~/kronterm/scripts/krondesign-manager.sh start
                    </code>
                    {startError != null && <p className="text-xs text-red-500">{startError}</p>}
                    <button
                        className={cn(
                            "cursor-pointer rounded-md bg-[var(--accent-color)] px-4 py-2 text-sm font-medium text-white transition-colors",
                            starting ? "opacity-60" : "hover:opacity-90"
                        )}
                        onClick={handleStart}
                        disabled={starting}
                    >
                        {starting ? "Starting…" : "Start Krondesign"}
                    </button>
                </div>
            )}
            {daemonState === "online" && (
                <iframe
                    src={`${daemonUrl}/`}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
                    className="h-full w-full border-0"
                />
            )}
        </div>
    );
});
DesignView.displayName = "DesignView";

export { DesignView };
