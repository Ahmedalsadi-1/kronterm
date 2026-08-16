import App from "@hermes/app";
import "@hermes/styles.css";
import { useEffect, useRef } from "react";
import { installHermesDesktopShim } from "./hermes-desktop-shim";
import type { HermesViewModel } from "./hermes-model";

type HermesViewProps = {
    blockId: string;
    blockRef: React.RefObject<HTMLDivElement>;
    contentRef: React.RefObject<HTMLDivElement>;
    model: HermesViewModel;
};

let shimInstalled = false;

function ensureShim(): void {
    if (shimInstalled) {
        return;
    }
    shimInstalled = true;
    installHermesDesktopShim({ baseUrl: "http://127.0.0.1:9119", token: "" });
}

export function HermesView({ contentRef }: HermesViewProps) {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        ensureShim();
    }, []);

    return (
        <div
            ref={contentRef}
            className="hermes-view-container"
            style={{ width: "100%", height: "100%", overflow: "hidden" }}
        >
            <div ref={mountRef} style={{ width: "100%", height: "100%" }}>
                <App />
            </div>
        </div>
    );
}
