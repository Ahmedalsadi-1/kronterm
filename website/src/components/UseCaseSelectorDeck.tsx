import { useState } from "react";
import type { MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Bot, Boxes, GitPullRequest, Network, PanelTop, Terminal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { productAssets, type Media } from "../data/site";
import { Backlight } from "./MagicUiFrames";

type UseCase = {
    label: string;
    kicker: string;
    title: string;
    href: string;
    cardText: string;
    description: string;
    outcome: string;
    media: Media;
    icon: LucideIcon;
    evidence: string[];
};

const useCases: UseCase[] = [
    {
        label: "Code review",
        kicker: "Diffs + terminal evidence",
        title: "Review changes with the workspace still open.",
        href: "/use-cases/code-review",
        cardText: "Inspect diffs, terminal output, browser state, and side-panel context before a human pass.",
        description:
            "Kronterm turns code review into a workspace-native loop instead of a detached comment thread. KronosCode can inspect the file diff, connect the changed files to terminal test output, use browser context when UI behavior matters, and present the risky parts back to the builder with explicit approval points.",
        outcome:
            "A reviewer sees what changed, why it changed, which commands ran, what failed or passed, and what still needs human judgment before merge.",
        media: { type: "image", src: productAssets.diff, alt: "KronosCode file diff panel for code review" },
        icon: GitPullRequest,
        evidence: ["AI file diff view", "terminal scrollback tools", "side-panel files and git tree", "human-approved execution"]
    },
    {
        label: "Bug investigation",
        kicker: "Browser + logs + files",
        title: "Reproduce failures where the product actually runs.",
        href: "/use-cases/bug-investigation",
        cardText: "Keep browser widgets, terminal logs, files, and sandbox state together while narrowing root cause.",
        description:
            "When a bug crosses frontend, backend, and environment boundaries, Kronterm keeps the evidence in one place. The browser widget can hold the repro, the terminal can hold dev server and test output, files stay inspectable in the same workspace, and KronosCode can reason across those surfaces instead of guessing from a pasted stack trace.",
        outcome:
            "A vague report becomes a concrete chain of evidence: reproduction steps, observed browser behavior, relevant logs, suspected files, and the next approved command or edit.",
        media: { type: "video", src: productAssets.browserVideo, alt: "Kronterm browser widget used for bug investigation" },
        icon: PanelTop,
        evidence: ["web browser widget", "dev server terminal output", "file explorer context", "KronosCode workspace reasoning"]
    },
    {
        label: "Refactors",
        kicker: "Plan + edit + validate",
        title: "Move large changes through visible checkpoints.",
        href: "/use-cases/refactors",
        cardText: "Plan multi-file edits, inspect diffs, run validation, and keep every command approval-driven.",
        description:
            "Refactors fail when the plan, edits, and validation live in different places. Kronterm lets builders keep the current branch, active files, diff preview, terminal commands, and KronosCode plan in view while changes move from idea to tested result. The AI can assist across files, but the builder keeps control over commands and final acceptance.",
        outcome:
            "A large code change is broken into an inspectable plan, concrete edits, reviewable diffs, test runs, and a summary that explains what changed and what still deserves attention.",
        media: { type: "image", src: productAssets.explorer, alt: "KronosCode file explorer and project context for refactoring" },
        icon: Network,
        evidence: ["file tree context", "diff review surface", "terminal command gates", "workspace tabs and blocks"]
    },
    {
        label: "Agent builders",
        kicker: "Sandbox + desktop control",
        title: "Build and supervise agents inside a real workspace.",
        href: "/use-cases/agent-builders",
        cardText: "Coordinate local agents, cloud models, browser tasks, sandbox desktops, and project files.",
        description:
            "Kronterm is built for people creating agent systems, not only people prompting one. The product includes terminal control, browser widgets, sandbox desktop tools, file access, agent panels, and model/provider configuration surfaces. That gives agent builders a command center for testing tools, observing behavior, and approving actions before automation touches real work.",
        outcome:
            "Agent workflows become observable: what the agent saw, which desktop or browser action it took, what files it touched, which command it wants next, and where a human approved or stopped the run.",
        media: { type: "image", src: productAssets.devElectron, alt: "Kronterm dev Electron app showing terminal, vertical tabs, and side tool rail" },
        icon: Bot,
        evidence: ["sandbox desktop tools", "agent control panel", "local and cloud model support", "terminal and browser operation"]
    }
];

export function UseCaseSelectorDeck() {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [openingIndex, setOpeningIndex] = useState<number | null>(null);
    const navigate = useNavigate();
    const selected = useCases[selectedIndex];
    const SelectedIcon = selected.icon;

    function openUseCase(index: number, href: string, event: MouseEvent<HTMLAnchorElement>) {
        event.preventDefault();
        setSelectedIndex(index);

        const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (shouldReduceMotion) {
            navigate(href);
            return;
        }

        setOpeningIndex(index);
        window.setTimeout(() => {
            navigate(href);
        }, 520);
    }

    return (
        <section className="usecase-selector-deck" aria-labelledby="usecase-selector-title">
            <div className="usecase-selector-copy">
                <p className="usecase-index">[ 02 ] —— Use cases</p>
                <h2 id="usecase-selector-title">
                    Built for
                    <span>every builder role.</span>
                </h2>
                <p>From code review to agent builders, real workflows powered by Kronterm and KronosCode.</p>
            </div>

            <div className={`usecase-card-stage ${openingIndex == null ? "" : "is-opening"}`} aria-label="Use case cards">
                {useCases.map((useCase, index) => (
                    <Link
                        className={`paper-usecase-card card-${index + 1} ${index === selectedIndex ? "active" : ""} ${index === openingIndex ? "opening" : ""}`}
                        key={useCase.href}
                        to={useCase.href}
                        aria-label={`Open ${useCase.label} use case page`}
                        onClick={(event) => openUseCase(index, useCase.href, event)}
                    >
                        <small>{useCase.kicker}</small>
                        <strong>{useCase.label}</strong>
                        <span>{useCase.cardText}</span>
                        <em>Open full page <ArrowRight size={14} aria-hidden="true" /></em>
                    </Link>
                ))}
            </div>

            <p className="usecase-drag-note">← select a role to explore →</p>

            <div className="usecase-selector-layout">
                <div className="usecase-selector-tabs" role="tablist" aria-label="Choose a Kronterm use case">
                    {useCases.map((useCase, index) => {
                        const Icon = useCase.icon;
                        return (
                            <button
                                className={index === selectedIndex ? "active" : ""}
                                key={useCase.label}
                                type="button"
                                role="tab"
                                aria-selected={index === selectedIndex}
                                aria-controls="usecase-detail-panel"
                                onClick={() => setSelectedIndex(index)}
                            >
                                <Icon size={17} aria-hidden="true" />
                                <span>{useCase.label}</span>
                            </button>
                        );
                    })}
                </div>

                <article className="usecase-detail-panel" id="usecase-detail-panel" role="tabpanel">
                    <div className="usecase-detail-heading">
                        <SelectedIcon size={22} aria-hidden="true" />
                        <div>
                            <p>{selected.kicker}</p>
                            <h3>{selected.title}</h3>
                        </div>
                    </div>
                    <p>{selected.description}</p>
                    <div className="usecase-outcome">
                        <strong>What visitors should understand</strong>
                        <span>{selected.outcome}</span>
                    </div>
                    <div className="usecase-evidence-grid">
                        {selected.evidence.map((item) => (
                            <span key={item}>{item}</span>
                        ))}
                    </div>
                    <Backlight className="usecase-detail-backlight">
                        <div className="usecase-detail-media">
                            {selected.media.type === "video" ? (
                                <video src={selected.media.src} aria-label={selected.media.alt} autoPlay muted loop playsInline preload="metadata" />
                            ) : (
                                <img src={selected.media.src} alt={selected.media.alt} />
                            )}
                        </div>
                    </Backlight>
                    <Link className="usecase-detail-link" to={selected.href}>
                        Read the full {selected.label} page <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                </article>
            </div>

            <div className="usecase-source-note">
                <Terminal size={15} aria-hidden="true" />
                <span>Grounded in Kronterm surfaces: terminal blocks, browser widgets, file diffs, sandbox desktop tools, side rail, and KronosCode approval flows.</span>
                <Boxes size={15} aria-hidden="true" />
            </div>
        </section>
    );
}
