import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import NoiseOverlay from "@/components/NoiseOverlay";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const entries = [
    {
        version: "0.14.3",
        date: "May 17, 2026",
        tag: "feature",
        tagLabel: "Feature",
        title: "KronTerm Desktop 0.14.3",
        items: [
            "Added sandbox desktop widget with isolated Linux VM",
            "New browser automation tools for KronosCode",
            "Improved block resize performance with drag handles",
            "Added terminal split view with horizontal and vertical modes",
        ],
    },
    {
        version: "0.14.2",
        date: "May 10, 2026",
        tag: "improvement",
        tagLabel: "Improvement",
        title: "KronTerm Desktop 0.14.2",
        items: [
            "Reduced memory usage by 30% for large workspaces",
            "Improved AI panel with streaming response support",
            "New file explorer with git status indicators",
            "Added keyboard shortcuts for block navigation",
        ],
    },
    {
        version: "0.14.1",
        date: "May 3, 2026",
        tag: "fix",
        tagLabel: "Fix",
        title: "KronTerm Desktop 0.14.1",
        items: [
            "Fixed terminal scrollback buffer overflow on long-running processes",
            "Resolved browser preview not loading on first open",
            "Fixed block drag-and-drop failing in nested layouts",
            "Corrected AI panel not showing tool execution results",
        ],
    },
    {
        version: "0.14.0",
        date: "April 26, 2026",
        tag: "feature",
        tagLabel: "Feature",
        title: "KronTerm Desktop 0.14.0",
        items: [
            "Launched KronosCode AI agent with MCP tool support",
            "Added desktop control for native macOS applications",
            "New workspace sharing with team collaboration",
            "Introduced block-based layout system with drag and drop",
            "Added browser blocks with embedded Chromium",
            "New sandbox environments for isolated agent execution",
        ],
    },
    {
        version: "0.13.0",
        date: "April 12, 2026",
        tag: "improvement",
        tagLabel: "Improvement",
        title: "KronTerm Desktop 0.13.0",
        items: [
            "Redesigned settings panel with live preview",
            "Improved terminal performance with faster rendering",
            "Added support for custom themes and color schemes",
            "New onboarding flow for first-time users",
        ],
    },
    {
        version: "0.12.0",
        date: "March 28, 2026",
        tag: "feature",
        tagLabel: "Feature",
        title: "KronTerm Desktop 0.12.0",
        items: [
            "Added inline browser blocks with full web support",
            "New terminal multiplexer with pane management",
            "Introduced command palette for quick actions",
            "Added file watcher for live reload in preview blocks",
        ],
    },
    {
        version: "0.11.0",
        date: "March 14, 2026",
        tag: "improvement",
        tagLabel: "Improvement",
        title: "KronTerm Desktop 0.11.0",
        items: [
            "Improved SSH connection management",
            "Added WSL support for Windows users",
            "New notification system for background tasks",
            "Enhanced search across workspace blocks",
        ],
    },
    {
        version: "0.10.0",
        date: "February 28, 2026",
        tag: "feature",
        tagLabel: "Feature",
        title: "KronTerm Desktop 0.10.0",
        items: [
            "Initial public release of KronTerm",
            "Terminal block with shell integration",
            "File explorer with tab support",
            "Basic workspace layout management",
        ],
    },
];

export default function Changelog() {
    return (
        <div className="warp-page">
            <NoiseOverlay />
            <Nav />

            <div style={{ paddingTop: "var(--nav-height)" }}>
                <section className="section">
                    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "0 24px" }}>
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            <span className="section-label">Changelog</span>
                            <h1 className="section-title" style={{ marginTop: "12px" }}>
                                What's new in KronTerm
                            </h1>
                            <p
                                style={{
                                    fontSize: "17px",
                                    color: "var(--text-secondary)",
                                    marginTop: "12px",
                                    maxWidth: "500px",
                                }}
                            >
                                A chronological list of features, improvements, and fixes.
                            </p>
                        </motion.div>

                        <div style={{ marginTop: "48px" }}>
                            {entries.map((entry, i) => (
                                <motion.article
                                    key={entry.version}
                                    initial={{ opacity: 0, y: 16 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.05 }}
                                    className="changelog-entry"
                                >
                                    <div className="changelog-date">{entry.date}</div>
                                    <span className={`changelog-tag ${entry.tag}`}>{entry.tagLabel}</span>
                                    <div className="changelog-content">
                                        <h3>{entry.title}</h3>
                                        <ul>
                                            {entry.items.map((item, j) => (
                                                <li key={j}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </motion.article>
                            ))}
                        </div>

                        <div style={{ marginTop: "48px", textAlign: "center" }}>
                            <Link to="/docs" className="btn-secondary">
                                Read the documentation <ArrowRight size={14} />
                            </Link>
                        </div>
                    </div>
                </section>
            </div>

            <Footer />
        </div>
    );
}
