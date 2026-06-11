// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Tooltip } from "@/app/element/tooltip";
import { updateFoldState, widgetFoldStateAtom } from "@/app/workspace/widget-fold-state";
import { makeIconClass } from "@/util/util";
import { useAtom } from "jotai";
import { memo, useCallback } from "react";

const DefaultWidgetGroups: Record<string, { label: string; order: number }> = {
    terminal: { label: "Terminal", order: 0 },
    browser: { label: "Browser", order: 1 },
    ai: { label: "AI", order: 2 },
    sandbox: { label: "Sandbox", order: 3 },
    design: { label: "Design", order: 4 },
    apps: { label: "Apps", order: 5 },
    tools: { label: "Tools", order: 6 },
};

const WidgetGroupColors: Record<string, string> = {
    terminal: "#4ade80",
    browser: "#60a5fa",
    ai: "#e8c47c",
    sandbox: "#f472b6",
    design: "#38bdf8",
    apps: "#a78bfa",
    tools: "#94a3b8",
};

const WidgetGroupIcons: Record<string, string> = {
    terminal: "terminal",
    browser: "globe",
    ai: "sparkles",
    sandbox: "desktop",
    design: "palette",
    apps: "grid-2",
    tools: "wrench",
};

/**
 * Compact pills shown in the tab bar for each folded widget group.
 * Clicking a pill unfolds the group in the widget sidebar.
 */
const FoldedWidgetsBar = memo(() => {
    const [foldState, setFoldState] = useAtom(widgetFoldStateAtom);

    const foldedKeys = Object.entries(foldState)
        .filter(([, isFolded]) => isFolded)
        .map(([key]) => key)
        .sort((a, b) => {
            const aOrder = DefaultWidgetGroups[a]?.order ?? 99;
            const bOrder = DefaultWidgetGroups[b]?.order ?? 99;
            return aOrder - bOrder;
        });

    const handleUnfold = useCallback(
        (groupKey: string) => {
            setFoldState(
                updateFoldState(foldState, (prev) => {
                    const next = { ...prev };
                    delete next[groupKey];
                    return next;
                })
            );
        },
        [foldState, setFoldState]
    );

    if (foldedKeys.length === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-1 mx-1 mb-[3px]">
            {foldedKeys.map((groupKey) => {
                const groupInfo = DefaultWidgetGroups[groupKey] ?? { label: groupKey, order: 99 };
                const color = WidgetGroupColors[groupKey] ?? "#94a3b8";
                const icon = WidgetGroupIcons[groupKey] ?? "cube";

                return (
                    <Tooltip
                        key={groupKey}
                        content={`Unfold ${groupInfo.label} widgets`}
                        placement="bottom"
                        divClassName="folded-widget-pill"
                        divOnClick={() => handleUnfold(groupKey)}
                    >
                        <i className={makeIconClass(icon, false) + " text-[10px]"} style={{ color }} />
                        <span className="text-[10px] font-medium" style={{ color: `${color}cc` }}>
                            {groupInfo.label}
                        </span>
                    </Tooltip>
                );
            })}
        </div>
    );
});

FoldedWidgetsBar.displayName = "FoldedWidgetsBar";

export { FoldedWidgetsBar };
