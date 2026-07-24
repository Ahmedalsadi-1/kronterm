// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { atom } from "jotai";
import { ChatHubV2View } from "./chathubv2";

export class ChatHubV2ViewModel implements ViewModel {
    blockId: string;
    viewType = "chathubv2";
    viewIcon = atom("sparkles");
    viewName = atom("ChatHub V2");
    noPadding = atom(true);
    nodeModel: BlockNodeModel;
    tabModel: TabModel;

    constructor({ blockId, nodeModel, tabModel }: ViewModelInitType) {
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
    }

    get viewComponent(): ViewComponent {
        return ChatHubV2View;
    }

    giveFocus(): boolean {
        return true;
    }
}
