import type { Media } from "../data/site";

type MediaFrameProps = {
    media: Media;
    compact?: boolean;
};

export function MediaFrame({ media, compact }: MediaFrameProps) {
    return (
        <div className={`media-frame ${compact ? "media-frame-compact" : ""}`}>
            <div className="media-toolbar" aria-hidden="true">
                <span />
                <span />
                <span />
                <strong>Kronterm</strong>
            </div>
            {media.type === "video" ? (
                <video
                    className="media-asset"
                    src={media.src}
                    aria-label={media.alt}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                />
            ) : (
                <img className="media-asset" src={media.src} alt={media.alt} loading={compact ? "lazy" : "eager"} />
            )}
        </div>
    );
}
