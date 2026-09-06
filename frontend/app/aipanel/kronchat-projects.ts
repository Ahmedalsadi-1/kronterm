// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export type KronchatProject = {
    workspace: string;
    name: string;
    sessionCount: number;
    liveCount: number;
    activeConversationId?: string;
    updatedTs: number;
};

export const KronchatProjectsStorageKey = "kronoscode:chat-projects";
export const KronchatProjectsChangedEvent = "kronoscode:chat-projects-changed";
export const KronchatOpenProjectEvent = "kronoscode:open-project";

export function formatKronchatProjectName(workspace: string): string {
    if (!workspace) {
        return "Focused workspace";
    }
    return workspace.split("/").filter(Boolean).pop() ?? workspace;
}

export function readKronchatProjects(): KronchatProject[] {
    if (typeof window === "undefined") {
        return [];
    }
    try {
        const raw = window.localStorage.getItem(KronchatProjectsStorageKey);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw) as KronchatProject[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function writeKronchatProjects(projects: KronchatProject[]) {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(KronchatProjectsStorageKey, JSON.stringify(projects));
        window.dispatchEvent(new CustomEvent<KronchatProject[]>(KronchatProjectsChangedEvent, { detail: projects }));
    } catch {
        return;
    }
}

export function requestOpenKronchatProject(project: KronchatProject) {
    if (typeof window === "undefined") {
        return;
    }
    window.dispatchEvent(new CustomEvent<KronchatProject>(KronchatOpenProjectEvent, { detail: project }));
}
