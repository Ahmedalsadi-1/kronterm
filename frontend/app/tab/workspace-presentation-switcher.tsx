// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useRef } from "react";
import {
    getAdjacentWorkspacePresentation,
    WorkspacePresentations,
    type WorkspacePresentation,
} from "./workspace-presentation";
import "./workspace-presentation-switcher.scss";

const PresentationDetails: Record<WorkspacePresentation, { icon: string; label: string; description: string }> = {
    widgets: {
        icon: "fa-table-cells-large",
        label: "Widgets",
        description: "Arrange widgets in resizable splits",
    },
    tabs: {
        icon: "fa-window-restore",
        label: "Tabs",
        description: "Focus one widget at a time",
    },
    canvas: {
        icon: "fa-object-group",
        label: "Canvas",
        description: "Arrange widgets on a spatial canvas",
    },
};

const WorkspacePresentationSwitcher = ({
    value,
    onChange,
}: {
    value: WorkspacePresentation;
    onChange: (value: WorkspacePresentation) => void;
}) => {
    const buttonRefs = useRef(new Map<WorkspacePresentation, HTMLButtonElement>());

    const selectAdjacent = (direction: -1 | 1) => {
        const nextValue = getAdjacentWorkspacePresentation(value, direction);
        onChange(nextValue);
        buttonRefs.current.get(nextValue)?.focus();
    };

    return (
        <nav
            className="workspace-presentation-switcher"
            aria-label="Workspace presentation"
            onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    selectAdjacent(-1);
                } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    selectAdjacent(1);
                } else if (event.key === "Home" || event.key === "End") {
                    event.preventDefault();
                    const nextValue = event.key === "Home" ? WorkspacePresentations[0] : WorkspacePresentations.at(-1);
                    onChange(nextValue);
                    buttonRefs.current.get(nextValue)?.focus();
                }
            }}
        >
            <span className="workspace-presentation-label">View</span>
            <div className="workspace-presentation-options" role="radiogroup" aria-label="Workspace view">
                {WorkspacePresentations.map((presentation) => {
                    const detail = PresentationDetails[presentation];
                    const active = value === presentation;
                    return (
                        <button
                            key={presentation}
                            ref={(element) => {
                                if (element) {
                                    buttonRefs.current.set(presentation, element);
                                } else {
                                    buttonRefs.current.delete(presentation);
                                }
                            }}
                            type="button"
                            className={active ? "is-active" : ""}
                            role="radio"
                            aria-checked={active}
                            tabIndex={active ? 0 : -1}
                            title={detail.description}
                            onClick={() => onChange(presentation)}
                        >
                            <i className={`fa-solid ${detail.icon}`} aria-hidden="true" />
                            <span>{detail.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export { WorkspacePresentationSwitcher };
