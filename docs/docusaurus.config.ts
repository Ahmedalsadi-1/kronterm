import type { Config } from "@docusaurus/types";
import rehypeHighlight from "rehype-highlight";
import { docOgRenderer } from "./src/renderer/image-renderers";

const baseUrl = process.env.EMBEDDED ? "/docsite/" : "/";

const config: Config = {
    title: "KronTerm Documentation",
    tagline: "The living workspace for human + agent development",
    favicon: "img/logo/kronterm-icon.svg",

    // Set the production url of your site here
    url: "https://docs.kronterm.dev/",
    // Set the /<baseUrl>/ pathname under which your site is served
    // For GitHub pages deployment, it is often '/<projectName>/'
    baseUrl,

    // GitHub pages deployment config.
    // If you aren't using GitHub pages, you don't need these.
    organizationName: "Ahmedalsadi-1",
    projectName: "kronterm",
    deploymentBranch: "main",

    onBrokenAnchors: "ignore",
    onBrokenLinks: "throw",
    onBrokenMarkdownLinks: "warn",
    trailingSlash: false,

    // Even if you don't use internationalization, you can use this field to set
    // useful metadata like html lang. For example, if your site is Chinese, you
    // may want to replace "en" with "zh-Hans".
    i18n: {
        defaultLocale: "en",
        locales: ["en"],
    },
    plugins: [
        [
            "content-docs",
            {
                path: "docs",
                routeBasePath: "/",
                exclude: ["features/**"],
                editUrl: !process.env.EMBEDDED
                    ? "https://github.com/Ahmedalsadi-1/kronterm/edit/main/docs/"
                    : undefined,
                rehypePlugins: [rehypeHighlight],
            } as import("@docusaurus/plugin-content-docs").Options,
        ],
        "ideal-image",
        [
            "@docusaurus/plugin-sitemap",
            {
                changefreq: "daily",
                filename: "sitemap.xml",
            },
        ],
        !process.env.EMBEDDED && [
            "@waveterm/docusaurus-og",
            {
                path: "./preview-images", // relative to the build directory
                imageRenderers: {
                    "docusaurus-plugin-content-docs": docOgRenderer,
                },
            },
        ],
        "docusaurus-plugin-sass",
        "@docusaurus/plugin-svgr",
    ].filter((v) => v),
    themes: [
        ["classic", { customCss: "src/css/custom.scss" }],
        !process.env.EMBEDDED && "@docusaurus/theme-search-algolia",
    ].filter((v) => v),
    themeConfig: {
        docs: {
            sidebar: {
                hideable: false,
                autoCollapseCategories: false,
            },
        },
        colorMode: {
            defaultMode: "light",
            disableSwitch: false,
            respectPrefersColorScheme: true,
        },
        navbar: {
            logo: {
                alt: "KronTerm",
                src: "img/logo/kronterm-icon.svg",
                srcDark: "img/logo/kronterm-icon.svg",
                href: "https://www.kronterm.dev/",
            },
            hideOnScroll: true,
            items: [
                {
                    type: "doc",
                    position: "left",
                    docId: "index",
                    label: "Docs",
                },
                !process.env.EMBEDDED
                    ? [
                          {
                              position: "left",
                              href: "https://docs.kronterm.dev/storybook",
                              label: "Storybook",
                          },
                          {
                              href: "https://discord.gg/XfvZ334gwU",
                              position: "right",
                              className: "header-link-custom custom-icon-discord",
                              "aria-label": "Discord invite",
                          },
                          {
                              href: "https://github.com/Ahmedalsadi-1/kronterm",
                              position: "right",
                              className: "header-link-custom custom-icon-github",
                              "aria-label": "GitHub repository",
                          },
                      ]
                    : [],
            ].flat(),
        },
        metadata: [
            {
                name: "keywords",
                content:
                    "KronTerm, KronosCode, KronosChamber, terminal, developer workspace, AI agent, canvas, browser automation, sandbox, computer use, SSH, remote development, widgets, macOS, documentation",
            },
            {
                name: "og:type",
                content: "website",
            },
            {
                name: "og:site_name",
                content: "KronTerm Documentation",
            },
            {
                name: "application-name",
                content: "KronTerm Documentation",
            },
            {
                name: "apple-mobile-web-app-title",
                content: "KronTerm Documentation",
            },
        ],
        footer: {
            copyright: `Copyright © ${new Date().getFullYear()} Command Line Inc. Built with Docusaurus.`,
        },
        algolia: {
            appId: "B6A8512SN4",
            apiKey: "e879cd8663f109b2822cd004d9cd468c",
            indexName: "waveterm",
        },
    },
    headTags: [
        {
            tagName: "link",
            attributes: {
                rel: "preload",
                as: "font",
                type: "font/woff2",
                "data-next-font": "size-adjust",
                href: `${baseUrl}fontawesome/webfonts/fa-sharp-regular-400.woff2`,
            },
        },
        {
            tagName: "link",
            attributes: {
                rel: "preload",
                as: "font",
                type: "font/woff2",
                "data-next-font": "size-adjust",
                href: `${baseUrl}fontawesome/webfonts/fa-sharp-solid-900.woff2`,
            },
        },
        {
            tagName: "link",
            attributes: {
                rel: "sitemap",
                type: "application/xml",
                title: "Sitemap",
                href: `${baseUrl}sitemap.xml`,
            },
        },
        !process.env.EMBEDDED && {
            tagName: "script",
            attributes: {
                defer: "true",
                "data-domain": "docs.kronterm.dev",
                src: "https://plausible.io/js/script.file-downloads.outbound-links.tagged-events.js",
            },
        },
    ].filter((v) => v),
    stylesheets: [
        `${baseUrl}fontawesome/css/fontawesome.min.css`,
        `${baseUrl}fontawesome/css/sharp-regular.min.css`,
        `${baseUrl}fontawesome/css/sharp-solid.min.css`,
    ],
    staticDirectories: ["static", "storybook"],
};

export default config;
