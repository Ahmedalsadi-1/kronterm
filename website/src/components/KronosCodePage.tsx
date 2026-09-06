import { ArrowRight, Bot, Boxes, CheckCircle2, Code2, Globe, MonitorPlay, Terminal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { productAssets, type Media } from "../data/site";
import { KronosCodeTuiSection } from "./KronosCodeTuiSection";
import { MediaFrame } from "./MediaFrame";

const trustTiles = ["Founders", "AI labs", "Product teams", "Agent builders", "Platform teams", "Security leads", "Devtools teams", "Automation teams"];

type DeckSection = {
    eyebrow: string;
    title: string;
    text: string;
    media: Media;
    icon: LucideIcon;
    points: string[];
};

const deckSections: DeckSection[] = [
    {
        eyebrow: "KronosCode engine",
        title: "The AI engine gets the same workspace evidence you use.",
        text: "KronosCode reads terminal output, browser state, file trees, diffs, sandbox activity, and project context before it proposes the next move.",
        media: { type: "image", src: productAssets.agent, alt: "KronosCode agent prompt with workspace context inside Kronterm" },
        icon: Bot,
        points: ["Workspace-aware reasoning", "Plan inspection", "Human-approved actions"]
    },
    {
        eyebrow: "Kronterm workspace",
        title: "Terminal, browser, editor, files, and agents stay in one command center.",
        text: "Kronterm gives KronosCode a structured desktop surface instead of isolated chat. Every block can become context for debugging, coding, browsing, testing, and automation.",
        media: { type: "image", src: productAssets.hero, alt: "Kronterm desktop workspace with terminal, browser, files, and side panels" },
        icon: MonitorPlay,
        points: ["Programmable layouts", "Files and previews", "Shared workspace memory"]
    },
    {
        eyebrow: "Sandbox execution",
        title: "Run experiments inside controlled environments.",
        text: "Use sandboxes for browser automation, tests, dev servers, and agent-assisted execution while keeping risky work visible and contained.",
        media: { type: "video", src: productAssets.sandboxVideo, alt: "Kronterm sandbox workflow demonstration" },
        icon: Boxes,
        points: ["Isolated workflows", "Approval checkpoints", "Local and cloud model support"]
    },
    {
        eyebrow: "Browser context",
        title: "Validate what KronosCode changes against the running product.",
        text: "KronosCode can reason with browser context, app previews, screenshots, and live failures so frontend work is grounded in what actually renders.",
        media: { type: "video", src: productAssets.browserVideo, alt: "Kronterm browser widget showing live app validation" },
        icon: Globe,
        points: ["Live app previews", "Bug reproduction", "Visual feedback loops"]
    },
    {
        eyebrow: "Terminal control",
        title: "Commands remain readable, reversible, and approval-driven.",
        text: "KronosCode watches command output, explains failures, proposes fixes, and asks before execution so builders stay in control of serious work.",
        media: { type: "image", src: productAssets.diff, alt: "KronosCode diff and terminal output review inside Kronterm" },
        icon: Terminal,
        points: ["Terminal output awareness", "Diff review", "User-approved execution"]
    },
    {
        eyebrow: "Agent-ready workspace",
        title: "Coordinate agents without losing the thread.",
        text: "Kronterm is built for serious builders who want to supervise local agents, cloud agents, sandboxes, files, browser tasks, and code changes in one place.",
        media: { type: "image", src: productAssets.apps, alt: "Kronterm streamable apps and agent workflow surface" },
        icon: Code2,
        points: ["Agent orchestration", "Visible work logs", "Commercial team workflows"]
    }
];

export function KronosCodePage() {
    return (
        <>
            <section className="kronos-cloud-hero" aria-labelledby="kronos-cloud-title">
                <div className="kronos-cloud-copy">
                    <p className="cloud-label">KronosCode</p>
                    <h1 id="kronos-cloud-title">
                        The next level of workspace autonomy
                        <span>KronosCode operates across terminal, browser, files, sandboxes, and agents.</span>
                    </h1>
                    <Link className="cloud-cta" to="/contact-sales">
                        Request KronosCode beta <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                </div>
                <div className="cloud-product-stage" aria-label="KronosCode workspace product preview">
                    <div className="cloud-product-card">
                        <div className="cloud-window-bar" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                            <strong>kronterm://workspace/agents</strong>
                        </div>
                        <div className="cloud-window-grid">
                            <aside>
                                <strong>This Week</strong>
                                <span className="active">AI-native onboarding flow</span>
                                <span>Repair failing test suite</span>
                                <span>Sandbox browser run</span>
                                <span>Review pull request diff</span>
                                <span>Port CLI workflow</span>
                            </aside>
                            <div className="cloud-agent-panel">
                                <p className="panel-title">Workspace plan</p>
                                <div className="prompt-line">Build a launch-ready page for KronosCode with browser, sandbox, and terminal context.</div>
                                <p className="panel-body">
                                    KronosCode inspected the workspace, found active assets, mapped product sections, and prepared a human-approved execution plan.
                                </p>
                                <div className="mini-media">
                                    <img src={productAssets.agent} alt="KronosCode agent context preview" />
                                    <button type="button">Review plan</button>
                                </div>
                                <div className="follow-up">Approve command...</div>
                            </div>
                            <div className="cloud-control-panel">
                                <div className="cloud-tabs" aria-hidden="true">
                                    <span>Git</span>
                                    <span className="selected">Desktop</span>
                                    <span>Terminal</span>
                                    <span>Files</span>
                                </div>
                                <img src={productAssets.hero} alt="Kronterm full workspace controlled by KronosCode" />
                                <button type="button">Take control</button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="trust-strip" aria-label="KronosCode audience">
                <p>Built for serious builders and commercial teams</p>
                <div>
                    {trustTiles.map((tile) => (
                        <span key={tile}>{tile}</span>
                    ))}
                </div>
            </section>

            <section className="kronos-deck" aria-labelledby="kronos-deck-title">
                <div className="section-heading">
                    <p className="eyebrow">Across every workspace surface</p>
                    <h2 id="kronos-deck-title">Each KronosCode capability gets its own product section.</h2>
                    <p>KronosCode is not a homepage feature block. It is the intelligence layer for the full Kronterm workspace.</p>
                </div>
                <div className="kronos-deck-list">
                    {deckSections.map((section) => {
                        const Icon = section.icon;
                        return (
                            <article className="kronos-deck-card" key={section.title}>
                                <div className="deck-copy">
                                    <p className="eyebrow">{section.eyebrow}</p>
                                    <h3>{section.title}</h3>
                                    <p>{section.text}</p>
                                    <ul>
                                        {section.points.map((point) => (
                                            <li key={point}>
                                                <CheckCircle2 size={16} aria-hidden="true" />
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="deck-media-shell">
                                    <div className="deck-icon" aria-hidden="true">
                                        <Icon size={18} />
                                    </div>
                                    <MediaFrame media={section.media} compact />
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>

            <KronosCodeTuiSection />
        </>
    );
}
