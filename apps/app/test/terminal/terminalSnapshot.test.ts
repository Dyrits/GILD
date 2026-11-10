import { describe, expect, it } from "vitest";
import { messageWithTerminal, terminalSnapshotOf, terminalTextOf } from "../../src/terminal/terminalSnapshot";

describe("sending terminal output to the Companion", () => {
  it("keeps the owner's request and rendered command output in the persisted message", () => {
    const message = messageWithTerminal("Explain this failure", "/realms/app", "$ bun test\nFAIL login");
    expect(message).toContain("Explain this failure");
    expect(message).toContain("started in /realms/app");
    expect(message).toContain("$ bun test\nFAIL login");
  });

  it("sends a terminal snapshot without requiring a typed message", () => {
    expect(messageWithTerminal("", "/home/owner", "output")).toMatch(/^Terminal snapshot/);
  });

  it("renders the terminal before the owner's accompanying text without losing either in context", () => {
    const message = messageWithTerminal("Nothing.", "/home/owner", "$ echo Hello\nHello");
    expect(terminalSnapshotOf(message)).toEqual({
      after: "Nothing.",
      before: "",
      cwd: "/home/owner",
      output: "$ echo Hello\nHello",
    });
    expect(terminalSnapshotOf("This is an ordinary message!")).toBeNull();
  });

  it("keeps output containing Markdown fences inside the transcript", () => {
    expect(messageWithTerminal("", "/realm", "```\noutput\n```")).toContain("````text\n```\noutput\n```\n````");
  });

  it("joins wrapped display lines without inventing new command lines", () => {
    const lines = [
      { isWrapped: false, translateToString: () => "$ long-com" },
      { isWrapped: true, translateToString: () => "mand" },
      { isWrapped: false, translateToString: () => "result" },
      { isWrapped: false, translateToString: () => "" },
    ];
    expect(terminalTextOf({ getLine: (index) => lines[index], length: lines.length })).toBe("$ long-command\nresult");
  });

  it("bounds context size and explicitly marks omitted earlier output", () => {
    const output = terminalTextOf({
      getLine: () => ({ isWrapped: false, translateToString: () => "x".repeat(21000) }),
      length: 1,
    });
    expect(output).toMatch(/^\[Earlier terminal output omitted\]/);
    expect(output.endsWith("x".repeat(20000))).toBe(true);
    expect(output.length).toBeLessThan(20100);
  });
});
