import { describe, expect, it } from "vitest";
import { companionLabelOf, modelLabelOf, replyWriterOf } from "../src/formatting";

describe("companionLabelOf", () => {
  it("names the company, then the model's name and version, from the reported model", () => {
    expect(companionLabelOf("claude", "claude-sonnet-5-5", "default")).toBe("Anthropic - Sonnet 5.5");
    expect(companionLabelOf("claude", "claude-opus-4-1-20250805", "opus")).toBe("Anthropic - Opus 4.1");
    expect(companionLabelOf("claude", "claude-3-5-haiku-20241022", "haiku")).toBe("Anthropic - Haiku 3.5");
    expect(companionLabelOf("codex", "gpt-5.1-codex", "default")).toBe("OpenAI - GPT-5.1 Codex");
  });

  it("falls back to the chosen model under the harness's company when none was reported", () => {
    expect(companionLabelOf("claude", null, "sonnet")).toBe("Anthropic - Sonnet");
    expect(companionLabelOf("codex", null, "default")).toBe("OpenAI - Default model");
  });

  it("reads a bare Claude alias as the model's name", () => {
    expect(companionLabelOf("claude", "sonnet", "default")).toBe("Anthropic - Sonnet");
  });

  it("keeps an unrecognised reported model as it is", () => {
    expect(companionLabelOf("opencode", "qwen3-coder", "default")).toBe("OpenCode - qwen3-coder");
  });
});

describe("replyWriterOf", () => {
  it("keeps a reply under the harness and model that wrote it, whatever the thread runs on now", () => {
    expect(replyWriterOf({ harness: "claude", model: "claude-sonnet-5-5" }, "codex")).toEqual({
      harness: "claude",
      label: "Anthropic - Sonnet 5.5",
    });
    expect(replyWriterOf({ harness: "claude", model: null }, "codex")).toEqual({
      harness: "claude",
      label: "Anthropic - Default model",
    });
  });

  it("takes the thread's harness for a reply that recorded none", () => {
    expect(replyWriterOf({ harness: null, model: null }, "codex")).toEqual({
      harness: "codex",
      label: "OpenAI - Default model",
    });
  });
});

describe("modelLabelOf", () => {
  it("reads a full Claude identifier as the family and version, Fable included", () => {
    expect(modelLabelOf("claude-fable-5-2")).toBe("Fable 5.2");
    expect(modelLabelOf("claude-haiku-5-5")).toBe("Haiku 5.5");
    expect(companionLabelOf("claude", "claude-fable-5-2", "claude-fable-5-2")).toBe("Anthropic - Fable 5.2");
  });

  it("prefers the harness's own label, and still names a legacy default", () => {
    expect(modelLabelOf("claude-opus-5-5", [{ id: "claude-opus-5-5", label: "Opus (latest)" }])).toBe("Opus (latest)");
    expect(modelLabelOf("default")).toBe("Default model");
  });
});
