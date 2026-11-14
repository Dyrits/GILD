import { describe, expect, it } from "vitest";
import { toolCallsOf } from "../../src/harness/claudeEvents.ts";

describe("reading Claude tool calls", () => {
  it("keeps valid calls in order and preserves their untrusted input", () => {
    const input = { file_path: "/dummy/read.ts" };
    expect(
      toolCallsOf([
        { id: "first", input, name: "Read", type: "tool_use" },
        { text: "I will read it.", type: "text" },
        { id: "second", input: null, name: "Bash", type: "tool_use" },
      ]),
    ).toEqual([
      { id: "first", input, toolName: "Read" },
      { id: "second", input: null, toolName: "Bash" },
    ]);
  });

  it("ignores malformed blocks and non-array content without discarding valid neighbors", () => {
    expect(toolCallsOf(null)).toEqual([]);
    expect(toolCallsOf({ content: [] })).toEqual([]);
    expect(
      toolCallsOf([
        null,
        "tool_use",
        { id: 1, name: "Read", type: "tool_use" },
        { id: "missing-name", type: "tool_use" },
        { id: "wrong-kind", name: "Read", type: "text" },
        { id: "valid", name: "Read", type: "tool_use" },
      ]),
    ).toEqual([{ id: "valid", input: void 0, toolName: "Read" }]);
  });

  it("retains empty string fields and primitive input accepted by the prior boundary", () => {
    expect(toolCallsOf([{ id: "", input: "untrusted", name: "", type: "tool_use" }])).toEqual([
      { id: "", input: "untrusted", toolName: "" },
    ]);
  });
});
