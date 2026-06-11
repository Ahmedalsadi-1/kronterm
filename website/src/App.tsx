import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Footer } from "./components/Footer";
import { Nav } from "./components/Nav";
import { PageTemplate } from "./components/PageTemplate";
import { allPages, type PageConfig } from "./data/site";
import { setPageMeta } from "./lib/meta";

const legalPages: PageConfig[] = [
    {
        path: "/legal/privacy",
        title: "Privacy | Kronterm",
        description: "Privacy overview for Kronterm and KronosCode private beta.",
        eyebrow: "Privacy",
        headline: "Privacy for an AI-native workspace.",
        subheadline: "Kronterm is designed for commercial users who need clear data handling, visible AI execution, and control over local and cloud model workflows.",
        primaryCta: "Ask privacy questions",
        secondaryCta: "Review security",
        heroMedia: { type: "image", src: "/assets/kronoscode/tui-settings.webp", alt: "Kronterm settings interface for privacy controls" },
        sections: [
            {
                title: "Workspace context should be explicit.",
                text: "KronosCode works best when it can reason over terminal output, files, browser state, and sandbox activity. Kronterm presents that context as product surfaces users can inspect and control."
            }
        ]
    },
    {
        path: "/legal/terms",
        title: "Terms | Kronterm",
        description: "Commercial terms overview for Kronterm private beta.",
        eyebrow: "Terms",
        headline: "Commercial product terms.",
        subheadline: "Kronterm is a closed-source commercial product. Private beta terms, access scope, usage boundaries, and support expectations are handled through the access process.",
        primaryCta: "Contact sales",
        secondaryCta: "Review security",
        heroMedia: { type: "image", src: "/assets/product/kronterm-sidepanel.webp", alt: "Kronterm workspace interface" },
        sections: [
            {
                title: "Private beta access is controlled.",
                text: "Kronterm is not positioned as an open community project. It is a commercial AI-native workspace for serious builders and teams."
            }
        ]
    }
];

const routePages = [...allPages, ...legalPages];

function PageRoute({ page }: { page: PageConfig }) {
    const location = useLocation();

    useEffect(() => {
        setPageMeta(page.title, page.description);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [location.pathname, page.description, page.title]);

    return (
        <main>
            <PageTemplate page={page} />
        </main>
    );
}

function App() {
    return (
        <div className="app-shell">
            <Nav />
            <Routes>
                {routePages.map((page) => (
                    <Route key={page.path} path={page.path} element={<PageRoute page={page} />} />
                ))}
                <Route path="/events" element={<Navigate to="/newsroom" replace />} />
                <Route path="/changelog" element={<Navigate to="/newsroom" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Footer />
        </div>
    );
}

export default App;
