import { AccountId, type HarnessInfo, type HarnessList } from "@iskios/contracts";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { harnessOfAccount, modelsOf, tabsOf } from "../../src/editors/accountModels";

const work = Schema.decodeSync(AccountId)("work");
const model = (id: string) => ({ id, label: id });

const harness = (name: HarnessInfo["name"], accounts: HarnessInfo["accounts"], problem: string | null = null) =>
  ({ accounts, models: [model(`${name}-first`)], name, problem, update: null, version: "1" }) satisfies HarnessInfo;

const own = (extra: object = {}) => ({ detail: null, id: null, label: "Mac", signIn: "SignedIn", ...extra }) as const;
const added = (extra: object = {}) =>
  ({ detail: null, id: work, label: "Work", signIn: "SignedIn", ...extra }) as const;

const list = (harnesses: HarnessInfo[]): HarnessList => ({ harnesses });

describe("tabsOf", () => {
  const harnesses = list([
    harness("claude", [own({ models: [model("sonnet")] }), added({ models: [model("opus")] })]),
    harness("codex", [own()]),
    harness("opencode", [own()], "not installed"),
  ]);

  it("makes one tab per account of a harness, each with that account's models", () => {
    const tabs = tabsOf(harnesses, true, { accountId: null, harness: "claude" });
    expect(tabs.map((tab) => [tab.harness, tab.accountId, tab.label])).toEqual([
      ["claude", null, "Mac"],
      ["claude", work, "Work"],
      ["codex", null, "Mac"],
      ["opencode", null, "Mac"],
    ]);
    expect(tabs[0]?.models.map((option) => option.id)).toEqual(["sonnet"]);
    expect(tabs[1]?.models.map((option) => option.id)).toEqual(["opus"]);
  });

  it("falls back to the harness's list for an account whose models were not read", () => {
    expect(
      tabsOf(harnesses, true, { accountId: null, harness: "claude" })[2]?.models.map((option) => option.id),
    ).toEqual(["codex-first"]);
  });

  it("shows only the computer's own sign-in when accounts are not shown", () => {
    const tabs = tabsOf(harnesses, false, { accountId: null, harness: "claude" });
    expect(tabs.filter((tab) => tab.harness === "claude")).toHaveLength(1);
  });

  it("marks a signed-out account and an uninstalled harness, and lists no models for the signed-out one", () => {
    const tabs = tabsOf(
      list([harness("claude", [own(), added({ signIn: "SignedOut" })]), harness("opencode", [own()], "gone")]),
      true,
      { accountId: null, harness: "claude" },
    );
    expect(tabs.find((tab) => tab.accountId === work)).toMatchObject({ models: [], problem: "signed out" });
    expect(tabs.find((tab) => tab.harness === "opencode")?.problem).toBe("not installed");
  });

  it("keeps the runner's removed account as a tab", () => {
    const tabs = tabsOf(harnesses, true, { accountId: Schema.decodeSync(AccountId)("gone"), harness: "codex" });
    expect(tabs.filter((tab) => tab.harness === "codex").map((tab) => tab.label)).toEqual(["Mac", "Removed account"]);
  });

  it("lists every harness before the host has read its accounts", () => {
    expect(tabsOf(null, true, { accountId: null, harness: "claude" })).toHaveLength(3);
  });
});

describe("modelsOf and harnessOfAccount", () => {
  const info = harness("claude", [own({ models: [model("sonnet")] }), added()]);

  it("reads the account's own models, else the harness's", () => {
    expect(modelsOf(info, null).map((option) => option.id)).toEqual(["sonnet"]);
    expect(modelsOf(info, work).map((option) => option.id)).toEqual(["claude-first"]);
    expect(harnessOfAccount(info, null)?.models.map((option) => option.id)).toEqual(["sonnet"]);
  });
});
