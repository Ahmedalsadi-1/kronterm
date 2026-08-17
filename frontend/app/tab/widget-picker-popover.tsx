// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useWaveEnv } from "@/app/waveenv/waveenv";
import { shouldIncludeWidgetForWorkspace } from "@/app/workspace/widgetfilter";
import type { WidgetsEnv } from "@/app/workspace/widgets";
import { makeIconClass } from "@/util/util";
import {
    autoUpdate,
    flip,
    FloatingPortal,
    offset,
    shift,
    useDismiss,
    useFloating,
    useInteractions,
} from "@floating-ui/react";
import { useAtomValue } from "jotai";
import { memo, useMemo } from "react";

interface WidgetPickerPopoverProps {
    anchorElement: HTMLElement;
    open: boolean;
    onClose: () => void;
}

const WidgetPickerPopover = memo(({ anchorElement, open, onClose }: WidgetPickerPopoverProps) => {
    const env = useWaveEnv<WidgetsEnv>();
    const fullConfig = useAtomValue(env.atoms.fullConfigAtom);
    const workspaceId = useAtomValue(env.atoms.workspaceId);
    const widgets = useMemo(() => {
        const widgetsMap = fullConfig?.widgets ?? {};
        return Object.entries(widgetsMap)
            .filter(([, widget]) => {
                if (widget["display:hidden"]) {
                    return false;
                }
                return shouldIncludeWidgetForWorkspace(widget, workspaceId);
            })
            .map(([key, widget]) => ({ key, widget }))
            .sort((a, b) => (a.widget["display:order"] ?? 0) - (b.widget["display:order"] ?? 0));
    }, [fullConfig?.widgets, workspaceId]);
    const { refs, floatingStyles, context } = useFloating({
        open,
        onOpenChange: (nextOpen) => {
            if (!nextOpen) {
                onClose();
            }
        },
        placement: "bottom-start",
        middleware: [offset(6), flip({ padding: 12 }), shift({ padding: 12 })],
        whileElementsMounted: autoUpdate,
        elements: {
            reference: anchorElement,
        },
    });
    const dismiss = useDismiss(context);
    const { getFloatingProps } = useInteractions([dismiss]);

    if (!open) {
        return null;
    }

    return (
        <FloatingPortal>
            <div
                ref={refs.setFloating}
                style={floatingStyles}
                className="widget-picker-popover"
                role="menu"
                aria-label="Add a widget"
                {...getFloatingProps()}
            >
                <div className="widget-picker-popover-header">
                    <span>Add widget</span>
                    <span>{widgets.length} types</span>
                </div>
                {widgets.length === 0 ? (
                    <div className="widget-picker-popover-empty">No widgets are available for this workspace.</div>
                ) : (
                    <div className="widget-picker-popover-grid">
                        {widgets.map(({ key, widget }) => {
                            const label = String(widget.label ?? "Widget");
                            return (
                                <button
                                    type="button"
                                    key={key}
                                    className="widget-picker-popover-item"
                                    role="menuitem"
                                    onClick={() => {
                                        void env.createBlock(widget.blockdef, widget.magnified);
                                        onClose();
                                    }}
                                    title={widget.description || label}
                                >
                                    <span className="widget-picker-popover-icon" style={{ color: widget.color }}>
                                        <i className={makeIconClass(widget.icon, true, { defaultIcon: "browser" })} />
                                    </span>
                                    <span>{label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </FloatingPortal>
    );
});
WidgetPickerPopover.displayName = "WidgetPickerPopover";

export { WidgetPickerPopover };
