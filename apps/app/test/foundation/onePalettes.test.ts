import { describe, expect, it } from "vitest";
import { palettes } from "../../src/foundation/palettes";

describe("drawing with One", () => {
  // Expected colors come from Zed's pinned One theme, not Iskios's palette implementation.
  // See documentation/research/zed-one-themes.md.
  it.each([
    ["dark", "#282c33", "#2f343e", "#dce0e5", "#a9afbc"],
    ["light", "#fafafa", "#ebebec", "#242529", "#58585a"],
  ])("uses Zed's One %s surfaces and foregrounds", (scheme, page, surface, text, muted) => {
    expect(palettes).toHaveProperty(`one.${scheme}.page`, page);
    expect(palettes).toHaveProperty(`one.${scheme}.surface`, surface);
    expect(palettes).toHaveProperty(`one.${scheme}.text`, text);
    expect(palettes).toHaveProperty(`one.${scheme}.textMuted`, muted);
  });
});
