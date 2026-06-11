import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { navGroups } from "../data/site";

export function Nav() {
    const [open, setOpen] = useState(false);
    const [activeGroup, setActiveGroup] = useState<string | null>(null);

    return (
        <header className="site-header">
            <a className="announcement" href="/contact-sales">
                <span>Private beta now routing commercial teams and serious builders</span>
                <strong>Request access</strong>
            </a>
            <nav className="nav-shell" aria-label="Main navigation">
                <Link className="brand" to="/" onClick={() => setOpen(false)}>
                    <img src="/assets/product/kronterm-icon.svg" alt="" />
                    <span>Kronterm</span>
                </Link>

                <div className="desktop-nav" onMouseLeave={() => setActiveGroup(null)}>
                    {navGroups.map((group) => (
                        <button
                            className="nav-item"
                            key={group.label}
                            type="button"
                            onMouseEnter={() => setActiveGroup(group.label)}
                            onFocus={() => setActiveGroup(group.label)}
                            aria-expanded={activeGroup === group.label}
                        >
                            {group.label}
                        </button>
                    ))}
                    <NavLink className="nav-link" to="/pricing">
                        Pricing
                    </NavLink>
                    {activeGroup ? (
                        <div className="mega-menu">
                            {navGroups
                                .find((group) => group.label === activeGroup)
                                ?.links.map((link) => (
                                    <Link className="mega-link" to={link.href} key={link.href}>
                                        <strong>{link.title}</strong>
                                        <span>{link.text}</span>
                                    </Link>
                                ))}
                        </div>
                    ) : null}
                </div>

                <div className="nav-actions">
                    <Link className="ghost-button" to="/contact-sales">
                        Contact sales
                    </Link>
                    <Link className="primary-button small" to="/download">
                        Download
                    </Link>
                    <button className="menu-button" type="button" onClick={() => setOpen((value) => !value)} aria-label="Toggle menu">
                        {open ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </nav>
            {open ? (
                <div className="mobile-menu">
                    {navGroups.map((group) => (
                        <div className="mobile-group" key={group.label}>
                            <p>{group.label}</p>
                            {group.links.map((link) => (
                                <Link to={link.href} key={link.href} onClick={() => setOpen(false)}>
                                    {link.title}
                                </Link>
                            ))}
                        </div>
                    ))}
                    <Link className="primary-button" to="/download" onClick={() => setOpen(false)}>
                        Download
                    </Link>
                </div>
            ) : null}
        </header>
    );
}
