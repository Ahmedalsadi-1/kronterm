import { cn } from "@/util/util";
import { memo } from "react";

type AcpToolConfirmation = {
    id: string;
    callId: string;
    title: string;
    options: Array<{ optionId: string; name: string; kind: string }>;
    toolCall?: unknown;
};

type AcpToolApprovalProps = {
    confirmations: AcpToolConfirmation[];
    onConfirm: (callId: string, optionId: string) => void;
    className?: string;
};

const kindIcons: Record<string, string> = {
    allow_once: "fa-check",
    allow_always: "fa-unlock",
    reject_once: "fa-pause",
    reject_always: "fa-ban",
};

const kindColors: Record<string, string> = {
    allow_once: "border-[#414324] bg-[#242519] text-[#b1b955] hover:bg-[#30321e]",
    allow_always: "border-[#303a40] bg-[#171e22] text-[#91aab7] hover:bg-[#202a30]",
    reject_once: "border-[#302f2d] bg-[#181817] text-[#aba69e] hover:bg-[#242321]",
    reject_always: "border-[#522c29] bg-[#211716] text-[#dc7668] hover:bg-[#30201d]",
};

export const AcpToolApproval = memo(({ confirmations, onConfirm, className }: AcpToolApprovalProps) => {
    if (confirmations.length === 0) return null;

    return (
        <div className={cn("mx-auto w-full max-w-3xl space-y-2 px-4 py-2 @lg:px-6", className)}>
            {confirmations.map((confirmation) => (
                <div
                    key={confirmation.id}
                    className="rounded-lg border border-[#42362a] bg-[#181716] p-4 shadow-sm shadow-black/20"
                >
                    <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#42362a] bg-[#231d19] text-base">
                            <i className="fa fa-shield-halved text-[#b39355]" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-[#ddd9d2]">{confirmation.title}</div>
                            {confirmation.toolCall ? (
                                <pre className="mt-2 max-h-[92px] overflow-auto rounded-md border border-[#292827] bg-[#101010] p-3 font-mono text-[10px] text-[#98938c]">
                                    {JSON.stringify(confirmation.toolCall, null, 2)}
                                </pre>
                            ) : null}
                            <div className="mt-2 flex flex-wrap gap-2">
                                {confirmation.options.map((option) => (
                                    <button
                                        key={option.optionId}
                                        onClick={() => onConfirm(confirmation.callId, option.optionId)}
                                        className={cn(
                                            "flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                                            kindColors[option.kind] ?? kindColors.reject_once
                                        )}
                                    >
                                        <i
                                            className={cn(
                                                "fa text-[11px]",
                                                kindIcons[option.kind] ?? "fa-circle-question"
                                            )}
                                        />
                                        <span>{option.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
});

AcpToolApproval.displayName = "AcpToolApproval";
