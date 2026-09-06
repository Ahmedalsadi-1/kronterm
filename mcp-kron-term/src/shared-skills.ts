import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";

export const SharedSkillDirsEnv = "KRONTERM_SHARED_SKILL_DIRS";

export type SharedSkillSummary = {
    id: string;
    name: string;
    description: string;
    source: string;
};

type SharedSkillRecord = SharedSkillSummary & {
    filePath: string;
};

function frontmatterValue(content: string, key: string): string {
    if (!content.startsWith("---")) {
        return "";
    }
    const closing = content.indexOf("\n---", 3);
    if (closing === -1) {
        return "";
    }
    const match = content.slice(3, closing).match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, "m"));
    return match?.[1]?.trim() ?? "";
}

function sourceName(root: string): string {
    const parent = basename(dirname(root));
    if (parent.startsWith(".")) {
        return parent.slice(1);
    }
    return basename(root);
}

function isWithinRoot(root: string, candidate: string): boolean {
    return candidate === root || candidate.startsWith(`${root}${sep}`);
}

function skillRecord(root: string, directory: string): SharedSkillRecord | null {
    const rootPath = realpathSync(root);
    const skillDirectory = realpathSync(directory);
    if (!isWithinRoot(rootPath, skillDirectory)) {
        return null;
    }
    const filePath = join(skillDirectory, "SKILL.md");
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        return null;
    }
    const content = readFileSync(filePath, "utf8");
    const fallbackName = basename(skillDirectory);
    const source = sourceName(rootPath);
    return {
        id: `${source}/${fallbackName}`,
        name: frontmatterValue(content, "name") || fallbackName,
        description: frontmatterValue(content, "description"),
        source,
        filePath,
    };
}

export class SharedSkillCatalog {
    private readonly roots: string[];

    constructor(value = process.env[SharedSkillDirsEnv] ?? "") {
        this.roots = Array.from(
            new Set(
                value
                    .split(process.platform === "win32" ? ";" : ":")
                    .map((entry) => entry.trim())
                    .filter(Boolean)
                    .map((entry) => resolve(entry))
                    .filter((entry) => existsSync(entry) && statSync(entry).isDirectory())
            )
        );
    }

    list(query = ""): SharedSkillSummary[] {
        const normalizedQuery = query.trim().toLowerCase();
        return this.records()
            .filter((skill) => {
                if (!normalizedQuery) {
                    return true;
                }
                return `${skill.id} ${skill.name} ${skill.description}`.toLowerCase().includes(normalizedQuery);
            })
            .map(({ filePath: _, ...skill }) => skill);
    }

    read(id: string): { skill: SharedSkillSummary; content: string } {
        const record = this.records().find((skill) => skill.id === id);
        if (!record) {
            throw new Error(`Unknown shared skill: ${id}`);
        }
        const { filePath, ...skill } = record;
        return { skill, content: readFileSync(filePath, "utf8") };
    }

    configuredRoots(): string[] {
        return [...this.roots];
    }

    private records(): SharedSkillRecord[] {
        const records: SharedSkillRecord[] = [];
        for (const root of this.roots) {
            const rootSkill = skillRecord(root, root);
            if (rootSkill) {
                records.push(rootSkill);
            }
            for (const entry of readdirSync(root, { withFileTypes: true })) {
                if (!entry.isDirectory() && !entry.isSymbolicLink()) {
                    continue;
                }
                try {
                    const record = skillRecord(root, join(root, entry.name));
                    if (record) {
                        records.push(record);
                    }
                } catch {
                    continue;
                }
            }
        }
        return records.sort((left, right) => left.id.localeCompare(right.id));
    }
}
