import { Plus } from "lucide-react";
import { useState } from "react";

const questions = [
    [
        "What makes KronTerm different from a normal terminal?",
        "KronTerm is a block workspace for terminals, browser previews, sandboxes, and desktop surfaces. KronosCode can reason across those surfaces and coordinate visible actions inside the same workspace.",
    ],
    [
        "What can KronosCode automate?",
        "KronosCode can orchestrate terminal commands, workspace blocks, browser tasks, sandbox environments, and connected desktop routines through native tools.",
    ],
    [
        "Can teams use private deployments?",
        "Yes. Enterprise plans are designed around onboarding, controlled access, and deployment requirements for your organization.",
    ],
    [
        "Which operating systems are supported?",
        "KronTerm is designed for macOS, Linux, and Windows workflows. Contact our team for current edition availability and rollout details.",
    ],
];

export default function Faq() {
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <section style={{ borderTop: "1px solid var(--border)", padding: "var(--space-section) 24px" }}>
            <div
                style={{
                    maxWidth: "var(--content-max-width)",
                    margin: "0 auto",
                    display: "grid",
                    gap: "48px",
                    gridTemplateColumns: "0.7fr 1fr",
                }}
            >
                <div>
                    <span className="warp-eyebrow">Questions, answered</span>
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
                        Before you
                        <br />
                        take command.
                    </h2>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {questions.map(([question, answer], index) => {
                        const isOpen = index === openIndex;
                        return (
                            <article key={question} className="faq-card">
                                <button
                                    type="button"
                                    onClick={() => setOpenIndex(isOpen ? -1 : index)}
                                    className="faq-trigger"
                                >
                                    <span>{question}</span>
                                    <Plus className={isOpen ? "open" : ""} />
                                </button>
                                {isOpen && <p className="faq-answer">{answer}</p>}
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
