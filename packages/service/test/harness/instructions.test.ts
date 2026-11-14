import { describe, expect, it } from "vitest";
import { approvalInstructionsOf } from "../../src/harness/index.ts";

const access = {
  approvalLevel: "RiskyOnly",
  isInWorkspace: true,
  mcpUrl: "",
  permissions: [],
  unaskedTools: [],
} as const;

describe("telling a thread where it may work unasked", () => {
  it("names the folder and the workspace's git worktrees as work that needs no escape", () => {
    const text = approvalInstructionsOf(access, true, "claude");
    expect(text).toContain("worktrees");
    expect(text).toContain("Do not run a command outside the sandbox for work in them");
  });

  it("tells a thread to make a worktree inside its folder or in its temporary folder, never beside it", () => {
    const text = approvalInstructionsOf(access, true, "claude");
    expect(text).toContain(".worktrees/<name>");
    expect(text).toContain("$TMPDIR");
    expect(text).toContain("never as a sibling folder");
  });

  it("gives the same advice to a thread whose harness has no sandbox here", () => {
    const text = approvalInstructionsOf(access, false, "claude");
    expect(text).toContain(".worktrees/<name>");
  });
});
