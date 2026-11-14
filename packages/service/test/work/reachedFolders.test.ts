import { MissionId, SuggestionId } from "@iskios/contracts";
import { describe, expect, it } from "vitest";
import { folderOfRequest } from "../../src/work/reachedFolders.ts";

describe("identifying folders named in requests", () => {
  it("extracts the named folder from every folder-bearing request tag", () => {
    expect(folderOfRequest({ _tag: "CreateRealm", crest: null, name: "App", path: "/work/app" })).toBe("/work/app");
    expect(folderOfRequest({ _tag: "FindArchivedRealm", path: "/work/old" })).toBe("/work/old");
    expect(
      folderOfRequest({
        _tag: "CreateRitual",
        fallbacks: [],
        instruction: "Check",
        primary: { accountId: null, effort: "default", harness: "claude", model: "claude-sonnet-5-5" },
        requestId: "r1",
        schedule: { _tag: "Daily", time: "07:00" },
        title: "Digest",
        workspacePath: "/work/ritual",
      }),
    ).toBe("/work/ritual");
    expect(folderOfRequest({ _tag: "ListSkills", workspacePath: "/work/skills" })).toBe("/work/skills");
    expect(folderOfRequest({ _tag: "ListWorkspaceEntries", query: "", workspacePath: "/work/entries" })).toBe(
      "/work/entries",
    );
    expect(
      folderOfRequest({
        _tag: "StartMission",
        effort: "default",
        model: "default",
        requestId: "r2",
        text: "Go",
        workspacePath: "/work/quest",
      }),
    ).toBe("/work/quest");
    expect(
      folderOfRequest({
        _tag: "AnswerSuggestion",
        answer: { _tag: "NewMission", backups: [], effort: "default", model: "default", realmPath: "/work/new" },
        suggestionId: SuggestionId.make("s1"),
      }),
    ).toBe("/work/new");
  });

  it("returns null for folderless suggestion answers and requests that name no folder", () => {
    expect(
      folderOfRequest({
        _tag: "AnswerSuggestion",
        answer: { _tag: "Continue", missionId: MissionId.make("m1") },
        suggestionId: SuggestionId.make("s2"),
      }),
    ).toBeNull();
    expect(
      folderOfRequest({
        _tag: "AnswerSuggestion",
        answer: { _tag: "Aside" },
        suggestionId: SuggestionId.make("s3"),
      }),
    ).toBeNull();
    expect(
      folderOfRequest({
        _tag: "ListMissions",
        isArchived: false,
        search: null,
        state: null,
        workspaceId: null,
      }),
    ).toBeNull();
  });
});
