import { Link } from "react-router-dom";

const groups = {
    Product: [
        { label: "Features", to: "/features" },
        { label: "KronosCode", to: "/agents" },
        { label: "Pricing", to: "/#pricing" },
        { label: "Changelog", to: "/changelog" },
    ],
    Resources: [
        { label: "Documentation", to: "/docs" },
        { label: "Guides", to: "/docs" },
        { label: "API Reference", to: "/docs" },
        { label: "Status", to: "#" },
    ],
    Company: [
        { label: "About", to: "#" },
        { label: "Blog", to: "#" },
        { label: "Careers", to: "#" },
        { label: "Press", to: "#" },
    ],
    Legal: [
        { label: "Privacy", to: "#" },
        { label: "Terms", to: "#" },
        { label: "Security", to: "#" },
        { label: "Cookies", to: "#" },
    ],
};

export default function Footer() {
    return (
        <footer className="warp-footer">
            <div className="warp-footer-inner">
                <div className="warp-footer-grid">
                    {Object.entries(groups).map(([title, items]) => (
                        <div key={title} className="warp-footer-group">
                            <h4>{title}</h4>
                            {items.map((item) =>
                                item.to.startsWith("/") ? (
                                    <Link key={item.label} to={item.to}>
                                        {item.label}
                                    </Link>
                                ) : (
                                    <a key={item.label} href={item.to}>
                                        {item.label}
                                    </a>
                                )
                            )}
                        </div>
                    ))}
                </div>
                <div className="warp-footer-bottom">
                    <div className="warp-footer-brand">
                        <img src="/assets/kronterm-pet-logo.png" alt="" />
                        <span>KronTerm</span>
                    </div>
                    <span className="warp-footer-copy">&copy; 2026 KronTerm. All rights reserved.</span>
                </div>
            </div>
        </footer>
    );
}
