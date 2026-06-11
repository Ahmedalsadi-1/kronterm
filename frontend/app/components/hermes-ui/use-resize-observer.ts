// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, type RefObject } from "react";

export function useResizeObserver(callback: () => void, ref: RefObject<Element | null>) {
    useEffect(() => {
        const element = ref.current;
        if (element == null) {
            return;
        }
        callback();
        const observer = new ResizeObserver(callback);
        observer.observe(element);
        return () => observer.disconnect();
    }, [callback, ref]);
}
