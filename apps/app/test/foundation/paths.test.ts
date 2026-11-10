import { describe, expect, it } from "vitest";
import { samePath } from "../../src/foundation/paths";

describe("samePath", () => {
  it("matches a folder with its macOS resolved form and a trailing separator", () => {
    expect(samePath("/private/var/work", "/var/work")).toBe(true);
    expect(samePath("/Users/x/work/", "/Users/x/work")).toBe(true);
  });

  it("tells apart a folder from one that only shares the end of its path", () => {
    expect(samePath("/work", "/Users/x/work")).toBe(false);
  });

  it("matches nothing without a path", () => {
    expect(samePath(null, "/work")).toBe(false);
  });
});
