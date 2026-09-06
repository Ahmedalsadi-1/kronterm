import { ChevronDown, Terminal } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

const heroTasks = {
    inProgress: [
        { title: "Build API Integration", meta: "Reading docs, analyzing endpoints" },
        { title: "Configure Sandbox Environment", meta: "Setting up isolation rules" },
        { title: "Optimize Query Performance", meta: "Analyzing bottleneck patterns" },
    ],
    readyForReview: [
        { title: "Refactor Auth Module", meta: "+48  −12  ·  15m" },
        { title: "Debug Test Suite", meta: "+132  −28  ·  22m" },
    ],
};

const tabs = ["Desktop", "CLI", "Sandbox"] as const;

const modelOptions = ["KronosCode runtime defaults", "KronosChamber desktop", "KronosCode repair mode"];

export function KrontermAgentHero() {
    const [activeTab, setActiveTab] = useState<string>("Desktop");
    const [modelOpen, setModelOpen] = useState(false);

    return (
        <section className="kronterm-agent-hero">
            <div className="agent-hero-inner">
                <div className="agent-hero-copy">
                    <p className="eyebrow">Kronterm + KronosCode</p>
                    <h1>
                        The AI-native workspace <span className="h1-soft">for builders.</span>
                    </h1>
                    <p className="hero-subtitle">
                        Kronterm combines your terminal, browser, editor, sandboxes, files, and AI agents into one
                        programmable desktop&nbsp;— with KronosCode and KronosChamber as the private-beta runtime.
                    </p>
                    <div className="cta-row">
                        <Link className="primary-button" to="/contact-sales">
                            Request private beta
                        </Link>
                        <Link className="ghost-button" to="/kronoscode">
                            Explore KronosCode
                        </Link>
                        <Link className="ghost-button" to="/contact-sales">
                            Request a demo
                        </Link>
                    </div>
                </div>

                <div className="agent-hero-panel">
                    {/* Title bar */}
                    <div className="agent-panel-titlebar">
                        <div className="titlebar-dots">
                            <span />
                            <span />
                            <span />
                        </div>
                        <span className="titlebar-label">Kronterm Workspace</span>
                        <span className="titlebar-badge">KronosCode 2.0</span>
                    </div>

                    {/* Tabs */}
                    <div className="agent-panel-tabs">
                        {tabs.map((tab) => (
                            <button
                                key={tab}
                                className={`agent-tab ${activeTab === tab ? "active" : ""}`}
                                onClick={() => setActiveTab(tab)}
                                type="button"
                            >
                                {tab === "Desktop" ? <Terminal size={13} aria-hidden="true" /> : null}
                                {tab}
                            </button>
                        ))}
                        <div className="agent-tab-spacer" />
                        <span className="agent-tab-url">localhost:5173</span>
                    </div>

                    {/* Tab content — only Desktop shown for now */}
                    {activeTab === "Desktop" ? (
                        <div className="agent-desktop-panel">
                            {/* Two-column task layout */}
                            <div className="agent-task-columns">
                                {/* In Progress */}
                                <div className="agent-task-col">
                                    <div className="agent-col-header">
                                        In Progress
                                        <span className="agent-count">{heroTasks.inProgress.length}</span>
                                    </div>
                                    {heroTasks.inProgress.map((task) => (
                                        <div className="agent-task-card" key={task.title}>
                                            <span className="task-status spinning">⟳</span>
                                            <div className="task-info">
                                                <strong>{task.title}</strong>
                                                <span className="task-meta">{task.meta}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Ready for Review */}
                                <div className="agent-task-col">
                                    <div className="agent-col-header">
                                        Ready for Review
                                        <span className="agent-count">{heroTasks.readyForReview.length}</span>
                                    </div>
                                    {heroTasks.readyForReview.map((task) => (
                                        <div className="agent-task-card agent-task-done" key={task.title}>
                                            <span className="task-status done">✓</span>
                                            <div className="task-info">
                                                <strong>{task.title}</strong>
                                                <span className="task-meta">{task.meta}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Agent summary bar */}
                            <div className="agent-summary-bar">
                                <div className="agent-summary-line">
                                    <span className="summary-icon">◆</span>
                                    <span>Explored 24 files, 6 searches</span>
                                </div>
                                <div className="agent-summary-line">
                                    <span className="summary-icon">◷</span>
                                    <span>Worked for 2m 34s</span>
                                </div>
                            </div>

                            {/* Prompt bar */}
                            <div className="agent-prompt-bar">
                                <div className="agent-prompt-left">
                                    <span className="prompt-arrow">→</span>
                                    <span className="prompt-text">Build API integration with sandbox isolation...</span>
                                </div>
                                <div className="agent-prompt-right">
                                    <div className="agent-model-select-wrapper">
                                        <button
                                            className="agent-model-select"
                                            onClick={() => setModelOpen(!modelOpen)}
                                            type="button"
                                        >
                                            KronosCode runtime
                                            <ChevronDown size={13} />
                                        </button>
                                        {modelOpen ? (
                                            <div className="agent-model-dropdown">
                                                {modelOptions.map((m) => (
                                                    <button
                                                        key={m}
                                                        className="agent-model-option"
                                                        onClick={() => setModelOpen(false)}
                                                        type="button"
                                                    >
                                                        {m}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                    <span className="prompt-hint">/ for commands · @ for files</span>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* CLI tab placeholder */}
                    {activeTab === "CLI" ? (
                        <div className="agent-cli-panel">
                            <div className="cli-line">
                                <span className="cli-prompt">$</span>
                                <span className="cli-text">kronoscode sandbox init --env node20</span>
                            </div>
                            <div className="cli-line cli-output">
                                <span>⟳ Initializing sandbox environment...</span>
                            </div>
                            <div className="cli-line cli-output">
                                <span>✓ Sandbox ready (node20, 4GB, linux/amd64)</span>
                            </div>
                            <div className="cli-line cli-output">
                                <span>◆ Configuring isolation rules...</span>
                            </div>
                            <div className="cli-line cli-cursor">
                                <span className="cli-prompt">$</span>
                                <span className="cli-blink">▊</span>
                            </div>
                        </div>
                    ) : null}

                    {/* Sandbox tab placeholder */}
                    {activeTab === "Sandbox" ? (
                        <div className="agent-cli-panel">
                            <div className="cli-line">
                                <span className="cli-prompt">◻</span>
                                <span className="cli-text">Sandbox Dashboard</span>
                            </div>
                            <div className="cli-line cli-output sandbox-stat">
                                <span>● Running · 2 containers</span>
                            </div>
                            <div className="cli-line cli-output sandbox-stat">
                                <span>▣ sandbox-node20 · healthy</span>
                            </div>
                            <div className="cli-line cli-output sandbox-stat">
                                <span>▣ sandbox-browser · healthy</span>
                            </div>
                            <div className="cli-line cli-output">
                                <span>◆ Agent task running: API integration build...</span>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
