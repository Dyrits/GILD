import { describe, expect, it } from "vitest";
import { panelAt } from "../../src/foundation/panelState";

describe("navigating with the right-hand panel", () => {
  it("starts closed at every destination", () => {
    expect(panelAt(null, "quest")).toEqual({ content: null, hostId: null, scope: "quest" });
  });

  it("closes page-owned pickers rather than falling back to Iskios", () => {
    expect(
      panelAt(
        { content: { id: "default", isIskios: false, tab: "companion" }, hostId: null, scope: "workshop:companions" },
        "workshop:permissions",
      ),
    ).toEqual({ content: null, hostId: null, scope: "workshop:permissions" });
  });

  it("closes details when navigating to another quest or realm", () => {
    expect(panelAt({ content: { tab: "quest" }, hostId: null, scope: "quest:one" }, "quest:two").content).toBeNull();
    expect(panelAt({ content: { tab: "quest" }, hostId: null, scope: "realm:one" }, "realm:two").content).toBeNull();
  });

  it("carries Iskios's own picker without changing its selection", () => {
    const content = { id: "iskios", isIskios: true, tab: "companion" } as const;
    expect(panelAt({ content, hostId: null, scope: "quest" }, "workshop")).toEqual({
      content,
      hostId: null,
      scope: "workshop",
    });
  });

  it("keeps the selection during updates to the same destination", () => {
    const state = { content: { tab: "quest" }, hostId: null, scope: "quest" } as const;
    expect(panelAt(state, "quest")).toBe(state);
  });

  it("does not carry an Iskios picker to another host's conversation", () => {
    const state = {
      content: { id: "iskios", isIskios: true, tab: "companion" },
      hostId: null,
      scope: "quest",
    } as const;
    expect(panelAt(state, "quest", "other-host").content).toBeNull();
  });

  it("does not reopen a page-owned picker on returning", () => {
    const left = panelAt(
      {
        content: { id: "quest", isIskios: false, tab: "companion" },
        hostId: null,
        scope: "quest",
      },
      "workshop",
    );
    expect(panelAt(left, "quest").content).toBeNull();
  });
});
