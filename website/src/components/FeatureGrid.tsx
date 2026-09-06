import type { Feature } from "../data/site";

type FeatureGridProps = {
    features: Feature[];
};

export function FeatureGrid({ features }: FeatureGridProps) {
    return (
        <div className="feature-grid">
            {features.map((feature) => {
                const Icon = feature.icon;
                return (
                    <article className="feature-card" key={feature.title}>
                        {Icon ? (
                            <div className="feature-icon">
                                <Icon size={20} />
                            </div>
                        ) : null}
                        <h3>{feature.title}</h3>
                        <p>{feature.text}</p>
                    </article>
                );
            })}
        </div>
    );
}
