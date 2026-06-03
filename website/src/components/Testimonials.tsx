import { motion } from "framer-motion";
import { useRef } from "react";

const testimonials = [
    {
        name: "Sarah Chen",
        handle: "@sarahcodes",
        avatar: "SC",
        text: "KronTerm's block system is genuinely incredible. Having terminals, browser previews, and agent panels visible at the same time changed how I work.",
    },
    {
        name: "Marcus Reid",
        handle: "@marcusdev",
        avatar: "MR",
        text: "I switched from Warp and I'm not looking back. KronosCode actually sees my terminal output and operates the desktop — that's a step change.",
    },
    {
        name: "Aisha Patel",
        handle: "@aishapdev",
        avatar: "AP",
        text: "The sandbox feature is what sold me. I can hand risky tasks to an isolated VM and review the results before anything hits my machine.",
    },
    {
        name: "Jake Morrison",
        handle: "@jakemorr",
        avatar: "JM",
        text: "KronTerm is what happens when someone actually thinks about the developer loop, not just the terminal window. It's become my daily driver.",
    },
    {
        name: "Elena Torres",
        handle: "@elenat",
        avatar: "ET",
        text: "The MCP integration is seamless. My agent can browse docs, run commands, and operate desktop apps — all from one workspace.",
    },
    {
        name: "David Kim",
        handle: "@dkim_io",
        avatar: "DK",
        text: "Being able to see everything the agent is doing in real-time instead of a black box is why KronTerm stands out. Transparency matters.",
    },
];

function TestimonialCard({ t }: { t: (typeof testimonials)[0] }) {
    return (
        <article className="testimonial-card">
            <div className="testimonial-header">
                <div className="testimonial-avatar">{t.avatar}</div>
                <div>
                    <div className="testimonial-name">{t.name}</div>
                    <div className="testimonial-handle">{t.handle}</div>
                </div>
                <svg
                    className="testimonial-twitter-icon"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    width="18"
                    height="18"
                >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.352 11.152H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
            </div>
            <p className="testimonial-text">{t.text}</p>
        </article>
    );
}

export default function Testimonials() {
    const ref = useRef<HTMLDivElement>(null);

    return (
        <section className="testimonials-section" ref={ref}>
            <div style={{ maxWidth: "var(--content-max-width)", margin: "0 auto" }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{ marginBottom: "48px" }}
                >
                    <span className="warp-eyebrow">What developers are saying</span>
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
                        Join a community of builders.
                    </h2>
                </motion.div>

                <div className="testimonials-grid">
                    {testimonials.map((t, i) => (
                        <motion.div
                            key={t.handle}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.06 }}
                        >
                            <TestimonialCard t={t} />
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
