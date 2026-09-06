import { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { KronSettingsViewModel } from "@/app/view/kronsettings/kronsettings-model";
import { WOS } from "@/store/global";
import * as jotai from "jotai";
import { createElement, lazy, Suspense } from "react";
import { hermesSurfaceController } from "./hermes-surface-controller";

const LazyHermesView = lazy(async () => ({ default: (await import("./hermes")).HermesView }));

function HermesLazyView(props: ViewComponentProps<HermesViewModel>) {
    return createElement(Suspense, { fallback: null }, createElement(LazyHermesView, props));
}

export class HermesViewModel implements ViewModel {
    viewType: string;
    blockId: string;
    nodeModel: BlockNodeModel;
    blockAtom: jotai.Atom<Block>;
    viewIcon: jotai.Atom<string | IconButtonDecl>;
    viewName: jotai.Atom<string>;
    noPadding: jotai.Atom<boolean>;
    tabModel: TabModel;
    kronSettingsModel: KronSettingsViewModel;

    constructor(initOpts: ViewModelInitType) {
        const { blockId, nodeModel, tabModel } = initOpts;
        this.viewType = "hermes";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.kronSettingsModel = new KronSettingsViewModel(initOpts);
        this.blockAtom = WOS.getWaveObjectAtom<Block>(`block:${blockId}`);
        this.viewIcon = jotai.atom("robot");
        this.viewName = jotai.atom("Kronos");
        this.noPadding = jotai.atom(true);
    }

    get viewComponent(): ViewComponent {
        return HermesLazyView;
    }

    giveFocus(): boolean {
        return true;
    }

    dispose(): void {
        const surface = hermesSurfaceController.getSnapshot();
        if (surface.presentation === "widget" && surface.widgetBlockId === this.blockId) {
            hermesSurfaceController.returnToHud(surface.sessionId);
        }
    }
}
