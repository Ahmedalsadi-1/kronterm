import App from "@hermes/app";
import { setTerminalTakeover } from "@hermes/app/right-sidebar/store";
import { RootErrorBoundary } from "@hermes/components/error-boundary";
import { removeTreePane, revealTreePane } from "@hermes/components/pane-shell/tree/store";
import { RootTooltipProvider } from "@hermes/components/ui/tooltip";
import { I18nProvider } from "@hermes/i18n";
import { queryClient } from "@hermes/lib/query-client";
import { setFileBrowserOpen, setSidebarOpen } from "@hermes/store/layout";
import "@hermes/styles.css";
import { ThemeProvider } from "@hermes/themes/context";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { HashRouter } from "react-router";

const HermesWidgetScale = 0.78;

export function HermesApp() {
    useEffect(() => {
        setTerminalTakeover(false);
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
        <div
            className="h-full origin-top-left overflow-hidden"
            style={{
                width: `${100 / HermesWidgetScale}%`,
                height: `${100 / HermesWidgetScale}%`,
                zoom: HermesWidgetScale,
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
    );
}
