import { Capacitor } from "@capacitor/core";
import { KronTermLocalShell, type LocalShellResult, type LocalShellStatus } from "@kronterm/local-shell";

export type { LocalShellResult, LocalShellStatus } from "@kronterm/local-shell";

const AnsiEscapePattern =
    /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

let statusPromise: Promise<LocalShellStatus | null> | undefined;

export const getLocalShellStatus = (): Promise<LocalShellStatus | null> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
        return Promise.resolve(null);
    }
    statusPromise ??= KronTermLocalShell.status().catch(() => null);
    return statusPromise;
};

export const runNativeLocalCommand = async (command: string): Promise<LocalShellResult | null> => {
    const status = await getLocalShellStatus();
    if (!status?.available) {
        return null;
    }
    return KronTermLocalShell.run({ command });
};

export const cleanTerminalOutput = (output: string): string[] =>
    output
        .replace(AnsiEscapePattern, "")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .filter((line, index, lines) => line || index < lines.length - 1);

export const isKronosCodeCommand = (command: string): boolean => /^(?:kronoscode|kc)(?:\s|$)/i.test(command.trim());
