import type { BlockNodeModel } from "@/app/block/blocktypes";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { globalStore } from "@/app/store/jotaiStore";
import { Atom, atom } from "jotai";
import type { WaveEnv } from "@/app/waveenv/waveenv";
import { AppStreamView } from "./appstream";

export class AppStreamViewModel implements ViewModel {
    viewType = "appstream";
    blockId: string;
    nodeModel: BlockNodeModel;
    env: WaveEnv;
    blockAtom: Atom<Block>;
    noPadding = atom(true);
    viewIcon = atom("desktop");
    viewName: Atom<string>;

    streamUrlAtom = atom<string>("");
    appNameAtom: Atom<string>;
    appIdAtom: Atom<string>;
    statusAtom = atom<"idle" | "starting" | "streaming" | "error">("idle");
    errorAtom = atom<string>("");

    constructor({ blockId, nodeModel, waveEnv }: ViewModelInitType) {
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.env = waveEnv;
        this.blockAtom = this.env.wos.getWaveObjectAtom<Block>("block:" + blockId);
        this.appNameAtom = this.env.getBlockMetaKeyAtom(blockId, "appstream:appname" as keyof MetaType) as Atom<string>;
        this.appIdAtom = this.env.getBlockMetaKeyAtom(blockId, "appstream:appid" as keyof MetaType) as Atom<string>;
        this.viewName = atom("App Stream");
    }

    get viewComponent(): ViewComponent {
        return AppStreamView;
    }

    giveFocus(): boolean {
        return true;
    }

    dispose() {
        const streamUrl = globalStore.get(this.streamUrlAtom);
        if (streamUrl) {
            RpcApi.AppStreamStopCommand(TabRpcClient, { sessionId: this.blockId }).catch(() => {});
        }
    }

    async startStream(): Promise<void> {
        globalStore.set(this.statusAtom, "starting");
        const appName = globalStore.get(this.appNameAtom) || "Unknown";
        const bundleId = globalStore.get(this.appIdAtom) || "";
        try {
            const response = await RpcApi.AppStreamStartCommand(TabRpcClient, {
                sessionId: this.blockId,
                appName: appName,
                bundleId,
            });
            if (response.error) {
                globalStore.set(this.statusAtom, "error");
                globalStore.set(this.errorAtom, response.error);
                return;
            }
            globalStore.set(this.streamUrlAtom, response.streamUrl);
            globalStore.set(this.statusAtom, "streaming");
        } catch (e) {
            globalStore.set(this.statusAtom, "error");
            globalStore.set(this.errorAtom, String(e));
        }
    }

    async stopStream(): Promise<void> {
        try {
            await RpcApi.AppStreamStopCommand(TabRpcClient, { sessionId: this.blockId });
        } catch {}
        globalStore.set(this.streamUrlAtom, "");
        globalStore.set(this.statusAtom, "idle");
    }

    async sendClick(x: number, y: number, button?: string): Promise<void> {
        const streamUrl = globalStore.get(this.streamUrlAtom);
        if (!streamUrl) return;
        try {
            await fetch(streamUrl + "/click", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ x, y, button: button || "left" }),
            });
        } catch {}
    }

    async sendType(text: string): Promise<void> {
        const streamUrl = globalStore.get(this.streamUrlAtom);
        if (!streamUrl) return;
        try {
            await fetch(streamUrl + "/type", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });
        } catch {}
    }

    async sendKeyPress(keys: string): Promise<void> {
        const streamUrl = globalStore.get(this.streamUrlAtom);
        if (!streamUrl) return;
        try {
            await fetch(streamUrl + "/press_key", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ keys }),
            });
        } catch {}
    }

    async sendScroll(direction: string, scrollCount?: number): Promise<void> {
        const streamUrl = globalStore.get(this.streamUrlAtom);
        if (!streamUrl) return;
        try {
            await fetch(streamUrl + "/scroll", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ direction, scrollCount: scrollCount || 3 }),
            });
        } catch {}
    }
}
