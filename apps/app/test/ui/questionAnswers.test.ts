import type { Question } from "@iskios/contracts";
import { describe, expect, it } from "vitest";
import { answersOf } from "../../src/ui/questionAnswers";

const question = (fields: Pick<Question, "pattern" | "permission">) => fields;

describe("the answers a question card offers", () => {
  it("offers Always allow when the answer can save a standing permission", () => {
    expect(answersOf(question({ pattern: "git push origin main", permission: "Run this exact command" }))).toEqual([
      "Allow",
      "AlwaysAllow",
      "Deny",
    ]);
  });

  it("offers only Allow and Deny for a one-time question, such as a thread folder that is a link", () => {
    expect(answersOf(question({ pattern: null, permission: null }))).toEqual(["Allow", "Deny"]);
  });
});
