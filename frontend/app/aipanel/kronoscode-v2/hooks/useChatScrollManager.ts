// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from "react";
import type { WaveUIMessage } from "@/app/aipanel/aitypes";
import { globalStore } from "@/app/store/jotaiStore";
import { WaveAIModel } from "@/app/aipanel/waveai-model";

interface UseChatScrollManagerOptions {
    currentSessionId: string | null;
    sessionMessages: Array<{ info: { id: string; role: string }; parts: WaveUIMessage["parts"] }>;
    streamingMessageId: string | null;
    sessionMemoryState: { hasMoreAbove?: boolean; historyComplete?: boolean } | null;
    updateViewportAnchor: (anchor: { messageId: string; offset: number }) => void;
    isSyncing: boolean;
    isMobile: boolean;
    messageStreamStates: Map<string, { status: string }>;
    sessionPermissions: unknown[];
    trimToViewportWindow: () => void;
}

interface UseChatScrollManagerReturn {
    scrollRef: React.RefObject<HTMLDivElement>;
    handleMessageContentChange: (messageId: string, heightDelta: number) => void;
    getAnimationHandlers: () => {
        onEnter: () => void;
        onExit: () => void;
    };
    showScrollButton: boolean;
    scrollToBottom: (options?: { instant?: boolean; force?: boolean }) => void;
    scrollToPosition: (position: number, options?: { instant?: boolean }) => void;
    isPinned: boolean;
}

const SCROLL_THRESHOLD = 100;
const SCROLL_BUTTON_THRESHOLD = 200;

export function useChatScrollManager(
    options: UseChatScrollManagerOptions
): UseChatScrollManagerReturn {
    const {
        currentSessionId,
        sessionMessages,
        streamingMessageId,
        sessionMemoryState,
        updateViewportAnchor,
        isSyncing,
        isMobile,
        messageStreamStates,
        sessionPermissions,
        trimToViewportWindow,
    } = options;

    const scrollRef = useRef<HTMLDivElement>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [isPinned, setIsPinned] = useState(true);
    const animationFrameRef = useRef<number | null>(null);
    const lastScrollTopRef = useRef(0);
    const isScrollingRef = useRef(false);

    const container = scrollRef.current;

    const scrollToBottom = useCallback(
        (opts?: { instant?: boolean; force?: boolean }) => {
            const el = scrollRef.current;
            if (!el) return;

            const { instant = false, force = false } = opts ?? {};
            const targetScrollTop = el.scrollHeight - el.clientHeight;

            if (instant || force) {
                el.scrollTop = targetScrollTop;
                setIsPinned(true);
                setShowScrollButton(false);
                return;
            }

            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }

            const animate = () => {
                const current = el.scrollTop;
                const distance = targetScrollTop - current;
                if (Math.abs(distance) < 1) {
                    el.scrollTop = targetScrollTop;
                    setIsPinned(true);
                    setShowScrollButton(false);
                    return;
                }
                el.scrollTop = current + distance * 0.3;
                animationFrameRef.current = requestAnimationFrame(animate);
            };
            animate();
        },
        []
    );

    const scrollToPosition = useCallback(
        (position: number, opts?: { instant?: boolean }) => {
            const el = scrollRef.current;
            if (!el) return;
            if (opts?.instant) {
                el.scrollTop = position;
            } else {
                el.scrollTop = position;
            }
        },
        []
    );

    const handleMessageContentChange = useCallback(
        (messageId: string, heightDelta: number) => {
            const el = scrollRef.current;
            if (!el || isPinned) return;

            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }

            animationFrameRef.current = requestAnimationFrame(() => {
                el.scrollTop += heightDelta;
            });
        },
        [isPinned]
    );

    const getAnimationHandlers = useCallback(() => {
        return {
            onEnter: () => {},
            onExit: () => {},
        };
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const handleScroll = () => {
            if (isScrollingRef.current) return;
            isScrollingRef.current = true;

            const scrollTop = el.scrollTop;
            const scrollHeight = el.scrollHeight;
            const clientHeight = el.clientHeight;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

            const wasPinned = isPinned;
            const nowPinned = distanceFromBottom <= SCROLL_THRESHOLD;
            if (wasPinned !== nowPinned) {
                setIsPinned(nowPinned);
            }

            const shouldShowButton = distanceFromBottom > SCROLL_BUTTON_THRESHOLD && sessionMessages.length > 0;
            setShowScrollButton(shouldShowButton);

            lastScrollTopRef.current = scrollTop;
            isScrollingRef.current = false;
        };

        el.addEventListener("scroll", handleScroll, { passive: true });
        return () => el.removeEventListener("scroll", handleScroll);
    }, [isPinned, sessionMessages.length]);

    useEffect(() => {
        if (!currentSessionId) return;
        if (streamingMessageId && isPinned) {
            scrollToBottom({ force: true });
        }
    }, [streamingMessageId, isPinned, currentSessionId, scrollToBottom]);

    useEffect(() => {
        if (!isSyncing && isPinned) {
            scrollToBottom({ force: true });
        }
    }, [isSyncing, isPinned, scrollToBottom]);

    return {
        scrollRef,
        handleMessageContentChange,
        getAnimationHandlers,
        showScrollButton,
        scrollToBottom,
        scrollToPosition,
        isPinned,
    };
}