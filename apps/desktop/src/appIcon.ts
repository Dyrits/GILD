import type { Theme } from "../../app/src/foundation/themeName.ts";

/** The icon file of each theme, in the desktop app's `assets`. */
export const iconFiles = { gild: "icon-gild.png", iskios: "icon.png" } as const satisfies Record<Theme, string>;

const isTheme = (name: unknown): name is Theme => typeof name === "string" && Object.hasOwn(iconFiles, name);

/** The icon file of a theme, as named by the window; anything that is not a theme's name is Iskios's. */
export const iconFileOf = (theme: unknown): string => iconFiles[isTheme(theme) ? theme : "iskios"];
