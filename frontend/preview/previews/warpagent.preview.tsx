// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { WarpAgentView } from "@/app/view/warpagent/warpagent";
import { useEffect, useState } from "react";

export default function WarpAgentPreview() {
    const [height, setHeight] = useState(720);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setHeight(720);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
            <div className="mb-4 flex items-center gap-4">
                <span className="text-[12px] text-secondary">Warp Agent widget preview</span>
                <label className="flex items-center gap-2 text-[12px] text-secondary">
                    Height
                    <input
                        type="range"
                        min={320}
                        max={900}
                        value={height}
                        onChange={(e) => setHeight(Number(e.target.value))}
                    />
                </label>
            </div>
            <div
                className="w-full max-w-[760px] overflow-hidden rounded-xl border border-border"
                style={{ height }}
            >
                <WarpAgentView />
            </div>
        </div>
    );
}