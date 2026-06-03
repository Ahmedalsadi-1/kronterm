import { motion } from "framer-motion";

const features = [
    {
        title: "Flexible Layouts",
        description:
            "Every block can be dragged, resized, and arranged into any configuration. Split horizontally, vertically, or create complex nested layouts.",
        items: [
            "Replace your tile manager",
            "Inline web views",
            "Command blocks",
            "One-click full-screen",
            "Layout presets",
        ],
    },
    {
        title: "Block System",
        description: "Replace your tile manager with a flexible block-based workspace that adapts to your flow.",
        items: ["Drag & drop blocks", "Split layouts", "Full-screen toggle"],
    },
    {
        title: "KronosCode AI Engine",
        description:
            "The AI reads your output, understands your workspace, and controls every block through native MCP tools.",
        items: ["Natural language control", "Automated commands", "Diff previews"],
    },
    {
        title: "Inline Browser Blocks",
        description: "Full browser blocks alongside your terminals. Navigate, interact, and preview in real-time.",
        items: ["Full browser support", "AI-controlled browsing", "Dev server preview"],
    },
    {
        title: "Agent Control Protocol",
        description:
            "Orchestrate multiple AI agents simultaneously with parallel execution, shared context, and granular permissions.",
        items: ["Multi-agent orchestration", "Agent communication", "Cost tracking"],
    },
    {
        title: "Team Collaboration",
        description:
            "Share blocks, layouts, and terminal sessions with your team. Real-time collaboration inside the terminal.",
        items: ["Workspace sharing", "Shared sessions", "RBAC", "E2E encryption"],
    },
];

export default function BentoFeatures() {
    return (
        <section
            style={{
                background: "var(--bg-secondary)",
                borderTop: "1px solid var(--border)",
                borderBottom: "1px solid var(--border)",
                padding: "var(--space-section) 24px",
            }}
        >
            <div style={{ maxWidth: "var(--content-max-width)", margin: "0 auto" }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{ marginBottom: "48px", maxWidth: "600px" }}
                >
                    <span className="warp-eyebrow">Features</span>
                    <h2
                        style={{
                            marginTop: "16px",
                            fontFamily: "var(--font-heading)",
                            fontSize: "clamp(2rem, 4.5vw, 4rem)",
                            fontWeight: 590,
                            letterSpacing: "-0.075em",
                            lineHeight: 0.98,
                        }}
                    >
                        A workspace, not a window manager.
                    </h2>
                    <p
                        style={{
                            color: "var(--text-secondary)",
                            fontSize: "15px",
                            lineHeight: 1.65,
                            marginTop: "16px",
                        }}
                    >
                        Drag, drop, resize, and arrange terminals, editors, web views, AI chats, and sandboxes into any
                        layout.
                    </p>
                </motion.div>

                <div className="warp-feature-grid">
                    {features.map((feature, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.06 }}
                            className="warp-feature-card"
                            style={{ gridColumn: i === 0 ? "span 2" : undefined }}
                        >
                            <h3>{feature.title}</h3>
                            <p style={{ marginTop: "8px" }}>{feature.description}</p>
                            <ul style={{ listStyle: "none", padding: 0, marginTop: "16px" }}>
                                {feature.items.map((item, j) => (
                                    <li
                                        key={j}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            padding: "4px 0",
                                            fontSize: "13px",
                                            color: "var(--text-tertiary)",
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: "4px",
                                                height: "4px",
                                                borderRadius: "50%",
                                                background: "var(--accent)",
                                                flexShrink: 0,
                                            }}
                                        />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
