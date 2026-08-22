import App from "@hermes/app";
import { RootErrorBoundary } from "@hermes/components/error-boundary";
import { RootTooltipProvider } from "@hermes/components/ui/tooltip";
import { I18nProvider } from "@hermes/i18n";
import { queryClient } from "@hermes/lib/query-client";
import "@hermes/styles.css";
import { ThemeProvider } from "@hermes/themes/context";
import { QueryClientProvider } from "@tanstack/react-query";
import { HashRouter } from "react-router";

export function HermesApp() {
    return (
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
    );
}
