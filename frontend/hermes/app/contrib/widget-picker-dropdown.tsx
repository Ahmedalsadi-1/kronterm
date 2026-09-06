import { useState } from "react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@hermes/components/ui/dropdown-menu";
import { Tip } from "@hermes/components/ui/tooltip";
import { TitlebarIcon } from "../shell/titlebar-icon";
import { titlebarButtonClass } from "../shell/titlebar";

interface WidgetDef {
    id: string;
    label: string;
    icon: string;
    view: string;
    description?: string;
}

const EXCLUDED_VIEWS = new Set([
    "chathubv2",     // KronosChamber
    "waveai",        // Chathubv2 AI
    "open-design",   // OpenDesign
]);

const AVAILABLE_WIDGETS: WidgetDef[] = [
    { id: "terminal", label: "Terminal", icon: "terminal", view: "term", description: "New terminal" },
    { id: "browser", label: "Browser", icon: "globe", view: "web", description: "New browser" },
    { id: "files", label: "Files", icon: "folder", view: "preview", description: "New file explorer" },
    { id: "gittree", label: "Git Tree", icon: "code-branch", view: "preview", description: "Browse repository" },
    { id: "sandbox", label: "Sandbox", icon: "desktop", view: "sandbox", description: "Isolated Linux desktop" },
    { id: "sysinfo", label: "Sysinfo", icon: "chart-line", view: "sysinfo", description: "System information" },
    { id: "apps", label: "Apps", icon: "shapes", view: "installedapps", description: "Installed applications" },
    { id: "warpagent", label: "Warp Agent", icon: "wand-magic-sparkles", view: "warpagent", description: "Warp-style agent" },
];

function krontermCreateWidget(view: string) {
    window.dispatchEvent(
        new CustomEvent("kronterm:create-widget", { detail: { view } })
    );
}

export function WidgetPickerDropdown() {
    const [open, setOpen] = useState(false);

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <Tip label="Add widget">
                <DropdownMenuTrigger asChild>
                    <button
                        className={`${titlebarButtonClass} bg-transparent select-none`}
                        type="button"
                        aria-label="Add widget"
                    >
                        <TitlebarIcon name="add" />
                    </button>
                </DropdownMenuTrigger>
            </Tip>
            <DropdownMenuContent side="bottom" align="end" sideOffset={4}>
                {AVAILABLE_WIDGETS.map((w) => (
                    <DropdownMenuItem
                        key={w.id}
                        onSelect={() => {
                            krontermCreateWidget(w.view);
                            setOpen(false);
                        }}
                    >
                        <TitlebarIcon name={w.icon} />
                        <span>{w.label}</span>
                        {w.description && (
                            <span className="ml-auto text-[0.65rem] text-(--ui-text-tertiary)">
                                {w.description}
                            </span>
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
