import { useWaveEnv } from "@/app/waveenv/waveenv";
import { cn } from "@/util/util";
import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import ReactDOM from "react-dom";

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
    hermes: "✦",
    kronoscode: "🚀",
    qwen: "🔮",
    custom: "🔧",
};

export const AcpAgentSelector = memo(({ onSelect, selectedBackend, className }: AcpAgentSelectorProps) => {
    const { electron } = useWaveEnv();
    const [agents, setAgents] = useState<AcpBackendInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [popupStyle, setPopupStyle] = useState<CSSProperties>({});

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
    const toggleOpen = () => {
        setOpen((visible) => {
            if (!visible && buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                setPopupStyle({
                    position: "fixed",
                    right: Math.max(16, window.innerWidth - rect.right),
                    top: rect.bottom + 8,
                });
            }
            return !visible;
        });
    };

    return (
        <div className={cn("relative", className)}>
            <button
                ref={buttonRef}
                onClick={toggleOpen}
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

            {open
                ? ReactDOM.createPortal(
                      <>
                          <button
                              type="button"
                              className="fixed inset-0 z-40 cursor-default bg-black/20"
                              onClick={() => setOpen(false)}
                              aria-label="Close ACP agent selector"
                          />
                          <div
                              className="z-50 flex max-h-[500px] w-[min(460px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-3 shadow-2xl shadow-black/70"
                              style={popupStyle}
                          >
                              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                                  <div>
                                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                                          ACP agents
                                      </div>
                                      <div className="mt-1 max-w-[300px] truncate text-xs text-zinc-300">
                                          {selected?.name ?? "Select an installed runtime"}
                                      </div>
                                  </div>
                                  <div className="shrink-0 rounded border border-zinc-800 px-2 py-1 text-[10px] text-zinc-500">
                                      {agents.filter((agent) => agent.available).length}/{agents.length} installed
                                  </div>
                              </div>
                              <div className="min-h-0 overflow-y-auto pr-1">
                                  {loading ? (
                                      <div className="px-3 py-10 text-center text-sm text-zinc-500">
                                          Detecting installed agents...
                                      </div>
                                  ) : agents.length === 0 ? (
                                      <div className="px-3 py-10 text-center text-sm text-zinc-500">
                                          No agents detected
                                      </div>
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
                                                      "mb-1 flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors last:mb-0 disabled:opacity-45",
                                                      isSelected
                                                          ? "bg-accent/10 text-accent"
                                                          : "text-zinc-300 hover:bg-zinc-800"
                                                  )}
                                                  disabled={!agent.available}
                                              >
                                                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-base">
                                                      {backendIcons[agent.backend] ?? "🤖"}
                                                  </span>
                                                  <div className="min-w-0 flex-1">
                                                      <div className="truncate text-sm font-medium">{agent.name}</div>
                                                      <div className="mt-1 truncate font-mono text-[10px] text-zinc-500">
                                                          {agent.cliPath}
                                                      </div>
                                                  </div>
                                                  <span
                                                      className={cn(
                                                          "h-2.5 w-2.5 shrink-0 rounded-full",
                                                          agent.available ? "bg-emerald-500" : "bg-zinc-600"
                                                      )}
                                                  />
                                              </button>
                                          );
                                      })
                                  )}
                              </div>
                          </div>
                      </>,
                      document.body
                  )
                : null}
        </div>
    );
});

AcpAgentSelector.displayName = "AcpAgentSelector";
