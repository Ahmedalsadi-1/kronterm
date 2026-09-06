import { CheckCircle2, Globe2, MonitorPlay, Smartphone } from "lucide-react";
import { productAssets } from "../data/site";
import { Backlight, IphoneFrame, MagicGlobe, SafariFrame } from "./MagicUiFrames";

const approvalSteps = ["Read terminal output", "Inspect browser state", "Review proposed diff", "Approve next command"];

export function ProductDeviceShowcase() {
    return (
        <section className="device-showcase" aria-labelledby="device-showcase-title">
            <div className="device-showcase-heading">
                <p className="eyebrow">Interface kit</p>
                <h2 id="device-showcase-title">Kronterm gives KronosCode more than a prompt box.</h2>
                <p>
                    The workspace includes browser previews, terminal sessions, files, sandboxes, and model routing surfaces. These are the contexts KronosCode can understand before it asks to edit code or run commands.
                </p>
            </div>

            <div className="device-showcase-grid">
                <article className="device-card safari-card">
                    <div className="device-card-copy">
                        <MonitorPlay size={18} aria-hidden="true" />
                        <div>
                            <h3>Browser context inside the builder loop.</h3>
                            <p>Validate the app where it actually renders, keep the repro beside logs, and let KronosCode reason across browser state and terminal output.</p>
                        </div>
                    </div>
                    <Backlight className="device-backlight">
                        <SafariFrame url="localhost:5173/workflows">
                            <video src={productAssets.browserVideo} aria-label="Kronterm browser widget running inside a Safari-style product frame" autoPlay muted loop playsInline preload="metadata" />
                        </SafariFrame>
                    </Backlight>
                </article>

                <article className="device-card phone-card">
                    <div className="device-card-copy">
                        <Smartphone size={18} aria-hidden="true" />
                        <div>
                            <h3>Approval flow that still works in compact views.</h3>
                            <p>Use the same command gates, review states, and agent status when the workspace collapses down to a narrow layout.</p>
                        </div>
                    </div>
                    <Backlight className="device-backlight">
                        <IphoneFrame>
                            <div className="iphone-demo-content">
                                <p>KronosCode</p>
                                <h4>Refactor checkpoint</h4>
                                {approvalSteps.map((step) => (
                                    <span key={step}>
                                        <CheckCircle2 size={14} aria-hidden="true" />
                                        {step}
                                    </span>
                                ))}
                                <button type="button">Approve run</button>
                            </div>
                        </IphoneFrame>
                    </Backlight>
                </article>

                <article className="device-card globe-card">
                    <div className="device-card-copy">
                        <Globe2 size={18} aria-hidden="true" />
                        <div>
                            <h3>Local and cloud model support, routed through one workspace.</h3>
                            <p>Kronterm is designed for serious builders who want KronosCode to coordinate private local work, cloud models, sandboxed agents, and human-approved execution from the same command center.</p>
                        </div>
                    </div>
                    <MagicGlobe />
                    <div className="globe-stat-row" aria-label="Kronterm model support highlights">
                        <span>Local models</span>
                        <span>Cloud models</span>
                        <span>Agent sandboxes</span>
                    </div>
                </article>
            </div>
        </section>
    );
}
