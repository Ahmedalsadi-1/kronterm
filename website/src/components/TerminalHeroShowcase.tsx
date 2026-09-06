import { Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { productAssets, type Media } from "../data/site";
import { MediaFrame } from "./MediaFrame";

type Slide = {
    label: string;
    title: string;
    media: Media;
};

const slides: Slide[] = [
    {
        label: "KronosCode",
        title: "Workspace-aware AI agent",
        media: {
            type: "image",
            src: productAssets.agent,
            alt: "KronosCode agent prompt running inside the Kronterm terminal workspace"
        }
    },
    {
        label: "Terminal",
        title: "Command output in context",
        media: {
            type: "image",
            src: productAssets.hero,
            alt: "Kronterm terminal beside browser, sandbox, files, and system panels"
        }
    },
    {
        label: "Browser",
        title: "Browser validation next to shell work",
        media: {
            type: "video",
            src: productAssets.browserVideo,
            alt: "Kronterm browser widget running beside development tools"
        }
    },
    {
        label: "Diffs",
        title: "Review edits before execution continues",
        media: {
            type: "image",
            src: productAssets.diff,
            alt: "KronosCode file diff review in Kronterm"
        }
    },
    {
        label: "Sandbox",
        title: "Controlled execution surfaces",
        media: {
            type: "video",
            src: productAssets.sandboxVideo,
            alt: "Kronterm sandbox demonstration for controlled execution"
        }
    }
];

export function TerminalHeroShowcase() {
    const [active, setActive] = useState(0);
    const selected = slides[active];

    useEffect(() => {
        const timer = window.setInterval(() => {
            setActive((value) => (value + 1) % slides.length);
        }, 4200);

        return () => window.clearInterval(timer);
    }, []);

    const command = useMemo(() => "$ kronterm beta request --terminal", []);

    return (
        <section className="terminal-hero-showcase" aria-labelledby="terminal-hero-title">
            <div className="terminal-aurora" aria-hidden="true" />
            <div className="terminal-hero-copy">
                <h1 id="terminal-hero-title">The best place to build with KronosCode</h1>
                <p>Ship faster in an AI-native terminal designed to take you from prompt to production.</p>
                <div className="terminal-command-row">
                    <Link className="terminal-download-button" to="/contact-sales">
                        Request access
                    </Link>
                    <div className="terminal-command-pill">
                        <code>{command}</code>
                        <Copy size={14} aria-hidden="true" />
                    </div>
                </div>
            </div>
            <div className="terminal-slideshow" aria-label="Kronterm terminal slideshow">
                <div className="terminal-slide-tabs" role="tablist" aria-label="Kronterm terminal views">
                    {slides.map((slide, index) => (
                        <button
                            className={index === active ? "active" : ""}
                            type="button"
                            key={slide.label}
                            onClick={() => setActive(index)}
                            role="tab"
                            aria-selected={index === active}
                        >
                            <span>{slide.label}</span>
                        </button>
                    ))}
                </div>
                <div className="terminal-slide-stage">
                    <div className="terminal-slide-caption">
                        <span>{selected.label}</span>
                        <strong>{selected.title}</strong>
                    </div>
                    <MediaFrame media={selected.media} compact />
                </div>
            </div>
        </section>
    );
}
