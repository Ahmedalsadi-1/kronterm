import { motion } from "framer-motion";
import { Eye, Settings, Shield } from "lucide-react";

const trustCards = [
    {
        icon: Shield,
        title: "Your data, secure and private.",
        description:
            "KronTerm never stores your credentials or sends telemetry without consent. Your workspace data stays on your machine. Enterprise teams get SOC 2 compliance and zero-data-retention agreements.",
    },
    {
        icon: Settings,
        title: "Complete control of your agents.",
        description:
            "Control how much autonomy agents have, from approving each step to allowing more autonomous execution. Configure file access, command permissions, and MCP tool boundaries per agent.",
    },
    {
        icon: Eye,
        title: "Full transparency.",
        description:
            "Every action your agent takes is visible in real-time. Review high-level telemetry, monitor agent activity in the network log, and audit exactly what changed. Enterprise customers can export usage data through the Analytics API.",
    },
];

export default function TrustSection() {
    return (
        <section className="trust-section">
            <div style={{ maxWidth: "var(--content-max-width)", margin: "0 auto" }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{ marginBottom: "48px" }}
                >
                    <span className="warp-eyebrow">Security & Privacy</span>
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
                        Transparency and control
                        <br />
                        <span className="text-gradient">at every touchpoint.</span>
                    </h2>
                </motion.div>

                <div className="trust-grid">
                    {trustCards.map((card, i) => (
                        <motion.article
                            key={card.title}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.08 }}
                            className="trust-card"
                        >
                            <div className="trust-icon">
                                <card.icon size={20} />
                            </div>
                            <h3>{card.title}</h3>
                            <p>{card.description}</p>
                        </motion.article>
                    ))}
                </div>
            </div>
        </section>
    );
}
