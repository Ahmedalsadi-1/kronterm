type AgentWidgetVisualSettings = {
    glow: boolean;
    actionChip: boolean;
    cursor: boolean;
    screenshots: boolean;
    aura: boolean;
    pointerStyle: "pixel" | "smooth" | "minimal";
};

const DefaultAgentWidgetVisualSettings: AgentWidgetVisualSettings = {
    glow: true,
    actionChip: true,
    cursor: true,
    screenshots: true,
    aura: true,
    pointerStyle: "pixel",
};

const SettingsEvent = "agent-widget-settings";

function settingsKey(blockId: string): string {
    return `kronoscode:agent-widget-settings:${blockId}`;
}

function loadAgentWidgetVisualSettings(blockId: string): AgentWidgetVisualSettings {
    try {
        const value = window.localStorage.getItem(settingsKey(blockId));
        if (value == null) {
            return { ...DefaultAgentWidgetVisualSettings };
        }
        return { ...DefaultAgentWidgetVisualSettings, ...JSON.parse(value) };
    } catch {
        return { ...DefaultAgentWidgetVisualSettings };
    }
}

function saveAgentWidgetVisualSettings(blockId: string, settings: AgentWidgetVisualSettings): void {
    window.localStorage.setItem(settingsKey(blockId), JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent(SettingsEvent, { detail: { blockId, settings } }));
}

function updateAgentWidgetVisualSetting(blockId: string, key: keyof AgentWidgetVisualSettings, value: boolean | string): void {
    saveAgentWidgetVisualSettings(blockId, { ...loadAgentWidgetVisualSettings(blockId), [key]: value });
}

export {
    SettingsEvent as AgentWidgetSettingsEvent,
    loadAgentWidgetVisualSettings,
    updateAgentWidgetVisualSetting,
    type AgentWidgetVisualSettings,
};
