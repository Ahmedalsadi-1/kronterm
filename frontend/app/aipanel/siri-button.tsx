// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { VoiceModel, VoiceStatus } from "@/app/aipanel/voice-model";
import { cn } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useEffect, useRef, useState } from "react";

type SiriButtonProps = {
    className?: string;
};

export const SiriButton = memo(({ className }: SiriButtonProps) => {
    const model = VoiceModel.getInstance();
    const status = useAtomValue(model.statusAtom);
    const engineReady = useAtomValue(model.engineReadyAtom);
    const listening = useAtomValue(model.listeningAtom);
    const isActive = useAtomValue(model.isSiriButtonActive);

    const handleClick = () => {
        if (!engineReady) {
            model.startEngine();
            return;
        }
        model.toggleListening();
    };

    return (
        <button
            onClick={handleClick}
            className={cn(
                "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-all duration-300",
                isActive
                    ? "bg-accent/20 text-accent shadow-[0_0_8px_theme(colors.accent.DEFAULT/40%)]"
                    : "text-tertiary hover:bg-surface-hover hover:text-primary",
                className
            )}
            title={
                !engineReady
                    ? "Start Voice"
                    : listening
                      ? "Stop listening"
                      : "Start listening"
            }
        >
            <div className="relative flex h-4 w-4 items-center justify-center">
                {/* Base mic icon */}
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                >
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                </svg>

                {/* Pulse rings when active */}
                {isActive && <PulseRings />}
            </div>
        </button>
    );
});

SiriButton.displayName = "SiriButton";

/** Expanding ring animation when voice is active */
const PulseRings = memo(() => {
    const [rings] = useState(() => [0, 1, 2]);

    return (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {rings.map((i) => (
                <span
                    key={i}
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                    style={{
                        backgroundColor: "currentColor",
                        animationDelay: `${i * 0.3}s`,
                        animationDuration: "1.8s",
                    }}
                />
            ))}
        </span>
    );
});

PulseRings.displayName = "PulseRings";
