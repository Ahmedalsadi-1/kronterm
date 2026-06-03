import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";

const plans = [
    {
        name: "KronTerm Pro",
        price: "$24",
        audience: "For individual builders",
        features: ["KronosCode desktop agent", "Unlimited local workspaces", "Browser and sandbox automation"],
        featured: false,
    },
    {
        name: "KronTerm Teams",
        price: "$49",
        audience: "For product teams",
        features: ["Everything in Pro", "Shared workspace automations", "Priority onboarding and support"],
        featured: true,
    },
];

export default function ActionCard() {
    return (
        <section
            id="pricing"
            className="section"
            style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--bg-secondary)" }}
        >
            <div style={{ maxWidth: "var(--content-max-width)", margin: "0 auto", padding: "0 24px" }}>
                <div style={{ marginBottom: "40px" }}>
                    <span className="section-label">Choose your command center</span>
                    <h2 className="section-title" style={{ marginTop: "12px" }}>
                        Put your desktop
                        <br />
                        <span className="text-gradient">under one command.</span>
                    </h2>
                    <p className="section-subtitle" style={{ marginTop: "16px" }}>
                        Start with the edition built for your workload. Every plan includes the KronTerm desktop
                        workspace and KronosCode orchestration engine.
                    </p>
                </div>

                <div className="pricing-grid">
                    {plans.map((plan, i) => (
                        <motion.article
                            key={plan.name}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.08 }}
                            className={`pricing-card ${plan.featured ? "featured" : ""}`}
                        >
                            <span className="section-label">{plan.audience}</span>
                            <h3
                                style={{
                                    fontSize: "22px",
                                    fontWeight: 600,
                                    marginTop: "16px",
                                    letterSpacing: "-0.03em",
                                }}
                            >
                                {plan.name}
                            </h3>
                            <div style={{ marginTop: "16px", display: "flex", alignItems: "baseline", gap: "4px" }}>
                                <span className="price">{plan.price}</span>
                                <span className="period">/ month</span>
                            </div>
                            <ul className="features-list">
                                {plan.features.map((feature) => (
                                    <li key={feature}>
                                        <Check />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                            <a
                                href="#contact"
                                className={plan.featured ? "btn-primary" : "btn-secondary"}
                                style={{ justifyContent: "center" }}
                            >
                                {plan.featured ? "Start with Teams" : "Start with Pro"} <ArrowRight size={14} />
                            </a>
                        </motion.article>
                    ))}

                    <motion.article
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.16 }}
                        className="pricing-card"
                        style={{ background: "var(--accent-subtle)", borderColor: "var(--accent-glow)" }}
                    >
                        <span className="section-label">Private deployment</span>
                        <h3 style={{ fontSize: "22px", fontWeight: 600, marginTop: "16px", letterSpacing: "-0.03em" }}>
                            Enterprise
                        </h3>
                        <p
                            style={{
                                color: "var(--text-secondary)",
                                fontSize: "14px",
                                lineHeight: 1.6,
                                marginTop: "16px",
                                flex: 1,
                            }}
                        >
                            Deploy KronTerm around your security model with onboarding, access controls, and a rollout
                            plan for your organization.
                        </p>
                        <a
                            href="#contact"
                            className="btn-secondary"
                            style={{ justifyContent: "center", marginTop: "24px" }}
                        >
                            Contact us <ArrowRight size={14} />
                        </a>
                    </motion.article>
                </div>
            </div>
        </section>
    );
}
