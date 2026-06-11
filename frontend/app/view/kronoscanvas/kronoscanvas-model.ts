// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { atom } from "jotai";
import { KronosCanvasView } from "./kronoscanvas";

export class KronosCanvasViewModel implements ViewModel {
    blockId: string;
    nodeModel: BlockNodeModel;
    tabModel: TabModel;
    viewType = "kronoscanvas";
    viewIcon = atom("diagram-project");
    viewName = atom("Canvas");
    noPadding = atom(true);

    constructor({ blockId, nodeModel, tabModel }: ViewModelInitType) {
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
    }

    get viewComponent(): ViewComponent {
        return KronosCanvasView;
    }

    giveFocus(): boolean {
        return true;
    }
}
