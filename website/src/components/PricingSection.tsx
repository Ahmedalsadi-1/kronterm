import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";

type BillingPeriod = "monthly" | "annual";

const plans = [
    {
        name: "Free",
        price: { monthly: "$0", annual: "$0" },
        audience: "For individual developers exploring KronTerm",
        features: [
            "KronTerm desktop workspace",
            "Limited KronosCode agent access",
            "Basic browser and sandbox blocks",
            "Community support",
        ],
        featured: false,
        cta: "Download Now",
        href: "#pricing",
    },
    {
        name: "Pro",
        price: { monthly: "$24", annual: "$19" },
        audience: "For builders shipping with AI",
        features: [
            "Unlimited KronosCode sessions",
            "Full agent model access (Claude, GPT, Gemini)",
            "Priority sandbox & browser automation",
            "Unlimited workspace blocks",
            "Private email support",
        ],
        featured: true,
        cta: "Start Today",
        href: "#pricing",
    },
    {
        name: "Teams",
        price: { monthly: "$49", annual: "$39" },
        audience: "For engineering teams scaling with agents",
        features: [
            "Everything in Pro",
            "Shared workspace automations",
            "Team usage metrics & admin controls",
            "SAML-based SSO",
            "Priority onboarding & support",
        ],
        featured: false,
        cta: "Start Today",
        href: "#pricing",
    },
];

export default function ActionCard() {
    const [billing, setBilling] = useState<BillingPeriod>("monthly");

    return (
        <section
            id="pricing"
            style={{
                borderTop: "1px solid var(--border-subtle)",
                background: "var(--bg-secondary)",
            }}
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

                    {/* Billing Toggle */}
                    <div className="pricing-toggle">
                        <button
                            className={`pricing-toggle-btn ${billing === "monthly" ? "is-active" : ""}`}
                            onClick={() => setBilling("monthly")}
                        >
                            Monthly
                        </button>
                        <button
                            className={`pricing-toggle-btn ${billing === "annual" ? "is-active" : ""}`}
                            onClick={() => setBilling("annual")}
                        >
                            Annual
                            <span className="pricing-toggle-badge">Save 20%</span>
                        </button>
                    </div>
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
                            {plan.featured && <span className="pricing-badge">Recommended</span>}
                            <span className="section-label">{plan.audience}</span>
                            <h3
                                style={{
                                    fontSize: "22px",
                                    fontWeight: 600,
                                    marginTop: "16px",
                                    letterSpacing: "-0.03em",
                                }}
                            >
                                KronTerm {plan.name}
                            </h3>
                            <div style={{ marginTop: "16px", display: "flex", alignItems: "baseline", gap: "4px" }}>
                                <span className="price">
                                    {billing === "annual" ? plan.price.annual : plan.price.monthly}
                                </span>
                                <span className="period">/ month</span>
                                {billing === "annual" && plan.price.monthly !== "$0" && (
                                    <span className="pricing-annual-note">billed annually</span>
                                )}
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
                                href={plan.href}
                                className={plan.featured ? "btn-primary" : "btn-secondary"}
                                style={{ justifyContent: "center" }}
                            >
                                {plan.cta} <ArrowRight size={14} />
                            </a>
                        </motion.article>
                    ))}

                    <motion.article
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.24 }}
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
                            href="mailto:sales@kronterm.dev"
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
