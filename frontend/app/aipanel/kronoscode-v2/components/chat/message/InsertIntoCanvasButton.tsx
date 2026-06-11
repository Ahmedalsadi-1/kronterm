import React, { useState, useCallback } from 'react';
import { useAtomValue } from "jotai";
import { atoms } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { cn } from "@/util/util";
import { RiLayoutMasonryLine, RiCheckLine, RiErrorWarningLine, RiLoader4Line } from '@remixicon/react';

interface InsertIntoCanvasButtonProps {
    canvasBlockId?: string;
    content: string;
    title: string;
}

const InsertIntoCanvasButton: React.FC<InsertIntoCanvasButtonProps> = ({ canvasBlockId, content, title }) => {
    const workspaceId = useAtomValue(atoms.workspaceId);
    const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    
    const insert = useCallback(async () => {
        if (!canvasBlockId || !content.trim()) {
            return;
        }
        setState("saving");
        try {
            const nodeId = `chat-${Date.now()}`;
            await RpcApi.CanvasCreateNodeCommand(TabRpcClient, {
                workspaceid: workspaceId,
                blockid: canvasBlockId,
                node: {
                    id: nodeId,
                    shapeid: nodeId,
                    type: "text",
                    title,
                    content,
                    status: "inserted",
                } as any,
            });
            setState("saved");
            window.setTimeout(() => setState("idle"), 1600);
        } catch (e) {
            console.error("failed to insert message into canvas", e);
            setState("error");
        }
    }, [canvasBlockId, content, title, workspaceId]);

    if (!canvasBlockId || !content.trim()) {
        return null;
    }

    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                void insert();
            }}
            className="mt-1.5 cursor-pointer rounded-lg border border-white/5 bg-white/5 px-2 py-1 text-[10px] text-white/50 opacity-0 transition-all hover:text-white hover:bg-white/10 group-hover:opacity-100 flex items-center gap-1.5"
            title="Insert into Canvas"
        >
            {state === "saving" ? (
                <RiLoader4Line className="h-3 w-3 animate-spin" />
            ) : state === "saved" ? (
                <RiCheckLine className="h-3 w-3 text-emerald-400" />
            ) : state === "error" ? (
                <RiErrorWarningLine className="h-3 w-3 text-rose-400" />
            ) : (
                <RiLayoutMasonryLine className="h-3 w-3" />
            )}
            <span>{state === "saving" ? "Inserting" : state === "saved" ? "Inserted" : "Insert into Canvas"}</span>
        </button>
    );
};

export default React.memo(InsertIntoCanvasButton);
