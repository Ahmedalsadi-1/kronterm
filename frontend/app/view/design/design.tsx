// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { WebView, WebViewModel } from "@/app/view/webview/webview";
import { atom } from "jotai";
import { memo } from "react";

const KrondesignUrl = "http://127.0.0.1:7456";

export class DesignViewModel extends WebViewModel {
    constructor(init: ViewModelInitType) {
        super(init);
        this.viewType = "design";
        this.viewIcon = atom("palette");
        this.viewName = atom("Krondesign");
        this.hideViewName = atom(false);
        this.homepageUrl = atom(KrondesignUrl);
        this.url = atom(KrondesignUrl);
        this.partitionOverride = atom("persist:krondesign");
    }

    get viewComponent(): ViewComponent {
        return DesignView;
    }

    getBrowserTabs(): any[] {
        return [{ id: "krondesign", url: KrondesignUrl, title: "Krondesign" }];
    }

    getActiveBrowserTabId(): string {
        return "krondesign";
    }
}

const DesignView = memo((props: ViewComponentProps<DesignViewModel>) => {
    return <WebView {...props} initialSrc={KrondesignUrl} />;
});
DesignView.displayName = "DesignView";

export { DesignView };
