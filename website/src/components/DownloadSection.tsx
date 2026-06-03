import { motion } from "framer-motion";
import { useState } from "react";

type Platform = "mac" | "linux" | "windows";

const platforms: Record<
    Platform,
    { label: string; version: string; install: string; note?: string; formats?: { name: string; archs: string[] }[] }
> = {
    mac: {
        label: "macOS",
        version: "Version 10.14+",
        install: "brew install --cask kronterm",
        formats: [{ name: ".dmg", archs: ["Universal"] }],
    },
    linux: {
        label: "Linux",
        version: "",
        install: "",
        formats: [
            { name: ".deb", archs: ["x64", "ARM64"] },
            { name: ".rpm", archs: ["x64", "ARM64"] },
            { name: ".tar.zst", archs: ["Arch Linux"] },
            { name: "AppImage", archs: ["x64", "ARM64"] },
        ],
    },
    windows: {
        label: "Windows",
        version: "Windows 11/10",
        install: "winget install KronTerm.KronTerm",
        formats: [{ name: ".exe", archs: ["x64", "ARM64"] }],
    },
};

const platformIcons: Record<Platform, React.ReactNode> = {
    mac: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.4c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
        </svg>
    ),
    linux: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12.504 0c-.155 0-.311.015-.466.04C7.26.57 3.5 4.86 3.5 10.02c0 2.78 1.14 5.29 2.97 7.09L5 20.14c-.17.57.12 1.19.69 1.42l2.07.87c.57.24 1.22-.04 1.43-.62l1.04-2.72c.44.08.89.14 1.35.14.99 0 1.94-.18 2.84-.5l1.04 2.72c.21.58.86.86 1.43.62l2.07-.87c.57-.24.86-.85.69-1.42l-1.47-4.03C19.57 14.27 21 12.14 21 10.02 21 5.52 17.19.72 12.504 0zM7 10.99c0-2.86 2.24-5.18 5-5.18s5 2.32 5 5.18c0 2.86-2.24 5.18-5 5.18s-5-2.32-5-5.18z" />
        </svg>
    ),
    windows: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M0 3.549L9.75 2.203v9.451H0zm10.977 0L24 2.203v9.695h-13.023zM0 12.346h9.75v9.451L0 20.451zm10.977 0H24v9.797l-13.023-1.848z" />
        </svg>
    ),
};

export default function DownloadSection() {
    const [active, setActive] = useState<Platform>("mac");
    const current = platforms[active];

    return (
        <section className="download-section" id="pricing">
            <div style={{ maxWidth: "var(--content-max-width)", margin: "0 auto" }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{ textAlign: "center", marginBottom: "40px" }}
                >
                    <h2
                        style={{
                            fontFamily: "var(--font-heading)",
                            fontSize: "clamp(2rem, 4.5vw, 4rem)",
                            fontWeight: 590,
                            letterSpacing: "-0.075em",
                            lineHeight: 0.98,
                        }}
                    >
                        Get KronTerm today
                    </h2>
                    <p
                        style={{
                            color: "var(--text-secondary)",
                            fontSize: "15px",
                            lineHeight: 1.65,
                            marginTop: "16px",
                        }}
                    >
                        Open source and free for individual developers.
                    </p>
                </motion.div>

                <div className="download-platform-tabs">
                    {(["mac", "linux", "windows"] as Platform[]).map((p) => (
                        <button
                            key={p}
                            className={`download-tab ${active === p ? "is-active" : ""}`}
                            onClick={() => setActive(p)}
                        >
                            {platformIcons[p]}
                            {platforms[p].label}
                        </button>
                    ))}
                </div>

                <motion.div
                    key={active}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="download-card"
                >
                    {current.version && <div className="download-version">{current.version}</div>}

                    {current.install && (
                        <div className="download-command">
                            <span className="download-prompt">$</span>
                            <code>{current.install}</code>
                        </div>
                    )}

                    {current.formats && (
                        <div className="download-formats">
                            {current.formats.map((f) => (
                                <div key={f.name} className="download-format">
                                    <span className="download-format-ext">{f.name}</span>
                                    <div className="download-format-archs">
                                        {f.archs.map((arch) => (
                                            <a key={`${f.name}-${arch}`} href="#" className="download-arch-link">
                                                {arch}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>
        </section>
    );
}
