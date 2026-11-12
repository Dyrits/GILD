import { describe, expect, it } from "vitest";
import { guildmasterInstructionsOf } from "../../src/harness/instructions.ts";
import { guideTopics } from "../../src/work/appGuideTopics.ts";
import { topicsFor } from "../../src/work/guildmasterGuide.ts";

const idsFor = (question: string) => topicsFor(question).map((topic) => topic.id);

describe("the app guide", () => {
  it("has unique topic ids, and every topic says what it answers", () => {
    const ids = guideTopics.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of guideTopics) {
      expect(topic.title.trim()).not.toBe("");
      expect(topic.summary.trim()).not.toBe("");
      expect(topic.body.length).toBeGreaterThan(100);
      expect(topic.keywords.length).toBeGreaterThan(0);
    }
  });

  it("speaks to the owner of quests, never of missions", () => {
    for (const topic of guideTopics)
      expect(`${topic.title} ${topic.summary} ${topic.body}`).not.toMatch(/\bmissions?\b/i);
  });

  it("names the settings screen as it is in the sidebar, the Workshop", () => {
    for (const topic of guideTopics) expect(topic.body).not.toMatch(/(?:in|open|from) the Charter\b/);
  });

  it("finds a topic by its id or its title", () => {
    expect(idsFor("rituals")).toEqual(["rituals"]);
    expect(idsFor("  Budgets ")).toEqual(["budgets"]);
    expect(idsFor("Lore and The Keep")).toEqual(["lore"]);
  });

  it.each([
    ["How do I make something run every morning?", "rituals"],
    ["can you schedule a weekly check for me", "rituals"],
    ["What does the ! do in the message box?", "messages"],
    ["how do I attach an image to a message", "messages"],
    ["How do I pair my phone with Iskios?", "pairing"],
    ["what is a realm", "realms"],
    ["What is the Borderlands?", "realms"],
    ["how much will this cost me, can I set a budget", "budgets"],
    ["Why did it ask me to Allow a command", "approvals"],
    ["how do I switch a thread from Claude to Codex", "companions"],
    ["where are the settings", "workshop"],
    ["what can you do for me", "iskios"],
    ["my mac says the app is blocked", "install"],
    ["what does lore do and why did it fade", "lore"],
    ["what is a side-quest", "quests"],
  ])("answers %j from the %s topic", (question, id) => {
    expect(idsFor(question)).toContain(id);
    expect(idsFor(question)[0]).toBe(id);
  });

  it("returns nothing for a question the guide does not cover", () => {
    expect(idsFor("what is the capital of France")).toEqual([]);
    expect(idsFor("write me a poem")).toEqual([]);
  });

  it("returns at most two topics", () => {
    expect(topicsFor("quest realm ritual budget lore approval").length).toBeLessThanOrEqual(2);
  });

  it("is in Iskios's instructions, with the rule to say so when it does not know", () => {
    const text = guildmasterInstructionsOf("thread-1");
    expect(text).toContain("read_app_guide");
    expect(text).toContain("say you do not know");
    expect(text).not.toContain("in the Charter");
  });
});
