import { Apple, Copy, Laptop, Monitor, Terminal } from "lucide-react";
import { Link } from "react-router-dom";

const groups = [
    {
        title: "Product",
        links: [
            ["/product", "Workspace"],
            ["/kronoscode", "KronosCode"],
            ["/terminal", "Terminal"],
            ["/workflows", "AI Workflows"],
            ["/download", "Download"]
        ]
    },
    {
        title: "Solutions",
        links: [
            ["/use-cases/code-review", "Code Review"],
            ["/use-cases/bug-investigation", "Bug Investigation"],
            ["/use-cases/refactors", "Refactors"],
            ["/use-cases/agent-builders", "Agent Builders"]
        ]
    },
    {
        title: "Company",
        links: [
            ["/teams", "Teams"],
            ["/customers", "Customers"],
            ["/about", "About"],
            ["/careers", "Careers"],
            ["/press", "Press"]
        ]
    },
    {
        title: "Resources",
        links: [
            ["/docs", "Docs"],
            ["/blog", "Blog"],
            ["/research", "Research"],
            ["/newsroom", "Newsroom"],
            ["/faq", "FAQ"]
        ]
    },
    {
        title: "Legal",
        links: [
            ["/security", "Security"],
            ["/legal/privacy", "Privacy"],
            ["/legal/terms", "Terms"]
        ]
    }
];

export function Footer() {
    return (
        <footer className="footer">
            <section className="downloads-footer" id="global-downloads-footer" aria-labelledby="downloads-footer-title">
                <div className="downloads-inner">
                    <p className="downloads-eyebrow">All downloads</p>
                    <h2 id="downloads-footer-title">Get Kronterm today</h2>
                    <p className="downloads-subtitle">
                        Request private beta access for the commercial AI-native workspace powered by{" "}
                        <Link to="/kronoscode">KronosCode</Link>.
                    </p>

                    <div className="platform-grid">
                        <article className="platform-column">
                            <Apple className="platform-icon" size={34} aria-hidden="true" />
                            <h3>Mac</h3>
                            <Link className="installer-card" to="/contact-sales">
                                <strong>macOS</strong>
                                <span>Private beta access</span>
                            </Link>
                            <div className="command-pill">
                                <code>$ kronterm beta request --platform macos</code>
                                <Copy size={14} aria-hidden="true" />
                            </div>
                        </article>

                        <article className="platform-column">
                            <Terminal className="platform-icon" size={34} aria-hidden="true" />
                            <h3>Linux</h3>
                            <div className="linux-cards">
                                <Link className="installer-card" to="/contact-sales">
                                    <strong>.deb</strong>
                                    <span>Debian, Ubuntu</span>
                                </Link>
                                <Link className="installer-card" to="/contact-sales">
                                    <strong>.rpm</strong>
                                    <span>Red Hat, Fedora, SUSE</span>
                                </Link>
                            </div>
                            <div className="package-row">
                                <span>.deb</span>
                                <div>
                                    <Link to="/contact-sales">x64</Link>
                                    <Link to="/contact-sales">ARM64</Link>
                                </div>
                            </div>
                            <div className="package-row">
                                <span>.rpm</span>
                                <div>
                                    <Link to="/contact-sales">x64</Link>
                                    <Link to="/contact-sales">ARM64</Link>
                                </div>
                            </div>
                            <div className="package-row">
                                <span>.tar.zst</span>
                                <small>Private beta</small>
                                <div>
                                    <Link to="/contact-sales">x64</Link>
                                    <Link to="/contact-sales">ARM64</Link>
                                </div>
                            </div>
                        </article>

                        <article className="platform-column">
                            <Monitor className="platform-icon" size={34} aria-hidden="true" />
                            <h3>Windows</h3>
                            <div className="linux-cards">
                                <Link className="installer-card" to="/contact-sales">
                                    <strong>.exe</strong>
                                    <span>Windows 11/10 x64</span>
                                </Link>
                                <Link className="installer-card" to="/contact-sales">
                                    <strong>.exe</strong>
                                    <span>Windows 11/10 ARM64</span>
                                </Link>
                            </div>
                            <div className="command-pill">
                                <code>$ kronterm beta request --platform windows</code>
                                <Copy size={14} aria-hidden="true" />
                            </div>
                            <div className="package-row">
                                <span>.exe</span>
                                <div>
                                    <Link to="/contact-sales">x64</Link>
                                    <Link to="/contact-sales">ARM64</Link>
                                </div>
                            </div>
                        </article>
                    </div>
                </div>
            </section>

            <div className="footer-links-shell">
                <div className="footer-grid">
                    <div className="footer-brand">
                        <img src="/assets/product/kronterm-icon.svg" alt="" />
                        <strong>Kronterm</strong>
                        <p>Commercial AI-native workspace for builders, powered by KronosCode.</p>
                    </div>
                    {groups.map((group) => (
                        <div className="footer-column" key={group.title}>
                            <h3>{group.title}</h3>
                            {group.links.map(([href, label]) => (
                                <Link key={href} to={href}>
                                    {label}
                                </Link>
                            ))}
                        </div>
                    ))}
                </div>
                <div className="footer-bottom">
                    <span>All Rights Reserved © 2026 Kronterm</span>
                    <span>Closed-source commercial product</span>
                    <span className="status-pill"><Laptop size={13} aria-hidden="true" /> Private beta routing</span>
                </div>
            </div>
        </footer>
    );
}
