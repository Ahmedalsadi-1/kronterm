import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

const navItems = [
    {
        label: "Product",
        children: [
            { label: "Features", to: "/features" },
            { label: "KronosCode Agent", to: "/agents" },
            { label: "Changelog", to: "/changelog" },
        ],
    },
    { label: "Docs", to: "/docs" },
    { label: "Pricing", to: "/#pricing" },
];

export default function Nav() {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <nav className="warp-nav">
                <div className="warp-nav-inner">
                    <Link to="/" className="warp-brand" onClick={() => setIsOpen(false)}>
                        <img src="/assets/kronterm-pet-logo.png" alt="" />
                        <span>KronTerm</span>
                    </Link>

                    <div className="warp-nav-links">
                        {navItems.map((item) =>
                            "children" in item && item.children ? (
                                <div key={item.label} className="warp-nav-dropdown">
                                    <button type="button" className="warp-nav-link">
                                        {item.label}
                                        <ChevronDown />
                                    </button>
                                    <div className="warp-dropdown-panel">
                                        {item.children.map((child) => (
                                            <Link key={child.to} to={child.to}>
                                                {child.label}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    className={`warp-nav-link ${location.pathname === item.to ? "is-active" : ""}`}
                                >
                                    {item.label}
                                </Link>
                            )
                        )}
                    </div>

                    <div className="warp-nav-actions">
                        <a href="mailto:sales@kronterm.dev" className="warp-contact-link">
                            Contact
                        </a>
                        <a href="/#pricing" className="warp-download-button">
                            Get KronTerm
                        </a>
                    </div>

                    <button
                        type="button"
                        className="warp-mobile-toggle"
                        onClick={() => setIsOpen(true)}
                        aria-label="Open menu"
                    >
                        <Menu />
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
                            <Link to="/features" onClick={() => setIsOpen(false)}>
                                Features
                            </Link>
                            <Link to="/agents" onClick={() => setIsOpen(false)}>
                                KronosCode
                            </Link>
                            <Link to="/docs" onClick={() => setIsOpen(false)}>
                                Docs
                            </Link>
                            <Link to="/changelog" onClick={() => setIsOpen(false)}>
                                Changelog
                            </Link>
                            <a href="/#pricing" onClick={() => setIsOpen(false)}>
                                Pricing
                            </a>
                            <a href="mailto:sales@kronterm.dev">Contact sales</a>
                        </nav>
                        <a
                            href="/#pricing"
                            className="warp-download-button"
                            style={{ marginTop: "auto", justifyContent: "center" }}
                            onClick={() => setIsOpen(false)}
                        >
                            Get KronTerm
                        </a>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
