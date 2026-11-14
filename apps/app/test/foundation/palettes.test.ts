import { describe, expect, it } from "vitest";
import { palettes } from "../../src/foundation/palettes";
import { themes } from "../../src/foundation/themeRules";

const luminance = (hex: string): number => {
  const channel = (at: number) => {
    const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};
const contrast = (foreground: string, background: string): number => {
  const [high, low] = [luminance(foreground), luminance(background)].sort((current, next) => next - current);
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
};

describe.each(themes.flatMap((theme) => (["dark", "light"] as const).map((scheme) => [theme, scheme] as const)))(
  "the %s theme, %s look",
  (theme, scheme) => {
    const colors = palettes[theme][scheme];

    it("reads the text on the page, the sidebar, and the cards", () => {
      for (const ground of [colors.page, colors.sidebar, colors.surface, colors.bubble]) {
        expect(contrast(colors.text, ground)).toBeGreaterThanOrEqual(7);
      }
    });

    // Iskios's original colors stay unchanged; newer palettes meet the small-text threshold.
    it.runIf(theme !== "iskios")("reads the dimmer text and the accent on the page", () => {
      expect(contrast(colors.textMuted, colors.page)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.accentText, colors.page)).toBeGreaterThanOrEqual(4.5);
    });

    it.runIf(theme !== "iskios")("reads the label of an accent button", () => {
      expect(contrast(colors.onAccent, colors.accent)).toBeGreaterThanOrEqual(4.5);
    });

    it.runIf(theme === "one")("reads messages and state labels on their tinted backgrounds", () => {
      expect(contrast(colors.accentText, colors.accentSoft)).toBeGreaterThanOrEqual(4.5);
      for (const background of [colors.bubbleUser, colors.accentSoft, colors.controlActive]) {
        expect(contrast(colors.text, background)).toBeGreaterThanOrEqual(4.5);
      }
      for (const [foreground, background] of [
        [colors.dangerText, colors.dangerSoft],
        [colors.successText, colors.successSoft],
        [colors.warningText, colors.warningSoft],
        [colors.violet, colors.violetSoft],
      ]) {
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
      }
    });
  },
);

describe("the palettes", () => {
  it("give Gild its own colors", () => {
    expect(palettes.gild.dark.accent).not.toBe(palettes.iskios.dark.accent);
    expect(palettes.gild.light.page).not.toBe(palettes.iskios.light.page);
  });
});
