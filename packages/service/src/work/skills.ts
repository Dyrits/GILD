import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type Skill, skillTokensOf } from "@iskios/contracts";
import { Effect } from "effect";

// The skills a message can name with a slash, found in the existing skill folders (tool-and-skill-loading).

/** The skill folders under a root, nearest preference first: `.agents/skills`, then Claude Code's. */
const skillFoldersOf = (root: string) => [join(root, ".agents", "skills"), join(root, ".claude", "skills")];

/** A frontmatter field of a SKILL.md, or an empty string; quotes around the value are dropped. */
const fieldOf = (text: string, field: string) => {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
  const line = new RegExp(`^${field}:\\s*(.*)$`, "m").exec(frontmatter)?.[1] ?? "";
  return line.trim().replace(/^(["'])(.*)\1$/, "$2");
};

/** The skills in one skill folder; an unreadable entry is left out. */
const readSkillFolder = (folder: string): ReadonlyArray<Skill> => {
  let names: ReadonlyArray<string>;
  try {
    names = readdirSync(folder);
  } catch {
    return [];
  }
  return names.flatMap((entry) => {
    const path = join(folder, entry, "SKILL.md");
    if (!existsSync(path)) return [];
    try {
      const text = readFileSync(path, "utf8");
      return [{ description: fieldOf(text, "description"), name: fieldOf(text, "name") || entry, path }];
    } catch {
      return [];
    }
  });
};

/**
 * The skills in scope: the workspace's, then the global ones, each with `.agents/skills` before `.claude/skills`;
 * for a name found twice the first wins, so the narrower scope does (tool-and-skill-loading, Name conflicts).
 */
export const listSkills = (workspacePath: string | null, home: string = homedir()) =>
  Effect.sync(() => {
    const roots = workspacePath === null ? [home] : [workspacePath, home];
    const found = new Map<string, Skill>();
    for (const skill of roots.flatMap(skillFoldersOf).flatMap(readSkillFolder)) {
      if (!found.has(skill.name)) found.set(skill.name, skill);
    }
    return [...found.values()].sort((first, second) => first.name.localeCompare(second.name));
  });

/** A message with a line appended telling the harness where the instructions of each skill it names are; unchanged when it names none. */
export const withSkillInstructions = (text: string, skills: ReadonlyArray<Skill>) => {
  const named = [...new Set(skillTokensOf(text).map((token) => token.name))].flatMap((name) => {
    const skill = skills.find((candidate) => candidate.name === name);
    return skill === undefined ? [] : [skill];
  });
  if (named.length === 0) return text;
  const lines = named.map((skill) => `- /${skill.name}: read ${skill.path} and follow its instructions.`);
  return `${text}\n\nThe message names these skills:\n${lines.join("\n")}`;
};
