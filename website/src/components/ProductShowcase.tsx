import { motion } from "framer-motion";
import { ArrowUpRight, Check } from "lucide-react";

const showcases = [
    {
        number: "01",
        eyebrow: "Unified Workspace",
        title: "Your entire dev loop, arranged on one canvas.",
        description:
            "Terminals, browser previews, sandbox desktops, memory graphs, and file explorers stay visible together. Build a workspace around the task instead of switching between isolated apps.",
        items: [
            "Multi-block layouts",
            "Inline browser previews",
            "Sandbox desktop streaming",
            "Real-time system metrics",
        ],
        image: "/assets/kronterm-homepage.png",
        caption: "kronterm // workspace_alpha",
    },
    {
        number: "02",
        eyebrow: "KronosCode AI",
        title: "An agent that can see the work and move it forward.",
        description:
            "KronosCode reads terminal output, coordinates tools through MCP, and operates the desktop workspace. Every step stays visible so you can inspect the result instead of trusting a black box.",
        items: [
            "Terminal-aware reasoning",
            "Native MCP tool control",
            "Multi-agent orchestration",
            "Reviewable actions",
        ],
        image: "/assets/kronterm-sidepanel.png",
        caption: "kronoscode // ai-panel",
        reverse: true,
    },
    {
        number: "03",
        eyebrow: "Sandbox Desktop",
        title: "Delegate complex work without cluttering your machine.",
        description:
            "Launch isolated Linux desktop environments for agent tasks, previews, and risky changes. KronTerm keeps the environment, output, and browser surface together in a workspace you can understand.",
        items: [
            "Isolated Linux VMs",
            "Desktop app streaming",
            "Visible execution state",
            "Reusable automation routines",
        ],
        image: "/assets/kronterm-sandbox-screenshot.png",
        caption: "sandbox // isolated-desktop",
    },
    {
        number: "04",
        eyebrow: "Agent Chat",
        title: "Natural language control over your entire workspace.",
        description:
            "Talk to KronosCode and multiple ACP agents from one chat interface. Explain this codebase, fix failing workflows, review changes, or implement features — all from natural language.",
        items: ["Multi-agent chat", "Codebase understanding", "Workflow debugging", "Feature implementation"],
        image: "/assets/kronterm-chamber-chat.png",
        caption: "chat // kronoscode-agents",
        reverse: true,
    },
    {
        number: "05",
        eyebrow: "Settings & MCP",
        title: "Configure everything from one powerful settings panel.",
        description:
            "Manage agents, skills, MCP servers, and AI providers from a unified settings interface. Customize chat defaults, workspace behavior, and external integrations.",
        items: ["Agent configuration", "MCP server management", "Skills & providers", "Workspace defaults"],
        image: "/assets/kronterm-chamber-settings.png",
        caption: "settings // mcp-providers",
    },
];

export default function ProductShowcase() {
    return (
        <section style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
            {showcases.map((showcase, index) => (
                <article key={showcase.number} className="showcase-section">
                    <div className={`showcase-grid ${showcase.reverse ? "reverse" : ""}`}>
                        <motion.div
                            initial={{ opacity: 0, x: showcase.reverse ? 24 : -24 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5 }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                                <span className="showcase-number">{showcase.number}</span>
                                <span className="showcase-label">{showcase.eyebrow}</span>
                            </div>
                            <h2 className="showcase-title">{showcase.title}</h2>
                            <p className="showcase-desc">{showcase.description}</p>
                            <ul className="showcase-features">
                                {showcase.items.map((item) => (
                                    <li key={item}>
                                        <span className="check">
                                            <Check size={10} />
                                        </span>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <a
                                href={index === 1 ? "/agents" : "/features"}
                                className="warp-secondary-button"
                                style={{ marginTop: "8px" }}
                            >
                                Explore <ArrowUpRight size={13} />
                            </a>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.97 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1, duration: 0.5 }}
                        >
                            <div className="screenshot-card">
                                <div className="screenshot-bar">
                                    <div className="warp-window-dots">
                                        <i />
                                        <i />
                                        <i />
                                    </div>
                                    <span>{showcase.caption}</span>
                                    <span className="warp-live">● live</span>
                                </div>
                                <img src={showcase.image} alt={showcase.title} loading="lazy" />
                            </div>
                        </motion.div>
                    </div>
                </article>
            ))}
        </section>
    );
}
