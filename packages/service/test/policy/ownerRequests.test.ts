import { describe, expect, it } from "@effect/vitest";
import { isNamedByOwner, type NamedAction } from "../../src/policy/index.ts";

const archive: NamedAction = {
  operation: "Archive",
  rivals: ["Report", "Old notes"],
  targets: ["Weekly report draft"],
  value: null,
};

describe("the owner naming a structural action", () => {
  it("accepts the action's words and its exact target in one plain request", () => {
    expect(isNamedByOwner("Please archive Weekly report draft.", archive)).toBe(true);
    expect(isNamedByOwner("Archive the quest Weekly report draft", archive)).toBe(true);
    expect(
      isNamedByOwner("Rename Weekly report draft to Final report, and archive Old notes.", {
        ...archive,
        operation: "Rename",
        value: "Final report",
      }),
    ).toBe(true);
    expect(
      isNamedByOwner("Set shouldShowFinishedQuests to true", {
        operation: "ChangeSetting",
        targets: ["shouldShowFinishedQuests"],
        value: "true",
      }),
    ).toBe(true);
    expect(
      isNamedByOwner("Rename the realm Ideas to Notions.", {
        operation: "RenameRealm",
        targets: ["Ideas"],
        value: "Notions",
      }),
    ).toBe(true);
  });

  it("refuses a negated, doubtful, or questioning request", () => {
    for (const message of [
      "Don't archive Weekly report draft.",
      "Do not archive Weekly report draft",
      "N'archive pas Weekly report draft.",
      "Maybe archive Weekly report draft.",
      "Should you archive Weekly report draft?",
      "Archive it, not Weekly report draft.",
      "If it is done, archive Weekly report draft.",
    ]) {
      expect(isNamedByOwner(message, archive), message).toBe(false);
    }
  });

  it("refuses a request that names another action, another target too, or no new value", () => {
    expect(
      isNamedByOwner("Rename Weekly report draft.", { ...archive, operation: "Rename", value: "Final report" }),
    ).toBe(false);
    expect(isNamedByOwner("Archive Weekly report draft.", { ...archive, operation: "Done" })).toBe(false);
    expect(isNamedByOwner("Archive Weekly report draft or Old notes.", archive)).toBe(false);
    expect(
      isNamedByOwner("Rename Old notes to Weekly report draft.", { ...archive, operation: "Rename", value: "x" }),
    ).toBe(false);
    expect(isNamedByOwner("Archive Report.", archive)).toBe(false);
    expect(isNamedByOwner("Make Ideas.", { operation: "CreateRealm", targets: ["Ideas"], value: null })).toBe(false);
  });

  it("never takes a short target or a target inside a longer name", () => {
    const report: NamedAction = {
      operation: "Archive",
      rivals: ["Weekly report draft"],
      targets: ["Report"],
      value: null,
    };
    expect(isNamedByOwner("Archive Weekly report draft.", report)).toBe(false);
    expect(isNamedByOwner("Archive Report.", report)).toBe(true);
    expect(isNamedByOwner("Archive it.", { operation: "Archive", targets: ["it"], value: null })).toBe(false);
  });

  it("needs the words in the same request, not across sentences", () => {
    expect(isNamedByOwner("Archive things. Weekly report draft is fine.", archive)).toBe(false);
  });
});
