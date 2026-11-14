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

  it("refuses a request the message takes back or only narrates", () => {
    const report: NamedAction = { operation: "Archive", rivals: [], targets: ["Report"], value: null };
    const done: NamedAction = { operation: "Done", rivals: [], targets: ["Report"], value: null };
    expect(isNamedByOwner("Archive Report.", report)).toBe(true);
    expect(isNamedByOwner("Archive Report. Actually, keep it.", report)).toBe(false);
    expect(isNamedByOwner("Archive Report. On second thought, leave it for later.", report)).toBe(false);
    expect(isNamedByOwner("Mark Report as done.", done)).toBe(true);
    expect(isNamedByOwner("Report is done.", done)).toBe(false);
    expect(isNamedByOwner("Report was finished yesterday.", done)).toBe(false);
  });

  it("refuses a target that another quest shares by title", () => {
    const shared: NamedAction = { operation: "Archive", rivals: ["Report"], targets: ["Report"], value: null };
    expect(isNamedByOwner("Archive Report.", shared)).toBe(false);
  });

  it("does not find a realm folder inside a longer path", () => {
    const realm: NamedAction = {
      operation: "CreateRealm",
      targets: ["/dummy/root"],
      value: null,
    };
    expect(isNamedByOwner("Create a realm at /dummy/root.", realm)).toBe(true);
    expect(isNamedByOwner("Create a realm at /dummy/root/projects/app.", realm)).toBe(false);
  });

  it("does not find a realm folder inside a longer path whose next part starts with a separator or symbol", () => {
    const garden: NamedAction = { operation: "CreateRealm", targets: ["Garden"], value: "/dummy/root" };
    expect(isNamedByOwner("Create realm Garden at /dummy/root.", garden)).toBe(true);
    for (const quoted of ['"/dummy/root"', "`/dummy/root/`", "(/dummy/root/)", "**/dummy/root**", "«/dummy/root»"])
      expect(isNamedByOwner(`Create realm Garden at ${quoted}.`, garden), quoted).toBe(true);
    expect(isNamedByOwner("Create realm Garden at /dummy/root/.", garden)).toBe(true);
    for (const longer of [
      "/dummy/root//projects/app",
      "/dummy/root/😺",
      "/dummy/root/(old)",
      "/dummy/root/@x",
      "/dummy/root/*",
    ])
      expect(isNamedByOwner(`Create realm Garden at ${longer}.`, garden), longer).toBe(false);
  });

  it("does not find a realm folder at the end of a longer path", () => {
    const garden: NamedAction = { operation: "CreateRealm", targets: ["Garden"], value: "/dummy/root" };
    for (const longer of ["/other//dummy/root", "/😺/dummy/root", "/(x)/dummy/root"])
      expect(isNamedByOwner(`Create realm Garden at ${longer}.`, garden), longer).toBe(false);
  });

  it("finds a realm folder only as a whole path, however the owner quotes or ends it", () => {
    const garden: NamedAction = { operation: "CreateRealm", targets: ["Garden"], value: "/dummy/root" };
    const accepted = [
      "/dummy/root.",
      "/dummy/root/ now.",
      '"/dummy/root/".',
      "`/dummy/root/`.",
      "(/dummy/root/).",
      "**/dummy/root**.",
      "«/dummy/root».",
      "« /dummy/root ».",
      "/dummy/root/.",
      "/dummy/root, ok.",
    ];
    for (const phrasing of accepted)
      expect(isNamedByOwner(`Create realm Garden at ${phrasing}`, garden), phrasing).toBe(true);
    const refused = [
      "/dummy/root.bak now.",
      "/dummy/root-old now.",
      "/dummy/root_old now.",
      "/dummy/root)old now.",
      "/dummy/root/)old now.",
      "/dummy/root/'s app now.",
      '/dummy/root/"x" now.',
      "/dummy/root/]x now.",
      "/dummy/root/>x now.",
      "/dummy/root/’x now.",
      "/dummy/root/.hidden now.",
      "/x*/dummy/root now.",
      "/a«/dummy/root now.",
      "/x(/dummy/root now.",
      '/x"/dummy/root now.',
    ];
    for (const phrasing of refused)
      expect(isNamedByOwner(`Create realm Garden at ${phrasing}`, garden), phrasing).toBe(false);
  });
});
