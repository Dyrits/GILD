import { describe, expect, it } from "@effect/vitest";
import { threadTools, toolListing, unaskedToolNamesOf } from "../../src/work/threadTools.ts";

// Stored and wire names keep `intel` so existing data and agents still work: thread tool names (`save_intel`, ...).

describe("listing the thread tools", () => {
  it("lists every tool with the required arguments its decoder needs", () => {
    const required = Object.fromEntries(
      toolListing.map((tool) => [tool.name, (tool.inputSchema as { required?: Array<string> }).required ?? []]),
    );
    expect(required).toMatchObject({
      find_missions: ["request"],
      interrupt_thread: ["thread"],
      open_thread: ["request"],
      read_journal: [],
      report_result: ["journal", "result"],
      request_approval: ["action", "command"],
      send_thread_message: ["text", "to"],
      set_mission_title: ["title"],
      suggest_mission: ["text", "title"],
      update_journal: ["entry"],
    });
    expect(toolListing.map((tool) => tool.name).sort()).toEqual(Object.keys(threadTools).sort());
  });

  it("runs every tool unasked except the approval tools themselves", () => {
    const names = unaskedToolNamesOf("gild");
    expect(names).toContain("mcp__gild__open_thread");
    expect(names).not.toContain("mcp__gild__request_approval");
    expect(names).not.toContain("mcp__gild__answer_prompt");
    expect(names).toHaveLength(Object.keys(threadTools).length - 2);
  });

  it("describes every argument a thread fills in", () => {
    const missing = toolListing
      .filter((tool) => tool.name !== "answer_prompt")
      .flatMap((tool) =>
        Object.entries((tool.inputSchema as { properties?: Record<string, { description?: string }> }).properties ?? {})
          .filter(([, property]) => property.description === undefined)
          .map(([name]) => `${tool.name}.${name}`),
      );
    expect(missing).toEqual([]);
  });

  it("names every lore entry kind in save_intel", () => {
    expect(toolListing.find((tool) => tool.name === "save_intel")?.description).toContain("temporary");
  });
});
