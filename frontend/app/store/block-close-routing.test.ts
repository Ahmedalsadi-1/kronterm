// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from "vitest";
import { routeBlockClose } from "./block-close-routing";

describe("routeBlockClose", () => {
    it("closes through the layout when the block has a layout node", () => {
        const closeLayoutNode = vi.fn();
        const closeOwnedNode = vi.fn();

        const route = routeBlockClose({ id: "layout-node" }, closeLayoutNode, closeOwnedNode);

        expect(route).toBe("layout");
        expect(closeLayoutNode).toHaveBeenCalledWith("layout-node");
        expect(closeOwnedNode).not.toHaveBeenCalled();
    });

    it("falls back to the owning node when the block is not in the layout", () => {
        const closeLayoutNode = vi.fn();
        const closeOwnedNode = vi.fn();

        const route = routeBlockClose(undefined, closeLayoutNode, closeOwnedNode);

        expect(route).toBe("owner");
        expect(closeLayoutNode).not.toHaveBeenCalled();
        expect(closeOwnedNode).toHaveBeenCalledOnce();
    });
});
