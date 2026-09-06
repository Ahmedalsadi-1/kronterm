import type { ReactNode } from "react";

type FrameProps = {
    children: ReactNode;
    className?: string;
};

type SafariFrameProps = FrameProps & {
    url: string;
};

export function Backlight({ children, className = "" }: FrameProps) {
    return <div className={`backlight ${className}`.trim()}>{children}</div>;
}

export function SafariFrame({ children, className = "", url }: SafariFrameProps) {
    return (
        <div className={`safari-frame ${className}`.trim()}>
            <div className="safari-toolbar" aria-hidden="true">
                <span />
                <span />
                <span />
                <div>{url}</div>
            </div>
            <div className="safari-content">{children}</div>
        </div>
    );
}

export function IphoneFrame({ children, className = "" }: FrameProps) {
    return (
        <div className={`iphone-frame ${className}`.trim()}>
            <div className="iphone-speaker" aria-hidden="true" />
            <div className="iphone-screen">{children}</div>
        </div>
    );
}

export function MagicGlobe({ className = "" }: { className?: string }) {
    return (
        <div className={`magic-globe ${className}`.trim()} aria-label="Animated Kronterm global workspace network">
            <div className="globe-core">
                <span className="globe-longitude globe-longitude-1" />
                <span className="globe-longitude globe-longitude-2" />
                <span className="globe-longitude globe-longitude-3" />
                <span className="globe-latitude globe-latitude-1" />
                <span className="globe-latitude globe-latitude-2" />
                <span className="globe-latitude globe-latitude-3" />
                <span className="globe-node node-1" />
                <span className="globe-node node-2" />
                <span className="globe-node node-3" />
                <span className="globe-node node-4" />
            </div>
            <span className="globe-orbit orbit-1" />
            <span className="globe-orbit orbit-2" />
            <span className="globe-orbit orbit-3" />
        </div>
    );
}
