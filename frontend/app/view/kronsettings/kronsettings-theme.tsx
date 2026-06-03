// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo, useCallback, useState } from "react";
import { SettingsCard, SectionHeader, SettingRow } from "./kronsettings-shared";
import { THEME_PRESETS, applyThemePreset, resetThemeToDefault, applyCustomAccent } from "./kronsettings-theme-presets";
import type { KronSettingsViewModel } from "./kronsettings-model";

interface KronSettingsThemeContentProps {
    model: KronSettingsViewModel;
}

const AccentPicker = memo(({ r, g, b, onChange }: { r: number; g: number; b: number; onChange: (r: number, g: number, b: number) => void }) => {
    const [dragging, setDragging] = useState<"hue" | "saturation" | null>(null);

    const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
        const a = s * Math.min(l, 1 - l);
        const f = (n: number) => {
            const k = (n + h / 30) % 12;
            return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        };
        return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
    };

    const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
        const rn = r / 255, gn = g / 255, bn = b / 255;
        const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
        const l = (max + min) / 2;
        if (max === min) return [0, 0, Math.round(l * 100)];
        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        let h = 0;
        if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        else if (max === gn) h = ((bn - rn) / d + 2) / 6;
        else h = ((rn - gn) / d + 4) / 6;
        return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
    };

    const [hue, sat, light] = rgbToHsl(r, g, b);

    const handleHueChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const newHue = Number(e.target.value);
            const [nr, ng, nb] = hslToRgb(newHue, sat / 100, 0.5);
            onChange(nr, ng, nb);
        },
        [sat, onChange]
    );

    const handleHexInput = useCallback(
        (hex: string) => {
            const match = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
            if (match) {
                onChange(parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16));
            }
        },
        [onChange]
    );

    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    const currentHex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: `rgb(${r}, ${g}, ${b})`,
                        border: "2px solid rgba(255,255,255,0.15)",
                        boxShadow: `0 0 12px rgba(${r}, ${g}, ${b}, 0.3)`,
                        cursor: "pointer",
                        transition: "box-shadow 0.2s ease",
                        position: "relative",
                        overflow: "hidden",
                    }}
                >
                    <input
                        type="color"
                        value={currentHex}
                        onChange={(e) => handleHexInput(e.target.value)}
                        style={{
                            position: "absolute",
                            inset: -4,
                            width: "calc(100% + 8px)",
                            height: "calc(100% + 8px)",
                            opacity: 0,
                            cursor: "pointer",
                        }}
                    />
                </div>
                <input
                    type="text"
                    value={currentHex}
                    onChange={(e) => handleHexInput(e.target.value)}
                    className="kron-settings-input kron-settings-input--mono"
                    style={{ width: 90 }}
                    maxLength={7}
                />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted-color)", minWidth: 28 }}>Hue</span>
                <input
                    type="range"
                    min={0}
                    max={360}
                    value={hue}
                    onChange={handleHueChange}
                    className="kron-settings-range"
                    style={{ width: "100%", flex: 1 }}
                    aria-label="Hue"
                />
                <span style={{ fontSize: 12, color: "var(--text-muted-color)", fontVariantNumeric: "tabular-nums", minWidth: 24, textAlign: "right" }}>{hue}°</span>
            </div>
        </div>
    );
});

AccentPicker.displayName = "AccentPicker";

const KronSettingsThemeContent = memo(({ _model }: KronSettingsThemeContentProps) => {
    const [selectedPreset, setSelectedPreset] = useState("default");

    const handlePresetSelect = useCallback((id: string) => {
        setSelectedPreset(id);
        if (id === "default") {
            resetThemeToDefault();
        } else {
            applyThemePreset(id);
        }
    }, []);

    const [customAccent, setCustomAccent] = useState<[number, number, number]>([88, 193, 66]);

    const handleCustomAccent = useCallback((r: number, g: number, b: number) => {
        setCustomAccent([r, g, b]);
        applyCustomAccent(r, g, b);
        setSelectedPreset("custom");
    }, []);

    return (
        <div>
            <SettingsCard>
                <SectionHeader title="Accent Color" icon="swatchbook" description="Choose a preset theme or define your own accent color." />

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 4 }}>
                    {THEME_PRESETS.map((preset) => (
                        <button
                            key={preset.id}
                            onClick={() => handlePresetSelect(preset.id)}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 6,
                                padding: "10px 4px 8px",
                                borderRadius: 8,
                                border: selectedPreset === preset.id ? "2px solid var(--accent-color)" : "1px solid var(--border-color)",
                                background: selectedPreset === preset.id ? "var(--surface-selected-color)" : "transparent",
                                cursor: "pointer",
                                transition: "border-color 0.15s ease, background 0.15s ease",
                            }}
                        >
                            <div
                                style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: "50%",
                                    background: preset.colors["--accent-color"],
                                    boxShadow: selectedPreset === preset.id ? `0 0 8px ${preset.colors["--accent-color"]}60` : "none",
                                }}
                            />
                            <span style={{ fontSize: 11, color: "var(--text-secondary-color)" }}>{preset.label}</span>
                        </button>
                    ))}
                </div>
            </SettingsCard>

            <SettingsCard>
                <SectionHeader title="Custom Accent" icon="eye-dropper" description="Pick a custom accent color for full control." />
                <SettingRow title="Color Picker" description="Click the swatch to use your system color picker.">
                    <AccentPicker r={customAccent[0]} g={customAccent[1]} b={customAccent[2]} onChange={handleCustomAccent} />
                </SettingRow>
            </SettingsCard>
        </div>
    );
});

KronSettingsThemeContent.displayName = "KronSettingsThemeContent";

export { KronSettingsThemeContent };