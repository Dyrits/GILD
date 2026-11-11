import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { mentionTokensOf, skillTokensOf } from "@iskios/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { listSkills, withSkillInstructions } from "../../src/work/skills.ts";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const folderWith = (skills: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), "iskios-skills-"));
  directories.push(root);
  for (const [path, text] of Object.entries(skills)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
};

describe("skill discovery", () => {
  it.effect("lists global and workspace skills with the workspace copy winning a name", () =>
    Effect.gen(function* () {
      const home = folderWith({
        ".agents/skills/challenge/SKILL.md": "---\nname: challenge\ndescription: Global one\n---\nBody",
        ".claude/skills/review/SKILL.md": '---\nname: review\ndescription: "Reviews"\n---\n',
      });
      const workspace = folderWith({
        ".claude/skills/challenge/SKILL.md": "---\nname: challenge\ndescription: Workspace one\n---\n",
      });
      const skills = yield* listSkills(workspace, home);
      expect(skills.map((skill) => [skill.name, skill.description])).toEqual([
        ["challenge", "Workspace one"],
        ["review", "Reviews"],
      ]);
    }),
  );
});

describe("slash-names in messages", () => {
  it("finds a name that starts a word and ignores paths", () => {
    expect(skillTokensOf("Use /challenge, then open /Users/me/file").map((token) => token.name)).toEqual(["challenge"]);
  });

  it("points a named skill to its instructions and leaves other messages unchanged", () => {
    const skills = [{ description: "", name: "challenge", path: "/s/challenge/SKILL.md" }];
    expect(withSkillInstructions("Run /challenge now", skills)).toContain("read /s/challenge/SKILL.md");
    expect(withSkillInstructions("Run /unknown now", skills)).toBe("Run /unknown now");
  });
});

describe("@-paths in messages", () => {
  it("finds a path that starts a word, without closing punctuation, and ignores addresses", () => {
    expect(
      mentionTokensOf("Read @src/index.ts, then @docs/ and mail me@example.com or @README.md.").map(
        (token) => token.path,
      ),
    ).toEqual(["src/index.ts", "docs/", "README.md"]);
  });
});
