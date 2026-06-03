import { AnimatePresence, motion } from "framer-motion";
import {
    Bot,
    Boxes,
    Building2,
    ChevronDown,
    Code2,
    FileText,
    LayoutGrid,
    LockKeyhole,
    MessageCircle,
    Newspaper,
    Rss,
    TerminalSquare,
    UserPlus,
    Users,
    X,
    Zap,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

const dropdowns = {
    Product: [
        {
            icon: TerminalSquare,
            label: "KronTerm Terminal",
            desc: "A modern terminal for agentic coding",
            to: "/features",
        },
        { icon: Bot, label: "KronosCode Agent", desc: "The orchestration-native coding agent", to: "/agents" },
        { icon: Boxes, label: "Sandbox", desc: "Isolated desktop environments for AI tasks", to: "/features" },
        { icon: LayoutGrid, label: "All Features", desc: "See everything KronTerm can do", to: "/features" },
    ],
    Solutions: [
        { icon: Code2, label: "Developers", desc: "For individual builders", to: "/features" },
        { icon: Users, label: "Teams", desc: "For engineering organizations", to: "/features" },
        { icon: LockKeyhole, label: "Enterprise", desc: "Secure, compliant deployment", to: "/features" },
    ],
    Resources: [
        { icon: FileText, label: "Documentation", desc: "API docs and guides", to: "/docs" },
        { icon: Rss, label: "Changelog", desc: "What's new in KronTerm", to: "/changelog" },
        { icon: MessageCircle, label: "Community", desc: "Get help and connect", to: "/docs" },
    ],
    Company: [
        { icon: Building2, label: "About", desc: "Our mission and team", to: "/about" },
        { icon: UserPlus, label: "Careers", desc: "Join the team", to: "/careers" },
        { icon: Newspaper, label: "Press", desc: "Media coverage and press kit", to: "/press" },
    ],
};

export default function MegaNav() {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    return (
        <>
            <nav className="warp-nav">
                <div className="warp-nav-inner">
                    <Link to="/" className="warp-brand" onClick={() => setIsOpen(false)}>
                        <img src="/assets/kronterm-pet-logo.png" alt="KronTerm" />
                        <span>KronTerm</span>
                    </Link>

                    <div className="warp-nav-links">
                        {Object.entries(dropdowns).map(([key, items]) => (
                            <div
                                key={key}
                                className="warp-nav-dropdown"
                                onMouseEnter={() => setOpenDropdown(key)}
                                onMouseLeave={() => setOpenDropdown(null)}
                            >
                                <button type="button" className="warp-nav-link">
                                    {key}
                                    <ChevronDown />
                                </button>
                                <div className="warp-mega-panel">
                                    {items.map((item) => (
                                        <Link
                                            key={item.label}
                                            to={item.to}
                                            className="warp-mega-item"
                                            onClick={() => setOpenDropdown(null)}
                                        >
                                            <span className="warp-mega-icon">
                                                <item.icon size={16} />
                                            </span>
                                            <div>
                                                <span className="warp-mega-label">{item.label}</span>
                                                <span className="warp-mega-desc">{item.desc}</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <Link
                            to="/#pricing"
                            className={`warp-nav-link ${location.pathname === "/pricing" ? "is-active" : ""}`}
                        >
                            Pricing
                        </Link>
                    </div>

                    <div className="warp-nav-actions">
                        <a
                            href="https://github.com/kronterm/kronterm"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="warp-github-badge"
                        >
                            <svg
                                viewBox="0 0 16 16"
                                width="14"
                                height="14"
                                fill="currentColor"
                                style={{ display: "inline-block" }}
                            >
                                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                            </svg>
                            <Zap size={10} />
                            <span>Open Source</span>
                        </a>
                        <a href="mailto:sales@kronterm.dev" className="warp-contact-link">
                            Contact sales
                        </a>
                        <a href="/#pricing" className="warp-download-button">
                            Get KronTerm <span>→</span>
                        </a>
                    </div>

                    <button
                        type="button"
                        className="warp-mobile-toggle"
                        onClick={() => setIsOpen(true)}
                        aria-label="Open menu"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="22"
                            height="22"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                        >
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>
                </div>
            </nav>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="warp-mobile-menu"
                    >
                        <div className="mobile-menu-header">
                            <Link to="/" className="warp-brand" onClick={() => setIsOpen(false)}>
                                <img src="/assets/kronterm-pet-logo.png" alt="" />
                                <span>KronTerm</span>
                            </Link>
                            <button
                                type="button"
                                className="mobile-menu-close"
                                onClick={() => setIsOpen(false)}
                                aria-label="Close menu"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <nav className="mobile-menu-nav">
                            {Object.entries(dropdowns).map(([category, items]) => (
                                <div key={category} className="mobile-nav-group">
                                    <span className="mobile-nav-group-title">{category}</span>
                                    {items.map((item) => (
                                        <Link key={item.label} to={item.to} onClick={() => setIsOpen(false)}>
                                            {item.label}
                                        </Link>
                                    ))}
                                </div>
                            ))}
                            <Link to="/#pricing" onClick={() => setIsOpen(false)}>
                                Pricing
                            </Link>
                            <a href="mailto:sales@kronterm.dev">Contact sales</a>
                        </nav>
                        <a
                            href="/#pricing"
                            className="warp-download-button"
                            style={{ marginTop: "auto", justifyContent: "center" }}
                            onClick={() => setIsOpen(false)}
                        >
                            Get KronTerm <span>→</span>
                        </a>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
