import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { productAssets, type Media } from "../data/site";
import { MediaFrame } from "./MediaFrame";

type StoryItem = {
    id: string;
    label: string;
    title: string;
    text: string;
    cta: string;
    href: string;
    media: Media;
};

const storyItems: StoryItem[] = [
    {
        id: "workspace",
        label: "Kronterm workspace",
        title: "Start in one programmable workspace",
        text: "Open terminal sessions, browser previews, files, sandboxes, memory panels, and agent controls in one focused desktop command center.",
        cta: "Learn more",
        href: "/product",
        media: {
            type: "image",
            src: productAssets.hero,
            alt: "Kronterm workspace with terminal, browser, sandbox, system graph, files, and side controls"
        }
    },
    {
        id: "kronoscode",
        label: "KronosCode",
        title: "Give AI the whole workspace",
        text: "KronosCode reads terminal output, sees browser context, inspects files, reasons across project state, and helps operate with human approval.",
        cta: "Explore KronosCode",
        href: "/kronoscode",
        media: {
            type: "image",
            src: productAssets.agent,
            alt: "KronosCode agent prompt inside the Kronterm workspace"
        }
    },
    {
        id: "browser",
        label: "Browser and previews",
        title: "Validate product work where it runs",
        text: "Keep browser context next to commands and code so debugging, UI checks, docs, and automation work stay connected to the agent loop.",
        cta: "View workflows",
        href: "/workflows",
        media: {
            type: "video",
            src: productAssets.browserVideo,
            alt: "Kronterm browser widget demonstration"
        }
    },
    {
        id: "sandbox",
        label: "Sandboxes and agents",
        title: "Control execution without hiding it",
        text: "Use sandboxes, visible command output, file diffs, and explicit approval points to supervise local and cloud model workflows.",
        cta: "Review security",
        href: "/security",
        media: {
            type: "video",
            src: productAssets.sandboxVideo,
            alt: "Kronterm sandbox demonstration"
        }
    }
];

export function WorkspaceScroll() {
    const [activeId, setActiveId] = useState(storyItems[0].id);
    const itemRefs = useRef<Record<string, HTMLElement | null>>({});

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
                if (visible?.target.id) {
                    setActiveId(visible.target.id);
                }
            },
            {
                rootMargin: "-28% 0px -46% 0px",
                threshold: [0.2, 0.45, 0.7]
            }
        );

        Object.values(itemRefs.current).forEach((node) => {
            if (node) {
                observer.observe(node);
            }
        });

        return () => observer.disconnect();
    }, []);

    return (
        <section className="workspace-scroll" id="why-kronterm">
            <div className="workspace-scroll-heading">
                <p className="eyebrow">Why Kronterm</p>
                <h2>Be more productive. Stay in control.</h2>
            </div>
            <div className="workspace-scroll-grid">
                <aside className="workspace-rail" aria-label="Kronterm workspace sections">
                    {storyItems.map((item) => (
                        <a className={item.id === activeId ? "active" : ""} href={`#${item.id}`} key={item.id}>
                            <span className="rail-icon" aria-hidden="true" />
                            {item.label}
                        </a>
                    ))}
                </aside>
                <div className="workspace-story">
                    {storyItems.map((item) => (
                        <article
                            className="workspace-story-item"
                            id={item.id}
                            key={item.id}
                            ref={(node) => {
                                itemRefs.current[item.id] = node;
                            }}
                        >
                            <p className="story-label">
                                <span aria-hidden="true" />
                                {item.label}
                            </p>
                            <div className="story-copy-row">
                                <div>
                                    <h3>{item.title}</h3>
                                    <p>{item.text}</p>
                                </div>
                                <Link className="story-button" to={item.href}>
                                    {item.cta}
                                </Link>
                            </div>
                            <MediaFrame media={item.media} compact />
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
