/** The two themes the app has: Iskios, the flat navy and cream look, and Gild, the guild's brown, gilt, and parchment. */
export const themes = ["iskios", "gild"] as const;

/** One of the app's themes; each comes in a dark and a light look. */
export type Theme = (typeof themes)[number];

/** The theme a stored value names; anything unknown, or nothing stored, is Iskios. */
export const themeOf = (stored: string | null): Theme => themes.find((theme) => theme === stored) ?? "iskios";
