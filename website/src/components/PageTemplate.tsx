import { Link } from "react-router-dom";
import type { PageConfig } from "../data/site";
import { CodeReviewHero } from "./CodeReviewHero";
import { FeatureGrid } from "./FeatureGrid";
import { KronosCodePage } from "./KronosCodePage";
import { KrontermCapabilitiesBento } from "./KrontermCapabilitiesBento";
import { KrontermNativeWorkflows } from "./KrontermNativeWorkflows";
import { MediaFrame } from "./MediaFrame";
import { PricingCards } from "./PricingCards";
import { ProductDeviceShowcase } from "./ProductDeviceShowcase";
import { SidePanelShowcase } from "./SidePanelShowcase";
import { TerminalHeroShowcase } from "./TerminalHeroShowcase";
import { UseCaseSelectorDeck } from "./UseCaseSelectorDeck";
import { WorkspaceScroll } from "./WorkspaceScroll";

type PageTemplateProps = {
    page: PageConfig;
};

export function PageTemplate({ page }: PageTemplateProps) {
    const visibleSections = page.path === "/" ? page.sections.slice(1) : page.sections;

    if (page.path === "/kronoscode") {
        return <KronosCodePage />;
    }

    return (
        <>
            {page.path === "/terminal" ? (
                <TerminalHeroShowcase />
            ) : page.path === "/use-cases/code-review" ? (
                <CodeReviewHero />
            ) : (
                <section className="hero">
                    <div className="hero-copy">
                        <p className="eyebrow">{page.eyebrow}</p>
                        <h1>{page.headline}</h1>
                        <p className="hero-subtitle">{page.subheadline}</p>
                        <div className="cta-row">
                            {page.primaryCta ? (
                                <Link className="primary-button" to="/contact-sales">
                                    {page.primaryCta}
                                </Link>
                            ) : null}
                            {page.secondaryCta ? (
                                <Link
                                    className="ghost-button"
                                    to={page.path === "/kronoscode" ? "/workflows" : "/kronoscode"}
                                >
                                    {page.secondaryCta}
                                </Link>
                            ) : null}
                        </div>
                    </div>
                    {page.heroMedia ? <MediaFrame media={page.heroMedia} /> : null}
                </section>
            )}

            {page.path === "/" ? <WorkspaceScroll /> : null}
            {page.path === "/product" ? <SidePanelShowcase /> : null}
            {page.path === "/product" ? <ProductDeviceShowcase /> : null}
            {page.path === "/product" ? <KrontermNativeWorkflows /> : null}
            {page.path === "/product" ? <KrontermCapabilitiesBento /> : null}
            {page.path === "/workflows" ? <UseCaseSelectorDeck /> : null}

            {page.path === "/pricing" ? (
                <section className="section">
                    <div className="section-heading">
                        <p className="eyebrow">Plans</p>
                        <h2>Simple commercial access paths.</h2>
                        <p>
                            Private beta access is routed by workflow, team size, model needs, and support requirements.
                        </p>
                    </div>
                    <PricingCards />
                </section>
            ) : null}

            {visibleSections.map((section) => (
                <section className="section split-section" key={section.title}>
                    <div className="section-copy">
                        {section.eyebrow ? <p className="eyebrow">{section.eyebrow}</p> : null}
                        <h2>{section.title}</h2>
                        <p>{section.text}</p>
                        {section.features ? <FeatureGrid features={section.features} /> : null}
                    </div>
                    {section.media ? <MediaFrame media={section.media} compact /> : null}
                </section>
            ))}
        </>
    );
}
