import { ArrowRight, Copy, GitPullRequest, Terminal } from "lucide-react";
import { Link } from "react-router-dom";
import { productAssets } from "../data/site";

const taskRows = [
    { title: "Map changed files to review risk", stat: "+12 -3", done: true },
    { title: "Check terminal test output", stat: "+4 -1", done: true },
    { title: "Inspect browser-facing state", stat: "+7 -2", done: false },
    { title: "Prepare human review summary", stat: "next", done: false }
];

export function CodeReviewHero() {
    return (
        <section className="review-agent-hero" aria-labelledby="review-agent-title">
            <div className="review-agent-copy">
                <h1 id="review-agent-title">Supercharge code review workflows with KronosCode</h1>
                <p>
                    Delegate first-pass review to a workspace-aware AI engine with terminal evidence, file diffs, browser context, side panels, and granular human-approved execution.
                </p>
                <div className="review-command-row">
                    <Link className="review-download" to="/contact-sales">
                        Request access <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                    <div className="review-command">
                        <code>kronterm review --workspace .</code>
                        <Copy size={15} aria-hidden="true" />
                    </div>
                </div>
            </div>

            <div className="review-workspace-card" aria-label="Kronterm code review workspace preview">
                <div className="review-window-bar" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <strong>Code review</strong>
                </div>
                <div className="review-workspace-grid">
                    <div className="review-left-panel">
                        <div className="review-context-line">
                            <GitPullRequest size={15} aria-hidden="true" />
                            <span>Review pull request #42</span>
                        </div>
                        <h2>Task 4: Update API route and validate UI state</h2>
                        <div className="review-task-list">
                            {taskRows.map((row) => (
                                <div className={row.done ? "review-task done" : "review-task"} key={row.title}>
                                    <span>{row.done ? "✓" : "○"}</span>
                                    <strong>{row.title}</strong>
                                    <em>{row.stat}</em>
                                </div>
                            ))}
                        </div>
                        <div className="review-diff-panel">
                            <div>
                                <span>src/workflows/review.ts</span>
                                <strong>+53 -12</strong>
                            </div>
                            <img src={productAssets.diff} alt="KronosCode diff panel showing file changes for review" />
                        </div>
                        <div className="review-terminal-strip">
                            <Terminal size={15} aria-hidden="true" />
                            <code>tests passed · browser preview checked · waiting for approval</code>
                        </div>
                    </div>
                    <aside className="review-side-doc">
                        <p>Problem Statement</p>
                        <h2>Current State Overview</h2>
                        <span>
                            KronosCode found touched files, connected test output to changed code, and summarized the risks that need human attention before merge.
                        </span>
                        <h3>Architecture</h3>
                        <ul>
                            <li>Terminal output is attached to review findings.</li>
                            <li>Browser state is visible for product changes.</li>
                            <li>Side panels keep files, git, and agent context close.</li>
                        </ul>
                        <div className="review-side-image">
                            <img src={productAssets.sidepanel} alt="Kronterm side panel with files, git, web, sandbox, apps, and settings" />
                        </div>
                    </aside>
                </div>
            </div>
        </section>
    );
}
