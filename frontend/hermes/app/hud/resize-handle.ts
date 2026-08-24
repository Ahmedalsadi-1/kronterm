import {
    type PointerEvent as ReactPointerEvent,
    type RefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

/** Clamp to the same mins the window was created with (spawnHudWindow). */
const HUD_MIN_WIDTH = 380;
const HUD_MIN_HEIGHT = 160;

interface ResizeState {
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    originW: number;
    originH: number;
    pointerId: number;
}

/**
 * HUD-only: drag the corner handle to resize the window.
 *
 * The window is created `resizable: false` (see spawnHudWindow — a transparent
 * frameless window must not expose a system resize hot-zone, or every drag
 * grows it), so resizing has to be programmatic: the handle reports absolute
 * screen bounds and main flips resizable on for the setBounds call. Same
 * pattern as the pet overlay's wheel-scale (`hermes:pet-overlay:set-bounds`).
 *
 * The top-left corner is anchored; only the bottom-right follows the pointer.
 * Deltas are read in SCREEN coordinates, like the composer drag: client
 * coordinates are relative to a window that is changing size, so they cannot
 * be trusted mid-resize.
 */
export function useHudResizeHandle(rootRef?: RefObject<HTMLElement | null>): {
    resizing: boolean;
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
} {
    const [resizing, setResizing] = useState(false);
    const stateRef = useRef<ResizeState | null>(null);

    const reset = useCallback(() => {
        stateRef.current = null;
        setResizing(false);
    }, []);

    const onPointerDown = useCallback(
        (event: ReactPointerEvent<HTMLElement>) => {
            if (event.button !== 0) {
                return;
            }

            const rect = rootRef?.current?.getBoundingClientRect();
            stateRef.current = {
                startX: event.screenX,
                startY: event.screenY,
                originX: rect?.left ?? window.screenX,
                originY: rect?.top ?? window.screenY,
                originW: rect?.width ?? window.outerWidth,
                originH: rect?.height ?? window.outerHeight,
                pointerId: event.pointerId,
            };

            setResizing(true);
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
        },
        [rootRef]
    );

    useEffect(() => {
        const onMove = (event: PointerEvent) => {
            const state = stateRef.current;

            if (!state || event.pointerId !== state.pointerId) {
                return;
            }

            event.preventDefault();

            const dx = event.screenX - state.startX;
            const dy = event.screenY - state.startY;

            window.hermesDesktop?.hud?.setBounds?.({
                x: state.originX,
                y: state.originY,
                width: Math.max(HUD_MIN_WIDTH, state.originW + dx),
                height: Math.max(HUD_MIN_HEIGHT, state.originH + dy),
            });
        };

        const onUp = (event: PointerEvent) => {
            const state = stateRef.current;

            if (!state || event.pointerId !== state.pointerId) {
                return;
            }

            reset();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);

        return () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
        };
    }, [reset]);

    // A resize interrupted by an unmount must not leave the state dangling.
    useEffect(() => reset, [reset]);

    return { resizing, onPointerDown };
}
