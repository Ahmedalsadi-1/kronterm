// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export interface ThemePreset {
    id: string;
    label: string;
    colors: Record<string, string>;
}

export const THEME_PRESETS: ThemePreset[] = [
    {
        id: "default",
        label: "Default Dark",
        colors: {
            "--accent-color": "rgb(88, 193, 66)",
            "accent-rgb": "88, 193, 66",
        },
    },
    {
        id: "nord",
        label: "Nord",
        colors: {
            "--accent-color": "rgb(136, 192, 208)",
            "accent-rgb": "136, 192, 208",
        },
    },
    {
        id: "dracula",
        label: "Dracula",
        colors: {
            "--accent-color": "rgb(189, 147, 249)",
            "accent-rgb": "189, 147, 249",
        },
    },
    {
        id: "catppuccin",
        label: "Catppuccin Mocha",
        colors: {
            "--accent-color": "rgb(203, 166, 247)",
            "accent-rgb": "203, 166, 247",
        },
    },
    {
        id: "solarized",
        label: "Solarized",
        colors: {
            "--accent-color": "rgb(38, 139, 210)",
            "accent-rgb": "38, 139, 210",
        },
    },
    {
        id: "gruvbox",
        label: "Gruvbox",
        colors: {
            "--accent-color": "rgb(250, 189, 47)",
            "accent-rgb": "250, 189, 47",
        },
    },
    {
        id: "tokyo",
        label: "Tokyo Night",
        colors: {
            "--accent-color": "rgb(125, 207, 255)",
            "accent-rgb": "125, 207, 255",
        },
    },
    {
        id: "rose",
        label: "Rose Pine",
        colors: {
            "--accent-color": "rgb(234, 154, 151)",
            "accent-rgb": "234, 154, 151",
        },
    },
];

export function applyThemePreset(presetId: string): void {
    const preset = THEME_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const root = document.documentElement;
    for (const [key, value] of Object.entries(preset.colors)) {
        root.style.setProperty(key, value);
    }

    const accentColor = preset.colors["--accent-color"];
    if (accentColor) {
        root.style.setProperty("--surface-selected-color", accentColor.replace("rgb(", "rgba(").replace(")", ", 0.16)"));
        root.style.setProperty("--focus-ring-color", accentColor.replace("rgb(", "rgba(").replace(")", ", 0.72)"));
        root.style.setProperty("--tab-green", accentColor);
        root.style.setProperty("--toggle-checked-bg-color", accentColor);
    }
}

export function resetThemeToDefault(): void {
    const root = document.documentElement;
    root.style.removeProperty("--accent-color");
    root.style.removeProperty("accent-rgb");
    root.style.removeProperty("--surface-selected-color");
    root.style.removeProperty("--focus-ring-color");
    root.style.removeProperty("--tab-green");
    root.style.removeProperty("--toggle-checked-bg-color");
}

export function applyCustomAccent(r: number, g: number, b: number): void {
    const root = document.documentElement;
    root.style.setProperty("--accent-color", `rgb(${r}, ${g}, ${b})`);
    root.style.setProperty("accent-rgb", `${r}, ${g}, ${b}`);
    root.style.setProperty("--surface-selected-color", `rgba(${r}, ${g}, ${b}, 0.16)`);
    root.style.setProperty("--focus-ring-color", `rgba(${r}, ${g}, ${b}, 0.72)`);
    root.style.setProperty("--tab-green", `rgb(${r}, ${g}, ${b})`);
    root.style.setProperty("--toggle-checked-bg-color", `rgb(${r}, ${g}, ${b})`);
}