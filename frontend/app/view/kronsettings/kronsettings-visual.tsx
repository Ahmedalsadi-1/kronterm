// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useAtomValue } from "jotai";
import { memo, useCallback, useEffect, useState } from "react";
import type { KronSettingsViewModel } from "./kronsettings-model";
import { SectionHeader, SelectSetting, SettingsCard, ToggleSetting } from "./kronsettings-shared";

interface KronSettingsVisualContentProps {
    model: KronSettingsViewModel;
}

const LayoutModeStorageKey = "kronterm:layoutmode";
const LayoutModeChangedEvent = "kronterm:layoutmode-changed";

function publishLayoutMode(mode: string) {
    try {
        window.localStorage.setItem(LayoutModeStorageKey, mode);
        window.dispatchEvent(new CustomEvent(LayoutModeChangedEvent, { detail: { mode } }));
    } catch {}
}

function getStoredLayoutMode() {
    try {
        const mode = window.localStorage.getItem(LayoutModeStorageKey);
        return mode === "canvas" || mode === "tabs" ? mode : "widgets";
    } catch {
        return "widgets";
    }
}

const KronSettingsVisualContent = memo(({ model }: KronSettingsVisualContentProps) => {
    const fullConfig = useAtomValue(model.env.atoms.fullConfigAtom);
    const settings = fullConfig?.settings ?? {};

    const setValues = useCallback((values: Record<string, any>) => {
        void RpcApi.SetConfigCommand(TabRpcClient, values).catch((error) => {
            console.warn("[KronTerm settings] config update failed", error);
        });
    }, []);

    const reducedMotion = settings["window:reducedmotion"] ?? false;
    const cursorBlink = settings["term:cursorblink"] ?? false;
    const durableSessions = settings["term:durable"] ?? true;
    const showHiddenFiles = settings["preview:showhiddenfiles"] ?? false;
    const confirmTabClose = settings["tab:confirmclose"] ?? false;
    const hideAIButton = settings["app:hideaibutton"] ?? false;
    const focusFollowsCursor = settings["app:focusfollowscursor"] ?? "off";
    const settingsLayoutMode =
        settings["app:layoutmode"] === "canvas" || settings["app:layoutmode"] === "tabs"
            ? settings["app:layoutmode"]
            : "widgets";
    const [layoutMode, setLayoutMode] = useState(() => getStoredLayoutMode());
    const quickComposer = settings["app:quickcomposer"] ?? false;
    const browserTabStripPosition = settings["web:tabstripposition"] ?? "top";
    const telemetryEnabled = settings["telemetry:enabled"] ?? false;

    useEffect(() => {
        setLayoutMode(settingsLayoutMode);
    }, [settingsLayoutMode]);

    return (
        <div>
            <SettingsCard>
                <SectionHeader title="Theme" icon="palette" description="Customize the appearance of your terminal." />
                <ToggleSetting
                    title="Reduced Motion"
                    description="Reduce animations and transitions."
                    checked={reducedMotion}
                    onChange={(v) => setValues({ "window:reducedmotion": v })}
                />
            </SettingsCard>

            <SettingsCard>
                <SectionHeader title="Terminal" icon="terminal" description="Terminal behavior and display." />
                <ToggleSetting
                    title="Cursor Blink"
                    description="Make the terminal cursor blink."
                    checked={cursorBlink}
                    onChange={(v) => setValues({ "term:cursorblink": v })}
                />
                <ToggleSetting
                    title="Durable Sessions"
                    description="Keep terminal sessions alive across restarts."
                    checked={durableSessions}
                    onChange={(v) => setValues({ "term:durable": v })}
                />
            </SettingsCard>

            <SettingsCard>
                <SectionHeader title="Interface" icon="sliders" description="Interface behavior." />
                <ToggleSetting
                    title="Show Hidden Files"
                    description="Show dotfiles in file previews."
                    checked={showHiddenFiles}
                    onChange={(v) => setValues({ "preview:showhiddenfiles": v })}
                />
                <ToggleSetting
                    title="Confirm Tab Close"
                    description="Show a confirmation dialog when closing a tab."
                    checked={confirmTabClose}
                    onChange={(v) => setValues({ "tab:confirmclose": v })}
                />
                <ToggleSetting
                    title="Hide AI Button"
                    description="Remove the AI button from the interface."
                    checked={hideAIButton}
                    onChange={(v) => setValues({ "app:hideaibutton": v })}
                />
                <SelectSetting
                    title="Workspace Layout"
                    description="Choose tiled widgets, browser-style widget tabs, or the spatial canvas."
                    value={layoutMode}
                    onChange={(v) => {
                        publishLayoutMode(v);
                        setLayoutMode(v === "canvas" || v === "tabs" ? v : "widgets");
                        setValues({ "app:layoutmode": v });
                    }}
                    options={[
                        { value: "widgets", label: "Widgets" },
                        { value: "tabs", label: "Widget tabs" },
                        { value: "canvas", label: "Canvas" },
                    ]}
                />
                <SelectSetting
                    title="Browser Tab Placement"
                    description="Show browser widget tabs above the page or as a left-side tab rail."
                    value={browserTabStripPosition}
                    onChange={(v) => setValues({ "web:tabstripposition": v })}
                    options={[
                        { value: "top", label: "Top" },
                        { value: "left", label: "Left Rail" },
                    ]}
                />
                <ToggleSetting
                    title="Floating Chat Composer"
                    description="Show the bottom quick composer for fast KronosCode prompts."
                    checked={quickComposer}
                    onChange={(v) => setValues({ "app:quickcomposer": v })}
                />
                <SelectSetting
                    title="Focus Follows Cursor"
                    description="How focus follows the mouse cursor."
                    value={focusFollowsCursor}
                    onChange={(v) => setValues({ "app:focusfollowscursor": v })}
                    options={[
                        { value: "off", label: "Off" },
                        { value: "normal", label: "Normal" },
                        { value: "strict", label: "Strict" },
                    ]}
                />
            </SettingsCard>

            <SettingsCard>
                <SectionHeader title="Privacy" icon="shield-halved" description="Data collection preferences." />
                <ToggleSetting
                    title="Telemetry"
                    description="Send anonymous usage data to help improve KronTerm."
                    checked={telemetryEnabled}
                    onChange={(v) => setValues({ "telemetry:enabled": v })}
                />
            </SettingsCard>
        </div>
    );
});

KronSettingsVisualContent.displayName = "KronSettingsVisualContent";

export { KronSettingsVisualContent };
