import "@fontsource-variable/manrope";
import "@fontsource-variable/newsreader";
import "@fontsource/ibm-plex-mono/400.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./styles.css";
import "./z-kronterm-mobile.css";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
        void navigator.serviceWorker.register("/sw.js");
    });
}
