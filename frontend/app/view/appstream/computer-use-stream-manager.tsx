import {
    AgentSurfaceUiActivityEvent,
    type LiveAgentSurfaceActivity,
} from "@/app/aipanel/desktop-pet-activity";
import { createBlockSplitHorizontally, getFocusedBlockId } from "@/app/store/global";
import { useWaveEnv } from "@/app/waveenv/waveenv";
import { useEffect, useRef } from "react";

export const AppStreamCreatedEvent = "kronterm:appstream-created";

function appStreamKey(appName: string): string {
    return appName.trim().toLowerCase();
}

export function ComputerUseStreamManager() {
    const env = useWaveEnv();
    const appStreamBlocks = useRef(new Map<string, string>());
    const creatingApps = useRef(new Set<string>());

    useEffect(() => {
        const handleRegisteredStream = (event: Event) => {
            const detail = (event as CustomEvent<{ appName?: string; blockId?: string }>).detail;
            if (!detail?.appName || !detail.blockId) {
                return;
            }
            appStreamBlocks.current.set(appStreamKey(detail.appName), detail.blockId);
        };
        const handleActivity = (event: Event) => {
            const activity = (event as CustomEvent<LiveAgentSurfaceActivity>).detail;
            const appName = activity.appname?.trim();
            const key = appName ? appStreamKey(appName) : "";
            if (activity.surface !== "desktop" || !appName || creatingApps.current.has(key)) {
                return;
            }
            if (appStreamBlocks.current.has(key)) {
                return;
            }
            creatingApps.current.add(key);
            const blockDef: BlockDef = {
                meta: {
                    view: "appstream",
                    "appstream:appid": appName,
                    "appstream:appname": appName,
                } as unknown as MetaType,
            };
            const focusedBlockId = getFocusedBlockId();
            const createStreamBlock = focusedBlockId
                ? createBlockSplitHorizontally(blockDef, focusedBlockId, "after")
                : env.createBlock(blockDef);
            createStreamBlock
                .then((blockId) => {
                    appStreamBlocks.current.set(key, blockId);
                    window.dispatchEvent(new CustomEvent(AppStreamCreatedEvent, { detail: { appName, blockId } }));
                })
                .catch((error) => {
                    console.error(`Failed to create computer-use stream for ${appName}:`, error);
                })
                .finally(() => {
                    creatingApps.current.delete(key);
                });
        };

        window.addEventListener(AppStreamCreatedEvent, handleRegisteredStream);
        window.addEventListener(AgentSurfaceUiActivityEvent, handleActivity);
        return () => {
            window.removeEventListener(AppStreamCreatedEvent, handleRegisteredStream);
            window.removeEventListener(AgentSurfaceUiActivityEvent, handleActivity);
        };
    }, [env]);

    return null;
}
