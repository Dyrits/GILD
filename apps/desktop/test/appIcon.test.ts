import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { iconFileOf, iconFiles } from "../src/appIcon.ts";

const assets = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");

describe("iconFileOf", () => {
  it("gives Gild's hooded figure for the Gild theme", () => {
    expect(iconFileOf("gild")).toBe("icon-gild.png");
  });

  it("gives Iskios's icon for Iskios and for anything unknown", () => {
    expect(iconFileOf("iskios")).toBe("icon.png");
    expect(iconFileOf("sepia")).toBe("icon.png");
    expect(iconFileOf(undefined)).toBe("icon.png");
  });

  it("names an icon file that exists for every theme", () => {
    for (const file of Object.values(iconFiles)) expect(existsSync(join(assets, file))).toBe(true);
  });

  it("is not fooled by names an object inherits", () => {
    expect(iconFileOf("toString")).toBe("icon.png");
  });
});
