import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize, KeyboardStyle } from "@capacitor/keyboard";

const config: CapacitorConfig = {
    appId: "dev.kronterm.iphone",
    appName: "KronTerm",
    webDir: "dist",
    server: {
        iosScheme: "kronterm",
    },
    ios: {
        contentInset: "never",
        backgroundColor: "#0b0b0b",
        preferredContentMode: "mobile",
    },
    plugins: {
        StatusBar: {
            style: "LIGHT",
            overlaysWebView: true,
        },
        Keyboard: {
            resize: KeyboardResize.Native,
            style: KeyboardStyle.Dark,
        },
    },
};

export { config as default };
