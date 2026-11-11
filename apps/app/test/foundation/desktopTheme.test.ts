import { describe, expect, it } from "vitest";
import { syncDesktopTheme } from "../../src/foundation/desktopTheme";
import { themes } from "../../src/foundation/themeRules";

describe("syncDesktopTheme", () => {
  it.each(themes)("gives the desktop app the %s theme", async (theme) => {
    const given: string[] = [];
    await syncDesktopTheme({ setTheme: async (each) => void given.push(each) }, theme);
    expect(given).toEqual([theme]);
  });

  it("keeps the theme and shows nothing when the desktop app cannot set the icon", async () => {
    await expect(
      syncDesktopTheme(
        { setTheme: () => Promise.reject(new Error("The theme is only set from Iskios's desktop window.")) },
        "gild",
      ),
    ).resolves.toBeUndefined();
  });

  it("does nothing without a desktop app", async () => {
    await expect(syncDesktopTheme(undefined, "gild")).resolves.toBeUndefined();
  });
});
