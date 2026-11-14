import { describe, expect, it } from "vitest";
import { settingsSectionOf } from "../../src/settings/settingsSections";

describe("resuming the Workshop after an appearance change", () => {
  it("keeps Look and feel open when a theme or look reload returns to Settings", () => {
    expect(settingsSectionOf("Settings")).toBe("defaults");
  });

  it("keeps Permissions as the initial section on an ordinary start", () => {
    expect(settingsSectionOf(null)).toBe("permissions");
    expect(settingsSectionOf("Guildmaster")).toBe("permissions");
    expect(settingsSectionOf("unknown")).toBe("permissions");
  });
});
