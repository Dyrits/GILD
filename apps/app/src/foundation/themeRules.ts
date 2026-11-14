import type { Theme } from "./themeName";

export type { Theme };

/** The themes offered in the Workshop, each with a light and a dark look. */
export const themes = ["iskios", "gild", "one"] as const satisfies ReadonlyArray<Theme>;

// Fails to compile when a theme is named in `Theme` and missing from the list.
const everyThemeIsListed: Exclude<Theme, (typeof themes)[number]> extends never ? true : never = true;
void everyThemeIsListed;

/** The theme a stored value names; anything unknown, or nothing stored, is Iskios. */
export const themeOf = (stored: string | null): Theme => themes.find((theme) => theme === stored) ?? "iskios";
