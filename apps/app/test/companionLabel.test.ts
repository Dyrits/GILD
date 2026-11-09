import { describe, expect, it } from "vitest";
import { companionLabelOf } from "../src/formatting";

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

  it("keeps an unrecognised reported model as it is", () => {
    expect(companionLabelOf("opencode", "qwen3-coder", "default")).toBe("OpenCode - qwen3-coder");
  });
});
