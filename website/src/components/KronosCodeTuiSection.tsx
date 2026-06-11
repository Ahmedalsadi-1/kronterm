import { Copy } from "lucide-react";
import { Link } from "react-router-dom";

const learnCards = [
    {
        title: "Get started with KronosCode TUI",
        text: "Set up the terminal client, connect your workspace, and start with human-approved agent execution.",
        href: "/docs"
    },
    {
        title: "Headless workspace runs",
        text: "Run KronosCode from scripts and automation workflows while keeping logs and approval points visible.",
        href: "/workflows"
    },
    {
        title: "Shell mode",
        text: "Let KronosCode reason over command output, propose fixes, and continue only when execution is approved.",
        href: "/terminal"
    },
    {
        title: "Agent control",
        text: "Coordinate local and cloud model agents with workspace context, file diffs, and terminal state.",
        href: "/use-cases/agent-builders"
    }
];

const wolfAscii = String.raw`
          .@@.
       .@@@@@@.
      @@@@  @@@@
   .@@@  .@@.  @@@.
  @@@   @@@@@@   @@@
 @@@  @@  @@  @@  @@@
 @@  @@   @@   @@  @@
 @@  @@  @@@@  @@  @@
 @@@  @@@@@@@@@@  @@@
  @@@   @@@@@@   @@@
   @@@@  @@@@  @@@@
     @@@@@@@@@@@@
      @@  @@  @@
        @@  @@
`;

export function KronosCodeTuiSection() {
    return (
        <section className="kronos-tui-section" aria-labelledby="kronos-tui-title">
            <div className="kronos-tui-inner">
                <div className="learn-more-grid">
                    <h2>Learn more</h2>
                    <div className="learn-card-grid">
                        {learnCards.map((card) => (
                            <Link className="learn-card" to={card.href} key={card.title}>
                                <strong>{card.title}</strong>
                                <span>{card.text}</span>
                                <em>Read documentation →</em>
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="tui-try">
                    <div className="wolf-orbit" aria-hidden="true">
                        <pre>{wolfAscii}</pre>
                    </div>
                    <h2 id="kronos-tui-title">Try KronosCode TUI.</h2>
                    <div className="tui-command-pill" aria-label="KronosCode TUI command">
                        <code>kronoscode tui --workspace .</code>
                        <Copy size={16} aria-hidden="true" />
                    </div>
                </div>
            </div>
        </section>
    );
}
