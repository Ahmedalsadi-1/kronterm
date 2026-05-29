import { cn } from "@/util/util";
import { memo } from "react";
import codebuddyLogo from "./agent-logos/codebuddy.svg?url";
import codexLogo from "./agent-logos/codex.svg?url";
import droidLogo from "./agent-logos/droid.svg?url";
import geminiLogo from "./agent-logos/gemini.png";
import hermesLogo from "./agent-logos/hermes.svg?url";
import kiroLogo from "./agent-logos/kiro.ico";
import kronoscodeLogo from "./agent-logos/kronoscode.svg?url";
import opencodeLogo from "./agent-logos/opencode.svg?url";
import qwenLogo from "./agent-logos/qwen.svg?url";

type AcpAgentMarkProps = {
    backend: string;
    className?: string;
};

const agentLogos: Record<string, string> = {
    codebuddy: codebuddyLogo,
    codex: codexLogo,
    droid: droidLogo,
    gemini: geminiLogo,
    hermes: hermesLogo,
    kiro: kiroLogo,
    kronoscode: kronoscodeLogo,
    opencode: opencodeLogo,
    qwen: qwenLogo,
};

export const AcpAgentMark = memo(({ backend, className }: AcpAgentMarkProps) => {
    const normalizedBackend = backend.toLowerCase();
    const logo = agentLogos[normalizedBackend];
    if (logo) {
        return (
            <img
                src={logo}
                alt=""
                draggable={false}
                className={cn(
                    "h-6 w-6 shrink-0 object-contain",
                    normalizedBackend === "hermes" && "brightness-0 invert",
                    className
                )}
                aria-hidden="true"
            />
        );
    }

    return (
        <span
            className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#3b3936] bg-[#242321] text-[11px] font-semibold uppercase text-[#b8b3ac]",
                className
            )}
            aria-hidden="true"
        >
            {backend.slice(0, 1)}
        </span>
    );
});

AcpAgentMark.displayName = "AcpAgentMark";
