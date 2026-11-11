import type { MissionSummary, WorkspaceId } from "@iskios/contracts";
import { describe, expect, it } from "vitest";
import { borderlandsDestination, moveConfirmationOf, sourceNameOf } from "../../src/shell/questMove";

const quest = (workspaceId: string | null, workspaceName: string | null) =>
  ({ title: "Fix the build", workspaceId: workspaceId as WorkspaceId | null, workspaceName }) satisfies Pick<
    MissionSummary,
    "title" | "workspaceId" | "workspaceName"
  >;

describe("confirming a quest move", () => {
  it("names the source and the destination of a move between realms", () => {
    const confirmation = moveConfirmationOf(quest("a", "Garden"), { id: "b" as WorkspaceId, name: "Workshop" });
    expect(confirmation?.title).toBe('Move "Fix the build" to Workshop?');
    expect(confirmation?.body).toContain("from Garden to Workshop");
  });

  it("explains that the available lore changes and is not copied", () => {
    const confirmation = moveConfirmationOf(quest("a", "Garden"), borderlandsDestination);
    expect(confirmation?.body).toContain("lore shared in Garden will no longer be available");
    expect(confirmation?.body).toContain("Lore is not copied");
  });

  it("asks as well for a move into the Borderlands, and calls a quest with no realm one of the Borderlands", () => {
    expect(moveConfirmationOf(quest("a", "Garden"), borderlandsDestination)).not.toBeNull();
    expect(sourceNameOf(quest(null, null))).toBe("the Borderlands");
    expect(moveConfirmationOf(quest(null, null), { id: "a" as WorkspaceId, name: "Garden" })?.body).toContain(
      "from the Borderlands to Garden",
    );
  });

  it("asks nothing for a drop where the quest already stands", () => {
    expect(moveConfirmationOf(quest("a", "Garden"), { id: "a" as WorkspaceId, name: "Garden" })).toBeNull();
    expect(moveConfirmationOf(quest(null, null), borderlandsDestination)).toBeNull();
  });
});
