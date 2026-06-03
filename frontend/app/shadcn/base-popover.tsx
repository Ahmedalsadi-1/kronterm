// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Popover } from "@base-ui/react/popover";
import { forwardRef, type ReactNode } from "react";

type BasePopoverProps = {
    children: ReactNode;
    trigger: ReactNode;
    triggerClassName?: string;
    popupClassName?: string;
    side?: Popover.Positioner.Props["side"];
    align?: Popover.Positioner.Props["align"];
    sideOffset?: number;
    onDismiss?: () => void;
    onTriggerClick?: () => void;
};

const BasePopover = forwardRef<HTMLButtonElement, BasePopoverProps>(
    (
        {
            children,
            trigger,
            triggerClassName,
            popupClassName,
            side = "bottom",
            align = "start",
            sideOffset = 4,
            onDismiss,
            onTriggerClick,
        },
        ref
    ) => {
        return (
            <Popover.Root
                onOpenChange={(open) => {
                    if (!open) {
                        onDismiss?.();
                    }
                }}
            >
                <Popover.Trigger ref={ref} className={triggerClassName} onClick={onTriggerClick}>
                    {trigger}
                </Popover.Trigger>
                <Popover.Portal>
                    <Popover.Positioner
                        side={side}
                        align={align}
                        sideOffset={sideOffset}
                        collisionPadding={12}
                        className="z-[var(--zindex-popover)]"
                    >
                        <Popover.Popup className={popupClassName}>{children}</Popover.Popup>
                    </Popover.Positioner>
                </Popover.Portal>
            </Popover.Root>
        );
    }
);

BasePopover.displayName = "BasePopover";

export { BasePopover };
