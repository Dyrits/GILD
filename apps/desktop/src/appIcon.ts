/** The icon file of a theme, as named by the window; anything but Gild is Iskios's. */
export const iconFileOf = (theme: unknown): string => (theme === "gild" ? "icon-gild.png" : "icon.png");
