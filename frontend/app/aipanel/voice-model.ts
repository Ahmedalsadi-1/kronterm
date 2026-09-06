// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { getApi } from "@/app/store/global";
import { globalStore } from "@/app/store/jotaiStore";
import { atom, type PrimitiveAtom } from "jotai";

export type VoiceStatus = "idle" | "listening" | "transcribing" | "speaking" | "error";

export type VoiceModelState = {
    status: VoiceStatus;
    listening: boolean;
    wakeWordEnabled: boolean;
    engineReady: boolean;
    transcript: string;
    error: string | null;
};

export class VoiceModel {
    private static instance: VoiceModel | null = null;

    readonly statusAtom = atom<VoiceStatus>("idle") as PrimitiveAtom<VoiceStatus>;
    readonly listeningAtom = atom(false) as PrimitiveAtom<boolean>;
    readonly wakeWordAtom = atom(false) as PrimitiveAtom<boolean>;
    readonly engineReadyAtom = atom(false) as PrimitiveAtom<boolean>;
    readonly transcriptAtom = atom("") as PrimitiveAtom<string>;
    readonly errorAtom = atom(null) as PrimitiveAtom<string | null>;

    readonly isSiriButtonActive = atom((get) => {
        const status = get(this.statusAtom);
        return get(this.listeningAtom) || status === "listening" || status === "transcribing" || status === "speaking";
    });

    private constructor() {
        const api = getApi();
        if (api == null) return;

        api.onAudioStatusChange?.((status: string) => {
            globalStore.set(this.statusAtom, status as VoiceStatus);
            if (status === "listening") {
                globalStore.set(this.listeningAtom, true);
            } else if (status === "error") {
                globalStore.set(this.listeningAtom, false);
            }
        });

        api.onAudioTranscript?.((text: string) => {
            this.handleTranscript(text);
        });

        api.onAudioError?.((message: string) => {
            globalStore.set(this.errorAtom, message);
            globalStore.set(this.statusAtom, "error");
        });
    }

    static getInstance(): VoiceModel {
        if (!VoiceModel.instance) {
            VoiceModel.instance = new VoiceModel();
        }
        return VoiceModel.instance;
    }

    getState(): VoiceModelState {
        return {
            status: globalStore.get(this.statusAtom),
            listening: globalStore.get(this.listeningAtom),
            wakeWordEnabled: globalStore.get(this.wakeWordAtom),
            engineReady: globalStore.get(this.engineReadyAtom),
            transcript: globalStore.get(this.transcriptAtom),
            error: globalStore.get(this.errorAtom),
        };
    }

    async startEngine(): Promise<boolean> {
        const api = getApi();
        if (api?.audioStart == null) return false;
        const result = await api.audioStart();
        if (result) {
            globalStore.set(this.engineReadyAtom, true);
        }
        return result;
    }

    async startListening(): Promise<boolean> {
        const api = getApi();
        if (api == null) return false;

        if (!globalStore.get(this.engineReadyAtom)) {
            const engineReady = await this.startEngine();
            if (!engineReady) {
                return false;
            }
        }

        api.audioStartListening?.();
        globalStore.set(this.listeningAtom, true);
        globalStore.set(this.statusAtom, "listening");
        globalStore.set(this.errorAtom, null);
        return true;
    }

    disableEngine(): void {
        const api = getApi();
        if (globalStore.get(this.listeningAtom)) {
            api?.audioStopListening?.();
        }
        api?.audioShutdown?.();
        globalStore.set(this.engineReadyAtom, false);
        globalStore.set(this.listeningAtom, false);
        globalStore.set(this.statusAtom, "idle");
    }

    async toggleListening(): Promise<void> {
        const api = getApi();
        if (api == null) return;

        const current = globalStore.get(this.listeningAtom);
        if (current) {
            api.audioStopListening?.();
            globalStore.set(this.listeningAtom, false);
            globalStore.set(this.statusAtom, "idle");
        } else {
            await this.startListening();
        }
    }

    setWakeWord(enabled: boolean): void {
        const api = getApi();
        api?.audioSetWakeWord?.(enabled);
        globalStore.set(this.wakeWordAtom, enabled);
    }

    speak(text: string): void {
        const api = getApi();
        api?.audioSpeak?.(text);
    }

    private handleTranscript(text: string): void {
        globalStore.set(this.transcriptAtom, text);
        const trimmedText = text.trim();
        if (!trimmedText || typeof window === "undefined") {
            return;
        }
        window.dispatchEvent(
            new CustomEvent("kronterm:voice-transcript", {
                detail: { text: trimmedText, mode: "submit" },
            })
        );
    }
}
