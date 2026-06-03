import { motion } from "framer-motion";

interface TerminalMockupProps {
    lines: string[];
    accentLine?: number;
    className?: string;
}

export default function TerminalMockup({ lines, accentLine = -1, className = "" }: TerminalMockupProps) {
    return (
        <div className={`terminal-mockup ${className}`}>
            <div className="terminal-mockup-bar">
                <div className="terminal-mockup-dots">
                    <span />
                    <span />
                    <span />
                </div>
                <span className="terminal-mockup-title">bash — zsh</span>
                <span className="terminal-mockup-status">●</span>
            </div>
            <div className="terminal-mockup-body">
                {lines.map((line, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.04 }}
                        className={`terminal-mockup-line ${i === accentLine ? "accent" : ""}`}
                    >
                        {line.startsWith("$") ? (
                            <>
                                <span className="terminal-mockup-prompt">$</span>
                                <span>{line.slice(1)}</span>
                            </>
                        ) : line.startsWith("›") ? (
                            <>
                                <span className="terminal-mockup-prompt">›</span>
                                <span>{line.slice(1)}</span>
                            </>
                        ) : (
                            <span>{line}</span>
                        )}
                    </motion.div>
                ))}
                <div className="terminal-mockup-cursor">
                    <span className="terminal-mockup-prompt">$</span>
                    <span className="terminal-mockup-blink">_</span>
                </div>
            </div>
        </div>
    );
}
