// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

interface SearchableCommand {
    label: string;
    detail: string;
    keywords: string[];
}

function normalizeCommandSearch(value: string): string[] {
    return value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
}

function getCommandSearchScore(command: SearchableCommand, tokens: string[]): number {
    if (tokens.length === 0) {
        return 1;
    }
    const label = command.label.toLocaleLowerCase();
    const detail = command.detail.toLocaleLowerCase();
    const keywords = command.keywords.map((keyword) => keyword.toLocaleLowerCase());
    let score = 0;
    for (const token of tokens) {
        if (label === token) {
            score += 100;
            continue;
        }
        if (label.startsWith(token)) {
            score += 50;
            continue;
        }
        if (label.includes(token)) {
            score += 25;
            continue;
        }
        if (keywords.some((keyword) => keyword.startsWith(token))) {
            score += 15;
            continue;
        }
        if (detail.includes(token) || keywords.some((keyword) => keyword.includes(token))) {
            score += 5;
            continue;
        }
        return 0;
    }
    return score;
}

function filterCommandPaletteActions<T extends SearchableCommand>(commands: T[], query: string): T[] {
    const tokens = normalizeCommandSearch(query);
    return commands
        .map((command, index) => ({ command, index, score: getCommandSearchScore(command, tokens) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map(({ command }) => command);
}

export { filterCommandPaletteActions, normalizeCommandSearch };
export type { SearchableCommand };
