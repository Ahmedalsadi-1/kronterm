const plans = [
    {
        name: "Builder",
        price: "Private beta",
        description: "For individual developers and founders evaluating Kronterm.",
        features: ["Kronterm workspace access", "KronosCode beta", "Local/cloud model setup", "Human-approved execution"]
    },
    {
        name: "Pro",
        price: "Commercial",
        description: "For serious builders using Kronterm as a daily workspace.",
        features: ["Expanded KronosCode usage", "Advanced workflows", "Browser and sandbox workflows", "Priority onboarding"]
    },
    {
        name: "Team",
        price: "Team access",
        description: "For technical teams standardizing AI-native workflows.",
        features: ["Seats and team onboarding", "Shared workflow guidance", "Usage and security review", "Commercial support"]
    },
    {
        name: "Enterprise",
        price: "Custom",
        description: "For organizations needing controls, deployment planning, and model strategy.",
        features: ["Custom model strategy", "Security and data review", "Deployment planning", "Dedicated commercial support"]
    }
];

export function PricingCards() {
    return (
        <div className="pricing-grid">
            {plans.map((plan) => (
                <article className="pricing-card" key={plan.name}>
                    <h3>{plan.name}</h3>
                    <strong>{plan.price}</strong>
                    <p>{plan.description}</p>
                    <ul>
                        {plan.features.map((feature) => (
                            <li key={feature}>{feature}</li>
                        ))}
                    </ul>
                </article>
            ))}
        </div>
    );
}
