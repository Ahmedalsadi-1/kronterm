import crypto from "crypto";
import path from "path";

export function makeKronTermWorkspaceSettings(current, workspace, now = Date.now()) {
    const normalizedWorkspace = path.resolve(workspace);
    const projects = Array.isArray(current?.projects) ? current.projects : [];
    const existing = projects.find((project) => path.resolve(project.path) === normalizedWorkspace);
    const project = existing ?? {
        id: `kronterm-${crypto.createHash("sha256").update(normalizedWorkspace).digest("hex").slice(0, 16)}`,
        path: normalizedWorkspace,
        label: path.basename(normalizedWorkspace) || "KronTerm",
        addedAt: now,
    };
    const nextProjects = existing
        ? projects.map((candidate) =>
              candidate.id === existing.id ? { ...candidate, lastOpenedAt: now } : candidate
          )
        : [...projects, { ...project, lastOpenedAt: now }];

    return {
        projects: nextProjects,
        activeProjectId: project.id,
        lastDirectory: normalizedWorkspace,
    };
}
