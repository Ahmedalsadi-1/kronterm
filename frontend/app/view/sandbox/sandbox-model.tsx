import { BlockNodeModel } from "@/app/block/blocktypes";
import { globalStore } from "@/app/store/jotaiStore";
import { createBlockSplitHorizontally } from "@/app/store/global";
import { makeORef } from "@/app/store/wos";
import type { WaveEnv } from "@/app/waveenv/waveenv";
import { atom, Atom } from "jotai";
import { SandboxView } from "./sandbox";

export class SandboxViewModel implements ViewModel {
    viewType = "sandbox";
    blockId: string;
    nodeModel: BlockNodeModel;
    env: WaveEnv;
    blockAtom: Atom<Block>;
    modeAtom: Atom<MetaType["sandbox:mode"]>;
    browserUrlAtom: Atom<MetaType["sandbox:browserurl"]>;
    browserBlockIdAtom: Atom<MetaType["sandbox:browserblockid"]>;
    noPadding = atom(true);
    viewIcon = atom("desktop");
    viewName = atom("Sandbox");

    constructor({ blockId, nodeModel, waveEnv }: ViewModelInitType) {
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.env = waveEnv;
        this.blockAtom = this.env.wos.getWaveObjectAtom<Block>(`block:${blockId}`);
        this.modeAtom = this.env.getBlockMetaKeyAtom(blockId, "sandbox:mode");
        this.browserUrlAtom = this.env.getBlockMetaKeyAtom(blockId, "sandbox:browserurl");
        this.browserBlockIdAtom = this.env.getBlockMetaKeyAtom(blockId, "sandbox:browserblockid");
    }

    get viewComponent(): ViewComponent {
        return SandboxView;
    }

    giveFocus(): boolean {
        return true;
    }

    async updateMeta(meta: MetaType): Promise<void> {
        await this.env.services.object.UpdateObjectMeta(makeORef("block", this.blockId), meta);
    }

    getCurrentMode(): string {
        return globalStore.get(this.modeAtom) ?? "desktop";
    }

    getCurrentBrowserUrl(): string {
        return globalStore.get(this.browserUrlAtom) ?? "about:blank";
    }

    getCurrentBrowserBlockId(): string {
        return globalStore.get(this.browserBlockIdAtom) ?? "";
    }

    async setMode(mode: "desktop" | "background"): Promise<void> {
        await this.updateMeta({ "sandbox:mode": mode });
    }

    async setBrowserState(browserUrl: string, browserBlockId?: string): Promise<void> {
        const meta: MetaType = { "sandbox:browserurl": browserUrl };
        if (browserBlockId != null) {
            meta["sandbox:browserblockid"] = browserBlockId;
        }
        await this.updateMeta(meta);
    }

    getBrowserBlock(blockId: string): Block {
        if (!blockId) {
            return null;
        }
        return globalStore.get(this.env.wos.getWaveObjectAtom<Block>(`block:${blockId}`));
    }

    async ensureBrowserBlock(browserUrl?: string): Promise<string> {
        const nextBrowserUrl = browserUrl ?? this.getCurrentBrowserUrl();
        const existingBlockId = this.getCurrentBrowserBlockId();
        const existingBlock = this.getBrowserBlock(existingBlockId);
        if (existingBlock != null) {
            await this.env.services.object.UpdateObjectMeta(makeORef("block", existingBlockId), { url: nextBrowserUrl });
            await this.setBrowserState(nextBrowserUrl, existingBlockId);
            return existingBlockId;
        }

        const blockDef: BlockDef = {
            meta: {
                view: "web",
                url: nextBrowserUrl,
            },
        };
        const newBlockId = await createBlockSplitHorizontally(blockDef, this.blockId, "after");
        await this.setBrowserState(nextBrowserUrl, newBlockId);
        return newBlockId;
    }
}
