import {
    Bot,
    Boxes,
    Braces,
    BriefcaseBusiness,
    CheckCircle2,
    Code2,
    Cpu,
    FileCode2,
    GitPullRequest,
    Globe,
    LayoutDashboard,
    LockKeyhole,
    MonitorPlay,
    Network,
    PanelTop,
    ShieldCheck,
    Sparkles,
    Terminal,
    Workflow
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Feature = {
    title: string;
    text: string;
    icon?: LucideIcon;
};

export type Media = {
    type: "image" | "video";
    src: string;
    alt: string;
};

export type PageConfig = {
    path: string;
    title: string;
    description: string;
    eyebrow: string;
    headline: string;
    subheadline: string;
    primaryCta?: string;
    secondaryCta?: string;
    heroMedia?: Media;
    sections: Array<{
        eyebrow?: string;
        title: string;
        text: string;
        media?: Media;
        features?: Feature[];
    }>;
};

export const productAssets = {
    hero: "/assets/product/kronterm-homepage.webp",
    devElectron: "/assets/product/kronterm-dev-electron.webp",
    sidepanel: "/assets/product/kronterm-sidepanel.webp",
    sandbox: "/assets/product/kronterm-sandbox.webp",
    pet: "/assets/product/kronterm-pet-logo.webp",
    agent: "/assets/kronoscode/kronoscode-agent.webp",
    diff: "/assets/kronoscode/file-diff.webp",
    apps: "/assets/kronoscode/streamable-apps.webp",
    explorer: "/assets/kronoscode/file-explorer.webp",
    settings: "/assets/kronoscode/tui-settings.webp",
    canvasVideo: "/assets/video/canvas-display.mp4",
    sandboxVideo: "/assets/video/sandbox-demo.mp4",
    browserVideo: "/assets/video/browser-widget.mp4",
    devServerVideo: "/assets/video/dev-server.mp4"
};

export const navGroups = [
    {
        label: "Product",
        links: [
            { href: "/product", title: "Kronterm Workspace", text: "Terminal, browser, editor, files, sandboxes, and agents in one desktop command center." },
            { href: "/kronoscode", title: "KronosCode", text: "The AI engine that reads workspace context and helps operate across it." },
            { href: "/terminal", title: "Terminal", text: "A serious terminal surface built for AI-assisted execution." },
            { href: "/download", title: "Download", text: "Private beta installers, platform notes, and setup guidance." }
        ]
    },
    {
        label: "Solutions",
        links: [
            { href: "/use-cases/code-review", title: "Code Review", text: "Review diffs, terminal output, and project state before a human pass." },
            { href: "/use-cases/bug-investigation", title: "Bug Investigation", text: "Reproduce issues using browser context, logs, files, and command output." },
            { href: "/use-cases/refactors", title: "Refactors", text: "Plan, edit, test, and validate large code changes with human approval." },
            { href: "/use-cases/agent-builders", title: "Agent Builders", text: "Build and control local or cloud agents inside a programmable workspace." }
        ]
    },
    {
        label: "Company",
        links: [
            { href: "/teams", title: "Teams", text: "Commercial workflows for developers, founders, and technical teams." },
            { href: "/security", title: "Security", text: "Human-approved execution, private beta controls, and data boundaries." },
            { href: "/customers", title: "Customers", text: "How serious builders use Kronterm to reduce context switching." },
            { href: "/research", title: "Research", text: "Field notes on AI-native workspaces and agent-ready development." }
        ]
    },
    {
        label: "Resources",
        links: [
            { href: "/blog", title: "Blog", text: "Product updates and essays on workspace-native AI." },
            { href: "/docs", title: "Docs", text: "Concepts, setup, configuration, and workflow guides." },
            { href: "/faq", title: "FAQ", text: "Common questions about private beta, models, and product scope." },
            { href: "/contact-sales", title: "Contact Sales", text: "Request access, ask about teams, or discuss deployment needs." }
        ]
    }
];

export const pillars: Feature[] = [
    {
        title: "Workspace-native context",
        text: "KronosCode can reason across terminal output, browser state, files, editor changes, sandbox sessions, and agent activity.",
        icon: LayoutDashboard
    },
    {
        title: "Human-approved execution",
        text: "Commands, edits, and agent actions remain inspectable and approval-driven, so builders stay in control of serious work.",
        icon: ShieldCheck
    },
    {
        title: "Local and cloud models",
        text: "Use local or cloud model support with a workspace that keeps context structured instead of scattering work across tools.",
        icon: Cpu
    },
    {
        title: "Agent-ready desktop",
        text: "Kronterm is designed as a desktop command center for coding agents, automation, browser tasks, and product validation.",
        icon: Bot
    }
];

export const workflowTabs = [
    {
        label: "Terminal",
        title: "Start with the command line, then keep the whole workspace in view.",
        text: "Run commands, watch output, inspect failures, and let KronosCode turn terminal state into actionable next steps.",
        media: { type: "image", src: productAssets.hero, alt: "Kronterm workspace with terminal, browser, sandbox, memory, and files panels" } satisfies Media
    },
    {
        label: "KronosCode",
        title: "Give the AI engine the context developers actually use.",
        text: "KronosCode reads workspace state, reasons over files and command output, proposes edits, and coordinates AI agents inside Kronterm.",
        media: { type: "image", src: productAssets.agent, alt: "KronosCode agent prompt inside the Kronterm workspace" } satisfies Media
    },
    {
        label: "Browser",
        title: "Validate products where they run.",
        text: "Keep browser previews beside terminals and files, so AI-assisted fixes can be checked against the live app without switching context.",
        media: { type: "video", src: productAssets.browserVideo, alt: "Kronterm browser widget demonstration" } satisfies Media
    },
    {
        label: "Sandbox",
        title: "Operate in controlled environments.",
        text: "Use sandboxes for isolated workflows, browser automation, testing, and agent-assisted execution with clear workspace boundaries.",
        media: { type: "video", src: productAssets.sandboxVideo, alt: "Kronterm sandbox demonstration" } satisfies Media
    }
];

export const pages: PageConfig[] = [
    {
        path: "/",
        title: "Kronterm — The AI-native workspace for builders",
        description: "Kronterm combines terminal, browser, editor, sandboxes, files, and AI agents into one programmable desktop environment powered by KronosCode.",
        eyebrow: "Commercial AI-native developer workspace",
        headline: "The AI-native workspace for builders.",
        subheadline: "Kronterm combines your terminal, browser, editor, sandboxes, files, and AI agents into one programmable workspace — powered by KronosCode, the AI engine that understands and operates across your development environment.",
        primaryCta: "Request private beta",
        secondaryCta: "Explore KronosCode",
        heroMedia: { type: "image", src: productAssets.hero, alt: "Kronterm full workspace with terminal, browser, sandbox, memory panel, files, and side controls" },
        sections: [
            {
                eyebrow: "Why Kronterm",
                title: "Not just an AI terminal — an AI workspace.",
                text: "Most AI terminals stop at the command line. Kronterm gives AI the entire workspace: terminal, browser, editor, files, sandboxes, layouts, and agent context.",
                media: { type: "video", src: productAssets.canvasVideo, alt: "Kronterm canvas display demonstration" },
                features: pillars
            },
            {
                eyebrow: "KronosCode",
                title: "The AI engine that understands your workspace.",
                text: "KronosCode sees terminal output, browser context, files, and project state. It helps edit code, run commands with user approval, explain failures, and coordinate agents from inside Kronterm.",
                media: { type: "image", src: productAssets.agent, alt: "KronosCode agent interface inside Kronterm" }
            },
            {
                eyebrow: "Built for serious builders",
                title: "A private-beta product for coding, browsing, testing, automation, and agent-assisted execution.",
                text: "Kronterm is built for developers, founders, technical teams, and AI-agent builders who want one focused commercial environment for high-leverage work.",
                media: { type: "image", src: productAssets.sidepanel, alt: "Kronterm side panel with files, git tree, web, sandbox, apps, and settings" }
            }
        ]
    },
    {
        path: "/product",
        title: "Product | Kronterm",
        description: "See how Kronterm combines terminal, browser, editor, files, sandboxes, and agent control into one desktop command center.",
        eyebrow: "Product",
        headline: "One programmable workspace for the full builder loop.",
        subheadline: "Kronterm brings development surfaces together so AI assistance can work with the same context you use: shells, browsers, files, app previews, sandboxes, and layout state.",
        primaryCta: "Request access",
        secondaryCta: "View workflows",
        heroMedia: { type: "image", src: productAssets.hero, alt: "Kronterm product overview screenshot" },
        sections: [
            {
                eyebrow: "Workspace surface",
                title: "Terminal, browser, editor, files, and sandboxes in one focused desktop.",
                text: "Stop scattering context across tabs and apps. Kronterm creates a unified surface where each block can be inspected, resized, routed, and used by KronosCode.",
                media: { type: "image", src: productAssets.hero, alt: "Kronterm workspace layout with multiple panels" },
                features: [
                    { title: "Terminal sessions", text: "Run commands and preserve context for AI-assisted debugging.", icon: Terminal },
                    { title: "Browser previews", text: "Inspect web apps, docs, and automation flows next to source and shell output.", icon: PanelTop },
                    { title: "Files and diffs", text: "Review project files and edits without leaving the workspace.", icon: FileCode2 },
                    { title: "Sandboxes", text: "Keep risky or experimental work inside controlled execution surfaces.", icon: Boxes }
                ]
            },
            {
                eyebrow: "Command center",
                title: "Designed for agent-assisted execution, not just chat.",
                text: "Kronterm lets builders supervise AI actions through visible panels, approval points, terminal output, and file diffs.",
                media: { type: "image", src: productAssets.diff, alt: "KronosCode file diff display" }
            }
        ]
    },
    {
        path: "/kronoscode",
        title: "KronosCode | Kronterm",
        description: "KronosCode is the AI engine inside Kronterm that understands workspace context and helps operate across it.",
        eyebrow: "KronosCode",
        headline: "AI coding inside your actual development workspace.",
        subheadline: "KronosCode reads terminal output, sees browser context, inspects files, reasons across project state, helps edit code, and coordinates AI agents with human-approved execution.",
        primaryCta: "Request KronosCode beta",
        secondaryCta: "See AI workflows",
        heroMedia: { type: "image", src: productAssets.agent, alt: "KronosCode agent running inside Kronterm" },
        sections: [
            {
                eyebrow: "Capabilities",
                title: "KronosCode works from workspace evidence, not isolated prompts.",
                text: "It can connect command output, file trees, diffs, browser state, and sandbox activity into one reasoning loop.",
                media: { type: "image", src: productAssets.explorer, alt: "KronosCode file explorer inside terminal UI" },
                features: [
                    { title: "Codebase reasoning", text: "Understands files, diffs, structure, and project state.", icon: Braces },
                    { title: "Terminal awareness", text: "Reads command output, failures, logs, and environment state.", icon: Terminal },
                    { title: "Browser context", text: "Uses the browser surface when product validation matters.", icon: Globe },
                    { title: "Agent coordination", text: "Routes work to AI agents while preserving user control.", icon: Workflow }
                ]
            },
            {
                eyebrow: "Transparent execution",
                title: "Inspect plans, approve commands, review diffs, then continue.",
                text: "KronosCode is built around serious workflows where output, edits, and actions are visible before they become permanent.",
                media: { type: "image", src: productAssets.diff, alt: "KronosCode diff review display" }
            }
        ]
    },
    {
        path: "/terminal",
        title: "Terminal | Kronterm",
        description: "A serious terminal experience built for AI-native development and human-approved execution.",
        eyebrow: "Terminal",
        headline: "The terminal becomes the command layer for the whole workspace.",
        subheadline: "Kronterm keeps shell sessions close to browser previews, files, sandbox state, and KronosCode reasoning so failures can be understood and fixed in context.",
        primaryCta: "Request beta",
        secondaryCta: "See product",
        heroMedia: { type: "image", src: productAssets.hero, alt: "Kronterm terminal integrated with workspace panels" },
        sections: [
            {
                eyebrow: "Command output as context",
                title: "Explain failures, inspect logs, and approve the next command.",
                text: "KronosCode can read terminal output and propose the next step while keeping execution under builder control.",
                media: { type: "video", src: productAssets.devServerVideo, alt: "Kronterm dev server demonstration" },
                features: [
                    { title: "Session context", text: "Keep shell output tied to the task and workspace layout.", icon: Terminal },
                    { title: "Process awareness", text: "Track local app state, dev servers, and testing loops.", icon: MonitorPlay },
                    { title: "Approval gates", text: "Run commands only after the user can inspect intent.", icon: CheckCircle2 },
                    { title: "Multi-surface feedback", text: "Connect shell changes to browser and file results.", icon: Network }
                ]
            }
        ]
    },
    {
        path: "/workflows",
        title: "AI Workflows | Kronterm",
        description: "High-value AI-native workflows for debugging, refactoring, review, browser validation, and agent-assisted builds.",
        eyebrow: "AI workflows",
        headline: "Move from task to tested result in one workspace.",
        subheadline: "Kronterm gives KronosCode the evidence needed to plan, edit, execute, inspect, and summarize serious development workflows.",
        primaryCta: "Run a private-beta workflow",
        secondaryCta: "Explore use cases",
        heroMedia: { type: "image", src: productAssets.apps, alt: "Kronterm streamable apps display" },
        sections: [
            {
                eyebrow: "Workflow loop",
                title: "Ask, inspect, approve, test, and ship.",
                text: "Each workflow keeps human control points explicit while giving AI access to files, command output, browser validation, and sandbox context.",
                media: { type: "image", src: productAssets.diff, alt: "KronosCode workflow diff and terminal UI" },
                features: [
                    { title: "Debug failing tests", text: "Use logs, files, and browser state to narrow root causes.", icon: Cpu },
                    { title: "Refactor modules", text: "Plan changes, edit across files, and validate behavior.", icon: Code2 },
                    { title: "Review changes", text: "Summarize intent, inspect diffs, and flag risks.", icon: GitPullRequest },
                    { title: "Build agent tools", text: "Coordinate agents in local and cloud model workflows.", icon: Bot }
                ]
            }
        ]
    },
    {
        path: "/teams",
        title: "Teams | Kronterm",
        description: "A commercial AI-native workspace for technical teams that need controlled agent-assisted execution.",
        eyebrow: "Teams",
        headline: "A desktop command center for serious technical teams.",
        subheadline: "Kronterm helps developers, founders, and AI-agent builders standardize how work moves from context to execution without losing control.",
        primaryCta: "Contact sales",
        secondaryCta: "Review security",
        heroMedia: { type: "image", src: productAssets.sidepanel, alt: "Kronterm team-ready workspace side panel" },
        sections: [
            {
                eyebrow: "Commercial workflows",
                title: "Reduce context switching across coding, browsing, testing, and agent supervision.",
                text: "Teams can use Kronterm for onboarding, debugging, code review, incident investigation, automation, and shared workspace practices.",
                media: { type: "image", src: productAssets.hero, alt: "Kronterm desktop command center for teams" },
                features: [
                    { title: "Developer workflows", text: "A focused environment for feature work and validation.", icon: Code2 },
                    { title: "Founder velocity", text: "Move from browser research to implementation and testing.", icon: BriefcaseBusiness },
                    { title: "Agent builders", text: "Control AI agents with visible execution and workspace context.", icon: Bot },
                    { title: "Technical leads", text: "Review risks, diffs, summaries, and repeatable workflows.", icon: ShieldCheck }
                ]
            }
        ]
    },
    {
        path: "/security",
        title: "Security | Kronterm",
        description: "Security and control model for Kronterm, KronosCode, workspace context, and human-approved execution.",
        eyebrow: "Security",
        headline: "AI execution needs visible boundaries.",
        subheadline: "Kronterm is designed for commercial users who need workspace intelligence, local and cloud model support, and approval-driven actions.",
        primaryCta: "Talk to us",
        secondaryCta: "View FAQ",
        heroMedia: { type: "image", src: productAssets.settings, alt: "KronosCode settings display for configuration and controls" },
        sections: [
            {
                eyebrow: "Control model",
                title: "KronosCode helps operate across the workspace without hiding execution.",
                text: "Commands, edits, browser work, and agent coordination are designed around inspectable context and user approval.",
                media: { type: "image", src: productAssets.settings, alt: "Kronterm settings and security controls" },
                features: [
                    { title: "Human-approved commands", text: "Builders decide when proposed commands should run.", icon: CheckCircle2 },
                    { title: "Diff visibility", text: "Review code changes before accepting them.", icon: FileCode2 },
                    { title: "Model flexibility", text: "Use local and cloud model support based on your workflow.", icon: Cpu },
                    { title: "Private beta posture", text: "Commercial access is controlled while the product matures.", icon: LockKeyhole }
                ]
            }
        ]
    },
    {
        path: "/pricing",
        title: "Pricing | Kronterm",
        description: "Commercial pricing structure for Kronterm private beta, individual builders, teams, and enterprise access.",
        eyebrow: "Pricing",
        headline: "Commercial plans for serious builders.",
        subheadline: "Kronterm is a closed-source commercial product. Private beta access is available for individual builders, teams, and organizations evaluating AI-native development workflows.",
        primaryCta: "Request access",
        secondaryCta: "Contact sales",
        heroMedia: { type: "image", src: productAssets.hero, alt: "Kronterm product screenshot for pricing page" },
        sections: [
            {
                eyebrow: "Plans",
                title: "Start in private beta. Scale into team workflows.",
                text: "Pricing is structured around access, AI usage, model configuration, team controls, and commercial support.",
                features: [
                    { title: "Builder", text: "Private beta workspace for individual builders and founders.", icon: Sparkles },
                    { title: "Pro", text: "Expanded KronosCode usage, local/cloud model configuration, and advanced workflows.", icon: Cpu },
                    { title: "Team", text: "Seats, shared workflows, usage visibility, and guided onboarding.", icon: BriefcaseBusiness },
                    { title: "Enterprise", text: "Commercial deployment planning, controls, support, and custom model strategy.", icon: ShieldCheck }
                ]
            }
        ]
    },
    {
        path: "/customers",
        title: "Customers | Kronterm",
        description: "How builders and teams use Kronterm to reduce context switching and supervise AI-assisted execution.",
        eyebrow: "Customers",
        headline: "Built for developers who need the whole workspace in play.",
        subheadline: "Kronterm is for serious builders evaluating a focused desktop command center for AI-native development.",
        primaryCta: "Share your workflow",
        secondaryCta: "Contact sales",
        heroMedia: { type: "image", src: productAssets.hero, alt: "Kronterm customer workflow product image" },
        sections: [
            {
                eyebrow: "Use patterns",
                title: "From solo founders to technical teams.",
                text: "The product is designed around workflows where terminal output, browser context, files, sandboxes, and agent actions need to stay connected.",
                features: [
                    { title: "Founders", text: "Research, code, test, and automate without leaving one workspace.", icon: BriefcaseBusiness },
                    { title: "Developers", text: "Debug and build with AI that sees more than the shell.", icon: Code2 },
                    { title: "Agent teams", text: "Coordinate agents from one command surface.", icon: Bot },
                    { title: "Platform teams", text: "Validate infrastructure and workflows with clear approval points.", icon: Network }
                ]
            }
        ]
    },
    {
        path: "/download",
        title: "Download | Kronterm",
        description: "Request private beta access and prepare to install Kronterm on your development machine.",
        eyebrow: "Download",
        headline: "Private beta access for Kronterm.",
        subheadline: "Kronterm is a commercial product currently routed through private beta access. Request access for macOS, Windows, or Linux evaluation when available.",
        primaryCta: "Request private beta",
        secondaryCta: "Read setup notes",
        heroMedia: { type: "image", src: productAssets.hero, alt: "Kronterm download page product preview" },
        sections: [
            {
                eyebrow: "Platforms",
                title: "Desktop-first, builder-focused.",
                text: "The product is designed as a desktop command center with local workspace awareness, model flexibility, and agent-ready execution.",
                features: [
                    { title: "macOS", text: "Private beta access for Mac builders.", icon: MonitorPlay },
                    { title: "Windows", text: "Windows evaluation path planned for desktop workflows.", icon: MonitorPlay },
                    { title: "Linux", text: "Linux workflow support for terminal-native builders.", icon: Terminal },
                    { title: "Setup", text: "Guided onboarding for KronosCode, model configuration, and workspace setup.", icon: CheckCircle2 }
                ]
            }
        ]
    }
];

const useCaseBase = {
    primaryCta: "Request workflow access",
    secondaryCta: "See AI workflows"
};

export const extraPages: PageConfig[] = [
    {
        path: "/use-cases/code-review",
        title: "Kronterm for Code Review",
        description: "Use KronosCode to review code changes with files, diffs, terminal output, and browser context in view.",
        eyebrow: "Use case",
        headline: "Review code with the full workspace in context.",
        subheadline: "KronosCode can inspect diffs, files, terminal output, and project state so builders get a first-pass review grounded in real evidence.",
        heroMedia: { type: "image", src: productAssets.diff, alt: "KronosCode diff display for code review" },
        ...useCaseBase,
        sections: [
            {
                title: "From change to human-ready review.",
                text: "Code review in Kronterm starts from the working environment instead of a detached diff. KronosCode can inspect changed files, terminal output, branch context, and browser-visible behavior before it prepares a review summary. The goal is not to replace the reviewer; it is to give the reviewer a better first pass grounded in the actual workspace state.",
                features: [
                    { title: "Diff analysis", text: "Understand what changed across files.", icon: GitPullRequest },
                    { title: "Terminal evidence", text: "Connect tests and command output to review findings.", icon: Terminal },
                    { title: "Browser validation", text: "Check UI behavior when product changes matter.", icon: PanelTop },
                    { title: "Human control", text: "Keep review decisions with the builder.", icon: ShieldCheck }
                ]
            },
            {
                eyebrow: "Review surface",
                title: "KronosCode connects diffs to the commands that prove them.",
                text: "The review workflow can include AI file diff previews, terminal scrollback, the most recent command output, and explicit approval gates before follow-up commands run. That means a reviewer can see whether a change was tested, what failed, what passed, and where KronosCode still needs human judgment.",
                media: { type: "image", src: productAssets.diff, alt: "KronosCode file diff review surface" }
            },
            {
                eyebrow: "Workspace evidence",
                title: "Side panels keep files, git, browser, and sandbox context close to the review.",
                text: "Kronterm’s side rail gives the review workflow access to files, git tree, web previews, sandbox state, and app surfaces. For teams, that turns review from a static patch into an inspectable workspace record: what changed, what was checked, and what action is waiting for approval.",
                media: { type: "image", src: productAssets.sidepanel, alt: "Kronterm side panel for files, git, browser, sandbox, apps, and settings" }
            }
        ]
    },
    {
        path: "/use-cases/bug-investigation",
        title: "Kronterm for Bug Investigation",
        description: "Reproduce and narrow bugs with terminal output, browser context, files, and sandboxes in one workspace.",
        eyebrow: "Use case",
        headline: "Reproduce, narrow, and fix bugs without losing context.",
        subheadline: "Kronterm keeps browser, terminal, files, and sandbox state together so KronosCode can reason across the evidence.",
        heroMedia: { type: "video", src: productAssets.browserVideo, alt: "Browser-based bug investigation in Kronterm" },
        ...useCaseBase,
        sections: [
            {
                title: "From vague report to inspected workspace state.",
                text: "Bug investigation needs browser behavior, logs, command output, and source files in the same room. Kronterm lets a developer keep a live browser widget beside terminal sessions and file context while KronosCode reasons over the evidence. Instead of pasting fragments into a chat box, the workflow stays attached to the workspace where the failure happens.",
                features: [
                    { title: "Browser repro", text: "Keep live app behavior visible.", icon: PanelTop },
                    { title: "Log analysis", text: "Read terminal output and system signals.", icon: Terminal },
                    { title: "File inspection", text: "Trace failures into source changes.", icon: FileCode2 },
                    { title: "Sandbox checks", text: "Validate safely in controlled spaces.", icon: Boxes }
                ]
            },
            {
                eyebrow: "Live repro",
                title: "Use the browser widget as evidence, not just a preview.",
                text: "Kronterm browser widgets can stay pinned beside terminal output while the app is being reproduced. KronosCode can use that context to connect visible behavior with logs, local dev server state, and suspected source files, making the next command or edit more targeted.",
                media: { type: "video", src: productAssets.browserVideo, alt: "Kronterm browser widget used to reproduce a product issue" }
            },
            {
                eyebrow: "Controlled validation",
                title: "Move risky checks into sandboxes when the bug needs isolation.",
                text: "When a bug needs a contained environment, Kronterm sandboxes and desktop tools provide a separate place to run browser automation, application checks, or agent-assisted experiments. The sandbox state stays visible, so a human can still inspect what happened before accepting the fix.",
                media: { type: "video", src: productAssets.sandboxVideo, alt: "Kronterm sandbox validation workflow" }
            }
        ]
    },
    {
        path: "/use-cases/refactors",
        title: "Kronterm for Refactors",
        description: "Plan and execute refactors with KronosCode, file diffs, terminal tests, and approval-driven commands.",
        eyebrow: "Use case",
        headline: "Large refactors need more than a prompt window.",
        subheadline: "KronosCode can reason across project structure, propose edits, run validation with approval, and show the resulting diffs inside Kronterm.",
        heroMedia: { type: "image", src: productAssets.diff, alt: "KronosCode file diff display for refactoring" },
        ...useCaseBase,
        sections: [
            {
                title: "Plan, edit, test, and keep the builder in control.",
                text: "Large refactors need a plan, a file map, visible diffs, validation commands, and a clear rollback path. Kronterm gives KronosCode access to project context while keeping every command and edit inspectable. The builder can use AI to accelerate the work without losing track of what changed or why.",
                features: [
                    { title: "Scope mapping", text: "Understand affected files and dependencies.", icon: Network },
                    { title: "Multi-file edits", text: "Review changes before accepting them.", icon: FileCode2 },
                    { title: "Test loops", text: "Run validation with approval.", icon: CheckCircle2 },
                    { title: "Agent assistance", text: "Coordinate repeated tasks without hiding state.", icon: Bot }
                ]
            },
            {
                eyebrow: "Project context",
                title: "Refactors start with files, structure, and current terminal state.",
                text: "KronosCode can reason from the file explorer, active workspace, terminal output, and branch context before proposing edits. That matters for refactors because the hard part is usually not one change; it is understanding how several files, tests, and runtime assumptions move together.",
                media: { type: "image", src: productAssets.explorer, alt: "KronosCode file explorer for project context" }
            },
            {
                eyebrow: "Validation loop",
                title: "Every major edit can become a reviewed diff and an approved command.",
                text: "Kronterm keeps multi-file edits and command output visible so a refactor can move through checkpoints: planned changes, applied edits, diff review, test execution, and a final summary. KronosCode can help with repetition, but the builder decides what runs and what lands.",
                media: { type: "image", src: productAssets.diff, alt: "KronosCode diff review for refactoring" }
            }
        ]
    },
    {
        path: "/use-cases/agent-builders",
        title: "Kronterm for Agent Builders",
        description: "Build, test, and supervise AI agents from a programmable desktop workspace.",
        eyebrow: "Use case",
        headline: "An agent-ready workspace for builders creating agents.",
        subheadline: "Kronterm gives agent builders a place to control model workflows, browser tasks, terminals, sandboxes, and local project state.",
        heroMedia: { type: "image", src: productAssets.agent, alt: "KronosCode agent interface for agent builders" },
        ...useCaseBase,
        sections: [
            {
                title: "Coordinate agents where the work actually happens.",
                text: "Agent builders need more than chat transcripts. They need a place to test tools, observe browser or desktop actions, inspect files, run terminal commands, and configure model workflows. Kronterm is designed as that command center: a commercial AI-native workspace where agent behavior stays visible and human-approved.",
                features: [
                    { title: "Model flexibility", text: "Support local and cloud model workflows.", icon: Cpu },
                    { title: "Agent supervision", text: "Keep actions visible and approval-driven.", icon: Bot },
                    { title: "Browser tasks", text: "Bring web context into agent workflows.", icon: PanelTop },
                    { title: "Sandbox execution", text: "Use controlled environments for experimentation.", icon: Boxes }
                ]
            },
            {
                eyebrow: "Live workspace",
                title: "The dev Electron app shows the real surfaces agents can work around.",
                text: "The current Kronterm development app exposes terminal blocks, vertical workspace tabs, and a side rail for terminal, browser, sandbox, files, git tree, sysinfo, apps, and settings. Those are the surfaces KronosCode can reason around when a builder is designing agent workflows.",
                media: { type: "image", src: productAssets.devElectron, alt: "Kronterm development Electron app with terminal and side tool rail" }
            },
            {
                eyebrow: "Sandbox and desktop tools",
                title: "Agent builders can test automation without making the main workspace opaque.",
                text: "Kronterm includes sandbox desktop tools for scrolling, clicking, dragging, reading and writing files, opening applications, and waiting on desktop state. That gives agent builders a controlled place to test automation while keeping the actions observable to the human supervising the run.",
                media: { type: "image", src: productAssets.sandbox, alt: "Kronterm sandbox desktop preview" }
            }
        ]
    },
    {
        path: "/contact-sales",
        title: "Contact Sales | Kronterm",
        description: "Request Kronterm private beta access, team evaluation, or commercial deployment guidance.",
        eyebrow: "Contact",
        headline: "Tell us what kind of builder workflow you want to run.",
        subheadline: "Request private beta access, ask about team evaluation, or discuss KronosCode deployment and model strategy.",
        primaryCta: "Request private beta",
        secondaryCta: "Email sales",
        heroMedia: { type: "image", src: productAssets.sidepanel, alt: "Kronterm commercial contact product preview" },
        sections: [
            {
                title: "We route access by workflow.",
                text: "Kronterm is currently positioned for developers, founders, technical teams, and AI-agent builders evaluating a commercial AI-native workspace.",
                features: [
                    { title: "Request a demo", text: "See Kronterm in action for your development workflow.", icon: MonitorPlay },
                    { title: "Private beta", text: "Join access review for early commercial usage.", icon: Sparkles },
                    { title: "Team evaluation", text: "Discuss seats, controls, and onboarding.", icon: BriefcaseBusiness },
                    { title: "Security questions", text: "Review data handling, approvals, and model configuration.", icon: ShieldCheck }
                ]
            }
        ]
    },
    {
        path: "/docs",
        title: "Docs | Kronterm",
        description: "Documentation hub for Kronterm concepts, setup, KronosCode, and AI-native workflows.",
        eyebrow: "Docs",
        headline: "Learn the Kronterm workspace model.",
        subheadline: "Documentation for setup, core concepts, KronosCode, model configuration, workflows, and security controls.",
        primaryCta: "Read quickstart",
        secondaryCta: "Request access",
        heroMedia: { type: "image", src: productAssets.explorer, alt: "Kronterm documentation product context" },
        sections: [
            {
                title: "Docs built around activation.",
                text: "Start with installation, learn the workspace surfaces, configure models, then run a controlled AI workflow.",
                features: [
                    { title: "Quickstart", text: "Get oriented in the desktop command center.", icon: CheckCircle2 },
                    { title: "KronosCode", text: "Understand AI context and action boundaries.", icon: Bot },
                    { title: "Workflows", text: "Run debugging, review, refactor, and browser tasks.", icon: Workflow },
                    { title: "Security", text: "Configure approvals and data boundaries.", icon: LockKeyhole }
                ]
            }
        ]
    },
    {
        path: "/blog",
        title: "Blog | Kronterm",
        description: "Essays and product updates on AI-native workspaces, developer tools, and agent-assisted execution.",
        eyebrow: "Resources",
        headline: "Field notes from the AI-native workspace.",
        subheadline: "Product updates, workflow essays, security notes, and technical writing for builders working with AI agents.",
        primaryCta: "Read latest notes",
        secondaryCta: "See research",
        heroMedia: { type: "image", src: productAssets.apps, alt: "Kronterm product UI for blog resources" },
        sections: [
            {
                title: "Topics for serious builders.",
                text: "Kronterm content focuses on workspace-native AI, agent control, terminal workflows, and commercial developer productivity.",
                features: [
                    { title: "AI workflows", text: "How to use AI across terminal, browser, and files.", icon: Sparkles },
                    { title: "Product updates", text: "Private beta progress and feature notes.", icon: MonitorPlay },
                    { title: "Security", text: "Human-approved execution and workspace controls.", icon: ShieldCheck },
                    { title: "Agent builders", text: "Patterns for building and supervising agents.", icon: Bot }
                ]
            }
        ]
    },
    {
        path: "/research",
        title: "Research | Kronterm",
        description: "Research and analysis on AI-native workspaces and agent-ready development environments.",
        eyebrow: "Research",
        headline: "Research for the next development environment.",
        subheadline: "Kronterm research explores how builders work when AI can use terminal, browser, editor, files, sandboxes, and agents together.",
        primaryCta: "Read research notes",
        secondaryCta: "Request beta",
        heroMedia: { type: "image", src: productAssets.hero, alt: "Kronterm research product screenshot" },
        sections: [
            {
                title: "The workspace is the context window.",
                text: "The core research bet behind Kronterm is that AI coding gets more useful when the model can reason over the entire builder environment.",
                features: pillars
            }
        ]
    },
    {
        path: "/about",
        title: "About | Kronterm",
        description: "Kronterm is building a commercial AI-native workspace for builders.",
        eyebrow: "About",
        headline: "We are building the desktop command center for AI-native work.",
        subheadline: "Kronterm exists because serious builders need more than an AI terminal or an IDE assistant. They need one workspace where context, execution, and control stay together.",
        primaryCta: "Request beta",
        secondaryCta: "Contact us",
        heroMedia: { type: "image", src: productAssets.pet, alt: "Kronterm product mark" },
        sections: [
            {
                title: "Commercial, focused, and product-heavy.",
                text: "Kronterm is a closed-source commercial AI-native developer workspace built for developers, founders, technical teams, and agent builders.",
                features: pillars
            }
        ]
    },
    {
        path: "/careers",
        title: "Careers | Kronterm",
        description: "Join the team building Kronterm, the AI-native workspace for builders.",
        eyebrow: "Careers",
        headline: "Build the workspace where AI agents get real work done.",
        subheadline: "We are interested in people who care about developer tools, AI execution, desktop systems, product craft, and serious builder workflows.",
        primaryCta: "Introduce yourself",
        secondaryCta: "See product",
        heroMedia: { type: "image", src: productAssets.hero, alt: "Kronterm product screenshot for careers" },
        sections: [
            {
                title: "The work is technical and product-heavy.",
                text: "Kronterm spans terminal systems, browser automation, editor workflows, desktop UI, model orchestration, and agent control.",
                features: [
                    { title: "Desktop product", text: "Build a polished commercial workspace.", icon: LayoutDashboard },
                    { title: "AI systems", text: "Shape KronosCode and agent control loops.", icon: Bot },
                    { title: "Developer experience", text: "Design workflows serious builders trust.", icon: Code2 },
                    { title: "Security thinking", text: "Make AI execution inspectable and controlled.", icon: ShieldCheck }
                ]
            }
        ]
    },
    {
        path: "/press",
        title: "Press | Kronterm",
        description: "Kronterm press resources, product description, and media contact.",
        eyebrow: "Press",
        headline: "Kronterm is the AI-native workspace for builders.",
        subheadline: "A commercial desktop command center combining terminal, browser, editor, sandboxes, files, AI chat, and agent control, powered by KronosCode.",
        primaryCta: "Contact press",
        secondaryCta: "Download media kit",
        heroMedia: { type: "image", src: productAssets.pet, alt: "Kronterm media asset" },
        sections: [
            {
                title: "Public description.",
                text: "Kronterm is a closed-source commercial AI-native developer workspace for coding, browsing, testing, automation, and agent-assisted execution.",
                features: pillars
            }
        ]
    },
    {
        path: "/newsroom",
        title: "Newsroom | Kronterm",
        description: "Kronterm announcements and product news.",
        eyebrow: "Newsroom",
        headline: "Product news from Kronterm.",
        subheadline: "Announcements about private beta access, KronosCode, model support, product workflows, and commercial availability.",
        primaryCta: "Subscribe for updates",
        secondaryCta: "Request beta",
        heroMedia: { type: "image", src: productAssets.sidepanel, alt: "Kronterm newsroom product image" },
        sections: [
            {
                title: "Latest updates.",
                text: "Private beta updates will focus on workspace capabilities, KronosCode improvements, security controls, and availability.",
                features: [
                    { title: "Private beta", text: "Access and onboarding updates.", icon: Sparkles },
                    { title: "KronosCode", text: "AI engine improvements.", icon: Bot },
                    { title: "Workspace", text: "Terminal, browser, editor, and sandbox updates.", icon: LayoutDashboard },
                    { title: "Commercial", text: "Plans, teams, and deployment notes.", icon: BriefcaseBusiness }
                ]
            }
        ]
    },
    {
        path: "/faq",
        title: "FAQ | Kronterm",
        description: "Common questions about Kronterm, KronosCode, private beta, AI models, security, and product scope.",
        eyebrow: "FAQ",
        headline: "Frequently asked questions.",
        subheadline: "Answers about private beta access, commercial product scope, KronosCode, local and cloud models, and human-approved execution.",
        primaryCta: "Request access",
        secondaryCta: "Contact us",
        heroMedia: { type: "image", src: productAssets.settings, alt: "Kronterm settings screen" },
        sections: [
            {
                title: "What should evaluators know?",
                text: "Kronterm is a closed-source commercial product in private beta. It is an AI-native workspace, not just an AI terminal.",
                features: [
                    { title: "Is Kronterm commercial?", text: "Yes. It is a closed-source commercial AI-native workspace.", icon: BriefcaseBusiness },
                    { title: "What is KronosCode?", text: "The AI engine inside Kronterm that understands workspace context.", icon: Bot },
                    { title: "Does it support local models?", text: "Kronterm is designed for local and cloud model support.", icon: Cpu },
                    { title: "Who approves actions?", text: "Execution is designed around human approval and visibility.", icon: ShieldCheck }
                ]
            }
        ]
    }
];

export const allPages = [...pages, ...extraPages];
