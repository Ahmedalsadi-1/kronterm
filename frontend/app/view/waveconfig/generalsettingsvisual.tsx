// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Toggle } from "@/app/element/toggle";
import { atoms } from "@/app/store/global";
import type { WaveConfigViewModel } from "@/app/view/waveconfig/waveconfig-model";
import { useAtomValue } from "jotai";
import type React from "react";
import { memo } from "react";

interface GeneralSettingsVisualContentProps {
    model: WaveConfigViewModel;
}

type ToggleSettingProps = {
    title: string;
    description: string;
    checked: boolean;
    disabled?: boolean;
    onChange: (checked: boolean) => void;
};

const sectionClassName = "rounded-xl border border-border bg-panel px-5 py-4";

const ToggleSetting = memo(({ title, description, checked, disabled, onChange }: ToggleSettingProps) => {
    return (
        <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-b-0">
            <div className="min-w-0">
                <div className="text-sm font-semibold text-primary">{title}</div>
                <div className="text-sm text-muted mt-1">{description}</div>
            </div>
            <div className={disabled ? "opacity-60 pointer-events-none" : ""}>
                <Toggle checked={checked} onChange={onChange} />
            </div>
        </div>
    );
});

ToggleSetting.displayName = "ToggleSetting";

const SelectSetting = memo(
    ({
        title,
        description,
        value,
        onChange,
        children,
    }: {
        title: string;
        description: string;
        value: string;
        onChange: (value: string) => void;
        children: React.ReactNode;
    }) => {
        return (
            <div className="py-3 border-b border-border last:border-b-0">
                <div className="text-sm font-semibold text-primary">{title}</div>
                <div className="text-sm text-muted mt-1 mb-3">{description}</div>
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-primary cursor-pointer"
                >
                    {children}
                </select>
            </div>
        );
    }
);

SelectSetting.displayName = "SelectSetting";

export const GeneralSettingsVisualContent = memo(({ model }: GeneralSettingsVisualContentProps) => {
    const fullConfig = useAtomValue(model.env.atoms.fullConfigAtom);
    const aiModeConfigs = useAtomValue(atoms.waveaiModeConfigAtom);
    const settings = fullConfig?.settings ?? {};
    const isSaving = useAtomValue(model.isSavingAtom);

    const setValues = (values: Partial<SettingsType>) => {
        model.setConfigValues(values);
    };

    const telemetryEnabled = settings["telemetry:enabled"] ?? false;
    const showCloudModes = settings["waveai:showcloudmodes"] ?? true;
    const defaultMode = settings["waveai:defaultmode"] ?? "waveai@kronos";
    const copyOnSelect = settings["term:copyonselect"] ?? false;
    const cursorBlink = settings["term:cursorblink"] ?? false;
    const durableSessions = settings["term:durable"] ?? true;
    const showHiddenFiles = settings["preview:showhiddenfiles"] ?? false;
    const confirmTabClose = settings["tab:confirmclose"] ?? false;
    const confirmWindowClose = settings["window:confirmclose"] ?? false;
    const reducedMotion = settings["window:reducedmotion"] ?? false;
    const hideAIButton = settings["app:hideaibutton"] ?? false;
    const focusFollowsCursor = settings["app:focusfollowscursor"] ?? "off";

    return (
        <div className="h-full overflow-y-auto bg-background">
            <div className="max-w-4xl mx-auto p-6 space-y-5">
                <div>
                    <div className="text-2xl font-semibold text-primary">Easy Settings</div>
                    <div className="text-sm text-muted mt-2 max-w-3xl">
                        These are the settings most casual users usually want to change. You can still switch to{" "}
                        <span className="font-semibold text-primary">Raw JSON</span> any time for advanced edits.
                    </div>
                    {isSaving && <div className="text-xs text-accent mt-2">Saving changes...</div>}
                </div>

                <section className={sectionClassName}>
                    <div className="text-base font-semibold text-primary">AI and privacy</div>
                    <div className="text-sm text-muted mt-1 mb-2">
                        Control whether hosted AI cloud modes appear, which mode opens by default, and how private your
                        default experience is.
                    </div>
                    <ToggleSetting
                        title="Enable anonymous telemetry for hosted AI cloud"
                        description="Turn this on if you want to use Wave’s hosted AI modes. Leave it off if you want to use only your own keys or local models."
                        checked={telemetryEnabled}
                        onChange={(checked) => setValues({ "telemetry:enabled": checked })}
                    />
                    <ToggleSetting
                        title="Show hosted cloud AI modes"
                        description="If you only use your own API keys or local models, turn this off to keep the AI mode picker simple."
                        checked={showCloudModes}
                        onChange={(checked) => setValues({ "waveai:showcloudmodes": checked })}
                    />
                    <SelectSetting
                        title="Default AI mode"
                        description="Choose which KronosCode mode should start inside the chat shell."
                        value={defaultMode}
                        onChange={(value) => setValues({ "waveai:defaultmode": value })}
                    >
                        {Object.entries(aiModeConfigs)
                            .filter(
                                ([, config]) =>
                                    config["ai:provider"] === "kronos" ||
                                    config["ai:provider"] === "kronoscode" ||
                                    config["ai:apitype"] === "kronos-session" ||
                                    config["ai:apitype"] === "kronoscode"
                            )
                            .map(([key, config]) => (
                                <option key={key} value={key}>
                                    {config["display:name"] || key}
                                </option>
                            ))}
                    </SelectSetting>
                </section>

                <section className={sectionClassName}>
                    <div className="text-base font-semibold text-primary">Terminal behavior</div>
                    <div className="text-sm text-muted mt-1 mb-2">
                        Make the terminal feel more like you expect, especially if you are not used to advanced
                        defaults.
                    </div>
                    <ToggleSetting
                        title="Copy selected text automatically"
                        description="Selecting text copies it immediately, similar to many terminal apps."
                        checked={copyOnSelect}
                        onChange={(checked) => setValues({ "term:copyonselect": checked })}
                    />
                    <ToggleSetting
                        title="Blinking cursor"
                        description="Adds cursor blinking for people who find it easier to track where they are typing."
                        checked={cursorBlink}
                        onChange={(checked) => setValues({ "term:cursorblink": checked })}
                    />
                    <ToggleSetting
                        title="Keep terminal sessions durable"
                        description="Preserve terminal sessions more reliably across interruptions and reconnects."
                        checked={durableSessions}
                        onChange={(checked) => setValues({ "term:durable": checked })}
                    />
                </section>

                <section className={sectionClassName}>
                    <div className="text-base font-semibold text-primary">Workspace and files</div>
                    <div className="text-sm text-muted mt-1 mb-2">
                        Choose safer defaults for closing things and browsing files.
                    </div>
                    <ToggleSetting
                        title="Show hidden files in previews"
                        description="Useful for developers who often need dotfiles. Turn it off if you prefer a cleaner file view."
                        checked={showHiddenFiles}
                        onChange={(checked) => setValues({ "preview:showhiddenfiles": checked })}
                    />
                    <ToggleSetting
                        title="Confirm before closing tabs"
                        description="Adds a confirmation step before a tab closes."
                        checked={confirmTabClose}
                        onChange={(checked) => setValues({ "tab:confirmclose": checked })}
                    />
                    <ToggleSetting
                        title="Confirm before closing windows"
                        description="Adds a confirmation step before closing the whole window."
                        checked={confirmWindowClose}
                        onChange={(checked) => setValues({ "window:confirmclose": checked })}
                    />
                </section>

                <section className={sectionClassName}>
                    <div className="text-base font-semibold text-primary">Appearance and layout</div>
                    <div className="text-sm text-muted mt-1 mb-2">
                        A few layout and motion settings that are easier to understand visually than in JSON.
                    </div>
                    <ToggleSetting
                        title="Reduce motion"
                        description="Tone down motion effects if you prefer a calmer interface."
                        checked={reducedMotion}
                        onChange={(checked) => setValues({ "window:reducedmotion": checked })}
                    />
                    <ToggleSetting
                        title="Hide the AI button in the tab bar"
                        description="Useful if you want a cleaner tab bar and prefer keyboard shortcuts or the side panel."
                        checked={hideAIButton}
                        onChange={(checked) => setValues({ "app:hideaibutton": checked })}
                    />
                    <SelectSetting
                        title="Focus follows cursor"
                        description="Decide whether moving the pointer should also move focus between blocks."
                        value={focusFollowsCursor}
                        onChange={(value) => setValues({ "app:focusfollowscursor": value })}
                    >
                        <option value="off">Off</option>
                        <option value="delay">Delayed</option>
                        <option value="instant">Instant</option>
                    </SelectSetting>
                </section>
            </div>
        </div>
    );
});

GeneralSettingsVisualContent.displayName = "GeneralSettingsVisualContent";
