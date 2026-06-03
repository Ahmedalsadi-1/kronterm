import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import NoiseOverlay from "@/components/NoiseOverlay";
import { motion } from "framer-motion";
import { ArrowRight, Code2, Download, ExternalLink, Terminal, Zap } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

const sidebarSections = [
    {
        title: "Getting Started",
        items: [
            { label: "Installation", id: "installation", active: true },
            { label: "Quick Start", id: "quick-start" },
            { label: "Configuration", id: "configuration" },
        ],
    },
    {
        title: "Core Concepts",
        items: [
            { label: "Workspace", id: "workspace" },
            { label: "Blocks", id: "blocks" },
            { label: "Terminal", id: "terminal" },
            { label: "Browser", id: "browser" },
        ],
    },
    {
        title: "KronosCode",
        items: [
            { label: "Overview", id: "kronoscode-overview" },
            { label: "MCP Tools", id: "mcp-tools" },
            { label: "Sandbox", id: "sandbox" },
            { label: "Desktop Control", id: "desktop-control" },
        ],
    },
    {
        title: "Advanced",
        items: [
            { label: "API Reference", id: "api-reference" },
            { label: "Extensions", id: "extensions" },
            { label: "Deployment", id: "deployment" },
        ],
    },
];

const steps = [
    {
        number: "01",
        title: "Install KronTerm",
        code: "brew install kronterm",
        description:
            "Install KronTerm using Homebrew on macOS, or download from the releases page for other platforms.",
    },
    {
        number: "02",
        title: "Launch the workspace",
        code: "kronterm",
        description:
            "Open KronTerm and create your first workspace. Add terminal blocks, browser previews, and file panels.",
    },
    {
        number: "03",
        title: "Connect KronosCode",
        code: "kronterm connect ai",
        description: "Enable the KronosCode AI agent to start reasoning across your workspace blocks.",
    },
];

export default function Docs() {
    const [activeSection, setActiveSection] = useState("installation");

    return (
        <div className="warp-page">
            <NoiseOverlay />
            <Nav />

            <div style={{ paddingTop: "var(--nav-height)" }}>
                <div className="docs-layout" style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 24px" }}>
                    {/* Sidebar */}
                    <aside className="docs-sidebar">
                        {sidebarSections.map((section) => (
                            <div key={section.title} className="docs-nav-group">
                                <h4>{section.title}</h4>
                                {section.items.map((item) => (
                                    <a
                                        key={item.id}
                                        href={`#${item.id}`}
                                        className={`docs-nav-link ${item.id === activeSection ? "is-active" : ""}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setActiveSection(item.id);
                                            document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
                                        }}
                                    >
                                        {item.label}
                                    </a>
                                ))}
                            </div>
                        ))}
                    </aside>

                    {/* Content */}
                    <main className="docs-content">
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            <span className="section-label">Documentation</span>
                            <h1>Get started with KronTerm</h1>
                            <p style={{ fontSize: "17px", color: "var(--text-secondary)", maxWidth: "600px" }}>
                                Everything you need to set up KronTerm, configure your workspace, and start using
                                KronosCode.
                            </p>
                        </motion.div>

                        {/* Installation */}
                        <section id="installation" style={{ marginTop: "48px" }}>
                            <h2>Installation</h2>
                            <p>
                                KronTerm is available for macOS, Linux, and Windows. Choose your preferred installation
                                method:
                            </p>

                            <div style={{ display: "grid", gap: "12px", marginTop: "20px" }}>
                                <div
                                    className="card-flat"
                                    style={{ display: "flex", alignItems: "center", gap: "16px" }}
                                >
                                    <div
                                        style={{
                                            width: "40px",
                                            height: "40px",
                                            borderRadius: "var(--radius-md)",
                                            background: "var(--accent-subtle)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Terminal size={18} style={{ color: "var(--accent)" }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: "14px" }}>Homebrew (macOS)</div>
                                        <div
                                            style={{
                                                fontFamily: "var(--font-mono)",
                                                fontSize: "13px",
                                                color: "var(--text-secondary)",
                                                marginTop: "2px",
                                            }}
                                        >
                                            brew install kronterm
                                        </div>
                                    </div>
                                    <button className="btn-ghost btn-sm">Copy</button>
                                </div>

                                <div
                                    className="card-flat"
                                    style={{ display: "flex", alignItems: "center", gap: "16px" }}
                                >
                                    <div
                                        style={{
                                            width: "40px",
                                            height: "40px",
                                            borderRadius: "var(--radius-md)",
                                            background: "var(--accent-subtle)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Download size={18} style={{ color: "var(--accent)" }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: "14px" }}>Direct Download</div>
                                        <div
                                            style={{
                                                fontFamily: "var(--font-mono)",
                                                fontSize: "13px",
                                                color: "var(--text-secondary)",
                                                marginTop: "2px",
                                            }}
                                        >
                                            Download from kronterm.dev/releases
                                        </div>
                                    </div>
                                    <a href="#" className="btn-ghost btn-sm">
                                        Download <ExternalLink size={12} />
                                    </a>
                                </div>

                                <div
                                    className="card-flat"
                                    style={{ display: "flex", alignItems: "center", gap: "16px" }}
                                >
                                    <div
                                        style={{
                                            width: "40px",
                                            height: "40px",
                                            borderRadius: "var(--radius-md)",
                                            background: "var(--accent-subtle)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Code2 size={18} style={{ color: "var(--accent)" }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: "14px" }}>Build from Source</div>
                                        <div
                                            style={{
                                                fontFamily: "var(--font-mono)",
                                                fontSize: "13px",
                                                color: "var(--text-secondary)",
                                                marginTop: "2px",
                                            }}
                                        >
                                            git clone && task build
                                        </div>
                                    </div>
                                    <button className="btn-ghost btn-sm">Copy</button>
                                </div>
                            </div>

                            <div className="docs-callout" style={{ marginTop: "20px" }}>
                                <Zap size={18} />
                                <div>
                                    <strong>System Requirements:</strong> macOS 13+, Ubuntu 22.04+, or Windows 11+ with
                                    WSL2. 8GB RAM recommended for sandbox features.
                                </div>
                            </div>
                        </section>

                        {/* Quick Start */}
                        <section id="quick-start" style={{ marginTop: "48px" }}>
                            <h2>Quick Start</h2>
                            <p>Get up and running in three steps:</p>

                            <div style={{ marginTop: "24px" }}>
                                {steps.map((step, i) => (
                                    <motion.div
                                        key={step.number}
                                        initial={{ opacity: 0, x: -16 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: i * 0.1 }}
                                        style={{
                                            display: "flex",
                                            gap: "20px",
                                            padding: "24px 0",
                                            borderBottom:
                                                i < steps.length - 1 ? "1px solid var(--border-subtle)" : "none",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: "32px",
                                                height: "32px",
                                                borderRadius: "50%",
                                                background: "var(--accent-subtle)",
                                                border: "1px solid var(--accent-glow)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontFamily: "var(--font-mono)",
                                                fontSize: "12px",
                                                color: "var(--accent)",
                                                flexShrink: 0,
                                            }}
                                        >
                                            {step.number}
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px" }}>
                                                {step.title}
                                            </h3>
                                            <p
                                                style={{
                                                    fontSize: "14px",
                                                    color: "var(--text-secondary)",
                                                    marginBottom: "12px",
                                                }}
                                            >
                                                {step.description}
                                            </p>
                                            <div
                                                className="code-block"
                                                style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
                                            >
                                                <span style={{ color: "var(--accent)" }}>$</span> {step.code}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </section>

                        {/* Configuration */}
                        <section id="configuration" style={{ marginTop: "48px" }}>
                            <h2>Configuration</h2>
                            <p>
                                KronTerm stores configuration in <code>~/.kronterm/settings.json</code>. You can also
                                edit settings from within the app.
                            </p>

                            <div
                                className="code-block"
                                style={{
                                    marginTop: "16px",
                                    fontFamily: "var(--font-mono)",
                                    fontSize: "13px",
                                    lineHeight: 1.7,
                                }}
                            >
                                <div>{"{"}</div>
                                <div>{'  "theme": "dark",'}</div>
                                <div>{'  "font": {'}</div>
                                <div>{'    "family": "Geist Variable",'}</div>
                                <div>{'    "size": 14'}</div>
                                <div>{"  },"}</div>
                                <div>{'  "kronoscode": {'}</div>
                                <div>{'    "enabled": true,'}</div>
                                <div>{'    "sandbox": "auto"'}</div>
                                <div>{"  }"}</div>
                                <div>{"}"}</div>
                            </div>
                        </section>

                        {/* Workspace */}
                        <section id="workspace" style={{ marginTop: "48px" }}>
                            <h2>Workspace</h2>
                            <p>
                                A workspace is a collection of blocks arranged in a layout. Each block can be a
                                terminal, browser preview, file panel, or AI chat.
                            </p>
                            <p>
                                Workspaces are saved automatically and persist between sessions. You can create multiple
                                workspaces for different projects.
                            </p>
                        </section>

                        {/* Blocks */}
                        <section id="blocks" style={{ marginTop: "48px" }}>
                            <h2>Blocks</h2>
                            <p>
                                Blocks are the building blocks of a workspace. Each block has a view type and maintains
                                its own state.
                            </p>
                            <ul style={{ paddingLeft: "20px", marginTop: "12px" }}>
                                <li>
                                    <strong>Terminal</strong> — Shell sessions with full scrollback
                                </li>
                                <li>
                                    <strong>Browser</strong> — Embedded web views with dev tools
                                </li>
                                <li>
                                    <strong>Preview</strong> — File previews and markdown rendering
                                </li>
                                <li>
                                    <strong>AI</strong> — KronosCode chat interface
                                </li>
                                <li>
                                    <strong>Files</strong> — File explorer and editor
                                </li>
                            </ul>
                        </section>

                        {/* KronosCode Overview */}
                        <section id="kronoscode-overview" style={{ marginTop: "48px" }}>
                            <h2>KronosCode Overview</h2>
                            <p>
                                KronosCode is the AI orchestration engine built into KronTerm. It can reason across your
                                workspace blocks, execute commands, and automate multi-step workflows.
                            </p>
                            <div className="docs-callout">
                                <Zap size={18} />
                                <div>
                                    KronosCode uses the Model Context Protocol (MCP) to interact with workspace blocks,
                                    making every action transparent and auditable.
                                </div>
                            </div>
                        </section>

                        {/* MCP Tools */}
                        <section id="mcp-tools" style={{ marginTop: "48px" }}>
                            <h2>MCP Tools</h2>
                            <p>
                                KronosCode connects to your workspace through MCP (Model Context Protocol) tools. These
                                tools give the agent visibility and control over your blocks.
                            </p>
                            <p>Key tool categories:</p>
                            <ul style={{ paddingLeft: "20px", marginTop: "12px" }}>
                                <li>
                                    <strong>Terminal tools</strong> — Execute commands, read output
                                </li>
                                <li>
                                    <strong>Browser tools</strong> — Navigate, click, fill forms
                                </li>
                                <li>
                                    <strong>File tools</strong> — Read, write, search files
                                </li>
                                <li>
                                    <strong>Desktop tools</strong> — Control native applications
                                </li>
                                <li>
                                    <strong>Sandbox tools</strong> — Manage isolated environments
                                </li>
                            </ul>
                        </section>

                        {/* Sandbox */}
                        <section id="sandbox" style={{ marginTop: "48px" }}>
                            <h2>Sandbox</h2>
                            <p>
                                Sandbox environments provide isolated workspaces for running agent tasks, testing
                                changes, and previewing results without affecting your main workspace.
                            </p>
                        </section>

                        {/* Desktop Control */}
                        <section id="desktop-control" style={{ marginTop: "48px" }}>
                            <h2>Desktop Control</h2>
                            <p>
                                KronTerm can control native desktop applications through the automation layer. This
                                enables KronosCode to interact with any app on your system.
                            </p>
                        </section>

                        {/* API Reference */}
                        <section id="api-reference" style={{ marginTop: "48px" }}>
                            <h2>API Reference</h2>
                            <p>KronTerm exposes a WebSocket RPC API for building integrations and extensions.</p>
                            <div
                                className="code-block"
                                style={{ marginTop: "16px", fontFamily: "var(--font-mono)", fontSize: "13px" }}
                            >
                                <div>
                                    <span style={{ color: "var(--text-tertiary)" }}>
                                        // Connect to the KronTerm API
                                    </span>
                                </div>
                                <div>const ws = new WebSocket('ws://localhost:3579/rpc')</div>
                                <div>
                                    ws.send({"{"} method: 'workspace.list' {"}"})
                                </div>
                            </div>
                        </section>

                        {/* Extensions */}
                        <section id="extensions" style={{ marginTop: "48px" }}>
                            <h2>Extensions</h2>
                            <p>
                                Extend KronTerm with custom blocks, MCP tools, and integrations. The extension API
                                supports both Go and TypeScript.
                            </p>
                        </section>

                        {/* Deployment */}
                        <section id="deployment" style={{ marginTop: "48px" }}>
                            <h2>Deployment</h2>
                            <p>
                                Enterprise teams can deploy KronTerm with centralized configuration, shared workspaces,
                                and access controls.
                            </p>
                            <div style={{ marginTop: "20px" }}>
                                <a href="mailto:sales@kronterm.dev" className="btn-secondary">
                                    Contact sales for enterprise deployment <ArrowRight size={14} />
                                </a>
                            </div>
                        </section>

                        {/* Next Steps */}
                        <div
                            style={{
                                marginTop: "64px",
                                padding: "32px",
                                borderRadius: "var(--radius-xl)",
                                background: "var(--bg-secondary)",
                                border: "1px solid var(--border-subtle)",
                            }}
                        >
                            <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>Next steps</h3>
                            <p style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>
                                Ready to dive deeper?
                            </p>
                            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                                <Link to="/changelog" className="btn-primary btn-sm">
                                    View changelog <ArrowRight size={13} />
                                </Link>
                                <a href="/#pricing" className="btn-secondary btn-sm">
                                    Get KronTerm
                                </a>
                            </div>
                        </div>
                    </main>
                </div>
            </div>

            <Footer />
        </div>
    );
}
