import { Switch } from "@/app/components/ui/switch";
import { cn } from "@/app/lib/utils";
import {
    cornerRadiusAtom,
    diffLayoutPreferenceAtom,
    diffViewModeAtom,
    fontSizeAtom,
    inputBarOffsetAtom,
    persistChatDraftAtom,
    queueModeEnabledAtom,
    showReasoningTracesAtom,
    showTerminalQuickKeysAtom,
    showTextJustificationActivityAtom,
    spacingAtom,
    terminalFontSizeAtom,
    themeModeAtom,
    toolCallExpansionAtom,
} from "@/stores/kronosChamberSettingsStore";
import { RiRestartLine } from "@remixicon/react";
import { useAtom } from "jotai";
import React from "react";

export type VisibleSetting =
    | "theme"
    | "fontSize"
    | "terminalFontSize"
    | "spacing"
    | "cornerRadius"
    | "inputBarOffset"
    | "toolOutput"
    | "diffLayout"
    | "dotfiles"
    | "reasoning"
    | "queueMode"
    | "textJustificationActivity"
    | "terminalQuickKeys"
    | "persistDraft";

interface KronosChamberVisualSettingsProps {
    visibleSettings?: VisibleSetting[];
}

const THEME_MODE_OPTIONS = [
    { value: "system" as const, label: "System" },
    { value: "light" as const, label: "Light" },
    { value: "dark" as const, label: "Dark" },
];

const TOOL_EXPANSION_OPTIONS = [
    { value: "collapsed" as const, label: "Collapsed", description: "Activity and tools start collapsed" },
    { value: "activity" as const, label: "Summary", description: "Activity expanded, tools collapsed" },
    { value: "detailed" as const, label: "Detailed", description: "Activity expanded, key tools expanded" },
];

const DIFF_LAYOUT_OPTIONS = [
    { id: "dynamic" as const, label: "Dynamic", description: "New files inline, modified files side-by-side." },
    { id: "inline" as const, label: "Always inline", description: "Show all file diffs as a single unified view." },
    {
        id: "side-by-side" as const,
        label: "Always side-by-side",
        description: "Compare original and modified files next to each other.",
    },
];

const DIFF_VIEW_MODE_OPTIONS = [
    { id: "single" as const, label: "Single file", description: "Show one file at a time in the Diff tab." },
    { id: "stacked" as const, label: "All files", description: "Stack all changed files together in the Diff tab." },
];

const RangeSlider: React.FC<{
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step: number;
    defaultValue: number;
    label: string;
}> = ({ value, onChange, min, max, step, defaultValue, label }) => (
    <div className="flex items-center gap-3 w-full max-w-md">
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1 min-w-0 h-2 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
            aria-label={label}
        />
        <span className="text-sm font-medium text-foreground tabular-nums rounded-md border border-border bg-background px-2 py-1.5 min-w-[3.75rem] text-center">
            {value}
            {label.includes("Font") || label.includes("Corner") || label.includes("Offset") ? "" : "%"}
        </span>
        <button
            type="button"
            onClick={() => onChange(defaultValue)}
            disabled={value === defaultValue}
            className="h-8 w-8 px-0 border border-border bg-background hover:bg-interactive-hover disabled:opacity-100 disabled:bg-background flex items-center justify-center rounded-md cursor-pointer"
            aria-label={`Reset ${label}`}
            title="Reset"
        >
            <RiRestartLine className="h-3.5 w-3.5" />
        </button>
    </div>
);

const ButtonGroup: React.FC<{
    options: { value: string; label: string }[];
    selected: string;
    onChange: (v: string) => void;
}> = ({ options, selected, onChange }) => (
    <div className="flex gap-1 w-fit">
        {options.map((option) => (
            <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    selected === option.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground border border-border hover:bg-interactive-hover"
                )}
            >
                {option.label}
            </button>
        ))}
    </div>
);

export const KronosChamberVisualSettings: React.FC<KronosChamberVisualSettingsProps> = ({ visibleSettings }) => {
    const [themeMode, setThemeMode] = useAtom(themeModeAtom);
    const [fontSize, setFontSize] = useAtom(fontSizeAtom);
    const [terminalFontSize, setTerminalFontSize] = useAtom(terminalFontSizeAtom);
    const [spacing, setSpacing] = useAtom(spacingAtom);
    const [cornerRadius, setCornerRadius] = useAtom(cornerRadiusAtom);
    const [inputBarOffset, setInputBarOffset] = useAtom(inputBarOffsetAtom);
    const [toolCallExpansion, setToolCallExpansion] = useAtom(toolCallExpansionAtom);
    const [diffLayoutPreference, setDiffLayoutPreference] = useAtom(diffLayoutPreferenceAtom);
    const [diffViewMode, setDiffViewMode] = useAtom(diffViewModeAtom);
    const [showTerminalQuickKeys, setShowTerminalQuickKeys] = useAtom(showTerminalQuickKeysAtom);
    const [showReasoningTraces, setShowReasoningTraces] = useAtom(showReasoningTracesAtom);
    const [showTextJustificationActivity, setShowTextJustificationActivity] = useAtom(
        showTextJustificationActivityAtom
    );
    const [queueModeEnabled, setQueueModeEnabled] = useAtom(queueModeEnabledAtom);
    const [persistChatDraft, setPersistChatDraft] = useAtom(persistChatDraftAtom);

    const shouldShow = (setting: VisibleSetting): boolean => {
        if (!visibleSettings) return true;
        return visibleSettings.includes(setting);
    };

    return (
        <div className="w-full space-y-8">
            {shouldShow("theme") && (
                <div className="space-y-4">
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold text-foreground">Theme Mode</h3>
                    </div>
                    <ButtonGroup
                        options={THEME_MODE_OPTIONS}
                        selected={themeMode}
                        onChange={(v) => setThemeMode(v as "system" | "light" | "dark")}
                    />
                </div>
            )}

            {shouldShow("fontSize") && (
                <div className="space-y-4">
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold text-foreground">Font Size</h3>
                    </div>
                    <RangeSlider
                        value={fontSize}
                        onChange={setFontSize}
                        min={50}
                        max={200}
                        step={5}
                        defaultValue={100}
                        label="Font Size"
                    />
                </div>
            )}

            {shouldShow("terminalFontSize") && (
                <div className="space-y-4">
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold text-foreground">Terminal Font Size</h3>
                    </div>
                    <RangeSlider
                        value={terminalFontSize}
                        onChange={setTerminalFontSize}
                        min={9}
                        max={52}
                        step={1}
                        defaultValue={13}
                        label="Terminal Font Size"
                    />
                </div>
            )}

            {shouldShow("spacing") && (
                <div className="space-y-4">
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold text-foreground">Spacing</h3>
                    </div>
                    <RangeSlider
                        value={spacing}
                        onChange={setSpacing}
                        min={50}
                        max={200}
                        step={5}
                        defaultValue={100}
                        label="Spacing"
                    />
                </div>
            )}

            {shouldShow("terminalQuickKeys") && (
                <div className="space-y-4">
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold text-foreground">Show terminal optional key bar</h3>
                        <p className="text-sm text-muted-foreground">Esc, Ctrl, arrows, Enter.</p>
                    </div>
                    <Switch
                        checked={showTerminalQuickKeys}
                        onCheckedChange={setShowTerminalQuickKeys}
                        className="data-[state=checked]:bg-status-info"
                    />
                </div>
            )}

            {shouldShow("cornerRadius") && (
                <div className="space-y-4">
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold text-foreground">Input Field Corner Radius</h3>
                    </div>
                    <RangeSlider
                        value={cornerRadius}
                        onChange={setCornerRadius}
                        min={0}
                        max={32}
                        step={1}
                        defaultValue={12}
                        label="Corner Radius"
                    />
                </div>
            )}

            {shouldShow("inputBarOffset") && (
                <div className="space-y-4">
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold text-foreground">Input Bar Offset</h3>
                        <p className="text-sm text-muted-foreground">
                            Raise the input bar to avoid screen obstructions.
                        </p>
                    </div>
                    <RangeSlider
                        value={inputBarOffset}
                        onChange={setInputBarOffset}
                        min={0}
                        max={100}
                        step={5}
                        defaultValue={0}
                        label="Input Bar Offset"
                    />
                </div>
            )}

            {shouldShow("toolOutput") && (
                <div className="space-y-4">
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold text-foreground">Default Tool Output</h3>
                        <p className="text-sm text-muted-foreground">
                            {TOOL_EXPANSION_OPTIONS.find((o) => o.value === toolCallExpansion)?.description}
                        </p>
                    </div>
                    <ButtonGroup
                        options={TOOL_EXPANSION_OPTIONS}
                        selected={toolCallExpansion}
                        onChange={(v) => setToolCallExpansion(v as "collapsed" | "activity" | "detailed")}
                    />
                </div>
            )}

            {shouldShow("diffLayout") && (
                <div className="space-y-6">
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold text-foreground">Diff layout (Diff tab)</h3>
                        <p className="text-sm text-muted-foreground">Choose the default layout for file diffs.</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <ButtonGroup
                            options={DIFF_LAYOUT_OPTIONS.map((option) => ({ ...option, value: option.id }))}
                            selected={diffLayoutPreference}
                            onChange={(v) => setDiffLayoutPreference(v as "dynamic" | "inline" | "side-by-side")}
                        />
                        <p className="text-sm text-muted-foreground max-w-xl">
                            {DIFF_LAYOUT_OPTIONS.find((o) => o.id === diffLayoutPreference)?.description}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold text-foreground">Diff view (Diff tab)</h3>
                        <p className="text-sm text-muted-foreground">
                            Choose whether the Diff tab defaults to a single file or all files.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <ButtonGroup
                            options={DIFF_VIEW_MODE_OPTIONS.map((option) => ({ ...option, value: option.id }))}
                            selected={diffViewMode}
                            onChange={(v) => setDiffViewMode(v as "single" | "stacked")}
                        />
                        <p className="text-sm text-muted-foreground max-w-xl">
                            {DIFF_VIEW_MODE_OPTIONS.find((o) => o.id === diffViewMode)?.description}
                        </p>
                    </div>
                </div>
            )}

            {shouldShow("reasoning") && (
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showReasoningTraces}
                        onChange={(e) => setShowReasoningTraces(e.target.checked)}
                        className="rounded border-border"
                    />
                    <span className="text-base font-semibold text-foreground">Show thinking / reasoning traces</span>
                </label>
            )}

            {shouldShow("textJustificationActivity") && (
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showTextJustificationActivity}
                        onChange={(e) => setShowTextJustificationActivity(e.target.checked)}
                        className="rounded border-border"
                    />
                    <span className="text-base font-semibold text-foreground">Show text justification in activity</span>
                </label>
            )}

            {shouldShow("queueMode") && (
                <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={queueModeEnabled}
                            onChange={(e) => setQueueModeEnabled(e.target.checked)}
                            className="rounded border-border"
                        />
                        <span className="text-base font-semibold text-foreground">Queue messages by default</span>
                    </label>
                    <p className="text-sm text-muted-foreground pl-5">
                        {queueModeEnabled
                            ? "Enter queues messages, Mod+Enter sends immediately."
                            : "Enter sends immediately, Mod+Enter queues messages."}
                    </p>
                </div>
            )}

            {shouldShow("persistDraft") && (
                <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={persistChatDraft}
                            onChange={(e) => setPersistChatDraft(e.target.checked)}
                            className="rounded border-border"
                        />
                        <span className="text-base font-semibold text-foreground">Persist chat input draft</span>
                    </label>
                    <p className="text-sm text-muted-foreground pl-5">
                        Save your typed message across page reloads and session switches.
                    </p>
                </div>
            )}

            {shouldShow("dotfiles") && (
                <div className="space-y-3">
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold text-foreground">Hidden files (Chat)</h3>
                        <p className="text-sm text-muted-foreground">
                            Show or hide dotfiles in file lists and directory pickers.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
