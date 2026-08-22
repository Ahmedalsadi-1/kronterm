import { BlockNodeModel } from "@/app/block/blocktypes";
import { WOS } from "@/store/global";
import * as jotai from "jotai";
import { createElement, lazy, Suspense } from "react";

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

    constructor(initOpts: ViewModelInitType) {
        const { blockId, nodeModel } = initOpts;
        this.viewType = "hermes";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.blockAtom = WOS.getWaveObjectAtom<Block>(`block:${blockId}`);
        this.viewIcon = jotai.atom("robot");
        this.viewName = jotai.atom("Hermes");
        this.noPadding = jotai.atom(true);
    }

    get viewComponent(): ViewComponent {
        return HermesLazyView;
    }

    giveFocus(): boolean {
        return true;
    }

    dispose(): void {
        // no-op
    }
}
