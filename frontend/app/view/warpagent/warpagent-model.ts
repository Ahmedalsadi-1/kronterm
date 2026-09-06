// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { atom } from "jotai";
import { WarpAgentView } from "./warpagent";

export class WarpAgentViewModel implements ViewModel {
    blockId: string;
    viewType = "warpagent";
    viewIcon = atom("wand-magic-sparkles");
    viewName = atom("Warp Agent");
    noPadding = atom(true);
    nodeModel: BlockNodeModel;
    tabModel: TabModel;

    constructor({ blockId, nodeModel, tabModel }: ViewModelInitType) {
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
    }

    get viewComponent(): ViewComponent {
        return WarpAgentView;
    }

    giveFocus(): boolean {
        return true;
    }
}