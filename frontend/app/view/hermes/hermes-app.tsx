import App from "@hermes/app";
import { setTerminalTakeover } from "@hermes/app/right-sidebar/store";
import { RootErrorBoundary } from "@hermes/components/error-boundary";
import { removeTreePane, resetLayoutTree, revealTreePane } from "@hermes/components/pane-shell/tree/store";
import { RootTooltipProvider } from "@hermes/components/ui/tooltip";
import { I18nProvider } from "@hermes/i18n";
import { queryClient } from "@hermes/lib/query-client";
import { setFileBrowserOpen, setSidebarOpen } from "@hermes/store/layout";
import "@hermes/styles.css";
import { ThemeProvider } from "@hermes/themes/context";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HashRouter } from "react-router";

const HermesDesignWidth = 1440;
const HermesDesignHeight = 900;
const HermesMaximumScale = 1;
const HermesMinimumScale = 0.65;

export function HermesApp() {
    const viewportRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(HermesMaximumScale);

    useLayoutEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) {
            return;
        }

        const updateScale = () => {
            const { width, height } = viewport.getBoundingClientRect();
            if (width <= 0 || height <= 0) {
                return;
            }

            const nextScale = Math.max(
                HermesMinimumScale,
                Math.min(HermesMaximumScale, width / HermesDesignWidth, height / HermesDesignHeight)
            );
            setScale((currentScale) => (Math.abs(currentScale - nextScale) < 0.001 ? currentScale : nextScale));
        };

        updateScale();
        const observer = new ResizeObserver(updateScale);
        observer.observe(viewport);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        setTerminalTakeover(false);
        resetLayoutTree();
        removeTreePane("terminal");
        setSidebarOpen(true);
        setFileBrowserOpen(true);

        const frame = window.requestAnimationFrame(() => {
            revealTreePane("sessions");
            revealTreePane("review");
            revealTreePane("surfaces");
        });
        const retry = window.setTimeout(() => revealTreePane("surfaces"), 250);

        return () => {
            window.cancelAnimationFrame(frame);
            window.clearTimeout(retry);
        };
    }, []);

    return (
        <div ref={viewportRef} className="relative h-full w-full overflow-hidden">
            <div
                className="origin-top-left"
                style={{
                    width: `${100 / scale}%`,
                    height: `${100 / scale}%`,
                    transform: `scale(${scale})`,
                }}
            >
                <RootErrorBoundary>
                    <QueryClientProvider client={queryClient}>
                        <I18nProvider>
                            <ThemeProvider>
                                <RootTooltipProvider>
                                    <HashRouter useTransitions={false}>
                                        <App />
                                    </HashRouter>
                                </RootTooltipProvider>
                            </ThemeProvider>
                        </I18nProvider>
                    </QueryClientProvider>
                </RootErrorBoundary>
            </div>
        </div>
    );
}
