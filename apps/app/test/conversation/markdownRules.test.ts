import { describe, expect, it } from "vitest";
import { linkTargetOf, listMarkerOf } from "../../src/conversation/markdownRules";

describe("a Markdown link", () => {
  it("opens a web address", () => {
    expect(linkTargetOf("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
  });

  it("opens a mail address", () => {
    expect(linkTargetOf("mailto:someone@example.com")).toBe("mailto:someone@example.com");
  });

  it("refuses a script address", () => {
    expect(linkTargetOf("javascript:alert(1)")).toBeNull();
  });

  it("refuses text that is no address", () => {
    expect(linkTargetOf("not a link")).toBeNull();
  });
});

describe("a Markdown list marker", () => {
  it("is a bullet in an unordered list", () => {
    expect(listMarkerOf({ ordered: false, start: "" }, 2)).toBe("•");
  });

  it("counts from one when an ordered list gives no start", () => {
    expect(listMarkerOf({ ordered: true, start: "" }, 1)).toBe("2.");
  });

  it("counts from the number an ordered list starts at", () => {
    expect(listMarkerOf({ ordered: true, start: 5 }, 1)).toBe("6.");
  });
});
