import { useState } from "react";
import { workflowTabs } from "../data/site";
import { MediaFrame } from "./MediaFrame";

export function WorkflowTabs() {
    const [active, setActive] = useState(0);
    const selected = workflowTabs[active];

    return (
        <section className="section">
            <div className="section-heading">
                <p className="eyebrow">Workspace control</p>
                <h2>Be more productive. Stay in control.</h2>
                <p>
                    Kronterm adapts Warp-style product storytelling into a Kronterm-native system: terminal,
                    browser, sandbox, files, and KronosCode all share one workspace.
                </p>
            </div>
            <div className="tab-panel">
                <div className="tab-list" role="tablist" aria-label="Kronterm workspace surfaces">
                    {workflowTabs.map((tab, index) => (
                        <button
                            className={index === active ? "active" : ""}
                            type="button"
                            key={tab.label}
                            onClick={() => setActive(index)}
                            role="tab"
                            aria-selected={index === active}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="tab-content">
                    <div>
                        <h3>{selected.title}</h3>
                        <p>{selected.text}</p>
                    </div>
                    <MediaFrame media={selected.media} compact />
                </div>
            </div>
        </section>
    );
}
