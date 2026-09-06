// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

const AdaptiveSplitAspectThreshold = 1.18;

type AdaptiveSplitDirection = "horizontal" | "vertical";

function getAdaptiveSplitDirection(width: number, height: number): AdaptiveSplitDirection {
    if (width <= 0 || height <= 0) {
        return "horizontal";
    }
    const aspectRatio = width / height;
    if (aspectRatio >= AdaptiveSplitAspectThreshold) {
        return "horizontal";
    }
    if (1 / aspectRatio >= AdaptiveSplitAspectThreshold) {
        return "vertical";
    }
    return width >= height ? "horizontal" : "vertical";
}

export { getAdaptiveSplitDirection, type AdaptiveSplitDirection };
