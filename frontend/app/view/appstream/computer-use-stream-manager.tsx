import {
    createBlockSplitHorizontally,
    getAllBlockComponentModels,
    getFocusedBlockId,
    globalStore,
    refocusNode,
} from "@/app/store/global";
import { useWaveEnv } from "@/app/waveenv/waveenv";
import { useEffect, useRef } from "react";
import { subscribeAgentActivityStream } from "../../../types/agent-activity";

export const AppStreamCreatedEvent = "kronterm:appstream-created";

function appStreamKey(appName: string): string {
    return appName.trim().toLowerCase();
}

export function ComputerUseStreamManager() {
    const env = useWaveEnv();
    const appStreamBlocks = useRef(new Map<string, string>());
    const creatingApps = useRef(new Set<string>());

    useEffect(() => {
        const reconcileStreams = () => {
            for (const model of getAllBlockComponentModels() as any[]) {
                const viewModel = model?.viewModel;
                if (viewModel?.viewType !== "appstream" || !viewModel.appNameAtom || !viewModel.blockId) continue;
                const appNameValue = globalStore.get(viewModel.appNameAtom);
                const appName = typeof appNameValue === "string" ? appNameValue.trim() : "";
                if (appName) appStreamBlocks.current.set(appStreamKey(appName), viewModel.blockId);
            }
        };
        reconcileStreams();
        const handleRegisteredStream = (event: Event) => {
            const detail = (event as CustomEvent<{ appName?: string; blockId?: string }>).detail;
            if (!detail?.appName || !detail.blockId) {
                return;
            }
            appStreamBlocks.current.set(appStreamKey(detail.appName), detail.blockId);
        };
        const handleControl = (event: Event) => {
            const detail = (event as CustomEvent<{ action?: string; activity?: { appname?: string; blockid?: string } }>).detail;
            const appName = detail?.activity?.appname;
            const blockId = (appName && appStreamBlocks.current.get(appStreamKey(appName))) || detail?.activity?.blockid;
            if (!blockId) return;
            const model = (getAllBlockComponentModels() as any[]).find((candidate) => candidate?.viewModel?.blockId === blockId)?.viewModel;
            if (detail.action === "focus" || detail.action === "takeover") refocusNode(blockId);
            if (detail.action === "stop") void model?.stopStream?.();
            if (detail.action === "retry") void model?.startStream?.();
        };
        const unsubscribeActivity = subscribeAgentActivityStream((activity) => {
            const appName = activity.appname?.trim();
            const key = appName ? appStreamKey(appName) : "";
            if (activity.surface !== "desktop" || !appName || creatingApps.current.has(key)) {
                return;
            }
            reconcileStreams();
            const existingBlockId = appStreamBlocks.current.get(key);
            if (existingBlockId) {
                refocusNode(existingBlockId);
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
        });

        window.addEventListener(AppStreamCreatedEvent, handleRegisteredStream);
        window.addEventListener("kronterm:computer-use-control", handleControl);
        return () => {
            window.removeEventListener(AppStreamCreatedEvent, handleRegisteredStream);
            window.removeEventListener("kronterm:computer-use-control", handleControl);
            unsubscribeActivity();
        };
    }, [env]);

    return null;
}
