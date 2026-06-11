import { Boxes, Files, GitBranch, Globe, Settings, Sparkles } from "lucide-react";
import { productAssets } from "../data/site";

const sidePanelItems = [
    { icon: Files, label: "Files", text: "Inspect project structure and keep edited files close to the active workspace." },
    { icon: GitBranch, label: "Git", text: "Track branches, diffs, pull requests, and review state without leaving Kronterm." },
    { icon: Globe, label: "Web", text: "Keep browser previews and references beside terminal and code context." },
    { icon: Boxes, label: "Sandbox", text: "Route risky tests, automation, and agent execution into controlled environments." },
    { icon: Sparkles, label: "KronosCode", text: "Expose side-panel context to the AI engine for better planning and review." },
    { icon: Settings, label: "Settings", text: "Configure models, permissions, layouts, and execution boundaries." }
];

export function SidePanelShowcase() {
    return (
        <section className="sidepanel-showcase" aria-labelledby="sidepanel-title">
            <div className="sidepanel-copy">
                <p className="eyebrow">Side panel command layer</p>
                <h2 id="sidepanel-title">Every workspace surface is one click from the side panel.</h2>
                <p>
                    Kronterm’s side panel makes files, git, browser context, sandboxes, apps, and KronosCode controls feel like one product surface instead of disconnected tools.
                </p>
            </div>
            <div className="sidepanel-layout">
                <div className="sidepanel-visual">
                    <img src={productAssets.sidepanel} alt="Kronterm side panel showing files, git tree, web, sandbox, apps, and settings" />
                    <div className="sidepanel-glass-card">
                        <strong>KronosCode context</strong>
                        <span>Files, git state, browser preview, sandbox logs, and approval controls are available from the same panel.</span>
                    </div>
                </div>
                <div className="sidepanel-list">
                    {sidePanelItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <article key={item.label}>
                                <Icon size={18} aria-hidden="true" />
                                <div>
                                    <h3>{item.label}</h3>
                                    <p>{item.text}</p>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
