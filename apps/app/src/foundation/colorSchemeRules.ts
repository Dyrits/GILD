/** The two looks the app has. */
export type ColorScheme = "dark" | "light";

/** What the owner may choose: a look, or to follow the system's. */
export const colorSchemePreferences = ["system", "light", "dark"] as const;

/** One of the owner's choices of look. */
export type ColorSchemePreference = (typeof colorSchemePreferences)[number];

/** The preference a stored value names; anything unknown, or nothing stored, follows the system. */
export const preferenceOf = (stored: string | null): ColorSchemePreference =>
  colorSchemePreferences.find((preference) => preference === stored) ?? "system";

/** The look a preference gives, given the look the system asks for. */
export const schemeOf = (preference: ColorSchemePreference, system: ColorScheme): ColorScheme =>
  preference === "system" ? system : preference;
