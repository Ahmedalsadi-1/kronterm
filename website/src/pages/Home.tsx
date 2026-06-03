import BentoFeatures from "@/components/BentoFeatures";
import DownloadSection from "@/components/DownloadSection";
import Faq from "@/components/Faq";
import Footer from "@/components/Footer";
import LogoMarquee from "@/components/LogoMarquee";
import MegaNav from "@/components/MegaNav";
import NoiseOverlay from "@/components/NoiseOverlay";
import PricingSection from "@/components/PricingSection";
import ProductShowcase from "@/components/ProductShowcase";
import StatsRow from "@/components/StatsRow";
import Testimonials from "@/components/Testimonials";
import ToolkitGrid from "@/components/ToolkitGrid";
import TrustSection from "@/components/TrustSection";
import { Backlight } from "@/components/ui/backlight";
import { motion } from "framer-motion";
import { ArrowRight, Layers } from "lucide-react";

export default function Home() {
    return (
        <div className="warp-page">
            <NoiseOverlay />
            <div className="warp-announcement">
                <span>KronTerm 0.14.3 — sandbox automation, desktop control, and KronosCode agents.</span>
                <a href="/changelog">Read the changelog →</a>
            </div>
            <MegaNav />

            {/* ─── Hero ─── */}
            <section className="warp-hero">
                <div className="warp-orb warp-orb-left" />
                <div className="warp-orb warp-orb-right" />
                <div className="warp-orb warp-orb-center" />

                <div className="warp-hero-copy">
                    <motion.div
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55 }}
                    >
                        <span className="warp-eyebrow">The agentic desktop environment</span>
                        <h1 className="text-gradient">
                            Your desktop.
                            <br />
                            One command away.
                        </h1>
                        <p>
                            KronTerm is an AI-native command center for your entire workflow. KronosCode can reason
                            across terminals, browser blocks, sandboxes, files, and desktop apps, then automate the work
                            from one focused workspace.
                        </p>
                        <div className="warp-hero-actions">
                            <a href="/#pricing" className="warp-download-button">
                                Get KronTerm
                                <span>→</span>
                            </a>
                            <a href="/features" className="warp-secondary-button">
                                Explore platform
                                <span>↗</span>
                            </a>
                        </div>
                    </motion.div>
                </div>

                {/* Hero Stage with REAL screenshot */}
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
                                    alt="KronTerm command center workspace showing terminal, sandbox, memory graph, browser preview, and file explorer"
                                    style={{
                                        display: "block",
                                        width: "100%",
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
                            {/* Agent float panel */}
                            <div className="warp-agent-float">
                                <span className="warp-mini-label">KronosCode</span>
                                <strong>Automate the whole loop</strong>
                                <p>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Workflow active across 5 workspace blocks
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* ─── Social Proof: Logo Marquee ─── */}
            <LogoMarquee />

            {/* ─── Stats ─── */}
            <StatsRow />

            {/* ─── Product Showcase ─── */}
            <ProductShowcase />

            {/* ─── Features Grid ─── */}
            <BentoFeatures />

            {/* ─── Toolkit ─── */}
            <ToolkitGrid />

            {/* ─── Testimonials ─── */}
            <Testimonials />

            {/* ─── Trust & Security ─── */}
            <TrustSection />

            {/* ─── FAQ ─── */}
            <Faq />

            {/* ─── Pricing ─── */}
            <PricingSection />

            {/* ─── Download ─── */}
            <DownloadSection />

            {/* ─── CTA ─── */}
            <section className="warp-cta">
                <div style={{ maxWidth: "var(--content-max-width)", margin: "0 auto" }}>
                    <Layers
                        style={{
                            height: "28px",
                            width: "28px",
                            color: "var(--accent)",
                            margin: "0 auto 24px",
                        }}
                    />
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
