/** The Workshop's sections, in the order the menu lists them; the page shows the one chosen. */
export const settingsSections = [
  { icon: "shield", id: "permissions", label: "Permissions" },
  { icon: "sliders", id: "defaults", label: "Look and feel" },
  { icon: "code", id: "providers", label: "Providers" },
  { icon: "sliders", id: "companions", label: "Companions" },
  { icon: "monitor", id: "remote", label: "Remote access" },
  { icon: "chat", id: "messaging", label: "Messaging" },
  { icon: "layers", id: "limits", label: "Limits" },
  { icon: "gear", id: "updates", label: "Updates" },
] as const;

/** The identifier of a section of the Workshop. */
export type SettingsSectionId = (typeof settingsSections)[number]["id"];

/** A theme or look reload returns to Look and feel; an ordinary start keeps Permissions as the initial section. */
export const settingsSectionOf = (resumedPlace: string | null): SettingsSectionId =>
  resumedPlace === "Settings" ? "defaults" : "permissions";
