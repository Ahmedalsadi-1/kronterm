// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { getSettingsKeyAtom } from "@/store/global";
import { useAtomValue } from "jotai";
import { memo, useEffect } from "react";

// Applies the Minimal UI appearance mode by toggling `minimal-ui` on the root
// element; all quiet-chrome overrides key off this class.
const MinimalUiController = memo(() => {
    const enabled = useAtomValue(getSettingsKeyAtom("app:minimalui")) ?? false;

    useEffect(() => {
        document.documentElement.classList.toggle("minimal-ui", enabled);
        return () => document.documentElement.classList.remove("minimal-ui");
    }, [enabled]);

    return null;
});

MinimalUiController.displayName = "MinimalUiController";

export { MinimalUiController };
