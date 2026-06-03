import { motion } from "framer-motion";
import { Settings, Shield, Users, Zap } from "lucide-react";

const stats = [
    { value: "800,000+", label: "developers use KronTerm monthly", icon: Users },
    { value: "#1", label: "terminal-bench ranked agent", icon: Zap },
    { value: "60%", label: "of PRs merged by agents internally", icon: Settings },
    { value: "3+", label: "platforms (macOS, Linux, Windows)", icon: Shield },
];

export default function StatsRow() {
    return (
        <section className="stats-row-section">
            <div style={{ maxWidth: "var(--content-max-width)", margin: "0 auto" }}>
                <div className="stats-row-grid">
                    {stats.map((stat, i) => (
                        <motion.article
                            key={stat.label}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.08 }}
                            className="stat-card"
                        >
                            <span className="stat-value">{stat.value}</span>
                            <span className="stat-label">{stat.label}</span>
                        </motion.article>
                    ))}
                </div>
            </div>
        </section>
    );
}
