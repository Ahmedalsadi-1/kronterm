import { useState } from "react";
import { productAssets } from "../data/site";

const workflowItems = [
    {
        label: "Vertical tabs",
        text: "Display terminal sessions, browser work, sandboxes, and agent tasks as vertical tabs with branch, worktree, and review metadata.",
        media: { type: "image", src: productAssets.hero, alt: "Kronterm vertical tabs with terminal, browser, and workspace panels" }
    },
    {
        label: "Notifications",
        text: "KronosCode can notify you when it needs approval, has a plan ready, finished a sandbox run, or found a review issue.",
        media: { type: "image", src: productAssets.agent, alt: "KronosCode agent notification and workspace planning panel" }
    },
    {
        label: "Interactive code review",
        text: "Review changes, leave comments, inspect diffs, and send work back to agents without leaving the Kronterm workspace.",
        media: { type: "image", src: productAssets.diff, alt: "KronosCode diff panel for interactive code review" }
    },
    {
        label: "Sandbox handoff",
        text: "Move from terminal work to isolated execution environments when browser automation, tests, or agent experiments need containment.",
        media: { type: "video", src: productAssets.sandboxVideo, alt: "Kronterm sandbox handoff workflow video" }
    }
];

export function KrontermNativeWorkflows() {
    const [activeIndex, setActiveIndex] = useState(0);
    const active = workflowItems[activeIndex];

    return (
        <section className="native-workflows" aria-labelledby="native-workflows-title">
            <div className="native-workflows-heading">
                <p className="eyebrow">Kronterm</p>
                <h2 id="native-workflows-title">Agent workflows that feel native.</h2>
                <p>Switch between assisted and manual workflows without leaving the Kronterm workspace.</p>
            </div>
            <div className="native-workflows-panel">
                <div className="native-tabs" role="tablist" aria-label="Kronterm native workflow previews">
                    {workflowItems.map((item, index) => (
                        <button
                            className={index === activeIndex ? "active" : ""}
                            key={item.label}
                            type="button"
                            role="tab"
                            aria-selected={index === activeIndex}
                            aria-controls="native-workflow-preview"
                            onClick={() => setActiveIndex(index)}
                        >
                            <span>{item.label}</span>
                            <p>{item.text}</p>
                        </button>
                    ))}
                </div>
                <div className="native-preview" id="native-workflow-preview" role="tabpanel">
                    <div className="native-preview-bg" aria-hidden="true" />
                    <div className="native-preview-window">
                        <div className="native-preview-toolbar" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                            <strong>{active.label}</strong>
                        </div>
                        {active.media.type === "video" ? (
                            <video
                                src={active.media.src}
                                aria-label={active.media.alt}
                                autoPlay
                                muted
                                loop
                                playsInline
                                preload="metadata"
                            />
                        ) : (
                            <img src={active.media.src} alt={active.media.alt} />
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
