import path from "path"

const isEnabled = (value) => typeof value === "string" && value.trim().toLowerCase() === "true"

export const resolveEmbeddedWorkspace = ({ env = process.env, isDirectory }) => {
  if (!isEnabled(env.KRONTERM_CHATHUB_CHAT_ONLY)) {
    return null
  }

  const candidate = typeof env.KRONTERM_WORKSPACE === "string" ? env.KRONTERM_WORKSPACE.trim() : ""
  if (!candidate || !path.isAbsolute(candidate)) {
    return null
  }

  const resolved = path.resolve(candidate)
  if (typeof isDirectory === "function" && !isDirectory(resolved)) {
    return null
  }

  return resolved
}

export const scopeSettingsToEmbeddedWorkspace = (settings, workspace) => {
  if (!workspace) {
    return settings
  }

  const projects = Array.isArray(settings?.projects) ? settings.projects : []
  const existing = projects.find((project) => project?.path === workspace)
  const project =
    existing ??
    {
      id: `kronterm-${Buffer.from(workspace).toString("base64url")}`,
      path: workspace,
      label: path.basename(workspace),
    }

  return {
    ...settings,
    projects: [project],
    activeProjectId: project.id,
    lastDirectory: workspace,
  }
}
