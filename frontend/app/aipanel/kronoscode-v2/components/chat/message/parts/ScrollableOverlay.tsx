import React from "react";
import { cn } from "@/lib/utils";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import "overlayscrollbars/overlayscrollbars.css";

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
    as: _Component = "div",
    disableHorizontal = false,
    fillContainer = true,
    ...rest
  }, _ref) => {
    return (
      <OverlayScrollbarsComponent
        defer
        options={{
          scrollbars: {
            autoHide: "leave",
            autoHideDelay: 500,
          },
          overflow: {
            x: disableHorizontal ? "hidden" : "scroll",
          }
        }}
        className={cn(
          "relative flex flex-col min-h-0 w-full overflow-hidden",
          fillContainer ? "flex-1" : "flex-none",
          outerClassName
        )}
        style={style}
        {...rest}
      >
        <div className={cn("min-h-0 w-full", className)}>
          {children}
        </div>
      </OverlayScrollbarsComponent>
    );
  }
);

ScrollableOverlay.displayName = "ScrollableOverlay";
