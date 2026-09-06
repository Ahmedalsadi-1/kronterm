// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { VoiceModel } from "@/app/aipanel/voice-model";
import { cn } from "@/util/util";
import { useAtomValue } from "jotai";
import { Loader2, Mic, MicOff, X } from "lucide-react";
import { memo, useEffect, useState } from "react";

type SiriButtonProps = {
    className?: string;
};

export const SiriButton = memo(({ className }: SiriButtonProps) => {
    const model = VoiceModel.getInstance();
    const listening = useAtomValue(model.listeningAtom);
    const isActive = useAtomValue(model.isSiriButtonActive);
    const [pending, setPending] = useState(false);

    const handleClick = async () => {
        if (pending) {
            return;
        }
        setPending(true);
        try {
            await model.toggleListening();
        } finally {
            setPending(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={pending}
            className={cn(
                "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-all duration-300",
                isActive
                    ? "bg-accent/20 text-accent shadow-[0_0_18px_rgba(45,231,255,0.45)]"
                    : "text-tertiary hover:bg-surface-hover hover:text-primary",
                pending && "cursor-pointer opacity-70",
                className
            )}
            title={listening ? "Stop listening" : "Start voice chat"}
        >
            <div className="relative flex h-4 w-4 items-center justify-center">
                {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : listening ? (
                    <MicOff className="h-4 w-4" />
                ) : (
                    <Mic className="h-4 w-4" />
                )}

                {isActive && <PulseRings />}
            </div>
        </button>
    );
});

SiriButton.displayName = "SiriButton";

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

const SiriWaveform = memo(({ active }: { active: boolean }) => {
    const bars = [0, 1, 2, 3, 4, 5, 6, 7, 8];

    return (
        <div className={cn("siri-waveform", active && "is-active")} aria-hidden="true">
            {bars.map((bar) => (
                <span key={bar} style={{ animationDelay: `${bar * 80}ms` }} />
            ))}
        </div>
    );
});

SiriWaveform.displayName = "SiriWaveform";

export const SiriVoiceOverlay = memo(() => {
    const model = VoiceModel.getInstance();
    const status = useAtomValue(model.statusAtom);
    const listening = useAtomValue(model.listeningAtom);
    const transcript = useAtomValue(model.transcriptAtom);
    const error = useAtomValue(model.errorAtom);
    const [dismissedKey, setDismissedKey] = useState("");
    const displayKey = `${status}:${transcript}:${error}`;
    const visible =
        listening ||
        status === "listening" ||
        status === "transcribing" ||
        status === "speaking" ||
        !!transcript ||
        !!error;

    useEffect(() => {
        if (visible) {
            setDismissedKey("");
        }
    }, [displayKey, visible]);

    useEffect(() => {
        if (!transcript || listening || status !== "idle") {
            return;
        }
        const timer = window.setTimeout(() => setDismissedKey(displayKey), 3800);
        return () => window.clearTimeout(timer);
    }, [displayKey, listening, status, transcript]);

    if (!visible || dismissedKey === displayKey) {
        return null;
    }

    const statusLabel = error
        ? "Voice error"
        : listening || status === "listening"
          ? "Listening"
          : status === "speaking"
            ? "Speaking"
            : transcript
              ? "Sent to chat"
              : "Voice";

    const handleClose = () => {
        if (listening) {
            void model.toggleListening();
        }
        setDismissedKey(displayKey);
    };

    return (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-start justify-center bg-black/20 px-4 pt-12 backdrop-blur-[2px]">
            <div className="pointer-events-auto w-full max-w-[360px] overflow-hidden rounded-xl border border-white/10 bg-[rgba(9,11,18,0.92)] shadow-2xl shadow-black/50">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#2de7ff] shadow-[0_0_14px_#2de7ff]" />
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/75">
                            {statusLabel}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-white/55 transition-colors hover:bg-white/10 hover:text-white"
                        title="Close voice overlay"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>

                <div className="relative flex min-h-[156px] flex-col items-center justify-center gap-4 px-5 py-5">
                    <div className="siri-orb" aria-hidden="true">
                        <SiriWaveform active={listening || status === "speaking"} />
                    </div>
                    <div className="min-h-10 text-center">
                        {error ? (
                            <div className="text-sm leading-5 text-red-200">{error}</div>
                        ) : transcript ? (
                            <div className="text-sm leading-5 text-white">{transcript}</div>
                        ) : (
                            <div className="text-sm leading-5 text-white/65">Ask KronosCode anything.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

SiriVoiceOverlay.displayName = "SiriVoiceOverlay";
