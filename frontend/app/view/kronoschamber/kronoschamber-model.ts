import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { KronosChamberSettingsView } from "../../components/sections/openchamber/KronosChamberSettingsView";
import { atom } from "jotai";

export class KronosChamberViewModel implements ViewModel {
    blockId: string;
    viewType = "kronoschamber";
    viewIcon = atom("sliders");
    viewName = atom("KronosChamber");
    viewComponent = KronosChamberSettingsView;
    noPadding = atom(true);
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
}
