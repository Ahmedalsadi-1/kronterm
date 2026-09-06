import { interpolate } from "remotion";

// ── Brand Palette ──────────────────────────────────────────
export const COLORS = {
    bg: "#050608",
    bg2: "#090b10",
    text: "#f5f7fb",
    muted: "#a6adba",
    soft: "#727b89",
    accent: "#b8ff6c",
    accentBlue: "#74d7ff",
    danger: "#ff6d9a",
    border: "rgba(255,255,255,0.14)",
    panel: "rgba(255,255,255,0.055)",
    panelStrong: "rgba(255,255,255,0.09)",
} as const;

// ── Layout ─────────────────────────────────────────────────
export const WIDTH = 1080;
export const HEIGHT = 1920;

// ── Typography ─────────────────────────────────────────────
export const FONT_FAMILY = "'Inter', ui-sans-serif, system-ui, sans-serif";
export const FONT_MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', monospace";

// ── Scene Timing (frames at 30fps) ─────────────────────────
export const SCENE = {
    HOOK: { start: 0, duration: 150 }, // 0:00-0:05
    TERMINAL: { start: 150, duration: 240 }, // 0:05-0:13
    KRONOSCODE: { start: 390, duration: 270 }, // 0:13-0:22
    WIDGETS: { start: 660, duration: 240 }, // 0:22-0:30
    CANVAS: { start: 900, duration: 240 }, // 0:30-0:38
    CTA: { start: 1140, duration: 210 }, // 0:38-0:45
} as const;

export const TOTAL_FRAMES = 1350;

// ── Intro Film Timing (frames at 30fps, calm pacing) ───────
export const INTRO_SCENE = {
    TITLE: { start: 0, duration: 300 }, // 0:00-0:10
    PROBLEM: { start: 300, duration: 390 }, // 0:10-0:23
    SOLUTION: { start: 690, duration: 420 }, // 0:23-0:37
    SURFACES: { start: 1110, duration: 405 }, // 0:37-0:50
    CANVAS_AI: { start: 1515, duration: 405 }, // 0:50-1:04
    VALUES: { start: 1920, duration: 405 }, // 1:04-1:17
    CTA: { start: 2325, duration: 375 }, // 1:17-1:30
} as const;

export const INTRO_TOTAL_FRAMES =
    INTRO_SCENE.TITLE.duration +
    INTRO_SCENE.PROBLEM.duration +
    INTRO_SCENE.SOLUTION.duration +
    INTRO_SCENE.SURFACES.duration +
    INTRO_SCENE.CANVAS_AI.duration +
    INTRO_SCENE.VALUES.duration +
    INTRO_SCENE.CTA.duration;

// Vertical-format text stays inside platform UI chrome
export const SAFE_TOP = 250;
export const SAFE_BOTTOM = 1670;

// ── Animation Helpers ──────────────────────────────────────
export function fadeIn(frame: number, duration: number = 30, delay: number = 0): number {
    return interpolate(frame, [delay, delay + duration], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
}

export function fadeOut(frame: number, sceneDuration: number, fadeDuration: number = 20): number {
    return interpolate(frame, [sceneDuration - fadeDuration, sceneDuration], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
}

export function slideUp(frame: number, delay: number = 0, duration: number = 30): number {
    return interpolate(frame, [delay, delay + duration], [40, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
}

export function scaleIn(frame: number, delay: number = 0, duration: number = 30): number {
    return interpolate(frame, [delay, delay + duration], [0.8, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
}
