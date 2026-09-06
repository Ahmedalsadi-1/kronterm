import { Bot, Boxes, GitPullRequest, PanelTop, PanelsTopLeft, Terminal, Workflow } from "lucide-react";
import { productAssets } from "../data/site";
import { Backlight } from "./MagicUiFrames";

const capabilityCards = [
    {
        title: "Vertical tabs",
        text: "Keep terminal sessions, browser work, sandboxes, and agent tasks visible with workspace metadata instead of buried app windows.",
        media: { type: "image", src: productAssets.devElectron, alt: "Kronterm dev app showing vertical tabs and side tool rail" },
        icon: PanelsTopLeft,
        size: "large"
    },
    {
        title: "Interactive code review",
        text: "Review changes, inspect diffs, attach terminal evidence, and send unresolved work back to KronosCode with context intact.",
        media: { type: "image", src: productAssets.diff, alt: "KronosCode interactive code review diff panel" },
        icon: GitPullRequest,
        size: "large"
    },
    {
        title: "Browser validation",
        text: "Run the app where it renders, keep browser context near logs, and validate UI behavior beside the terminal.",
        media: { type: "video", src: productAssets.browserVideo, alt: "Kronterm browser validation workflow" },
        icon: PanelTop,
        size: "wide"
    },
    {
        title: "Side rail context",
        text: "Files, git tree, web, sandbox, sysinfo, apps, and settings live in the same workspace surface.",
        media: { type: "image", src: productAssets.sidepanel, alt: "Kronterm side rail and workspace tools" },
        icon: Workflow,
        size: "small"
    },
    {
        title: "Sandbox control",
        text: "Move risky browser automation and desktop actions into isolated environments with visible status.",
        media: { type: "video", src: productAssets.sandboxVideo, alt: "Kronterm sandbox control workflow" },
        icon: Boxes,
        size: "small"
    },
    {
        title: "Terminal execution",
        text: "Let KronosCode read output, explain failures, and request approval before the next command runs.",
        media: { type: "video", src: productAssets.devServerVideo, alt: "Kronterm terminal execution and dev server workflow" },
        icon: Terminal,
        size: "small"
    },
    {
        title: "KronosCode engine",
        text: "The AI engine coordinates files, terminal output, browser context, sandboxes, and agent activity.",
        media: { type: "image", src: productAssets.agent, alt: "KronosCode agent panel inside Kronterm" },
        icon: Bot,
        size: "small"
    }
];

export function KrontermCapabilitiesBento() {
    return (
        <section className="capabilities-bento" aria-labelledby="capabilities-bento-title">
            <div className="capabilities-heading">
                <p className="eyebrow">Capabilities</p>
                <h2 id="capabilities-bento-title">Build, review, and ship in one surface.</h2>
                <p>Core Kronterm surfaces, structured for fast iteration with KronosCode in the loop.</p>
            </div>
            <div className="capabilities-grid">
                {capabilityCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <article className={`capability-card ${card.size}`} key={card.title}>
                            <Backlight className="capability-backlight">
                                <div className="capability-media">
                                    {card.media.type === "video" ? (
                                        <video src={card.media.src} aria-label={card.media.alt} autoPlay muted loop playsInline preload="metadata" />
                                    ) : (
                                        <img src={card.media.src} alt={card.media.alt} loading="eager" decoding="async" />
                                    )}
                                </div>
                            </Backlight>
                            <div className="capability-copy">
                                <Icon size={18} aria-hidden="true" />
                                <div>
                                    <h3>{card.title}</h3>
                                    <p>{card.text}</p>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
