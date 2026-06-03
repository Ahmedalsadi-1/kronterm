import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import NoiseOverlay from "@/components/NoiseOverlay";
import SignalStrip from "@/components/SignalStrip";
import { Backlight } from "@/components/ui/backlight";
import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowRight,
    Bot,
    Boxes,
    Check,
    Eye,
    Globe2,
    Layers,
    ShieldCheck,
    TerminalSquare,
    Zap,
    type LucideIcon,
} from "lucide-react";
import { useState } from "react";

const productTabs = [
    {
        label: "Terminal",
        eyebrow: "KronTerm Desktop",
        title: "Start in the terminal",
        body: "A modern agentic desktop environment born from the terminal. Keep commands, previews, files, and live applications together while KronosCode works beside you.",
        link: "/features",
        image: "/assets/kronterm-homepage.png",
        caption: "kronterm // workspace",
    },
    {
        label: "Agent",
        eyebrow: "KronosCode",
        title: "Build with KronosCode",
        body: "Delegate complete workflows to an orchestration-native agent with desktop context, workspace tools, sandbox access, and visible execution.",
        link: "/agents",
        image: "/assets/kronterm-sidepanel.png",
        caption: "kronoscode // ai-panel",
    },
    {
        label: "Sandbox",
        eyebrow: "Automation",
        title: "Automate the whole loop",
        body: "Turn a goal into an observable routine. KronosCode can open the workspace, run the tools, inspect results, and keep the output ready for review.",
        link: "/features#automation",
        image: "/assets/kronterm-sandbox-screenshot.png",
        caption: "sandbox // isolated-desktop",
    },
    {
        label: "Teams",
        eyebrow: "Collaboration",
        title: "Scale across your team",
        body: "Centralize repeatable workflows in a focused operating surface with visible actions, isolated environments, and reviewable results.",
        link: "/#pricing",
        image: "/assets/kronterm-chamber-chat.png",
        caption: "chat // kronoscode-agents",
    },
];

const features: [LucideIcon, string, string][] = [
    [TerminalSquare, "Terminal-native", "Command output stays readable, persistent, and ready for automation."],
    [Bot, "KronosCode agent", "Direct an agent that operates inside the workspace instead of beside it."],
    [Globe2, "Browser preview", "Keep docs, localhost previews, and browser tasks inside the active canvas."],
    [Boxes, "Sandbox tasks", "Hand complex work to isolated environments without losing visibility."],
    [Layers, "Flexible layouts", "Resize, split, and focus blocks as the task changes shape."],
    [Zap, "MCP tools", "Connect intent to desktop actions with auditable execution steps."],
    [Eye, "Visible state", "Review what changed, what ran, and what needs your attention."],
    [ShieldCheck, "Private workspaces", "Keep workflows controlled around your deployment model."],
];

const agentSteps = [
    ["01", "Read workspace", "12 blocks indexed"],
    ["02", "Run dev loop", "terminal + browser"],
    ["03", "Inspect result", "preview verified"],
    ["04", "Apply patch", "ready for review"],
];

type WarpProductPageProps = {
    eyebrow?: string;
    title?: string;
    description?: string;
};

export default function WarpProductPage({
    eyebrow = "The agentic desktop environment",
    title = "Ship better software with one command center",
    description = "KronTerm is an agentic desktop environment born from the terminal. Run KronosCode across terminals, browsers, sandboxes, files, and desktop apps from one focused workspace.",
}: WarpProductPageProps) {
    const [activeTab, setActiveTab] = useState(0);
    const activeProduct = productTabs[activeTab];

    return (
        <div className="warp-page">
            <NoiseOverlay />
            <div className="warp-announcement">
                <span>Introducing KronTerm Desktop 0.14.3 with sandbox automation.</span>
                <a href="/changelog">Read the changelog →</a>
            </div>
            <Nav />

            {/* ─── Hero ─── */}
            <section className="warp-hero">
                {/* Liquid orbs */}
                <div className="warp-orb warp-orb-left" />
                <div className="warp-orb warp-orb-right" />
                <div className="warp-orb warp-orb-center" />

                <div className="warp-hero-copy">
                    <motion.div
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55 }}
                    >
                        <span className="warp-eyebrow">{eyebrow}</span>
                        <h1 className="text-gradient">{title}</h1>
                        <p>{description}</p>
                        <div className="warp-hero-actions">
                            <a href="/#pricing" className="warp-download-button">
                                Get KronTerm
                                <span>→</span>
                            </a>
                            <a href="/docs" className="warp-secondary-button">
                                Read the docs
                                <span>↗</span>
                            </a>
                        </div>
                    </motion.div>
                </div>

                {/* Hero Stage */}
                <motion.div
                    initial={{ opacity: 0, y: 34 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18, duration: 0.7 }}
                    className="warp-hero-stage"
                >
                    <div className="warp-stage-frame backlight-frame">
                        <div className="warp-stage-topbar">
                            <div className="warp-window-dots">
                                <i />
                                <i />
                                <i />
                            </div>
                            <span>kronterm // workspace_alpha</span>
                            <span className="warp-live">● live</span>
                        </div>
                        <div style={{ position: "relative", overflow: "hidden" }}>
                            <Backlight className="absolute inset-0" blur={8}>
                                <img
                                    src="/assets/kronterm-homepage.png"
                                    alt="KronTerm command center workspace"
                                    style={{
                                        display: "block",
                                        width: "100%",
                                        opacity: 0.92,
                                    }}
                                />
                            </Backlight>
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    background: "linear-gradient(to top, var(--bg-primary), transparent 40%)",
                                    pointerEvents: "none",
                                }}
                            />
                            {/* Agent float */}
                            <div className="warp-agent-float">
                                <span className="warp-mini-label">KronosCode</span>
                                <strong>Automate the whole loop</strong>
                                <p>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Workflow active across 4 workspace blocks
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </section>

            <SignalStrip />

            {/* ─── Trust / Surface Row ─── */}
            <section className="warp-trust">
                <div style={{ maxWidth: "var(--content-max-width)", margin: "0 auto", padding: "0 24px" }}>
                    <span className="warp-eyebrow">Built for the command center</span>
                    <h2 className="text-gradient">
                        Your entire dev loop.
                        <br />
                        One focused workspace.
                    </h2>
                </div>
                <div className="warp-surface-row">
                    {[
                        ["Terminal", "blocks"],
                        ["Browser", "previews"],
                        ["Sandbox", "tasks"],
                        ["Desktop", "apps"],
                        ["KronosCode", "agent"],
                        ["MCP", "tools"],
                    ].map(([label, highlight]) => (
                        <div key={label}>
                            <span>{highlight}</span> {label}
                        </div>
                    ))}
                </div>
            </section>

            {/* ─── Why / Product Tabs ─── */}
            <section className="warp-why">
                <span className="warp-eyebrow">Why KronTerm</span>
                <h2>
                    Be more productive.
                    <br />
                    Stay in control.
                </h2>

                <div className="warp-tab-row">
                    {productTabs.map((tab, i) => (
                        <button
                            key={tab.label}
                            type="button"
                            onClick={() => setActiveTab(i)}
                            className={i === activeTab ? "is-active" : ""}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -14 }}
                        transition={{ duration: 0.3 }}
                        className="warp-product-panel"
                    >
                        <div className="warp-product-copy">
                            <span className="section-label">{activeProduct.eyebrow}</span>
                            <h3>{activeProduct.title}</h3>
                            <p>{activeProduct.body}</p>
                            <a href={activeProduct.link}>
                                Learn more <ArrowRight size={15} />
                            </a>
                        </div>
                        <div
                            className="warp-product-image"
                            style={{ position: "relative", overflow: "hidden", borderRadius: "var(--radius-xl)" }}
                        >
                            <div
                                className="screenshot-bar"
                                style={{ borderRadius: "var(--radius-xl) var(--radius-xl) 0 0" }}
                            >
                                <div className="warp-window-dots">
                                    <i />
                                    <i />
                                    <i />
                                </div>
                                <span>{activeProduct.caption}</span>
                                <span className="warp-live">● live</span>
                            </div>
                            <img
                                src={activeProduct.image}
                                alt={activeProduct.title}
                                style={{
                                    display: "block",
                                    width: "100%",
                                    filter: "brightness(1.1) contrast(1.03)",
                                }}
                            />
                        </div>
                    </motion.div>
                </AnimatePresence>
            </section>

            {/* ─── Feature Grid ─── */}
            <section
                className="warp-proof"
                style={{ padding: "var(--space-section) 24px", maxWidth: "var(--content-max-width)", margin: "0 auto" }}
            >
                <div>
                    <span className="warp-eyebrow">Features</span>
                    <h2 style={{ marginTop: "16px" }}>
                        Everything you need
                        <br />
                        <span className="text-gradient">to direct the desktop.</span>
                    </h2>
                </div>
                <div className="warp-advantage-grid">
                    {features.map(([Icon, featureTitle, desc], i) => (
                        <motion.article
                            key={featureTitle}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.04 }}
                        >
                            <Icon />
                            <h3>{featureTitle}</h3>
                            <p>{desc}</p>
                        </motion.article>
                    ))}
                </div>
            </section>

            {/* ─── Agent Band ─── */}
            <section
                className="warp-agent-band"
                style={{ padding: "var(--space-section) 24px", maxWidth: "var(--content-max-width)", margin: "0 auto" }}
            >
                <div>
                    <span className="warp-eyebrow">KronosCode</span>
                    <h2 style={{ marginTop: "16px" }}>
                        One agent.
                        <br />
                        Your whole desktop.
                    </h2>
                    <p>
                        Give KronosCode an outcome and keep the work visible as it coordinates terminals, previews,
                        sandboxes, files, and desktop actions.
                    </p>
                    <a href="/agents" className="warp-secondary-button" style={{ marginTop: "24px" }}>
                        Meet KronosCode <ArrowRight size={14} />
                    </a>
                </div>
                <div className="warp-agent-terminal">
                    <div>
                        <span>$</span> <b>kronoscode run</b> "verify the latest build"
                        <i>running</i>
                    </div>
                    {agentSteps.map(([num, step, detail]) => (
                        <div key={num}>
                            <span>{num}</span> <b>{step}</b> {detail}
                            <i>✓</i>
                        </div>
                    ))}
                    <div>
                        <span>✓</span> <b>workflow verified</b> ready for review
                        <i style={{ color: "var(--green)" }}>complete</i>
                    </div>
                </div>
            </section>

            {/* ─── Proof / Advantages ─── */}
            <section style={{ borderTop: "1px solid var(--border)" }}>
                <div className="warp-why" style={{ padding: "var(--space-section) 24px" }}>
                    <span className="warp-eyebrow">Why teams choose KronTerm</span>
                    <h2>
                        Built for developers
                        <br />
                        <span className="text-gradient">who want control.</span>
                    </h2>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                            gap: "16px",
                            marginTop: "48px",
                            maxWidth: "900px",
                            margin: "48px auto 0",
                        }}
                    >
                        {[
                            [
                                "Visible automation",
                                "Every step stays on screen. Review what changed instead of trusting a black box.",
                            ],
                            [
                                "Desktop-native",
                                "Operates inside your workspace with real tools, not a sandboxed approximation.",
                            ],
                            ["Team-ready", "Shared workflows, controlled access, and deployment models that scale."],
                            [
                                "Terminal-first",
                                "Built on the surface developers already live in. No context-switching tax.",
                            ],
                        ].map(([advTitle, advDesc], i) => (
                            <motion.article
                                key={advTitle}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.06 }}
                                className="warp-feature-card"
                            >
                                <h3>{advTitle}</h3>
                                <p>{advDesc}</p>
                            </motion.article>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── FAQ ─── */}
            <section style={{ borderTop: "1px solid var(--border)", padding: "var(--space-section) 24px" }}>
                <div
                    style={{
                        maxWidth: "var(--content-max-width)",
                        margin: "0 auto",
                        display: "grid",
                        gap: "48px",
                        gridTemplateColumns: "0.7fr 1fr",
                    }}
                >
                    <div>
                        <span className="warp-eyebrow">Questions, answered</span>
                        <h2 style={{ marginTop: "16px" }}>
                            Before you
                            <br />
                            take command.
                        </h2>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {[
                            [
                                "What makes KronTerm different from a normal terminal?",
                                "KronTerm is a block workspace for terminals, browser previews, sandboxes, and desktop surfaces. KronosCode can reason across those surfaces and coordinate visible actions inside the same workspace.",
                            ],
                            [
                                "What can KronosCode automate?",
                                "KronosCode can orchestrate terminal commands, workspace blocks, browser tasks, sandbox environments, and connected desktop routines through native tools.",
                            ],
                            [
                                "Can teams use private deployments?",
                                "Yes. Enterprise plans are designed around onboarding, controlled access, and deployment requirements for your organization.",
                            ],
                            [
                                "Which operating systems are supported?",
                                "KronTerm is designed for macOS, Linux, and Windows workflows. Contact our team for current edition availability and rollout details.",
                            ],
                        ].map(([q, a], i) => (
                            <FaqItem key={q} question={q} answer={a} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Pricing ─── */}
            <section
                id="pricing"
                style={{
                    borderTop: "1px solid var(--border)",
                    padding: "var(--space-section) 24px",
                    background: "linear-gradient(180deg, rgba(45, 36, 102, 0.15), var(--bg-primary))",
                }}
            >
                <div style={{ maxWidth: "var(--content-max-width)", margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: "48px" }}>
                        <span className="warp-eyebrow">Choose your command center</span>
                        <h2 style={{ marginTop: "16px" }}>
                            Put your desktop
                            <br />
                            <span className="text-gradient">under one command.</span>
                        </h2>
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: "16px",
                            maxWidth: "960px",
                            margin: "0 auto",
                        }}
                    >
                        {[
                            {
                                name: "KronTerm Pro",
                                price: "$24",
                                audience: "For individual builders",
                                features: [
                                    "KronosCode desktop agent",
                                    "Unlimited local workspaces",
                                    "Browser and sandbox automation",
                                ],
                                featured: false,
                            },
                            {
                                name: "KronTerm Teams",
                                price: "$49",
                                audience: "For product teams",
                                features: [
                                    "Everything in Pro",
                                    "Shared workspace automations",
                                    "Priority onboarding and support",
                                ],
                                featured: true,
                            },
                            {
                                name: "Enterprise",
                                price: "Custom",
                                audience: "Private deployment",
                                features: [
                                    "Custom deployment model",
                                    "Onboarding and access controls",
                                    "Dedicated support and SLA",
                                ],
                                featured: false,
                            },
                        ].map((plan, i) => (
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
                                    {plan.price !== "Custom" && <span className="period">/ month</span>}
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
                                    href={plan.featured ? "/#pricing" : "/docs"}
                                    className={plan.featured ? "warp-download-button" : "warp-secondary-button"}
                                    style={{ justifyContent: "center", marginTop: "8px" }}
                                >
                                    {plan.featured
                                        ? "Start with Teams"
                                        : plan.price === "Custom"
                                          ? "Contact us"
                                          : "Start with Pro"}{" "}
                                    <ArrowRight size={14} />
                                </a>
                            </motion.article>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── CTA ─── */}
            <section className="warp-cta">
                <div style={{ maxWidth: "var(--content-max-width)", margin: "0 auto" }}>
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        style={{ height: "28px", width: "28px", color: "var(--accent)", margin: "0 auto 24px" }}
                    >
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                    </svg>
                    <h2>Start building with KronosCode.</h2>
                    <p style={{ marginTop: "16px", marginBottom: "32px" }}>
                        Bring your entire desktop workflow under one command center.
                    </p>
                    <div className="warp-hero-actions">
                        <a href="/#pricing" className="warp-download-button">
                            Get KronTerm <ArrowRight size={15} />
                        </a>
                        <a href="mailto:sales@kronterm.dev" className="warp-secondary-button">
                            Contact sales
                        </a>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}

/* ─── FAQ Item (internal) ─── */

import { Plus } from "lucide-react";
import { useCallback } from "react";

function FaqItem({ question, answer }: { question: string; answer: string }) {
    const [open, setOpen] = useState(false);
    const toggle = useCallback(() => setOpen((v) => !v), []);

    return (
        <article className="faq-card">
            <button type="button" className="faq-trigger" onClick={toggle}>
                <span>{question}</span>
                <Plus className={open ? "open" : ""} />
            </button>
            {open && <p className="faq-answer">{answer}</p>}
        </article>
    );
}
