export type RuntimeTarget = "local" | "local-linux" | "sandbox" | "remote-device";

export interface KronLocalFile {
    path: string;
    content: string;
    language: "html" | "json" | "markdown" | "typescript";
}

export interface KronLocalWorkspace {
    id: string;
    name: string;
    branch: string;
    files: KronLocalFile[];
    updatedAt: number;
}

export interface RuntimeRoute {
    target: RuntimeTarget;
    label: string;
    reason: string;
}

export interface RoutedAgentObjective {
    text: string;
    route: RuntimeRoute;
    workspace: {
        id: string;
        name: string;
        branch: string;
        files: string[];
        selectedFile?: Pick<KronLocalFile, "path" | "content" | "language">;
    };
}

export interface LocalCommandResult {
    output: string[];
    clear?: boolean;
}

const WorkspaceStorageKey = "kronterm.local.workspace.v1";

const InitialFiles: KronLocalFile[] = [
    {
        path: "packages/agent/src/input-pipeline.ts",
        language: "typescript",
        content: `import { createInputChannel } from "./channel";

export type InputSource = "web" | "desktop" | "mobile";

export const makeInputPipeline = (source: InputSource) => {
    const channel = createInputChannel({ source, flushInterval: 8 });

    return {
        write(data: string) {
            channel.enqueue(data);
        },
        flush() {
            return channel.flush();
        },
    };
};
`,
    },
    {
        path: "index.html",
        language: "html",
        content: `<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>KronTerm Preview</title>
        <style>
            :root { color-scheme: dark; font-family: ui-sans-serif, system-ui; }
            body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #0d0d10; color: #f2eff8; }
            main { width: min(82vw, 620px); }
            small { color: #a5b86a; letter-spacing: .12em; text-transform: uppercase; }
            h1 { margin: 12px 0; font-size: clamp(38px, 9vw, 72px); letter-spacing: -.07em; }
            p { color: #aaa6b1; line-height: 1.6; }
            span { color: #9d7cf4; }
        </style>
    </head>
    <body>
        <main>
            <small>Kron Local · Live preview</small>
            <h1>Build from <span>anywhere.</span></h1>
            <p>This page is rendered directly from the persistent iPhone workspace.</p>
        </main>
    </body>
</html>`,
    },
    {
        path: "package.json",
        language: "json",
        content: `{
    "name": "kronterm-mobile-workspace",
    "private": true,
    "scripts": {
        "test": "vitest run"
    }
}
`,
    },
    {
        path: "README.md",
        language: "markdown",
        content: `# KronTerm Workspace

This project is available to Kron Local, Local Linux, and Kron Sandbox.
`,
    },
];

export const makeInitialWorkspace = (): KronLocalWorkspace => ({
    id: "kronterm-workspace",
    name: "KronTerm Workspace",
    branch: "main",
    files: InitialFiles.map((file) => ({ ...file })),
    updatedAt: Date.now(),
});

const isWorkspace = (value: unknown): value is KronLocalWorkspace => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const workspace = value as Partial<KronLocalWorkspace>;
    return (
        typeof workspace.id === "string" &&
        typeof workspace.name === "string" &&
        typeof workspace.branch === "string" &&
        typeof workspace.updatedAt === "number" &&
        Array.isArray(workspace.files) &&
        workspace.files.every(
            (file) =>
                file != null &&
                typeof file === "object" &&
                typeof file.path === "string" &&
                typeof file.content === "string" &&
                typeof file.language === "string"
        )
    );
};

export const loadLocalWorkspace = (): KronLocalWorkspace => {
    try {
        const serialized = window.localStorage.getItem(WorkspaceStorageKey);
        if (!serialized) {
            return makeInitialWorkspace();
        }
        const workspace = JSON.parse(serialized) as unknown;
        return isWorkspace(workspace) ? workspace : makeInitialWorkspace();
    } catch {
        return makeInitialWorkspace();
    }
};

export const saveLocalWorkspace = (workspace: KronLocalWorkspace): void => {
    window.localStorage.setItem(WorkspaceStorageKey, JSON.stringify(workspace));
};

export const updateWorkspaceFile = (
    workspace: KronLocalWorkspace,
    path: string,
    content: string
): KronLocalWorkspace => ({
    ...workspace,
    files: workspace.files.map((file) => (file.path === path ? { ...file, content } : file)),
    updatedAt: Date.now(),
});

export const routeRuntimeIntent = (intent: string): RuntimeRoute => {
    const normalized = intent.toLowerCase();
    if (/\b(xcode|macos|ios build|windows app|my (mac|pc|computer))\b/.test(normalized)) {
        return {
            target: "remote-device",
            label: "Remote Device",
            reason: "This work depends on a specific personal computer or native toolchain.",
        };
    }
    if (/\b(docker|postgres(?:ql)?|rust|go|golang|next\.js|large node|heavy build)\b/.test(normalized)) {
        return {
            target: "sandbox",
            label: "Kron Sandbox",
            reason: "The task benefits from an isolated cloud Linux runtime and larger compute budget.",
        };
    }
    if (/\b(python|pip|alpine|linux package|apt|apk)\b/.test(normalized)) {
        return {
            target: "local-linux",
            label: "Local Linux",
            reason: "A Linux userspace is the smallest compatible runtime for this task.",
        };
    }
    return {
        target: "local",
        label: "Kron Local",
        reason: "Files, JavaScript, WebAssembly, Git, and local previews stay private on this iPhone.",
    };
};

export const runLocalCommand = (workspace: KronLocalWorkspace, input: string): LocalCommandResult => {
    const command = input.trim();
    if (!command) {
        return { output: [] };
    }
    const [program, ...args] = command.split(/\s+/);
    if (program === "clear") {
        return { output: [], clear: true };
    }
    if (program === "pwd") {
        return { output: ["/kron-local/kronterm"] };
    }
    if (program === "ls") {
        return { output: ["README.md  index.html  package.json  packages/"] };
    }
    if (program === "cat") {
        const path = args.join(" ");
        const file = workspace.files.find((candidate) => candidate.path === path);
        return file ? { output: file.content.split("\n") } : { output: [`cat: ${path || "operand"}: No such file`] };
    }
    if (program === "git" && args[0] === "status") {
        return { output: ["On branch main", "Your branch is up to date with 'origin/main'.", "", "nothing to commit"] };
    }
    if ((program === "npm" && args[0] === "test") || (program === "pnpm" && args[0] === "test")) {
        return {
            output: [
                "",
                "> kronterm-mobile-workspace test",
                "",
                " ✓ input-pipeline.test.ts  (6 tests)",
                " ✓ runtime-router.test.ts  (8 tests)",
                "",
                " Test Files  2 passed (2)",
                "      Tests  14 passed (14)",
                "   Duration  438ms",
            ],
        };
    }
    if (program === "help") {
        return { output: ["Available: pwd, ls, cat <file>, git status, npm test, clear, help"] };
    }
    return {
        output: [`zsh: command not found: ${program}`, "Try `help`, or let Auto route this command to Kron Sandbox."],
    };
};
