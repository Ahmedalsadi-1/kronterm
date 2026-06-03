import {
    Bot,
    Boxes,
    Code2,
    Eye,
    Globe2,
    LayoutGrid,
    LockKeyhole,
    MonitorUp,
    Search,
    TerminalSquare,
    Workflow,
    Zap,
} from "lucide-react";

const tools = [
    [TerminalSquare, "Terminal blocks", "Command output stays readable, persistent, and ready for automation."],
    [Bot, "KronosCode", "Direct an agent that operates inside the workspace instead of beside it."],
    [Globe2, "Browser preview", "Keep docs, localhost previews, and browser tasks inside the active canvas."],
    [Boxes, "Sandbox tasks", "Hand complex work to isolated environments without losing visibility."],
    [LayoutGrid, "Flexible layouts", "Resize, split, and focus blocks as the task changes shape."],
    [Workflow, "MCP tools", "Connect intent to desktop actions with auditable execution steps."],
    [Eye, "Visible state", "Review what changed, what ran, and what needs your attention."],
    [MonitorUp, "Desktop apps", "Bring streamed desktop surfaces into your command center."],
    [Search, "Fast context", "Move through files, output, and tasks without breaking focus."],
    [Code2, "Dev loop", "Build, run, inspect, and verify from one operating surface."],
    [LockKeyhole, "Private workspaces", "Keep workflows controlled around your deployment model."],
    [Zap, "Reusable routines", "Turn repeated desktop work into a repeatable operation."],
];

export default function ToolkitGrid() {
    return (
        <section style={{ padding: "var(--space-section) 24px" }}>
            <div style={{ maxWidth: "var(--content-max-width)", margin: "0 auto" }}>
                <div style={{ marginBottom: "48px" }}>
                    <span className="warp-eyebrow">Built into the command center</span>
                    <h2
                        style={{
                            marginTop: "16px",
                            fontFamily: "var(--font-heading)",
                            fontSize: "clamp(2rem, 4.5vw, 4rem)",
                            fontWeight: 590,
                            letterSpacing: "-0.075em",
                            lineHeight: 0.98,
                        }}
                    >
                        More workspace.
                        <br />
                        <span className="text-gradient">Less app switching.</span>
                    </h2>
                    <p
                        style={{
                            color: "var(--text-secondary)",
                            fontSize: "15px",
                            lineHeight: 1.65,
                            marginTop: "16px",
                            maxWidth: "600px",
                        }}
                    >
                        KronTerm centralizes the surfaces your workload depends on and gives KronosCode a real
                        environment to operate.
                    </p>
                </div>
                <div className="toolkit-grid">
                    {tools.map(([Icon, toolTitle, description]) => (
                        <article key={toolTitle as string} className="toolkit-card">
                            <Icon />
                            <h3>{toolTitle as string}</h3>
                            <p>{description as string}</p>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
