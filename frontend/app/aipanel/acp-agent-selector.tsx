import { useWaveEnv } from "@/app/waveenv/waveenv";
import { cn } from "@/util/util";
import { memo, useEffect, useState } from "react";

type AcpBackendInfo = {
    backend: string;
    name: string;
    cliPath: string;
    available: boolean;
};

type AcpAgentSelectorProps = {
    onSelect: (agent: AcpBackendInfo) => void;
    selectedBackend?: string;
    className?: string;
};

const backendIcons: Record<string, string> = {
    opencode: "🔓",
    claude: "🧠",
    codex: "⚡",
    gemini: "💎",
    kronoscode: "🚀",
    qwen: "🔮",
    custom: "🔧",
};

export const AcpAgentSelector = memo(({ onSelect, selectedBackend, className }: AcpAgentSelectorProps) => {
    const { electron } = useWaveEnv();
    const [agents, setAgents] = useState<AcpBackendInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const detected = await electron.acpDetectAgents();
                if (!cancelled) {
                    setAgents(detected);
                }
            } catch {
                if (!cancelled) {
                    setAgents([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [electron]);

    const selected = agents.find((a) => a.backend === selectedBackend);

    return (
        <div className={cn("relative", className)}>
            <button
                onClick={() => setOpen(!open)}
                className={cn(
                    "flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 cursor-pointer hover:bg-zinc-800 transition-colors",
                    open && "bg-zinc-800"
                )}
                title="Select ACP Agent"
            >
                <span className="text-sm">{selected ? (backendIcons[selected.backend] ?? "🤖") : "🤖"}</span>
                <span className="truncate max-w-[100px]">
                    {loading ? "Detecting..." : (selected?.name ?? "Select Agent")}
                </span>
                <i className={cn("fa fa-chevron-down text-[10px] transition-transform", open && "rotate-180")} />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden">
                        <div className="px-3 py-2 border-b border-zinc-800 text-[10px] uppercase tracking-wide text-zinc-500">
                            ACP Agents
                        </div>
                        <div className="max-h-[280px] overflow-y-auto">
                            {loading ? (
                                <div className="px-3 py-4 text-xs text-zinc-500 text-center">
                                    Detecting installed agents...
                                </div>
                            ) : agents.length === 0 ? (
                                <div className="px-3 py-4 text-xs text-zinc-500 text-center">No agents detected</div>
                            ) : (
                                agents.map((agent) => {
                                    const isSelected = agent.backend === selectedBackend;
                                    return (
                                        <button
                                            key={agent.backend}
                                            onClick={() => {
                                                onSelect(agent);
                                                setOpen(false);
                                            }}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-3 py-2.5 text-left text-xs transition-colors cursor-pointer",
                                                isSelected
                                                    ? "bg-accent/10 text-accent"
                                                    : "text-zinc-300 hover:bg-zinc-800",
                                                !agent.available && "opacity-50"
                                            )}
                                            disabled={!agent.available}
                                        >
                                            <span className="text-base">{backendIcons[agent.backend] ?? "🤖"}</span>
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium truncate">{agent.name}</div>
                                                <div className="text-[10px] text-zinc-500 truncate font-mono">
                                                    {agent.cliPath}
                                                </div>
                                            </div>
                                            <span
                                                className={cn(
                                                    "h-2 w-2 rounded-full shrink-0",
                                                    agent.available ? "bg-emerald-500" : "bg-zinc-600"
                                                )}
                                            />
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
});

AcpAgentSelector.displayName = "AcpAgentSelector";
