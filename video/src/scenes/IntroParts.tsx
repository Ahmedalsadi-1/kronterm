import React from "react";
import { interpolate } from "remotion";
import { COLORS } from "../theme";

type WindowCardProps = {
    label: string;
    width: number;
    height: number;
    opacity?: number;
    transform?: string;
};

const DOT_COLORS = ["#ff6961", "#ffcc4d", "#6dde7a"];

export const WindowCard: React.FC<WindowCardProps> = ({ label, width, height, opacity = 1, transform }) => {
    return (
        <div
            style={{
                width,
                height,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                background: COLORS.bg2,
                overflow: "hidden",
                boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
                opacity,
                transform,
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    height: 34,
                    padding: "0 14px",
                    borderBottom: `1px solid ${COLORS.border}`,
                    background: COLORS.panel,
                }}
            >
                {DOT_COLORS.map((color) => (
                    <span key={color} style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />
                ))}
                <span
                    style={{
                        marginLeft: 10,
                        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
                        fontSize: 24,
                        color: COLORS.soft,
                    }}
                >
                    {label}
                </span>
            </div>
        </div>
    );
};

export function easeOutClamped(frame: number, inputRange: readonly number[], outputRange: readonly number[]): number {
    return interpolate(frame, inputRange as number[], outputRange as number[], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
    });
}
