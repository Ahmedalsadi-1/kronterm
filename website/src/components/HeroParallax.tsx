import AnimatedGridBackground from "@/components/AnimatedGridBackground";
import TerminalMockup from "@/components/TerminalMockup";
import { Backlight } from "@/components/ui/backlight";
import { motion } from "framer-motion";

const steps = [
    ["01", "Read workspace", "12 blocks indexed"],
    ["02", "Run dev loop", "terminal + browser"],
    ["03", "Inspect result", "preview verified"],
    ["04", "Apply patch", "ready for review"],
];

export default function HeroParallax() {
    return (
        <section className="relative overflow-hidden pt-[calc(var(--nav-height)+76px)] pb-20 lg:pb-28">
            <AnimatedGridBackground className="absolute inset-0" />
            <div className="absolute inset-0 bg-grid pointer-events-none" />
            <div className="hero-beam absolute inset-0 pointer-events-none" />
            <div className="absolute left-[-18%] top-[-14%] h-[560px] w-[560px] rounded-full bg-[var(--accent)]/10 blur-[140px]" />
            <div className="absolute right-[-10%] top-[18%] h-[440px] w-[440px] rounded-full bg-[var(--amber)]/8 blur-[140px]" />

            <div className="relative z-10 mx-auto px-6" style={{ maxWidth: "var(--content-max-width)" }}>
                <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55 }}
                    className="mb-12 max-w-[930px]"
                >
                    <div className="mb-7 flex flex-wrap items-center gap-3">
                        <span className="section-label inline-flex items-center gap-2 rounded-full border border-[var(--border-glow)] bg-[var(--accent-subtle)] px-3 py-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)] animate-pulse-soft" />
                            KronosCode online
                        </span>
                        <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] min-[440px]:inline">
                            Desktop orchestration engine
                        </span>
                    </div>

                    <h1 className="max-w-[900px] text-[clamp(2.9rem,8vw,7.2rem)] font-display font-semibold leading-[0.94] tracking-[-0.075em]">
                        Your desktop.
                        <br />
                        <span className="text-gradient">One command away.</span>
                    </h1>

                    <div className="mt-8 grid max-w-[900px] gap-7 md:grid-cols-[1fr_auto] md:items-end">
                        <p className="max-w-[650px] text-[clamp(1rem,2vw,1.3rem)] leading-relaxed text-[var(--text-secondary)]">
                            KronTerm is an AI-native command center for your entire workflow. KronosCode can reason
                            across terminals, browser blocks, sandboxes, files, and desktop apps, then automate the work
                            from one focused workspace.
                        </p>
                        <div className="flex flex-wrap gap-3 md:justify-end">
                            <a href="/#pricing" className="primary-button">
                                Choose your plan
                                <span>→</span>
                            </a>
                            <a href="/features" className="secondary-button">
                                Explore platform
                                <span>↗</span>
                            </a>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 34 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18, duration: 0.7 }}
                    className="command-shell backlight-frame"
                >
                    <div className="command-shell-bar">
                        <div className="flex items-center gap-1.5">
                            <span className="window-dot bg-[#ff6b5f]" />
                            <span className="window-dot bg-[#f7c64b]" />
                            <span className="window-dot bg-[#48c774]" />
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                            kronterm // workspace_alpha
                        </span>
                        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--accent)]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                            live
                        </span>
                    </div>

                    <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.72fr)]">
                        <div className="relative min-h-[300px] min-w-0 overflow-hidden border-b border-[var(--border)] sm:min-h-[390px] lg:border-b-0 lg:border-r">
                            <Backlight className="backlight-wrap absolute inset-0" blur={8}>
                                <div className="h-full w-full p-4">
                                    <TerminalMockup
                                        lines={[
                                            "$ kronterm",
                                            "› Initializing workspace...",
                                            "✓ 12 blocks ready",
                                            "✓ Terminal integrated",
                                            "✓ Browser preview active",
                                            "✓ KronosCode connected",
                                            "$ git status",
                                            "On branch main",
                                            "Your branch is up to date.",
                                            "nothing to commit, working tree clean",
                                        ]}
                                        accentLine={1}
                                        className="h-full"
                                    />
                                </div>
                            </Backlight>
                            <div className="absolute inset-0 bg-gradient-to-t from-[#090b0b] via-transparent to-[#090b0b]/20" />
                            <div className="absolute bottom-5 left-5 right-5 rounded-xl border border-white/10 bg-black/70 p-4 shadow-2xl backdrop-blur-xl">
                                <div className="mb-3 flex items-center gap-2 font-mono text-[11px] text-[var(--text-tertiary)]">
                                    <span className="text-[var(--accent)]">kronoscode@workspace</span>
                                    <span>~/kronterm</span>
                                </div>
                                <p className="font-mono text-xs leading-6 text-[var(--text-secondary)]">
                                    <span className="text-[var(--accent)]">›</span> Launch the app, run the dev server,
                                    open the preview, and verify the latest changes.
                                </p>
                                <p className="mt-1 font-mono text-xs text-[var(--accent-light)]">
                                    ✓ Workflow active across 4 workspace blocks
                                </p>
                            </div>
                        </div>

                        <div className="bg-[#0d1010]/95 p-5">
                            <div className="mb-5 flex items-center justify-between">
                                <div>
                                    <span className="section-label">KronosCode run</span>
                                    <h2 className="mt-1 font-display text-lg font-semibold tracking-[-0.03em]">
                                        Automate the whole loop
                                    </h2>
                                </div>
                                <span className="rounded-full border border-[var(--border-glow)] bg-[var(--accent-subtle)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--accent)]">
                                    Running
                                </span>
                            </div>
                            <div className="space-y-2">
                                {steps.map(([number, title, detail], index) => (
                                    <motion.div
                                        key={number}
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.5 + index * 0.12 }}
                                        className="group flex items-center gap-3 rounded-xl border border-white/[0.055] bg-white/[0.025] p-3 transition-colors hover:border-[var(--border-glow)] hover:bg-[var(--accent-subtle)]"
                                    >
                                        <span className="font-mono text-[10px] text-[var(--accent)]">{number}</span>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-medium text-[var(--text-primary)]">
                                                {title}
                                            </div>
                                            <div className="font-mono text-[10px] text-[var(--text-tertiary)]">
                                                {detail}
                                            </div>
                                        </div>
                                        <span className="text-xs text-[var(--accent)]">✓</span>
                                    </motion.div>
                                ))}
                            </div>
                            <div className="mt-5 border-t border-[var(--border)] pt-4 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                                Agent tools <span className="float-right text-[var(--accent)]">MCP connected</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
