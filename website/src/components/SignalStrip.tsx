const signals = [
    "Terminal-aware",
    "Desktop-native",
    "MCP connected",
    "Sandbox ready",
    "Browser automation",
    "Private deployment",
    "AI-native",
    "Cross-platform",
];

export default function SignalStrip() {
    return (
        <div className="signal-strip">
            <div className="signal-track">
                {[...signals, ...signals].map((signal, i) => (
                    <div key={`${signal}-${i}`} className="signal-item">
                        <span className="dot" />
                        <span>{signal}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
