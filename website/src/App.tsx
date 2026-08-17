import type { LucideIcon } from "lucide-react";
import {
    ArrowRight,
    ArrowUpRight,
    BookOpen,
    Bot,
    Boxes,
    BrainCircuit,
    Check,
    ChevronDown,
    Command,
    FileCode2,
    FileText,
    Film,
    GitBranch,
    Globe2,
    Laptop,
    LayoutDashboard,
    Menu,
    Mic,
    MousePointer2,
    Network,
    Pause,
    PenLine,
    Play,
    Search,
    Server,
    ShieldCheck,
    Sparkles,
    Terminal,
    X,
    Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { setPageMeta } from "./lib/meta";

type Media = {
    type: "image" | "video";
    src: string;
    alt: string;
    poster?: string;
    priority?: boolean;
};

type Capability = {
    slug: string;
    label: string;
    eyebrow: string;
    title: string;
    summary: string;
    description: string;
    icon: LucideIcon;
    media: Media;
    points: string[];
};

type Chapter = {
    thesis: string;
    narrative: [string, string];
    details: Array<{ title: string; text: string }>;
    workflow: string[];
    gallery: Media[];
};

const assets = {
    catMark: "/assets/product/kronterm-cat-mark.png",
    catGuide: "/assets/product/kronterm-cat-guide.png",
    catWalk: "/assets/product/kronterm-cat-walk.png",
    workflowOrbit: "/assets/generated/workflow-orbit-v4.webp",
    blueprintPet: "/assets/generated/blueprint-pet.webp",
    finalePet: "/assets/generated/finale-pet.webp",
    workspace: "/assets/product/kronterm-homepage.webp",
    sidepanel: "/assets/product/kronterm-sidepanel.webp",
    sandbox: "/assets/product/kronterm-sandbox.webp",
    agent: "/assets/kronoscode/kronoscode-agent.webp",
    diff: "/assets/kronoscode/file-diff.webp",
    apps: "/assets/kronoscode/streamable-apps.webp",
    explorer: "/assets/kronoscode/file-explorer.webp",
    settings: "/assets/kronoscode/tui-settings.webp",
    canvasVideo: "/assets/video/canvas-display.mp4",
    browserVideo: "/assets/video/browser-widget.mp4",
    sandboxVideo: "/assets/video/sandbox-demo.mp4",
    devServerVideo: "/assets/video/dev-server.mp4",
    acpVideo: "/assets/video/acp-management.mp4",
    fieldGuideVideo: "/assets/video/kronterm-field-guide.mp4",
    fieldGuidePoster: "/assets/generated/visual-stories/kronterm-field-guide-poster.png",
};

type VisualStory = {
    id: string;
    title: string;
    eyebrow: string;
    description: string;
    format: "wide" | "square" | "portrait";
    src: string;
};

const VisualStories: VisualStory[] = [
    {
        id: "human-agent-orchestra",
        title: "Human + Agent Orchestra",
        eyebrow: "Living canvas / 01",
        description: "Every technical surface stays visible while people and agents coordinate the work.",
        format: "wide",
        src: "/assets/generated/visual-stories/01-human-agent-orchestra.webp",
    },
    {
        id: "terminal-night-shift",
        title: "Terminal Night Shift",
        eyebrow: "Command layer / 02",
        description: "Commands, logs, tests, and product state share one focused operating picture.",
        format: "wide",
        src: "/assets/generated/visual-stories/02-terminal-night-shift.webp",
    },
    {
        id: "browser-evidence-trail",
        title: "Browser Evidence Trail",
        eyebrow: "Product validation / 03",
        description: "Browser evidence remains attached to the terminal output and diff that produced it.",
        format: "wide",
        src: "/assets/generated/visual-stories/03-browser-evidence-trail.webp",
    },
    {
        id: "sandbox-launch",
        title: "Sandbox Launch",
        eyebrow: "Isolated runtime / 04",
        description: "A complete disposable desktop gives uncertain work room to run inside a clear boundary.",
        format: "wide",
        src: "/assets/generated/visual-stories/04-sandbox-launch.webp",
    },
    {
        id: "living-workspace",
        title: "The Living Workspace",
        eyebrow: "KronTerm / 05",
        description: "Terminal, browser, files, code review, sandboxes, and agents become one persistent map.",
        format: "wide",
        src: "/assets/generated/visual-stories/05-living-workspace.webp",
    },
    {
        id: "code-review-detective",
        title: "Code Review Detective",
        eyebrow: "Diff-first / 06",
        description: "The pet follows the exact line from a suspicious change to a verified fix.",
        format: "square",
        src: "/assets/generated/visual-stories/06-code-review-detective.webp",
    },
    {
        id: "remote-session-bridge",
        title: "Remote Session Bridge",
        eyebrow: "Durable sessions / 07",
        description: "Local and remote context stay connected through reconnects, sleep, and app restarts.",
        format: "square",
        src: "/assets/generated/visual-stories/07-remote-session-bridge.webp",
    },
    {
        id: "desktop-app-pilot",
        title: "Desktop App Pilot",
        eyebrow: "Native control / 08",
        description: "Visible cursor paths keep desktop automation understandable and inspectable.",
        format: "square",
        src: "/assets/generated/visual-stories/08-desktop-app-pilot.webp",
    },
    {
        id: "agent-command-center",
        title: "Agent Command Center",
        eyebrow: "Agent operations / 09",
        description: "Specialist agents coordinate through one workspace instead of isolated transcripts.",
        format: "square",
        src: "/assets/generated/visual-stories/09-agent-command-center.webp",
    },
    {
        id: "test-lab",
        title: "Test Lab",
        eyebrow: "Verification / 10",
        description: "Failures become evidence, fixes become reruns, and results stay beside the code.",
        format: "square",
        src: "/assets/generated/visual-stories/10-test-lab.webp",
    },
    {
        id: "field-guide-cartographer",
        title: "Field Guide Cartographer",
        eyebrow: "Product map / 11",
        description: "Nine dedicated product chapters make the full operating model easier to understand.",
        format: "portrait",
        src: "/assets/generated/visual-stories/11-field-guide-cartographer.webp",
    },
    {
        id: "widget-builder",
        title: "Widget Builder",
        eyebrow: "Composable blocks / 12",
        description: "Build the workspace around the problem instead of forcing the problem into a fixed shell.",
        format: "portrait",
        src: "/assets/generated/visual-stories/12-widget-builder.webp",
    },
    {
        id: "security-sentinel",
        title: "Security Sentinel",
        eyebrow: "Visible boundaries / 13",
        description: "Host, browser, terminal, remote, and sandbox actions remain intentionally distinct.",
        format: "portrait",
        src: "/assets/generated/visual-stories/13-security-sentinel.webp",
    },
    {
        id: "deploy-celebration",
        title: "Deploy Celebration",
        eyebrow: "Ship with evidence / 14",
        description: "The entire build loop resolves into a product result the team can inspect.",
        format: "portrait",
        src: "/assets/generated/visual-stories/14-deploy-celebration.webp",
    },
    {
        id: "welcome-living-canvas",
        title: "Welcome to the Living Canvas",
        eyebrow: "Field guide / 15",
        description: "Open one technical notebook and keep every useful surface inside the same story.",
        format: "portrait",
        src: "/assets/generated/visual-stories/15-welcome-living-canvas.webp",
    },
];

const capabilities: Capability[] = [
    {
        slug: "workspace-canvas",
        label: "Workspace canvas",
        eyebrow: "01 / Command center",
        title: "One workspace, presented as tiles, tabs, or a living canvas.",
        summary: "Keep the same terminal, browser, files, sandboxes, and AI while changing how the work is arranged.",
        description:
            "KronTerm can present a project as resizable splits, focused browser-style tabs, or a freeform spatial canvas. The canvas adds notes, diagram tools, live agent task cards, and direct selection-to-KronosCode context without losing the underlying widgets.",
        icon: LayoutDashboard,
        media: {
            type: "video",
            src: assets.canvasVideo,
            poster: assets.workspace,
            alt: "KronTerm workspace canvas in motion",
        },
        points: [
            "Tiled, tabbed, and spatial presentations",
            "Live request, action, approval, evidence, and output cards",
            "Follow or quote canvas selections in KronosCode",
        ],
    },
    {
        slug: "kronoscode",
        label: "KronosCode",
        eyebrow: "02 / AI engine",
        title: "An agent that can see the work, not just the prompt.",
        summary: "KronosCode reasons across the live workspace, then acts through visible, inspectable steps.",
        description:
            "Give AI the context it normally misses: terminal output, files, diffs, browser state, sandbox activity, and session history. KronosCode plans across those surfaces while keeping meaningful commands and edits reviewable.",
        icon: BrainCircuit,
        media: { type: "image", src: assets.agent, alt: "KronosCode agent working inside KronTerm" },
        points: ["Workspace-aware planning", "Diff-first code changes", "Human approval at the right moments"],
    },
    {
        slug: "terminal",
        label: "Terminal",
        eyebrow: "03 / Command layer",
        title: "A real terminal at the center of the system.",
        summary: "Local shells, durable sessions, logs, and dev servers stay connected to the rest of the workspace.",
        description:
            "KronTerm treats command output as product context. Failures, exit codes, logs, and test results can inform the agent, the browser preview, and the next edit without copying anything into another tool.",
        icon: Terminal,
        media: {
            type: "video",
            src: assets.devServerVideo,
            poster: assets.explorer,
            alt: "A dev server running inside KronTerm",
        },
        points: ["Full PTY terminal sessions", "AI-readable output and history", "Local and remote workflows"],
    },
    {
        slug: "browser-automation",
        label: "Browser automation",
        eyebrow: "04 / Product validation",
        title: "Build and validate in the same field of view.",
        summary:
            "Embedded Chromium keeps localhost, documentation, and live product flows beside the code that drives them.",
        description:
            "Open product previews and browser workflows as native blocks. Agents can inspect structured page state, navigate, click, type, and capture evidence while you keep the terminal and source context in view.",
        icon: Globe2,
        media: {
            type: "video",
            src: assets.browserVideo,
            poster: assets.workspace,
            alt: "Browser automation inside a KronTerm block",
        },
        points: ["Embedded live previews", "Structured element references", "Screenshots and browser evidence"],
    },
    {
        slug: "sandbox-vms",
        label: "Sandbox VMs",
        eyebrow: "05 / Isolated runtime",
        title: "Give risky work a safe place to run.",
        summary: "Disposable Linux desktops let people and agents experiment without putting the host machine at risk.",
        description:
            "Launch isolated environments for package installs, reproductions, browser work, and automation. Each sandbox can expose a desktop, terminal, editor, and browser while remaining clearly separated from the host.",
        icon: Server,
        media: {
            type: "video",
            src: assets.sandboxVideo,
            poster: assets.sandbox,
            alt: "An isolated Linux sandbox controlled from KronTerm",
        },
        points: ["Disposable Linux environments", "Visible desktop automation", "Host and sandbox boundaries"],
    },
    {
        slug: "desktop-control",
        label: "Desktop control",
        eyebrow: "06 / Native automation",
        title: "Connect agent work to the apps already on your Mac.",
        summary: "Observe and operate native applications through accessibility and screenshot-based controls.",
        description:
            "Some workflows cross beyond code and browser tabs. KronTerm gives agents a permission-aware path to inspect native app structure and perform targeted clicks, typing, keyboard actions, scrolling, and dragging.",
        icon: MousePointer2,
        media: {
            type: "image",
            src: assets.sidepanel,
            alt: "KronTerm side panel coordinating desktop and workspace control",
        },
        points: ["Accessibility-tree inspection", "Targeted native app actions", "Visible host permissions"],
    },
    {
        slug: "remote-sessions",
        label: "Remote sessions",
        eyebrow: "07 / Distributed work",
        title: "Remote work that survives real life.",
        summary: "Durable SSH, remote files, and reconnecting sessions stay attached to the workspace.",
        description:
            "Keep remote terminal state, files, and previews available through network drops, sleep cycles, and app restarts. KronosCode can reason from the same remote output and project context you see.",
        icon: Network,
        media: { type: "image", src: assets.explorer, alt: "Remote files and terminal context inside KronTerm" },
        points: ["Durable SSH sessions", "Remote file previews", "Automatic reconnection"],
    },
    {
        slug: "acp-agents",
        label: "ACP agents",
        eyebrow: "08 / Agent operations",
        title: "Bring every specialist agent into one control plane.",
        summary: "Configure background and interactive agents for repeatable technical workflows.",
        description:
            "KronTerm supports Agent Control Protocol workflows for agents that can watch, report, and assist within clear scopes. Switch between specialists without losing the workspace or the evidence behind their work.",
        icon: Bot,
        media: {
            type: "video",
            src: assets.acpVideo,
            poster: assets.apps,
            alt: "ACP agent management inside KronTerm",
        },
        points: ["Multiple specialist agents", "Scoped background work", "Inspectable session history"],
    },
    {
        slug: "voice",
        label: "Voice",
        eyebrow: "09 / Experimental",
        title: "Speak into the same agent context already on the canvas.",
        summary: "Optional speech capture and local transcription connect directly to the active KronosCode composer.",
        description:
            "KronTerm can start an optional local Python audio process, capture microphone input, transcribe speech with faster-whisper, and submit the final text through the active composer. Speech output is also available when an online or offline TTS engine is configured.",
        icon: Mic,
        media: {
            type: "image",
            src: assets.sidepanel,
            alt: "The KronTerm side panel where voice transcripts enter the active agent session",
        },
        points: ["Local speech-to-text", "Visible listening and transcription state", "Opt-in process lifecycle"],
    },
];

const chapters: Record<string, Chapter> = {
    "workspace-canvas": {
        thesis: "The workspace should preserve the shape of the problem and still let the operator choose the right level of focus.",
        narrative: [
            "Most technical work changes shape during the day. A broad investigation benefits from several visible surfaces; a focused edit needs one active pane; planning and agent review become easier when evidence can be arranged spatially. A fixed layout forces the operator to rebuild context whenever the work changes.",
            "KronTerm keeps the same live widgets underneath three presentations: resizable tiles, browser-style tabs with pane splitting, and a persistent pan-and-zoom canvas. On the canvas, notes and diagrams can sit beside a live agent graph, and any selected widget or task card can become the next prompt's focus or quoted evidence.",
        ],
        details: [
            {
                title: "Change the presentation, keep the work",
                text: "Move between tiled monitoring, focused tabs, and spatial planning without replacing the underlying widgets.",
            },
            {
                title: "See the agent's lineage",
                text: "Requests, decisions, actions, approvals, evidence, and outputs remain connected as live task cards.",
            },
            {
                title: "Prompt from the selection",
                text: "Use a selected widget or task card as the active focus, or quote it as supporting evidence.",
            },
        ],
        workflow: [
            "Choose tiles, tabs, or canvas",
            "Arrange the surfaces and notes",
            "Follow live agent and evidence cards",
            "Send the right selection back to KronosCode",
        ],
        gallery: [
            { type: "image", src: assets.workspace, alt: "A complete KronTerm workspace composition" },
            {
                type: "video",
                src: assets.canvasVideo,
                poster: assets.sidepanel,
                alt: "The KronTerm canvas being arranged in real time",
            },
            { type: "image", src: assets.sandbox, alt: "A sandbox surface composed inside the workspace" },
        ],
    },
    kronoscode: {
        thesis: "An agent becomes more useful when it can inspect the same evidence as the person directing it.",
        narrative: [
            "A chat transcript is a narrow representation of software work. It omits the failing command, the open diff, the browser state, the remote connection, and the decisions that produced the current workspace. That missing context is where most agent mistakes begin.",
            "KronosCode operates inside KronTerm, where it can reason from visible workspace evidence. It plans across files, terminal output, browser state, sandboxes, and session history, then presents commands and edits at the moment a person needs to review them.",
        ],
        details: [
            {
                title: "Evidence before action",
                text: "Plans can incorporate files, output, screenshots, previews, and prior session state.",
            },
            {
                title: "Inspectable execution",
                text: "Commands, tool calls, and code changes remain visible instead of disappearing behind a spinner.",
            },
            {
                title: "Review the delta",
                text: "Diff-first editing keeps attention on what changed, why it changed, and what still needs validation.",
            },
        ],
        workflow: [
            "Describe the outcome",
            "Inspect the proposed route",
            "Approve meaningful actions",
            "Review evidence and continue",
        ],
        gallery: [
            { type: "image", src: assets.agent, alt: "KronosCode agent conversation inside KronTerm" },
            { type: "image", src: assets.diff, alt: "A reviewable code diff produced by KronosCode" },
            { type: "image", src: assets.settings, alt: "KronosCode model and tool settings" },
        ],
    },
    terminal: {
        thesis: "The command line is not a utility at the edge of the product. It is the system of record for what actually ran.",
        narrative: [
            "Builds, tests, servers, migrations, and remote operations all leave their clearest evidence in the terminal. When that output lives in a detached window, the rest of the workspace loses the most precise account of what happened.",
            "KronTerm keeps full PTY sessions beside the files and products they affect. Scrollback, exit status, logs, and running processes become usable context for both the operator and KronosCode, without flattening the terminal into a decorative console.",
        ],
        details: [
            {
                title: "Full terminal fidelity",
                text: "Local shells, long-running processes, familiar shortcuts, and durable terminal state remain intact.",
            },
            {
                title: "Output as context",
                text: "Failures and logs can inform the next agent action without being copied into a prompt.",
            },
            {
                title: "Development in one frame",
                text: "Run a server, inspect the product, edit files, and validate changes without losing the command history.",
            },
        ],
        workflow: [
            "Start a local or remote shell",
            "Run the system under investigation",
            "Connect output to files and previews",
            "Preserve the session with the workspace",
        ],
        gallery: [
            {
                type: "video",
                src: assets.devServerVideo,
                poster: assets.explorer,
                alt: "A development server running in KronTerm",
            },
            { type: "image", src: assets.explorer, alt: "Terminal output with an integrated file explorer" },
            { type: "image", src: assets.workspace, alt: "Terminal blocks arranged with product surfaces" },
        ],
    },
    "browser-automation": {
        thesis: "Product validation belongs beside implementation, not in a separate trail of windows and screenshots.",
        narrative: [
            "A browser is where assumptions become visible. Layout, state, authentication, network behavior, and customer flows can contradict what the code appears to promise. Separating that surface from the development workspace slows every feedback loop.",
            "Embedded Chromium blocks keep localhost, documentation, dashboards, and live applications beside the source and terminal. Structured element references give agents a stable way to inspect and operate pages while screenshots preserve the visual evidence a team needs to review.",
        ],
        details: [
            {
                title: "Inline product truth",
                text: "Keep the running product visible while commands and edits change the system around it.",
            },
            {
                title: "Structured interaction",
                text: "Agents can navigate, inspect, click, type, and scroll through stable element references.",
            },
            {
                title: "Evidence that travels",
                text: "Screenshots and browser state can remain attached to the task and inform the next step.",
            },
        ],
        workflow: [
            "Open the target experience",
            "Inspect visible and structured state",
            "Operate the browser with clear scope",
            "Connect the result back to code",
        ],
        gallery: [
            {
                type: "video",
                src: assets.browserVideo,
                poster: assets.workspace,
                alt: "KronTerm operating an embedded browser",
            },
            { type: "image", src: assets.workspace, alt: "Browser and terminal blocks sharing a workspace" },
            { type: "image", src: assets.sidepanel, alt: "Browser session controls within the KronTerm side panel" },
        ],
    },
    "sandbox-vms": {
        thesis: "Uncertain work should have room to run without inheriting access to the host machine.",
        narrative: [
            "Package installation, unfamiliar repositories, browser automation, and reproduction work often need a complete environment—not just a restricted shell. Running that work directly on the host turns every experiment into a trust decision.",
            "KronTerm sandboxes provide disposable Linux desktops with their own terminal, browser, editor, and filesystem. The agent can work visibly inside the isolated environment while the operator decides which results are worth carrying back into the primary workspace.",
        ],
        details: [
            {
                title: "A complete isolated machine",
                text: "Use a desktop, terminal, editor, browser, and root access without exposing the host.",
            },
            {
                title: "Automation you can watch",
                text: "Desktop and browser activity remains visible instead of vanishing into a remote job.",
            },
            {
                title: "Disposable by design",
                text: "Create, validate, and remove environments without leaving experimental state behind.",
            },
        ],
        workflow: [
            "Launch an isolated environment",
            "Install and reproduce freely",
            "Observe agent activity",
            "Promote only trusted results",
        ],
        gallery: [
            { type: "image", src: assets.sandbox, alt: "A complete Linux desktop inside a KronTerm sandbox" },
            {
                type: "video",
                src: assets.sandboxVideo,
                poster: assets.sandbox,
                alt: "A sandbox workflow running inside KronTerm",
            },
            {
                type: "image",
                src: assets.workspace,
                alt: "A sandbox arranged beside the primary development workspace",
            },
        ],
    },
    "desktop-control": {
        thesis: "Some of the most valuable technical workflows cross the boundary between code and native applications.",
        narrative: [
            "Release tools, design software, system dialogs, simulators, and internal applications do not always expose a clean API. A code-only agent reaches the edge of its world precisely where many real workflows continue.",
            "Desktop control gives KronosCode a permission-aware path into native macOS applications. Accessibility structure and screenshots provide observable state; targeted clicks, typing, key presses, scrolling, and dragging provide action without pretending the desktop is just another shell.",
        ],
        details: [
            {
                title: "Read native structure",
                text: "Inspect accessibility roles, labels, menus, fields, and panes before taking action.",
            },
            {
                title: "Act with specific scope",
                text: "Target visible controls rather than granting an opaque automation process broad freedom.",
            },
            {
                title: "Keep host actions distinct",
                text: "Desktop control remains visibly separate from browser, sandbox, terminal, and remote execution.",
            },
        ],
        workflow: [
            "Observe the target application",
            "Identify a stable control",
            "Approve the scoped action",
            "Return the result to the workspace",
        ],
        gallery: [
            { type: "image", src: assets.sidepanel, alt: "KronTerm coordinating native desktop control" },
            { type: "image", src: assets.workspace, alt: "Native app state visible alongside the KronTerm workspace" },
            { type: "image", src: assets.settings, alt: "KronTerm controls and permissions for agent tools" },
        ],
    },
    "remote-sessions": {
        thesis: "Remote infrastructure should feel like a durable room in the workspace, not a fragile terminal tab.",
        narrative: [
            "Network drops, sleep cycles, and application restarts are ordinary parts of remote development. Traditional SSH workflows make those interruptions the operator’s problem and detach remote files from the rest of the debugging context.",
            "KronTerm keeps remote sessions, files, and previews attached to a persistent workspace. Reconnection restores the operating picture, while KronosCode can reason from the same remote output and artifacts the engineer is using.",
        ],
        details: [
            {
                title: "Durable connections",
                text: "Recover working sessions after common network and machine interruptions.",
            },
            {
                title: "Remote files in context",
                text: "Browse and preview artifacts without separating them from commands and investigation notes.",
            },
            {
                title: "One local control plane",
                text: "Coordinate local and remote work without changing the workspace model.",
            },
        ],
        workflow: [
            "Connect to a remote environment",
            "Arrange its files and terminals",
            "Work through interruptions",
            "Resume with context intact",
        ],
        gallery: [
            { type: "image", src: assets.explorer, alt: "Remote project files inside KronTerm" },
            { type: "image", src: assets.workspace, alt: "A remote development workspace in KronTerm" },
            {
                type: "video",
                src: assets.devServerVideo,
                poster: assets.explorer,
                alt: "A remote-style development workflow with live output",
            },
        ],
    },
    "acp-agents": {
        thesis: "A multi-agent system needs a place where responsibilities, activity, and results remain legible.",
        narrative: [
            "Specialist agents are useful because they can work with different tools, models, and operating boundaries. Without a shared control plane, that specialization creates another collection of disconnected chats and background processes.",
            "KronTerm brings Agent Control Protocol sessions into the workspace. Teams can choose specialists, define scopes, observe activity, and move between interactive and background work while preserving the evidence and decisions around each agent session.",
        ],
        details: [
            {
                title: "Specialists with boundaries",
                text: "Assign different agents to focused responsibilities, tools, and runtime environments.",
            },
            {
                title: "Background work stays visible",
                text: "Monitor ongoing activity and review the outcomes without losing the primary workspace.",
            },
            {
                title: "Sessions become operational memory",
                text: "Keep plans, tool activity, decisions, and results available when the team returns.",
            },
        ],
        workflow: [
            "Select a specialist agent",
            "Define scope and runtime",
            "Monitor the session",
            "Review and preserve the result",
        ],
        gallery: [
            {
                type: "video",
                src: assets.acpVideo,
                poster: assets.apps,
                alt: "Agent Control Protocol management in KronTerm",
            },
            { type: "image", src: assets.apps, alt: "Multiple agent applications available through KronTerm" },
            { type: "image", src: assets.agent, alt: "An active specialist agent session" },
        ],
    },
    voice: {
        thesis: "Voice is useful when it enters the same visible, reviewable context as every other instruction.",
        narrative: [
            "A microphone should not create a second assistant with a second session. Spoken input is most useful when it arrives in the composer that already knows the selected model, workspace, files, canvas nodes, and approval state.",
            "KronTerm's experimental voice path starts an optional local Python process, captures microphone input, transcribes speech with faster-whisper, and submits the final transcript through the active KronosCode composer. Listening, transcribing, speaking, idle, and error states remain visible, and turning voice off terminates the process.",
        ],
        details: [
            {
                title: "One composer",
                text: "Voice transcripts enter the active KronosCode session instead of opening a parallel AI experience.",
            },
            {
                title: "Local transcription",
                text: "Speech-to-text runs in the optional local Python process with faster-whisper.",
            },
            {
                title: "Explicit lifecycle",
                text: "The UI reports audio state and can stop capture and shut down the engine from KronSettings.",
            },
        ],
        workflow: [
            "Enable the optional voice engine",
            "Start listening from the composer",
            "Review the submitted transcript",
            "Disable the engine when voice is no longer needed",
        ],
        gallery: [
            { type: "image", src: assets.sidepanel, alt: "KronTerm's active agent composer" },
            { type: "image", src: assets.settings, alt: "KronTerm settings for models and optional capabilities" },
            {
                type: "image",
                src: assets.workspace,
                alt: "Voice entering the same workspace context as the open surfaces",
            },
        ],
    },
};

const _useCases = [
    {
        icon: GitBranch,
        index: "01",
        title: "Ship a feature",
        text: "Plan, edit, run, preview, and verify without rebuilding context in every tool.",
    },
    {
        icon: Zap,
        index: "02",
        title: "Investigate a bug",
        text: "Put logs, source, browser state, and an isolated reproduction on the same canvas.",
    },
    {
        icon: ShieldCheck,
        index: "03",
        title: "Review agent work",
        text: "See proposed commands, diffs, screenshots, and results before anything meaningful lands.",
    },
    {
        icon: Boxes,
        index: "04",
        title: "Operate a system",
        text: "Keep remote sessions, dashboards, runbooks, and specialist agents ready in a durable workspace.",
    },
];

type ReferenceItem = {
    label: string;
    value: string;
};

const chapterReference: Record<string, { eyebrow: string; title: string; intro: string; items: ReferenceItem[] }> = {
    "workspace-canvas": {
        eyebrow: "Workspace catalogue",
        title: "Three presentations. One shared operating picture.",
        intro: "The same live widgets can become tiles, focused tabs, or nodes on an agent-aware spatial canvas.",
        items: [
            {
                label: "Presentations",
                value: "Resizable tiled widgets, browser-style tabs with pane splits, or a freeform spatial canvas.",
            },
            {
                label: "Canvas tools",
                value: "Pan, zoom, fit, move, resize, add notes, draw, and connect shapes around live widgets.",
            },
            {
                label: "Agent graph",
                value: "Requests, decisions, actions, approvals, evidence, and outputs remain connected as task cards.",
            },
            {
                label: "Canvas context",
                value: "Send a selected widget or agent card to KronosCode as active focus or quoted evidence.",
            },
            {
                label: "Terminal",
                value: "Full PTY, shell integration, scrollback capture, SSH, and AI-readable output.",
            },
            { label: "Browser", value: "Embedded Chromium for documentation, dashboards, previews, and automation." },
            {
                label: "Preview",
                value: "Markdown, images, CSVs, PDFs, and HTML that refresh when source files change.",
            },
            { label: "AI chat", value: "KronosCode with the context of every open block, file, and command." },
            {
                label: "Sandbox VM",
                value: "An isolated Linux desktop with Firefox, VS Code, terminal, and its own filesystem.",
            },
            { label: "Launcher", value: "A command palette for quick actions and workspace navigation." },
            { label: "System info", value: "Live CPU, memory, disk, and network monitoring inside the canvas." },
            { label: "Settings", value: "A visual editor for themes, keybindings, fonts, and AI providers." },
        ],
    },
    kronoscode: {
        eyebrow: "Execution anatomy",
        title: "Routing before action. Evidence after every step.",
        intro: "KronosCode is a structured execution engine, not a chat sidebar. Its pipeline stays deterministic and inspectable.",
        items: [
            { label: "Pipeline", value: "User request → Router → Planner → Executor → Critic → Summarizer." },
            { label: "Screen", value: "Capture any block or the macOS desktop, read pixels, and track the cursor." },
            { label: "Accessibility", value: "Read native application structure, values, controls, and scroll areas." },
            {
                label: "Widget",
                value: "Snapshot, click, type, scroll, drag, wait, and screenshot through stable element refs.",
            },
            {
                label: "Terminal",
                value: "Run commands with timeouts, capture scrollback, parse exit codes, and return JSON.",
            },
            { label: "Network", value: "Fetch URLs, search the web and documentation, scrape pages, and call APIs." },
            { label: "Memory", value: "Recall recent screen and audio history through Screenpipe." },
            { label: "Tooling", value: "69+ built-in tools, MCP integrations, and loadable domain-specific skills." },
            {
                label: "Runtime",
                value: "Managed local startup, health, credential refresh, reconnection, and visible repair guidance.",
            },
        ],
    },
    terminal: {
        eyebrow: "Command reference",
        title: "The terminal remains a real terminal.",
        intro: "KronTerm keeps terminal fidelity intact while making command evidence available to the rest of the workspace.",
        items: [
            {
                label: "Local PTY",
                value: "Full shell sessions through node-pty, with familiar shortcuts and long-running processes.",
            },
            { label: "Remote PTY", value: "A Go-based SSH bridge for durable remote command sessions." },
            {
                label: "Evidence",
                value: "Scrollback, exit codes, logs, and structured JSON can inform the next action.",
            },
            {
                label: "File explorer",
                value: "Browse, open, and edit files from the terminal with a KronosCode overlay.",
            },
            {
                label: "Settings TUI",
                value: "Configure themes, keybindings, fonts, and providers without leaving the command layer.",
            },
            {
                label: "Streamable apps",
                value: "Run a development server and keep its live view beside the code and output.",
            },
        ],
    },
    "browser-automation": {
        eyebrow: "Browser reference",
        title: "Automation native to the workspace.",
        intro: "Browser blocks use structured page state so agents can operate visible product flows without a separate automation stack.",
        items: [
            {
                label: "Runtime",
                value: "Embedded Chromium for localhost, documentation, dashboards, and live applications.",
            },
            {
                label: "Inspection",
                value: "The Widget Protocol returns a structured element tree with stable refs such as @e3.",
            },
            {
                label: "Actions",
                value: "Navigate, fill forms, click, type, scroll, scrape, inspect, and capture screenshots.",
            },
            {
                label: "Resilience",
                value: "Element refs replace fragile coordinate-only interaction for normal browser workflows.",
            },
            {
                label: "Feedback loop",
                value: "Keep the running product beside its source, command output, and agent plan.",
            },
            {
                label: "No handoff",
                value: "Core browser automation does not require a separate Playwright or Selenium process.",
            },
        ],
    },
    "sandbox-vms": {
        eyebrow: "Isolation reference",
        title: "A complete machine with a clear boundary.",
        intro: "E2B-powered Linux desktops give uncertain work enough room to run without inheriting access to the host.",
        items: [
            {
                label: "Desktop",
                value: "Firefox, VS Code, a terminal, and an independent filesystem in each environment.",
            },
            {
                label: "Privilege",
                value: "Root access for package installation and network operations inside the sandbox.",
            },
            {
                label: "Control",
                value: "KronosCode can click, type, scroll, drag, open apps, and work with files visibly.",
            },
            {
                label: "Isolation",
                value: "Sandbox operations remain separate from the host command and filesystem surfaces.",
            },
            {
                label: "Lifecycle",
                value: "Create an environment for a test, then discard it without Dockerfiles or VM upkeep.",
            },
            {
                label: "Use cases",
                value: "Reproductions, unfamiliar repositories, browser work, installs, and risky automation.",
            },
        ],
    },
    "desktop-control": {
        eyebrow: "Native action index",
        title: "The bridge from code to the applications around it.",
        intro: "KronosCode uses macOS Accessibility and visual evidence to work with native apps through explicit host permissions.",
        items: [
            { label: "See", value: "Read the full accessibility tree for buttons, fields, menus, and scroll areas." },
            { label: "Click", value: "Target an element name, DOM id, or screenshot coordinate." },
            { label: "Type", value: "Enter text into the currently focused native field." },
            { label: "Press", value: "Send key combinations such as ⌘C or ⌘⇧P." },
            { label: "Scroll + drag", value: "Move through panels or between coordinates with controlled duration." },
            { label: "Set values", value: "Operate sliders, date pickers, and supported native inputs." },
        ],
    },
    "remote-sessions": {
        eyebrow: "Remote reference",
        title: "A connection designed to be resumed.",
        intro: "Remote sessions preserve their place through the interruptions that normally erase terminal context.",
        items: [
            {
                label: "Durability",
                value: "Sessions survive routine network drops, sleep cycles, and KronTerm restarts.",
            },
            { label: "Recovery", value: "Automatic reconnection restores the remote operating picture." },
            { label: "Remote files", value: "Browse and edit server-side files with a built-in graphical editor." },
            {
                label: "Inline previews",
                value: "Inspect remote markdown, images, CSVs, and PDFs beside the connection.",
            },
            {
                label: "Shared context",
                value: "KronosCode reads the same remote output, files, and evidence as the operator.",
            },
            {
                label: "One model",
                value: "Local and remote work use the same block, layout, and agent interaction system.",
            },
        ],
    },
    "acp-agents": {
        eyebrow: "Agent roster",
        title: "Continuous specialists, coordinated in one place.",
        intro: "ACP agents complement on-demand KronosCode with autonomous work that remains scoped, observable, and reviewable.",
        items: [
            {
                label: "Hermes",
                value: "Personal automation that watches changes, triggers builds, and runs tests on save.",
            },
            {
                label: "OpenClaw",
                value: "Filesystem intelligence for dependency graphs, navigation, and large-scale refactors.",
            },
            {
                label: "Codex",
                value: "Deep code analysis and generation for complex paths and production-grade modules.",
            },
            {
                label: "Background work",
                value: "Run continuously, report progress, and preserve session history in the workspace.",
            },
            {
                label: "Configuration",
                value: "Choose agents, tools, models, runtime boundaries, and scopes from one control plane.",
            },
            { label: "Availability", value: "ACP agents are planned as part of KronTerm’s commercial premium tier." },
        ],
    },
    voice: {
        eyebrow: "Experimental audio path",
        title: "Speech enters the active KronosCode session.",
        intro: "Voice is an optional local process with visible state and an explicit shutdown path.",
        items: [
            { label: "Capture", value: "Opt-in microphone capture through the Electron-to-Python audio bridge." },
            { label: "Transcription", value: "Local speech-to-text through faster-whisper." },
            { label: "Submission", value: "Final transcripts are routed through the active KronosCode composer." },
            { label: "Speech", value: "Online TTS with an offline system fallback when available." },
            { label: "State", value: "Idle, listening, transcribing, speaking, and error remain visible in the UI." },
            { label: "Availability", value: "Experimental and dependent on optional local runtime packages." },
        ],
    },
};

const specialistAgents = [
    ["Kronos", "Routes every request to the right specialist and operating surface."],
    ["Hephaestus", "Host terminal, code edits, builds, tests, and Git workflows."],
    ["Sisyphus", "Sandbox VM execution and visible desktop-widget automation."],
    ["Prometheus", "Native macOS application control and desktop automation."],
    ["Oracle", "Browser blocks, visible tabs, page inspection, and interaction."],
    ["Librarian", "Web research, code search, and documentation retrieval."],
] as const;

const agentFlowSteps = [
    ["Request", "Capture the objective and the visible workspace context."],
    ["Router", "Choose the specialist and operating surface that fit the job."],
    ["Planner", "Turn intent into bounded, reviewable steps."],
    ["Executor", "Run tools inside the selected host, browser, or sandbox boundary."],
    ["Critic", "Check diffs, failures, approvals, and saved evidence."],
    ["Summarizer", "Return the result with session context intact."],
] as const;

const architectureLayers = [
    {
        index: "I",
        title: "User interface",
        text: "Electron + TypeScript desktop shell, drag-and-drop block canvas, WebSocket RPC bridge, native menus, tabs, themes, and keybindings across macOS, Linux, and Windows.",
    },
    {
        index: "II",
        title: "Widget layer",
        text: "wsh IPC exposes every block as a structured element tree, with widget tools for snapshots, clicking, typing, scrolling, dragging, local PTY, remote SSH, Chromium, and E2B lifecycle control.",
    },
    {
        index: "III",
        title: "KronosCode engine",
        text: "A Bun and TypeScript core using the Vercel AI SDK, Hono, Drizzle + SQLite, Zod, LSP intelligence, 69+ tools, MCP servers, and loadable skills.",
    },
    {
        index: "IV",
        title: "Provider layer",
        text: "OpenAI (GPT-4o, o3), Anthropic (Claude 4 Sonnet and Opus), Google (Gemini 2.0 Pro and Flash), Ollama, and LM Studio through a pluggable bring-your-own-key architecture with local execution and no required KronTerm cloud account.",
    },
];

const runtimeStack = [
    ["Desktop shell", "Electron + TypeScript", "Cross-platform windowing and native OS integrations"],
    ["Backend", "Go", "High-performance IPC, PTY, SSH, and WebSocket bridge"],
    ["AI engine", "TypeScript + Bun", "Agent logic, tool execution, and session management"],
    ["Widget protocol", "wsh IPC / JSON over WebSocket", "Bidirectional agent-to-block control"],
    ["Database", "SQLite via Drizzle", "Sessions, tool metadata, and configuration"],
    ["AI SDK", "Vercel AI SDK", "Multi-provider abstraction, streaming, and tool calling"],
    ["HTTP", "Hono", "Local API, MCP server, and health checks"],
    ["Validation", "Zod", "Runtime schemas for tool parameters"],
    ["SSH", "Go PTY bridge", "Durable remote sessions with reconnection"],
    ["Sandbox", "E2B SDK", "Linux VM lifecycle for browser, editor, and terminal"],
    ["Layout", "React tile manager", "Drag, resize, snap, stack, and full-screen blocks"],
] as const;

const roadmap = [
    ["KronTerm API", "Programmatic workspace control for CI, automation scripts, and custom tooling."],
    ["ACP agents", "Ship Hermes, OpenClaw, and Codex as continuously available specialists."],
    ["Shared workspaces", "Multi-user layouts, remote pair debugging, and team workflows."],
    ["Extended desktop control", "Bring native application automation to Windows and Linux."],
    ["Plugin system", "Open KronTerm to third-party widgets, tools, and agent integrations."],
] as const;

type DocumentationSection = {
    id: string;
    eyebrow: string;
    title: string;
    summary: string;
    points: string[];
    link: string;
    linkLabel: string;
};

const documentationSections: DocumentationSection[] = [
    {
        id: "getting-started",
        eyebrow: "01 / Begin here",
        title: "Getting started",
        summary:
            "Install the private beta, create your first workspace, choose an AI provider, and arrange the surfaces your project needs.",
        points: [
            "Request a macOS private-beta build and complete the guided onboarding.",
            "Create a workspace, then add terminal, browser, preview, files, and AI chat blocks.",
            "Connect OpenAI, Anthropic, Google, Ollama, or LM Studio with your own credentials.",
        ],
        link: "/download",
        linkLabel: "Request beta access",
    },
    {
        id: "workspace",
        eyebrow: "02 / Workspace model",
        title: "Blocks and layouts",
        summary:
            "Understand tiled widgets, focused tabs, the spatial canvas, and how each preserves the same project surfaces.",
        points: [
            "Choose resizable tiles, browser-style widget tabs, or a pan-and-zoom canvas.",
            "Place live task, approval, evidence, and output cards beside the widgets that produced them.",
            "Send selected widgets or agent cards to KronosCode as focus or quoted evidence.",
        ],
        link: "/capabilities/workspace-canvas",
        linkLabel: "Read the workspace chapter",
    },
    {
        id: "widget-protocol",
        eyebrow: "03 / Interaction",
        title: "Widget Protocol",
        summary:
            "Every block exposes a structured element tree so agents can inspect and operate the same visible surface as the person directing them.",
        points: [
            "Capture a widget snapshot with stable element references such as @e3.",
            "Click, type, scroll, drag, inspect, wait, and screenshot through one interface.",
            "Use structured references before falling back to fragile coordinate-only actions.",
        ],
        link: "/capabilities#reference-manual",
        linkLabel: "Open the protocol reference",
    },
    {
        id: "kronoscode",
        eyebrow: "04 / Agent engine",
        title: "KronosCode",
        summary:
            "Follow the routed execution pipeline from request through planning, specialist execution, critique, and final evidence.",
        points: [
            "Route work to terminal, browser, sandbox, desktop, or research specialists.",
            "Review commands, diffs, screenshots, and tool results as the session progresses.",
            "Use 69+ built-in tools, MCP integrations, and loadable domain skills.",
        ],
        link: "/capabilities/kronoscode",
        linkLabel: "Read the KronosCode chapter",
    },
    {
        id: "terminal-remote",
        eyebrow: "05 / Command layer",
        title: "Terminal and SSH",
        summary:
            "Run full local PTY sessions, preserve command evidence, and keep remote connections alive through real-world interruptions.",
        points: [
            "Capture scrollback, exit codes, logs, and structured command output.",
            "Browse and edit local or remote files without leaving the workspace.",
            "Reconnect durable SSH sessions after network drops, sleep, or app restarts.",
        ],
        link: "/capabilities/terminal",
        linkLabel: "Read the terminal chapter",
    },
    {
        id: "browser-sandbox",
        eyebrow: "06 / Validation",
        title: "Browser and sandboxes",
        summary:
            "Keep product validation beside implementation, and move uncertain work into disposable Linux desktops.",
        points: [
            "Operate embedded Chromium through structured page state and visible evidence.",
            "Launch E2B environments with Firefox, VS Code, terminal, and isolated files.",
            "Promote only reviewed results from the sandbox back into the host workspace.",
        ],
        link: "/capabilities/browser-automation",
        linkLabel: "Read the browser chapter",
    },
    {
        id: "desktop-control",
        eyebrow: "07 / Native apps",
        title: "Desktop control",
        summary:
            "Use the macOS accessibility tree and screenshots to connect agent work to native applications with explicit host permissions.",
        points: [
            "Inspect buttons, fields, menus, values, and scroll areas.",
            "Click, type, press keys, scroll, drag, and set supported control values.",
            "Keep native actions distinct from browser, terminal, remote, and sandbox work.",
        ],
        link: "/capabilities/desktop-control",
        linkLabel: "Read the desktop chapter",
    },
    {
        id: "security",
        eyebrow: "08 / Trust model",
        title: "Security and providers",
        summary:
            "Understand surface routing, tool budgets, secure key storage, local execution, and the direct path to your chosen model provider.",
        points: [
            "Store provider credentials in the operating system’s native secure store.",
            "Keep source code, terminal output, and tool execution on the local machine.",
            "Use capability checks, stop conditions, and Git safety rules around agent work.",
        ],
        link: "/security",
        linkLabel: "Read the security model",
    },
    {
        id: "voice",
        eyebrow: "09 / Experimental",
        title: "Voice",
        summary:
            "Connect optional local speech capture and transcription to the same composer, model, and workspace context.",
        points: [
            "Transcribe speech locally through faster-whisper.",
            "Keep listening, transcription, speaking, and error state visible.",
            "Stop capture and terminate the optional process from KronSettings.",
        ],
        link: "/capabilities/voice",
        linkLabel: "Read the voice chapter",
    },
];

type BlogPost = {
    slug: string;
    note: string;
    date: string;
    readTime: string;
    title: string;
    dek: string;
    sections: Array<{ title: string; paragraphs: string[] }>;
};

const blogPosts: BlogPost[] = [
    {
        slug: "workspace-is-the-context",
        note: "Field note 01",
        date: "July 2026",
        readTime: "6 min read",
        title: "The workspace is the context.",
        dek: "Why agent work improves when the terminal, product, files, and decisions remain visible in the same operating picture.",
        sections: [
            {
                title: "A transcript is only a shadow of the work",
                paragraphs: [
                    "Most software work does not happen in a prompt. It happens across a running process, an open diff, a browser state, a remote machine, and a series of decisions that rarely fit cleanly into one message.",
                    "When an agent only receives a transcript, the person directing it becomes a human context bridge. They copy the failure, describe the open page, paste the file, and explain which environment is safe to touch.",
                ],
            },
            {
                title: "Keep the evidence where the action happened",
                paragraphs: [
                    "KronTerm treats the workspace as the durable unit of context. Blocks preserve the spatial relationship between commands, source, previews, sandboxes, and agent sessions.",
                    "The goal is not maximal automation. It is a legible loop where a person and an agent can inspect the same evidence, act on the same surface, and understand what changed.",
                ],
            },
        ],
    },
    {
        slug: "browser-automation-should-leave-evidence",
        note: "Field note 02",
        date: "July 2026",
        readTime: "5 min read",
        title: "Browser automation should leave evidence.",
        dek: "A browser action is more trustworthy when the page state, target, screenshot, and resulting product behavior stay attached to the task.",
        sections: [
            {
                title: "Coordinates are not an explanation",
                paragraphs: [
                    "A click at x and y can reproduce an action, but it does not explain the target or survive a small layout change. Structured element references give browser work a vocabulary that people and agents can share.",
                    "KronTerm’s Widget Protocol exposes visible controls as stable references, while screenshots preserve the visual result that a selector alone cannot describe.",
                ],
            },
            {
                title: "Validation belongs beside implementation",
                paragraphs: [
                    "The browser is where assumptions about layout, state, authentication, and customer flow become visible. Keeping it beside the terminal and source compresses the distance between a change and its proof.",
                    "An agent can inspect a page, operate a scoped flow, capture the result, and connect that evidence back to the command or file that produced it.",
                ],
            },
        ],
    },
    {
        slug: "give-risky-work-a-room-of-its-own",
        note: "Field note 03",
        date: "July 2026",
        readTime: "4 min read",
        title: "Give risky work a room of its own.",
        dek: "Why disposable, visible Linux desktops are a better boundary for uncertain repositories, installations, and automation.",
        sections: [
            {
                title: "Uncertainty needs more than a restricted shell",
                paragraphs: [
                    "Reproducing an unfamiliar system often requires a browser, editor, package manager, terminal, and complete filesystem. Reducing that work to a narrow shell can make it less useful without making the boundary much clearer.",
                    "A disposable Linux desktop gives the task enough room to run while keeping its packages, credentials, files, and failures away from the host.",
                ],
            },
            {
                title: "Isolation should still be visible",
                paragraphs: [
                    "Background infrastructure can be safe and still feel opaque. KronTerm keeps the sandbox desktop on the canvas so people can watch the agent navigate, install, test, and gather evidence.",
                    "The sandbox is not a second hidden world. It is another explicit workspace surface with a boundary the operator can see.",
                ],
            },
        ],
    },
];

function usePageMeta(title: string, description: string) {
    const location = useLocation();

    useEffect(() => {
        setPageMeta(title, description);
        if (location.hash) {
            window.requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView());
            return;
        }
        window.scrollTo({ top: 0 });
    }, [description, location.hash, location.pathname, title]);
}

function ReadingProgress() {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const updateProgress = () => {
            const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
            setProgress(scrollRange > 0 ? Math.min(window.scrollY / scrollRange, 1) : 0);
        };

        updateProgress();
        window.addEventListener("scroll", updateProgress, { passive: true });
        window.addEventListener("resize", updateProgress);
        return () => {
            window.removeEventListener("scroll", updateProgress);
            window.removeEventListener("resize", updateProgress);
        };
    }, []);

    return (
        <span className="reading-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${progress})` }} />
        </span>
    );
}

function ScrollAtmosphere() {
    const location = useLocation();

    useEffect(() => {
        const sections = Array.from(
            document.querySelectorAll<HTMLElement>(
                "main .section, main .reference-spread, main .reference-ledger, main .status-spread"
            )
        );
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return;
                    }
                    entry.target.classList.add("section-entered");
                    observer.unobserve(entry.target);
                });
            },
            { rootMargin: "0px 0px -9%", threshold: 0.08 }
        );

        sections.forEach((section) => {
            section.classList.add("section-observe");
            observer.observe(section);
        });

        return () => observer.disconnect();
    }, [location.pathname]);

    return null;
}

function usePrefersReducedMotion() {
    const [reducedMotion, setReducedMotion] = useState(
        () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        const updatePreference = () => setReducedMotion(mediaQuery.matches);

        mediaQuery.addEventListener("change", updatePreference);
        return () => mediaQuery.removeEventListener("change", updatePreference);
    }, []);

    return reducedMotion;
}

function ProductMedia({ media, className = "" }: { media: Media; className?: string }) {
    const reducedMotion = usePrefersReducedMotion();

    return (
        <div className={`product-media ${className}`}>
            <div className="window-bar" aria-hidden="true">
                <span />
                <span />
                <span />
                <div className="window-title">
                    <Command size={12} /> kronterm / live workspace
                </div>
            </div>
            {media.type === "video" ? (
                <video
                    className="product-asset"
                    src={media.src}
                    poster={media.poster}
                    aria-label={media.alt}
                    autoPlay={!reducedMotion}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                />
            ) : (
                <img
                    className="product-asset"
                    src={media.src}
                    alt={media.alt}
                    loading={media.priority ? "eager" : "lazy"}
                    fetchPriority={media.priority ? "high" : "auto"}
                />
            )}
        </div>
    );
}

function PetNote({
    message,
    pose = "guide",
    className = "",
}: {
    message: string;
    pose?: "guide" | "walk";
    className?: string;
}) {
    return (
        <aside className={`pet-note pet-note-${pose} ${className}`} aria-label="A note from the KronTerm pixel cat">
            <img
                src={pose === "walk" ? assets.catWalk : assets.catGuide}
                alt="KronTerm’s pixel cat mascot"
                loading="lazy"
            />
            <p>{message}</p>
        </aside>
    );
}

function Brand() {
    return (
        <Link className="brand" to="/" aria-label="KronTerm home">
            <span className="brand-mark">
                <img src={assets.catMark} alt="" />
            </span>
            <span>KronTerm</span>
        </Link>
    );
}

function Nav() {
    const [open, setOpen] = useState(false);
    const location = useLocation();

    useEffect(() => setOpen(false), [location.pathname]);

    return (
        <header className="site-header">
            <nav className="nav-shell" aria-label="Main navigation">
                <Brand />
                <div className="nav-links">
                    <Link to="/capabilities">Field guide</Link>
                    <Link to="/capabilities/workspace-canvas">Workspace</Link>
                    <Link to="/capabilities/kronoscode">KronosCode</Link>
                    <Link to="/docs">Docs</Link>
                    <Link to="/blog">Blog</Link>
                    <Link to="/security">Security</Link>
                    <Link to="/pricing">Pricing</Link>
                </div>
                <div className="nav-actions">
                    <Link className="button button-quiet button-small" to="/contact-sales">
                        Talk to us
                    </Link>
                    <Link className="button button-primary button-small" to="/download">
                        Request access <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                    <button
                        className="menu-button"
                        type="button"
                        aria-label={open ? "Close navigation" : "Open navigation"}
                        aria-expanded={open}
                        onClick={() => setOpen((value) => !value)}
                    >
                        {open ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </nav>
            {open ? (
                <div className="mobile-nav">
                    <Link to="/capabilities">Field guide</Link>
                    <Link to="/capabilities/workspace-canvas">Workspace canvas</Link>
                    <Link to="/capabilities/kronoscode">KronosCode</Link>
                    <Link to="/docs">Documentation</Link>
                    <Link to="/blog">Blog</Link>
                    <Link to="/security">Security</Link>
                    <Link to="/pricing">Pricing</Link>
                    <Link className="button button-primary" to="/download">
                        Request access <ArrowRight size={16} />
                    </Link>
                </div>
            ) : null}
        </header>
    );
}

function Hero() {
    return (
        <section className="hero">
            <div className="hero-aura" aria-hidden="true" />
            <div className="hero-topline reveal">
                <span className="status-dot" />
                Private beta · open canvas notebook
            </div>
            <div className="hero-heading">
                <h1 className="reveal reveal-1">
                    The living canvas for <span>human + agent</span> work.
                </h1>
                <div className="hero-side reveal reveal-2">
                    <p>
                        Pin terminals, browsers, files, sandboxes, desktop control, and AI agents to one programmable
                        canvas—then keep every useful note in view.
                    </p>
                    <div className="hero-actions">
                        <Link className="button button-primary" to="/download">
                            Request private beta <ArrowRight size={17} />
                        </Link>
                        <Link className="button button-quiet" to="/capabilities">
                            Open the field guide <BookOpen size={15} />
                        </Link>
                    </div>
                </div>
            </div>
            <div className="hero-stage reveal reveal-3">
                <img
                    className="hero-canvas-art"
                    src="/assets/generated/visual-stories/05-living-workspace.webp"
                    alt="The KronTerm pet overlooking a connected terminal, browser, files, sandbox, and agent canvas"
                    fetchPriority="high"
                />
                <div className="hero-canvas-shade" aria-hidden="true" />
                <a className="hero-film-chip" href="#field-film">
                    <span>
                        <Play size={17} fill="currentColor" />
                    </span>
                    <strong>Watch the field film</strong>
                    <small>15 seconds</small>
                </a>
                <div className="hero-product-proof">
                    <ProductMedia
                        media={{
                            type: "image",
                            src: assets.workspace,
                            alt: "The real KronTerm command center with terminal, browser, files, and AI",
                            priority: true,
                        }}
                        className="hero-product"
                    />
                    <div className="floating-trace floating-trace-left">
                        <span className="trace-icon">
                            <BrainCircuit size={17} />
                        </span>
                        <div>
                            <strong>KronosCode is working</strong>
                            <small>Reading terminal output + 4 files</small>
                        </div>
                        <span className="live-pill">LIVE</span>
                    </div>
                </div>
                <div className="hero-stage-index" aria-hidden="true">
                    <span>01 / Compose the loop</span>
                    <span>02 / Keep evidence visible</span>
                    <span>03 / Direct the next action</span>
                </div>
            </div>
            <div className="scroll-cue" aria-hidden="true">
                <ChevronDown size={16} /> Explore the workspace
            </div>
        </section>
    );
}

function SurfaceTicker() {
    const items = ["Terminal", "Browser", "Files", "KronosCode", "Sandbox", "Desktop", "Remote", "ACP agents"];

    return (
        <div className="surface-ticker" aria-label="KronTerm workspace surfaces">
            <div>
                {[...items, ...items].map((item, index) => (
                    <span aria-hidden={index >= items.length} key={`${item}-${index}`}>
                        <i /> {item}
                    </span>
                ))}
            </div>
        </div>
    );
}

function ProductFilm() {
    const reducedMotion = usePrefersReducedMotion();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playing, setPlaying] = useState(!reducedMotion);

    const togglePlayback = () => {
        const video = videoRef.current;
        if (!video) {
            return;
        }
        if (video.paused) {
            void video.play();
            return;
        }
        video.pause();
    };

    return (
        <section className="field-film section" id="field-film">
            <div className="field-film-copy">
                <p className="kicker">KronTerm field film / 00:15</p>
                <h2>See the whole operating model move as one.</h2>
                <p>
                    A short visual tour through the living canvas, browser evidence, isolated execution, native app
                    control, and the pet that keeps every state legible.
                </p>
                <div className="field-film-index" aria-label="Film chapters">
                    <span>
                        <b>00:00</b> Open the canvas
                    </span>
                    <span>
                        <b>00:06</b> Follow the evidence
                    </span>
                    <span>
                        <b>00:10</b> Work across the loop
                    </span>
                </div>
            </div>
            <div className="field-film-player">
                <video
                    ref={videoRef}
                    src={assets.fieldGuideVideo}
                    poster={assets.fieldGuidePoster}
                    aria-label="A fifteen-second animated introduction to KronTerm"
                    autoPlay={!reducedMotion}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                />
                <button type="button" onClick={togglePlayback} aria-label={playing ? "Pause film" : "Play film"}>
                    {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                    <span>{playing ? "Pause field film" : "Play field film"}</span>
                </button>
                <div className="field-film-folio" aria-hidden="true">
                    <Film size={16} /> 1920 × 1080 / 30 FPS
                </div>
            </div>
        </section>
    );
}

function VisualStoryAtlas() {
    const [activeId, setActiveId] = useState("living-workspace");
    const activeStory = VisualStories.find((story) => story.id === activeId) ?? VisualStories[0];

    return (
        <section className="story-atlas section" id="visual-stories">
            <header className="story-atlas-header">
                <div>
                    <p className="kicker">Fifteen visual field notes</p>
                    <h2>The pet now has a whole world to guide.</h2>
                </div>
                <p>
                    Select any plate to explore a different part of the KronTerm operating model. Every scene was built
                    as both a product story and a reusable website asset.
                </p>
            </header>
            <div className="story-atlas-stage">
                <figure className={`story-atlas-feature story-format-${activeStory.format}`} key={activeStory.id}>
                    <img src={activeStory.src} alt={`${activeStory.title}, illustrated with the KronTerm pixel pet`} />
                    <figcaption>
                        <span>{activeStory.eyebrow}</span>
                        <strong>{activeStory.title}</strong>
                    </figcaption>
                </figure>
                <div className="story-atlas-copy" aria-live="polite">
                    <span>{String(VisualStories.indexOf(activeStory) + 1).padStart(2, "0")} / 15</span>
                    <h3>{activeStory.title}</h3>
                    <p>{activeStory.description}</p>
                    <Link to="/capabilities">
                        Enter the field guide <ArrowUpRight size={16} />
                    </Link>
                </div>
            </div>
            <div className="story-atlas-rail" role="tablist" aria-label="KronTerm visual field notes">
                {VisualStories.map((story, index) => (
                    <button
                        className={story.id === activeStory.id ? "story-atlas-thumb active" : "story-atlas-thumb"}
                        type="button"
                        role="tab"
                        aria-selected={story.id === activeStory.id}
                        aria-label={`Show ${story.title}`}
                        key={story.id}
                        onClick={() => setActiveId(story.id)}
                    >
                        <img src={story.src} alt="" loading="lazy" />
                        <span>{String(index + 1).padStart(2, "0")}</span>
                    </button>
                ))}
            </div>
        </section>
    );
}

function _PlatformSection() {
    const [activeSlug, setActiveSlug] = useState(capabilities[0].slug);
    const active = capabilities.find((capability) => capability.slug === activeSlug) ?? capabilities[0];

    return (
        <section className="platform-section section" id="platform">
            <div className="section-intro platform-intro">
                <p className="kicker">The KronTerm model</p>
                <h2>Stop feeding AI a transcript. Give it the workspace.</h2>
                <p>
                    Context should not disappear between a terminal, a browser, a diff, and a chat. KronTerm turns them
                    into connected surfaces that people and agents can understand together.
                </p>
            </div>
            <div className="platform-switcher">
                <div className="platform-rail" role="tablist" aria-label="KronTerm platform surfaces">
                    {capabilities.slice(0, 5).map((capability) => {
                        const Icon = capability.icon;
                        const isActive = capability.slug === active.slug;
                        return (
                            <button
                                className={isActive ? "platform-tab active" : "platform-tab"}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                aria-controls="platform-panel"
                                key={capability.slug}
                                onClick={() => setActiveSlug(capability.slug)}
                            >
                                <span className="platform-tab-number">{capability.eyebrow.slice(0, 2)}</span>
                                <Icon size={18} aria-hidden="true" />
                                <span>{capability.label}</span>
                                <ArrowRight size={15} aria-hidden="true" />
                            </button>
                        );
                    })}
                </div>
                <div className="platform-panel" id="platform-panel" role="tabpanel" key={active.slug}>
                    <div className="platform-copy">
                        <p className="kicker">{active.eyebrow}</p>
                        <h3>{active.title}</h3>
                        <p>{active.summary}</p>
                        <Link className="inline-link" to={`/capabilities/${active.slug}`}>
                            Explore capability <ArrowRight size={15} />
                        </Link>
                    </div>
                    <ProductMedia media={active.media} className="platform-media" />
                </div>
            </div>
        </section>
    );
}

function _ProductCinema() {
    return (
        <section className="cinema-section section">
            <div className="section-intro cinema-intro">
                <p className="kicker">Built to stay in motion</p>
                <h2>The work happens here. So does the proof.</h2>
                <p>
                    Watch the command line, product, and agent state evolve together—without reconstructing the story
                    later.
                </p>
            </div>
            <div className="cinema-grid">
                <article className="cinema-card cinema-card-wide">
                    <div className="card-heading">
                        <span className="card-icon">
                            <Globe2 size={18} />
                        </span>
                        <div>
                            <p className="kicker">Browser + terminal</p>
                            <h3>Change the code. See the product answer.</h3>
                        </div>
                    </div>
                    <ProductMedia
                        media={{
                            type: "video",
                            src: assets.browserVideo,
                            poster: assets.workspace,
                            alt: "A browser preview running beside the terminal",
                        }}
                        className="cinema-media"
                    />
                </article>
                <article className="cinema-card cinema-card-tall">
                    <div className="card-heading">
                        <span className="card-icon accent-violet">
                            <Server size={18} />
                        </span>
                        <div>
                            <p className="kicker">Safe execution</p>
                            <h3>A whole Linux desktop, isolated on demand.</h3>
                        </div>
                    </div>
                    <ProductMedia
                        media={{
                            type: "image",
                            src: assets.sandbox,
                            alt: "A Linux sandbox desktop running inside KronTerm",
                        }}
                        className="cinema-media cinema-media-portrait"
                    />
                    <div className="terminal-readout" aria-label="Sandbox status">
                        <span>$ sandbox status</span>
                        <strong>isolated / healthy / ready</strong>
                    </div>
                </article>
                <article className="cinema-card cinema-card-small">
                    <div className="card-heading compact">
                        <span className="card-icon accent-blue">
                            <FileCode2 size={18} />
                        </span>
                        <div>
                            <p className="kicker">Diff-first</p>
                            <h3>Every edit stays reviewable.</h3>
                        </div>
                    </div>
                    <img
                        className="bare-product-image"
                        src={assets.diff}
                        alt="A file diff review in KronosCode"
                        loading="lazy"
                    />
                </article>
                <article className="cinema-card cinema-card-small cinema-card-signal">
                    <div className="signal-graphic" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                    </div>
                    <p className="kicker">Shared context</p>
                    <h3>One signal, routed to every surface that needs it.</h3>
                    <p>
                        Terminal output can inform an edit. An edit can trigger a preview. The preview becomes evidence.
                    </p>
                </article>
            </div>
        </section>
    );
}

function _CapabilitiesSection() {
    return (
        <section className="capabilities-section section" id="capabilities">
            <div className="section-intro split-intro">
                <div>
                    <p className="kicker">One system, nine chapters</p>
                    <h2>Everything your team needs to direct intelligent work.</h2>
                </div>
                <p>
                    Each capability is useful alone. Together they form a control plane where context survives,
                    boundaries stay visible, and the next action is always grounded in evidence.
                </p>
            </div>
            <div className="capability-grid">
                {capabilities.map((capability, index) => {
                    const Icon = capability.icon;
                    return (
                        <Link className="capability-card" to={`/capabilities/${capability.slug}`} key={capability.slug}>
                            <div className="capability-card-top">
                                <span>{String(index + 1).padStart(2, "0")}</span>
                                <Icon size={21} aria-hidden="true" />
                            </div>
                            <h3>{capability.label}</h3>
                            <p>{capability.summary}</p>
                            <span className="card-link">
                                Explore <ArrowRight size={14} />
                            </span>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}

function _UseCasesSection() {
    return (
        <section className="use-cases-section section" id="use-cases">
            <div className="use-case-heading">
                <p className="kicker">From intent to evidence</p>
                <h2>A better loop for the work that actually crosses tools.</h2>
                <Link className="inline-link" to="/contact-sales">
                    Design a workflow with us <ArrowRight size={15} />
                </Link>
            </div>
            <div className="use-case-list">
                {_useCases.map((useCase) => {
                    const Icon = useCase.icon;
                    return (
                        <article className="use-case-row" key={useCase.title}>
                            <span className="use-case-index">{useCase.index}</span>
                            <span className="use-case-icon">
                                <Icon size={20} />
                            </span>
                            <h3>{useCase.title}</h3>
                            <p>{useCase.text}</p>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

function ControlSection() {
    return (
        <section className="control-section section">
            <div className="control-shell">
                <div className="control-copy">
                    <p className="kicker">Canvas map / control is a feature</p>
                    <h2>Powerful agents. Legible boundaries.</h2>
                    <p>
                        KronTerm keeps host, sandbox, browser, terminal, and remote actions distinct. Teams can bring
                        their own models, review consequential steps, and retain the evidence behind each session.
                    </p>
                    <Link className="button button-light" to="/security">
                        Explore security <ArrowRight size={16} />
                    </Link>
                </div>
                <div className="control-map" aria-label="KronTerm control boundary diagram">
                    <div className="control-node control-node-center">
                        <img src={assets.catMark} alt="" />
                        <strong>KronTerm</strong>
                        <span>policy + context</span>
                    </div>
                    <div className="control-node control-node-one">
                        <Terminal size={17} /> Terminal
                    </div>
                    <div className="control-node control-node-two">
                        <Globe2 size={17} /> Browser
                    </div>
                    <div className="control-node control-node-three">
                        <Server size={17} /> Sandbox
                    </div>
                    <div className="control-node control-node-four">
                        <Laptop size={17} /> Desktop
                    </div>
                    <div className="control-node control-node-five">
                        <Bot size={17} /> Agents
                    </div>
                    <div className="control-orbit control-orbit-one" />
                    <div className="control-orbit control-orbit-two" />
                </div>
            </div>
        </section>
    );
}

function FinalCta() {
    return (
        <section className="final-cta section">
            <figure className="final-pet-illustration">
                <img src={assets.finalePet} alt="KronTerm’s pixel pet planting a flag on a connected workspace" />
                <figcaption>I keep the next chapter—and your workspace context—close by.</figcaption>
            </figure>
            <div className="final-cta-mark" aria-hidden="true">
                <Sparkles size={28} />
            </div>
            <p className="kicker">Open a fresh page for technical work</p>
            <h2>Put the whole canvas behind the next prompt.</h2>
            <p>Join the KronTerm private beta and help shape the command center for human + agent teams.</p>
            <div className="final-actions">
                <Link className="button button-primary" to="/download">
                    Request private beta <ArrowRight size={17} />
                </Link>
                <Link className="button button-quiet" to="/contact-sales">
                    Talk to the team
                </Link>
            </div>
        </section>
    );
}

function ChapterPortal({ capability, index }: { capability: Capability; index: number }) {
    const Icon = capability.icon;
    const preview = capability.media.type === "video" ? capability.media.poster : capability.media.src;

    return (
        <Link
            className={index < 2 ? "chapter-portal chapter-portal-featured" : "chapter-portal"}
            to={`/capabilities/${capability.slug}`}
        >
            <span className="chapter-spine" aria-hidden="true">
                KT / {String(index + 1).padStart(2, "0")}
            </span>
            <div className="chapter-cover">
                {preview ? <img src={preview} alt="" loading="lazy" /> : null}
                <span className="chapter-cover-shade" />
                <div className="chapter-cover-heading">
                    <span>Chapter {String(index + 1).padStart(2, "0")}</span>
                    <Icon size={22} aria-hidden="true" />
                </div>
            </div>
            <div className="chapter-portal-copy">
                <div>
                    <p>{capability.eyebrow.split(" / ")[1]}</p>
                    <h3>{capability.label}</h3>
                </div>
                <p>{capability.summary}</p>
                <span className="chapter-enter">
                    Enter chapter <ArrowRight size={15} />
                </span>
            </div>
        </Link>
    );
}

function ChapterPortalSection({ showHeading = true }: { showHeading?: boolean }) {
    return (
        <section className="chapter-library section" id="chapters">
            {showHeading ? (
                <div className="chapter-library-heading">
                    <div>
                        <p className="kicker">The KronTerm field guide</p>
                        <h2>Nine chapters. Nine complete product stories.</h2>
                    </div>
                    <p>
                        Each chapter is a dedicated destination with its own thesis, detailed explanation, workflow, and
                        product gallery. Choose a cover to enter that part of KronTerm.
                    </p>
                </div>
            ) : null}
            <div className="chapter-library-grid">
                {capabilities.map((capability, index) => (
                    <ChapterPortal capability={capability} index={index} key={capability.slug} />
                ))}
            </div>
        </section>
    );
}

function FieldGuidePrelude() {
    return (
        <section className="field-guide-prelude section">
            <div className="prelude-mark" aria-hidden="true">
                <img className="prelude-blueprint-pet" src={assets.blueprintPet} alt="" />
                <span>Vol. I</span>
            </div>
            <div>
                <p className="kicker">A product notebook you can read deeply</p>
                <h2>The homepage is the cover. Every canvas becomes a chapter.</h2>
            </div>
            <p>
                KronTerm is not one feature repeated nine times. The canvas, terminal, browser, sandboxes, desktop,
                remote sessions, KronosCode, ACP agents, and experimental voice each solve a distinct part of the
                builder’s operating model.
            </p>
        </section>
    );
}

function ReferenceTeaser() {
    return (
        <section className="reference-teaser section">
            <div className="reference-teaser-folio" aria-hidden="true">
                <span>Appendix</span>
                <strong>A—D</strong>
            </div>
            <div className="reference-teaser-copy">
                <p className="kicker">The complete technical index</p>
                <h2>The details belong in the book, too.</h2>
                <p>
                    Read the full block catalogue, agent architecture, runtime stack, security model, platform status,
                    and roadmap—collected from the project README and organized as an editorial reference.
                </p>
                <Link className="inline-link" to="/capabilities#reference-manual">
                    Open the reference manual <ArrowRight size={15} />
                </Link>
            </div>
            <div className="reference-teaser-index" aria-label="Reference manual contents">
                <span>
                    <b>A</b> Block catalogue
                </span>
                <span>
                    <b>B</b> Agent architecture
                </span>
                <span>
                    <b>C</b> Runtime stack
                </span>
                <span>
                    <b>D</b> Platforms + roadmap
                </span>
            </div>
        </section>
    );
}

function ReferenceManual() {
    const blockItems = chapterReference["workspace-canvas"].items;

    return (
        <div className="reference-manual" id="reference-manual">
            <header className="reference-manual-header section">
                <p className="kicker">Appendix / complete canvas reference</p>
                <div>
                    <h2>The system, sketched without shorthand.</h2>
                    <p>
                        A plain-spoken record of what KronTerm contains, how the layers connect, and what is available
                        today. Built from the project README so the product story and technical story stay aligned.
                    </p>
                </div>
            </header>

            <section className="reference-spread reference-blocks" aria-labelledby="block-catalogue-title">
                <div className="spread-margin" aria-hidden="true">
                    <span>Appendix A</span>
                    <strong>Blocks</strong>
                </div>
                <div className="spread-content">
                    <div className="spread-heading">
                        <p className="kicker">Every surface is a widget</p>
                        <h2 id="block-catalogue-title">The block catalogue.</h2>
                        <p>
                            Position, resize, stack, or full-screen any surface. Each one exposes a structured
                            accessibility tree through the Widget Protocol, so agents can inspect and act through the
                            same interface you can see.
                        </p>
                    </div>
                    <div className="reference-card-grid">
                        {blockItems.map((item, index) => (
                            <article key={item.label}>
                                <span>{String(index + 1).padStart(2, "0")}</span>
                                <h3>{item.label}</h3>
                                <p>{item.value}</p>
                            </article>
                        ))}
                    </div>
                    <p className="reference-note">
                        <strong>Widget Protocol:</strong> snapshot a block, receive stable element refs such as @e3,
                        then click, type, scroll, drag, inspect, wait, or capture a screenshot without stitching
                        together separate automation libraries.
                    </p>
                </div>
            </section>

            <section className="reference-spread reference-agents" aria-labelledby="agent-architecture-title">
                <div className="spread-margin" aria-hidden="true">
                    <span>Appendix B</span>
                    <strong>Agents</strong>
                </div>
                <div className="spread-content">
                    <div className="spread-heading spread-heading-light">
                        <p className="kicker">Canvas diagram / KronosCode architecture</p>
                        <h2 id="agent-architecture-title">One request. A routed team.</h2>
                        <p>
                            Every request follows a visible execution sequence. The router chooses a specialist based on
                            the surface and job instead of pretending one agent is equally suited to every layer.
                        </p>
                    </div>
                    <ol className="agent-flow-graph" aria-label="KronosCode execution pipeline">
                        {agentFlowSteps.map(([step, description], index) => (
                            <li key={step}>
                                <div className="agent-flow-node">
                                    <span>{String(index + 1).padStart(2, "0")}</span>
                                    <strong>{step}</strong>
                                    <p>{description}</p>
                                </div>
                                {index < agentFlowSteps.length - 1 ? (
                                    <ArrowRight className="agent-flow-arrow" size={18} aria-hidden="true" />
                                ) : null}
                            </li>
                        ))}
                    </ol>
                    <div className="agent-roster">
                        {specialistAgents.map(([name, role], index) => (
                            <article key={name}>
                                <span>{String(index).padStart(2, "0")}</span>
                                <h3>{name}</h3>
                                <p>{role}</p>
                            </article>
                        ))}
                    </div>
                    <div className="reference-caption-row">
                        <p>
                            <strong>Real execution:</strong> tool calls are performed by the runtime; they are not
                            simulated or narrated as completed work.
                        </p>
                        <p>
                            <strong>Included:</strong> core KronosCode ships with KronTerm. ACP background agents are a
                            separate planned premium capability.
                        </p>
                    </div>
                </div>
            </section>

            <section className="reference-spread reference-architecture" aria-labelledby="architecture-title">
                <div className="spread-margin" aria-hidden="true">
                    <span>Appendix C</span>
                    <strong>System</strong>
                </div>
                <div className="spread-content">
                    <div className="spread-heading">
                        <p className="kicker">Canvas diagram / vertically integrated</p>
                        <h2 id="architecture-title">Four layers, one control plane.</h2>
                        <p>
                            The product spans the desktop shell, widget protocol, agent engine, and model providers so
                            context does not disappear at the seams between separate tools.
                        </p>
                    </div>
                    <div className="architecture-stack">
                        {architectureLayers.map((layer) => (
                            <article key={layer.index}>
                                <span>{layer.index}</span>
                                <h3>{layer.title}</h3>
                                <p>{layer.text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="reference-ledger" aria-labelledby="runtime-title">
                <div className="ledger-heading">
                    <p className="kicker">Runtime ledger / 11 components</p>
                    <h2 id="runtime-title">What the system runs on.</h2>
                </div>
                <div className="ledger-table" role="table" aria-label="KronTerm runtime stack">
                    {runtimeStack.map(([component, technology, role], index) => (
                        <div className="ledger-row" role="row" key={component}>
                            <span role="cell">{String(index + 1).padStart(2, "0")}</span>
                            <strong role="cell">{component}</strong>
                            <b role="cell">{technology}</b>
                            <p role="cell">{role}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="status-spread" aria-labelledby="status-title">
                <div className="status-heading">
                    <p className="kicker">Appendix D / product status</p>
                    <h2 id="status-title">Where KronTerm is now—and where it goes next.</h2>
                </div>
                <div className="platform-ledger">
                    <article>
                        <span>Available now</span>
                        <h3>macOS</h3>
                        <p>Apple silicon and Intel builds are onboarding through the private beta.</p>
                    </article>
                    <article>
                        <span>Under evaluation</span>
                        <h3>Windows</h3>
                        <p>x64 support is being evaluated alongside extended native desktop control.</p>
                    </article>
                    <article>
                        <span>Under evaluation</span>
                        <h3>Linux</h3>
                        <p>arm64 and x64 desktop support remain on the platform roadmap.</p>
                    </article>
                </div>
                <div className="roadmap-list">
                    {roadmap.map(([title, text], index) => (
                        <article key={title}>
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            <h3>{title}</h3>
                            <p>{text}</p>
                        </article>
                    ))}
                </div>
                <div className="community-ribbon">
                    <div>
                        <p className="kicker">Continue the conversation</p>
                        <h3>Follow the work, read the docs, or help shape the roadmap.</h3>
                    </div>
                    <div className="community-links">
                        <a href="https://docs.kronterm.dev">
                            Documentation <ArrowRight size={14} />
                        </a>
                        <a href="https://discord.gg/XfvZ334gwU">
                            Discord <ArrowRight size={14} />
                        </a>
                        <a href="https://x.com/krontermdev">
                            X / @krontermdev <ArrowRight size={14} />
                        </a>
                        <Link to="/download">
                            Private beta <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}

function ChapterReference({ capability }: { capability: Capability }) {
    const reference = chapterReference[capability.slug];

    return (
        <section className="chapter-reference section">
            <div className="chapter-reference-heading">
                <p className="kicker">{reference.eyebrow}</p>
                <h2>{reference.title}</h2>
                <p>{reference.intro}</p>
            </div>
            <dl>
                {reference.items.map((item, index) => (
                    <div key={item.label}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

function HomePage() {
    usePageMeta(
        "KronTerm — The command center for human + agent work",
        "Enter the KronTerm field guide: dedicated product chapters for the workspace canvas, KronosCode, terminal, browser, sandboxes, desktop control, remote sessions, ACP agents, and experimental voice."
    );

    return (
        <>
            <Hero />
            <SurfaceTicker />
            <ProductFilm />
            <VisualStoryAtlas />
            <FieldGuidePrelude />
            <ChapterPortalSection />
            <ReferenceTeaser />
            <FinalCta />
        </>
    );
}

function CapabilityIndexPage() {
    usePageMeta("KronTerm Field Guide", "Explore nine dedicated chapters covering every major KronTerm capability.");

    return (
        <>
            <section className="field-guide-hero section">
                <div className="field-guide-edition">
                    <BookOpen size={22} />
                    <span>First edition / 2026</span>
                </div>
                <p className="kicker">The complete product</p>
                <h1>
                    KronTerm
                    <br />
                    Field Guide.
                </h1>
                <p>
                    A collection of dedicated product chapters for the surfaces, systems, and operating boundaries that
                    make human-plus-agent work legible.
                </p>
            </section>
            <ChapterPortalSection showHeading={false} />
            <ReferenceManual />
            <FinalCta />
        </>
    );
}

function ChapterNavigation({ currentSlug }: { currentSlug: string }) {
    return (
        <nav className="chapter-navigation" aria-label="KronTerm field guide chapters">
            <Link className="chapter-navigation-home" to="/capabilities">
                <BookOpen size={15} /> Field guide
            </Link>
            <div className="chapter-navigation-pages">
                {capabilities.map((item, index) => (
                    <Link
                        className={item.slug === currentSlug ? "active" : ""}
                        to={`/capabilities/${item.slug}`}
                        aria-current={item.slug === currentSlug ? "page" : undefined}
                        aria-label={`Chapter ${index + 1}: ${item.label}`}
                        key={item.slug}
                    >
                        {String(index + 1).padStart(2, "0")}
                    </Link>
                ))}
            </div>
        </nav>
    );
}

function CapabilityPage() {
    const { slug } = useParams();
    const capability = capabilities.find((item) => item.slug === slug);
    const chapter = capability ? chapters[capability.slug] : null;

    usePageMeta(
        capability ? `${capability.label} | KronTerm Field Guide` : "Capability | KronTerm",
        capability?.summary ?? "Explore the KronTerm workspace."
    );

    if (!capability || !chapter) {
        return <Navigate to="/capabilities" replace />;
    }

    const chapterIndex = capabilities.findIndex((item) => item.slug === capability.slug);
    const nextCapability = capabilities[(chapterIndex + 1) % capabilities.length];
    const Icon = capability.icon;

    return (
        <article className="chapter-page">
            <ChapterNavigation currentSlug={capability.slug} />

            <header className="chapter-hero section">
                <div className="chapter-hero-number" aria-hidden="true">
                    {String(chapterIndex + 1).padStart(2, "0")}
                </div>
                <div className="chapter-hero-copy">
                    <div className="chapter-hero-meta">
                        <span>
                            Chapter {String(chapterIndex + 1).padStart(2, "0")} of{" "}
                            {String(capabilities.length).padStart(2, "0")}
                        </span>
                        <span>{capability.eyebrow.split(" / ")[1]}</span>
                    </div>
                    <span className="chapter-icon">
                        <Icon size={24} />
                    </span>
                    <h1>{capability.title}</h1>
                    <p>{capability.description}</p>
                    <div className="detail-actions">
                        <a className="button button-primary" href="#chapter-story">
                            Read the chapter
                        </a>
                        <Link className="button button-quiet" to="/capabilities">
                            All chapters
                        </Link>
                    </div>
                </div>
                <ProductMedia media={capability.media} className="chapter-hero-media" />
            </header>

            <section className="chapter-thesis section" id="chapter-story">
                <div className="chapter-thesis-label">
                    <span>Thesis</span>
                    <span>{String(chapterIndex + 1).padStart(2, "0")}—A</span>
                </div>
                <blockquote>{chapter.thesis}</blockquote>
            </section>

            <section className="chapter-essay section">
                <aside>
                    <p className="kicker">Why it exists</p>
                    <h2>{capability.label} is a complete product surface.</h2>
                </aside>
                <div className="chapter-prose">
                    <p>{chapter.narrative[0]}</p>
                    <p>{chapter.narrative[1]}</p>
                </div>
            </section>

            <section className="chapter-details section">
                <div className="chapter-section-heading">
                    <p className="kicker">Canvas notes / the operating model</p>
                    <h2>What changes when this surface is part of the workspace.</h2>
                </div>
                <div className="chapter-detail-grid">
                    {chapter.details.map((detail, index) => (
                        <article key={detail.title}>
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            <h3>{detail.title}</h3>
                            <p>{detail.text}</p>
                        </article>
                    ))}
                </div>
            </section>

            <ChapterReference capability={capability} />

            <section className="chapter-gallery section">
                <div className="chapter-section-heading gallery-heading">
                    <div>
                        <p className="kicker">Pinned to the canvas / product plates</p>
                        <h2>A closer look at {capability.label.toLowerCase()}.</h2>
                    </div>
                    <span>Plate 01—03</span>
                </div>
                <div className="chapter-gallery-grid">
                    {chapter.gallery.map((media, index) => (
                        <figure
                            className={index === 0 ? "gallery-plate gallery-plate-wide" : "gallery-plate"}
                            key={media.src}
                        >
                            <ProductMedia media={media.type === "image" ? { ...media, priority: true } : media} />
                            <figcaption>
                                <span>Plate {String(index + 1).padStart(2, "0")}</span>
                                <p>{media.alt}</p>
                            </figcaption>
                        </figure>
                    ))}
                </div>
            </section>

            <section className="chapter-workflow section">
                <div className="chapter-section-heading">
                    <p className="kicker">Canvas sequence / a typical flow</p>
                    <h2>From entry to evidence.</h2>
                </div>
                <ol>
                    {chapter.workflow.map((step, index) => (
                        <li key={step}>
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            <strong>{step}</strong>
                        </li>
                    ))}
                </ol>
            </section>

            <Link className="next-chapter section" to={`/capabilities/${nextCapability.slug}`}>
                <span>Turn the page</span>
                <div>
                    <p>Next / Chapter {String(((chapterIndex + 1) % capabilities.length) + 1).padStart(2, "0")}</p>
                    <h2>{nextCapability.label}</h2>
                </div>
                <ArrowRight size={34} />
            </Link>
        </article>
    );
}

function SecurityPage() {
    usePageMeta("Security | KronTerm", "Visible boundaries and approval-aware agent execution in KronTerm.");
    const items = [
        [
            ShieldCheck,
            "Surface routing",
            "Host, sandbox, browser, terminal, and remote actions are explicitly separated so commands cannot silently cross boundaries.",
        ],
        [
            Boxes,
            "Tool budgets",
            "Broad searches and agent activity can be limited before coding to control scope and model cost.",
        ],
        [
            BrainCircuit,
            "Capability contracts",
            "Runtime health checks tell agents which tools are actually available before a plan reaches execution.",
        ],
        [
            FileCode2,
            "Stop conditions",
            "Agents stop when acceptance checks pass or when credentials and other required inputs are missing.",
        ],
        [GitBranch, "Git safety", "Workflows do not force-push, amend published commits, or bypass repository hooks."],
        [
            Command,
            "Bring your own keys",
            "Your provider credentials connect directly to OpenAI, Anthropic, Google, or local models.",
        ],
        [
            ShieldCheck,
            "Secure storage",
            "Secrets use the native macOS Keychain, Linux secret service, or Windows Credential Manager.",
        ],
        [
            Server,
            "Sandbox isolation",
            "E2B environments allow root access inside the VM with no access to the host by default.",
        ],
    ] as const;
    return (
        <>
            <section className="simple-hero notebook-hero section">
                <p className="kicker">Security by legibility</p>
                <h1>See where every action happens.</h1>
                <p>
                    Agent power is only useful when teams can understand the boundary, inspect the step, and verify the
                    result.
                </p>
                <PetNote message="A clear boundary is easier to trust—and much easier to debug." />
            </section>
            <section className="simple-grid section">
                {items.map(([Icon, title, text]) => (
                    <article key={title}>
                        <Icon size={23} />
                        <h2>{title}</h2>
                        <p>{text}</p>
                    </article>
                ))}
            </section>
            <section className="data-flow section" aria-labelledby="data-flow-title">
                <div className="data-flow-heading">
                    <p className="kicker">Canvas diagram / local-first data flow</p>
                    <h2 id="data-flow-title">Your workspace is not routed through a KronTerm cloud.</h2>
                    <p>
                        Source code, terminal output, and local files stay on your machine. Only the context you
                        authorize moves from the local engine to the model provider you selected.
                    </p>
                </div>
                <ol>
                    <li>
                        <span>01</span>
                        <strong>Your API key</strong>
                        <p>Stored by the operating system’s native secure store.</p>
                    </li>
                    <li>
                        <span>02</span>
                        <strong>Your provider</strong>
                        <p>OpenAI, Anthropic, Google, Ollama, LM Studio, or another configured endpoint.</p>
                    </li>
                    <li>
                        <span>03</span>
                        <strong>Local KronosCode</strong>
                        <p>Plans and tool orchestration run on your machine.</p>
                    </li>
                    <li>
                        <span>04</span>
                        <strong>Local tools</strong>
                        <p>Approved actions execute against the workspace and return evidence to the session.</p>
                    </li>
                </ol>
                <p className="data-flow-note">
                    KronTerm has no required cloud service in this path. Local providers can keep model inference local
                    as well.
                </p>
            </section>
            <ControlSection />
            <FinalCta />
        </>
    );
}

function PricingPage() {
    usePageMeta("Pricing | KronTerm", "Private beta plans for individual builders, technical teams, and enterprises.");
    const plans = [
        {
            name: "Builder",
            eyebrow: "For independent operators",
            text: "A complete KronTerm workspace with core KronosCode and private beta access.",
            cta: "Request builder access",
            featured: false,
        },
        {
            name: "Team",
            eyebrow: "For teams shipping together",
            text: "Shared workflow design, expanded agent operations, and guided onboarding.",
            cta: "Talk to the team",
            featured: true,
        },
        {
            name: "Enterprise",
            eyebrow: "For controlled deployment",
            text: "Security review, custom orchestration, model policy, and deployment planning.",
            cta: "Contact sales",
            featured: false,
        },
    ];
    return (
        <>
            <section className="simple-hero notebook-hero section">
                <p className="kicker">Private beta plans</p>
                <h1>Start with the workspace your team needs.</h1>
                <p>
                    KronTerm is currently onboarding design partners. We will tailor access around team size, workflows,
                    and control requirements.
                </p>
                <PetNote pose="walk" message="Choose the workspace first. The plan should follow the work." />
            </section>
            <section className="pricing-grid section">
                {plans.map((plan) => (
                    <article className={plan.featured ? "pricing-card featured" : "pricing-card"} key={plan.name}>
                        {plan.featured ? <span className="plan-badge">Recommended</span> : null}
                        <p className="kicker">{plan.eyebrow}</p>
                        <h2>{plan.name}</h2>
                        <p>{plan.text}</p>
                        <ul>
                            <li>
                                <Check size={16} /> Workspace canvas
                            </li>
                            <li>
                                <Check size={16} /> KronosCode agents
                            </li>
                            <li>
                                <Check size={16} /> Approval-aware workflows
                            </li>
                        </ul>
                        <Link
                            className={plan.featured ? "button button-primary" : "button button-quiet"}
                            to="/contact-sales"
                        >
                            {plan.cta}
                        </Link>
                    </article>
                ))}
            </section>
            <section className="pricing-disclosure section">
                <div>
                    <p className="kicker">What ships with the product</p>
                    <h2>KronosCode is core. It is not an agent add-on.</h2>
                </div>
                <div>
                    <p>
                        The on-demand KronosCode engine is included with KronTerm without a separate premium tier for
                        its core agent system. Bring your own model keys and choose local or cloud providers.
                    </p>
                    <p>
                        Autonomous ACP agents—including Hermes, OpenClaw, and Codex—are planned as a commercial premium
                        capability for continuous background workflows.
                    </p>
                </div>
            </section>
            <FinalCta />
        </>
    );
}

function AccessPage({ contact = false }: { contact?: boolean }) {
    usePageMeta(contact ? "Contact | KronTerm" : "Request access | KronTerm", "Join the KronTerm private beta.");
    return (
        <section className="access-page notebook-access section">
            <div className="access-copy">
                <p className="kicker">{contact ? "Talk to the team" : "Private beta"}</p>
                <h1>
                    {contact ? "Design your team’s agent workspace." : "Build with the whole workspace in context."}
                </h1>
                <p>
                    {contact
                        ? "Tell us where your current developer and agent workflows lose context. We’ll map what KronTerm could bring together."
                        : "KronTerm is onboarding ambitious individual builders and technical teams in focused cohorts."}
                </p>
                <div className="access-points">
                    <span>
                        <Check size={16} /> Guided onboarding
                    </span>
                    <span>
                        <Check size={16} /> Direct product feedback loop
                    </span>
                    <span>
                        <Check size={16} /> Early workflow design
                    </span>
                </div>
                <PetNote
                    message={
                        contact
                            ? "Tell us where context gets lost. That is usually the best place to begin."
                            : "Private beta notes go directly to the people building KronTerm."
                    }
                />
            </div>
            <div className="access-card">
                <span className="card-icon">
                    <Command size={20} />
                </span>
                <h2>{contact ? "Start the conversation" : "Request an invitation"}</h2>
                <p>
                    Email the KronTerm team with your role, team size, and the workflow you most want to bring into one
                    surface.
                </p>
                <a
                    className="button button-primary"
                    href={`mailto:hello@kronterm.dev?subject=${encodeURIComponent(contact ? "KronTerm team inquiry" : "KronTerm private beta request")}`}
                >
                    Email hello@kronterm.dev <ArrowRight size={16} />
                </a>
                <small>We respond personally. No automated sales sequence.</small>
            </div>
        </section>
    );
}

function DocumentationPage() {
    const [query, setQuery] = useState("");
    const normalizedQuery = query.trim().toLowerCase();
    const filteredSections = documentationSections.filter((section) => {
        if (!normalizedQuery) {
            return true;
        }
        return [section.title, section.eyebrow, section.summary, ...section.points].some((value) =>
            value.toLowerCase().includes(normalizedQuery)
        );
    });

    usePageMeta(
        "Documentation | KronTerm",
        "Learn how KronTerm workspaces, blocks, KronosCode, browser automation, sandboxes, desktop control, SSH, and security fit together."
    );

    return (
        <>
            <section className="notebook-page docs-hero section">
                <div className="notebook-punches" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </div>
                <div className="notebook-folio">
                    <span>KT / Documentation</span>
                    <span>Revision 01 · 2026</span>
                </div>
                <p className="kicker">Documentation notebook</p>
                <h1>Everything needed to operate the workspace.</h1>
                <p>
                    Start with the model, then move into the exact surface you need. These notes connect the product
                    concepts, operating boundaries, and detailed field-guide chapters in one readable index.
                </p>
                <div className="docs-actions">
                    <a className="button button-light" href="https://docs.kronterm.dev">
                        Open technical docs <ArrowRight size={15} />
                    </a>
                    <Link className="button notebook-button" to="/capabilities">
                        Browse the field guide <BookOpen size={15} />
                    </Link>
                </div>
                <PetNote
                    className="docs-hero-pet"
                    message="I indexed the surfaces by the job you are trying to finish."
                />
            </section>

            <section className="docs-layout section">
                <aside className="docs-contents notebook-sheet">
                    <p className="kicker">On this page</p>
                    <nav aria-label="Documentation sections">
                        {documentationSections.map((section, index) => (
                            <a href={`#${section.id}`} key={section.id}>
                                <span>{String(index + 1).padStart(2, "0")}</span>
                                {section.title}
                            </a>
                        ))}
                    </nav>
                    <p className="docs-contents-note">Nine entries · product and operating reference</p>
                </aside>

                <div className="docs-manual">
                    <label className="docs-search">
                        <Search size={18} aria-hidden="true" />
                        <span className="sr-only">Search documentation</span>
                        <input
                            type="search"
                            value={query}
                            placeholder="Search the notebook…"
                            onChange={(event) => setQuery(event.target.value)}
                        />
                        <small aria-live="polite">
                            {filteredSections.length} {filteredSections.length === 1 ? "entry" : "entries"}
                        </small>
                    </label>

                    {filteredSections.length ? (
                        filteredSections.map((section, index) => (
                            <article className="docs-entry notebook-sheet" id={section.id} key={section.id}>
                                <div className="docs-entry-index">
                                    <span>{String(index + 1).padStart(2, "0")}</span>
                                    <FileText size={18} />
                                </div>
                                <div className="docs-entry-copy">
                                    <p className="kicker">{section.eyebrow}</p>
                                    <h2>{section.title}</h2>
                                    <p>{section.summary}</p>
                                    <ul>
                                        {section.points.map((point) => (
                                            <li key={point}>{point}</li>
                                        ))}
                                    </ul>
                                    <Link className="notebook-link" to={section.link}>
                                        {section.linkLabel} <ArrowRight size={14} />
                                    </Link>
                                </div>
                            </article>
                        ))
                    ) : (
                        <div className="docs-empty notebook-sheet">
                            <PetNote message="No note matches that phrase yet. Try a surface, action, or boundary." />
                            <button type="button" onClick={() => setQuery("")}>
                                Clear the search
                            </button>
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}

function BlogPage() {
    usePageMeta(
        "Field Notes | KronTerm Blog",
        "Read product thinking from KronTerm about workspace context, inspectable browser automation, and isolated agent execution."
    );
    const [featured, ...remainingPosts] = blogPosts;

    return (
        <>
            <section className="notebook-page blog-hero section">
                <div className="notebook-punches" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </div>
                <div className="notebook-folio">
                    <span>KT / Field notes</span>
                    <span>Vol. 01 · 2026</span>
                </div>
                <p className="kicker">KronTerm blog</p>
                <h1>Notes from building the command center.</h1>
                <p>
                    Product decisions, operating principles, and practical lessons from designing one workspace for
                    people and agents.
                </p>
                <PetNote
                    className="blog-hero-pet"
                    pose="walk"
                    message="I patrol the margins and collect the interesting decisions."
                />
            </section>

            <section className="blog-index section">
                <Link className="blog-feature-note" to={`/blog/${featured.slug}`}>
                    <div className="blog-note-meta">
                        <span>{featured.note}</span>
                        <span>
                            {featured.date} · {featured.readTime}
                        </span>
                    </div>
                    <div>
                        <p className="kicker">Featured dispatch</p>
                        <h2>{featured.title}</h2>
                        <p>{featured.dek}</p>
                    </div>
                    <span className="blog-read-link">
                        Read the field note <ArrowRight size={16} />
                    </span>
                </Link>

                <div className="blog-note-grid">
                    {remainingPosts.map((post, index) => (
                        <Link
                            className={`blog-note-card blog-note-card-${index + 1}`}
                            to={`/blog/${post.slug}`}
                            key={post.slug}
                        >
                            <div className="blog-note-meta">
                                <span>{post.note}</span>
                                <span>{post.readTime}</span>
                            </div>
                            <PenLine size={21} aria-hidden="true" />
                            <h2>{post.title}</h2>
                            <p>{post.dek}</p>
                            <span className="blog-read-link">
                                Open note <ArrowRight size={14} />
                            </span>
                        </Link>
                    ))}
                </div>

                <div className="blog-community-note notebook-sheet">
                    <div>
                        <p className="kicker">Shape the next note</p>
                        <h2>What should we document in public?</h2>
                    </div>
                    <p>
                        Share the workflow, technical boundary, or agent-design question you want the KronTerm team to
                        unpack next.
                    </p>
                    <a className="notebook-link" href="https://discord.gg/XfvZ334gwU">
                        Join the Discord discussion <ArrowRight size={14} />
                    </a>
                </div>
            </section>
        </>
    );
}

function BlogPostPage() {
    const { slug } = useParams();
    const post = blogPosts.find((item) => item.slug === slug);
    const postIndex = post ? blogPosts.findIndex((item) => item.slug === post.slug) : -1;
    const nextPost = post ? blogPosts[(postIndex + 1) % blogPosts.length] : null;

    usePageMeta(
        post ? `${post.title} | KronTerm Field Notes` : "Field note | KronTerm",
        post?.dek ?? "Read product and engineering notes from KronTerm."
    );

    if (!post || !nextPost) {
        return <Navigate to="/blog" replace />;
    }

    return (
        <article className="blog-post">
            <header className="notebook-page blog-post-header section">
                <div className="notebook-punches" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </div>
                <Link className="blog-back-link" to="/blog">
                    <ArrowRight size={14} /> All field notes
                </Link>
                <div className="blog-note-meta">
                    <span>{post.note}</span>
                    <span>
                        {post.date} · {post.readTime}
                    </span>
                </div>
                <h1>{post.title}</h1>
                <p>{post.dek}</p>
                <PetNote className="blog-post-pet" message="A field note should leave the reasoning visible." />
            </header>

            <section className="blog-prose section">
                <aside className="blog-prose-margin">
                    <span>Filed under</span>
                    <strong>Product principles</strong>
                    <span>Author</span>
                    <strong>KronTerm team + resident cat</strong>
                </aside>
                <div className="blog-prose-copy">
                    {post.sections.map((section, index) => (
                        <section key={section.title}>
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            <h2>{section.title}</h2>
                            {section.paragraphs.map((paragraph) => (
                                <p key={paragraph}>{paragraph}</p>
                            ))}
                        </section>
                    ))}
                </div>
            </section>

            <Link className="next-field-note section" to={`/blog/${nextPost.slug}`}>
                <span>Turn to the next field note</span>
                <h2>{nextPost.title}</h2>
                <ArrowRight size={28} />
            </Link>
        </article>
    );
}

function Footer() {
    return (
        <footer className="footer">
            <div className="footer-folio" aria-hidden="true">
                <span>End notes</span>
                <span>KronTerm field guide / 2026</span>
            </div>
            <div className="footer-main">
                <div className="footer-brand">
                    <Brand />
                    <p>A living field notebook for human + agent work.</p>
                </div>
                <div className="footer-links">
                    <div>
                        <strong>Product</strong>
                        <Link to="/capabilities">Field guide</Link>
                        <Link to="/capabilities/workspace-canvas">Workspace</Link>
                        <Link to="/docs">Documentation</Link>
                        <Link to="/blog">Blog</Link>
                        <Link to="/pricing">Pricing</Link>
                    </div>
                    <div>
                        <strong>Company</strong>
                        <Link to="/contact-sales">Contact</Link>
                        <Link to="/security">Security</Link>
                        <Link to="/download">Private beta</Link>
                    </div>
                    <div>
                        <strong>Community</strong>
                        <a href="https://docs.kronterm.dev">Technical docs</a>
                        <a href="https://discord.gg/XfvZ334gwU">Discord</a>
                        <a href="https://x.com/krontermdev">X / @krontermdev</a>
                        <a href="https://github.com/Ahmedalsadi-1/kronterm">GitHub</a>
                        <a href="https://www.kronterm.dev">kronterm.dev</a>
                    </div>
                </div>
            </div>
            <div className="footer-bottom">
                <span>© 2026 KronTerm</span>
                <span>Built for serious technical work.</span>
            </div>
        </footer>
    );
}

function AppRoutes() {
    const location = useLocation();

    return (
        <div className="page-turn-stage">
            <div className="page-leaf" key={location.pathname}>
                <Routes location={location}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/capabilities" element={<CapabilityIndexPage />} />
                    <Route path="/capabilities/:slug" element={<CapabilityPage />} />
                    <Route path="/docs" element={<DocumentationPage />} />
                    <Route path="/blog" element={<BlogPage />} />
                    <Route path="/blog/:slug" element={<BlogPostPage />} />
                    <Route path="/security" element={<SecurityPage />} />
                    <Route path="/pricing" element={<PricingPage />} />
                    <Route path="/download" element={<AccessPage />} />
                    <Route path="/contact-sales" element={<AccessPage contact />} />
                    <Route path="/product" element={<Navigate to="/" replace />} />
                    <Route path="/kronoscode" element={<Navigate to="/capabilities/kronoscode" replace />} />
                    <Route path="/terminal" element={<Navigate to="/capabilities/terminal" replace />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </div>
    );
}

export function App() {
    return (
        <div className="app-shell">
            <a className="skip-link" href="#main-content">
                Skip to content
            </a>
            <ReadingProgress />
            <Nav />
            <ScrollAtmosphere />
            <main id="main-content">
                <AppRoutes />
            </main>
            <Footer />
        </div>
    );
}
