// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

const WorkspacePresentations = ["widgets", "tabs", "canvas"] as const;

type WorkspacePresentation = (typeof WorkspacePresentations)[number];

function isWorkspacePresentation(value: unknown): value is WorkspacePresentation {
    return WorkspacePresentations.includes(value as WorkspacePresentation);
}

function getAdjacentWorkspacePresentation(current: WorkspacePresentation, direction: -1 | 1): WorkspacePresentation {
    const currentIndex = WorkspacePresentations.indexOf(current);
    const nextIndex = (currentIndex + direction + WorkspacePresentations.length) % WorkspacePresentations.length;
    return WorkspacePresentations[nextIndex];
}

export { WorkspacePresentations, getAdjacentWorkspacePresentation, isWorkspacePresentation };
export type { WorkspacePresentation };
