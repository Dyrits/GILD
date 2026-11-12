import { describe, expect, it } from "vitest";
import { modelsMatching } from "../../src/ui/modelSearch";

const models = [
  { id: "opus", label: "Opus 5.5" },
  { id: "sonnet", label: "Sonnet 5.5" },
  { id: "claude-haiku-5-5", label: "Haiku 5.5" },
];

describe("searching a harness's models", () => {
  it("lists every model when nothing is typed", () => {
    expect(modelsMatching(models, "  ")).toEqual(models);
  });
  it("matches a label ignoring case", () => {
    expect(modelsMatching(models, "SONN").map((model) => model.id)).toEqual(["sonnet"]);
  });
  it("matches an identifier the label does not show", () => {
    expect(modelsMatching(models, "claude-").map((model) => model.id)).toEqual(["claude-haiku-5-5"]);
  });
  it("lists none when nothing matches", () => {
    expect(modelsMatching(models, "gpt")).toEqual([]);
  });
});
