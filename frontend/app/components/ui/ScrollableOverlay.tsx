import React from "react";
import { cn } from "@/app/lib/utils";

type ScrollableOverlayProps = React.HTMLAttributes<HTMLElement> & {
  minThumbSize?: number;
  hideDelayMs?: number;
  as?: React.ElementType;
  outerClassName?: string;
  scrollbarClassName?: string;
  disableHorizontal?: boolean;
  observeMutations?: boolean;
  fillContainer?: boolean;
  keyboardAvoid?: boolean;
  preventOverscroll?: boolean;
};

export const ScrollableOverlay = React.forwardRef<HTMLElement, ScrollableOverlayProps>(
  ({
    className,
    outerClassName,
    children,
    style,
    minThumbSize,
    hideDelayMs,
    as: Component = "div",
    scrollbarClassName,
    disableHorizontal = false,
    observeMutations = true,
    fillContainer = true,
    keyboardAvoid = false,
    preventOverscroll = false,
    ...rest
  }, ref) => {
    const containerRef = React.useRef<HTMLElement | null>(null);

    React.useImperativeHandle(ref, () => containerRef.current as HTMLElement, []);

    return (
      <div
        className={cn(
          "relative flex flex-col min-h-0 w-full overflow-hidden",
          preventOverscroll && "overscroll-none",
          outerClassName
        )}
        data-keyboard-avoid={keyboardAvoid ? "true" : undefined}
      >
        <Component
          ref={containerRef as React.Ref<HTMLElement>}
          className={cn(
            preventOverscroll && "overscroll-none",
            fillContainer ? "flex-1 min-h-0 w-full" : "flex-none w-full h-auto",
            disableHorizontal ? "overflow-y-auto overflow-x-hidden" : "overflow-auto",
            className
          )}
          style={style}
          {...rest}
        >
          {children}
        </Component>
      </div>
    );
  }
);

ScrollableOverlay.displayName = "ScrollableOverlay";
