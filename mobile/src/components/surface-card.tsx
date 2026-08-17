import {
    AppWindow,
    Bot,
    FileCode2,
    Globe2,
    LoaderCircle,
    MonitorUp,
    MoreHorizontal,
    Smartphone,
    TerminalSquare,
    X,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { Surface, SurfaceKind } from "../types";

const SurfaceIcons: Record<SurfaceKind, typeof Globe2> = {
    browser: Globe2,
    terminal: TerminalSquare,
    file: FileCode2,
    app: AppWindow,
    run: Bot,
    preview: MonitorUp,
};

interface SurfaceCardProps {
    surface: Surface;
    onOpen: (surface: Surface) => void;
    onClose: (surface: Surface) => void;
}

export const SurfaceCard = ({ surface, onOpen, onClose }: SurfaceCardProps) => {
    const Icon = surface.phoneControl ? Smartphone : SurfaceIcons[surface.kind];
    const working = surface.status === "working";
    const attention = surface.attention !== "none";

    return (
        <article className={`surface-card surface-${surface.kind} status-${surface.status}`}>
            <button className="surface-preview" type="button" onClick={() => onOpen(surface)}>
                {surface.previewUrl ? (
                    <img src={surface.previewUrl} alt="" />
                ) : (
                    <div className="surface-placeholder">
                        <span className="surface-placeholder-orbit" />
                        <Icon />
                        <small>{surface.kind}</small>
                    </div>
                )}
                <span className="surface-card-host" style={{ "--host-color": surface.hostColor } as CSSProperties}>
                    <i />
                    {surface.hostLabel}
                </span>
                <span className={`surface-state ${attention ? "has-attention" : ""}`}>
                    {working ? <LoaderCircle className="spin" /> : <i />}
                    {surface.attention === "none" ? surface.status : surface.attention}
                </span>
            </button>
            <footer>
                <button className="surface-card-main" type="button" onClick={() => onOpen(surface)}>
                    <span className="surface-type-icon">
                        <Icon />
                    </span>
                    <span>
                        <strong>{surface.title}</strong>
                        <small>{surface.subtitle}</small>
                    </span>
                </button>
                <button className="surface-card-more" type="button" aria-label={`More options for ${surface.title}`}>
                    <MoreHorizontal />
                </button>
                <button
                    className="surface-card-close"
                    type="button"
                    aria-label={`Close ${surface.title}`}
                    onClick={() => onClose(surface)}
                >
                    <X />
                </button>
            </footer>
        </article>
    );
};
