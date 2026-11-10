/** The Workshop's sections, in the order the menu lists them and the page shows them. */
export const settingsSections = [
  { icon: "shield", id: "permissions", label: "Permissions" },
  { icon: "sliders", id: "defaults", label: "Defaults" },
  { icon: "code", id: "harnesses", label: "Harnesses" },
  { icon: "people", id: "accounts", label: "Accounts" },
  { icon: "chat", id: "messaging", label: "Messaging" },
  { icon: "layers", id: "limits", label: "Limits" },
] as const;

export type SettingsSectionId = (typeof settingsSections)[number]["id"];

/** How far below the top of the view a section counts as reached, so its heading is read before the menu moves on. */
const reachMargin = 40;

/**
 * The section the menu marks while the page scrolls: the last one whose top the view has reached, or the last of all
 * once the page is scrolled to its foot, where a short last section could never reach the top.
 */
export const activeSectionOf = ({
  isAtEnd,
  scrollTop,
  tops,
}: {
  isAtEnd: boolean;
  scrollTop: number;
  /** Where each section starts in the page, as far as measured. */
  tops: Partial<Record<SettingsSectionId, number>>;
}): SettingsSectionId => {
  const measured = settingsSections.filter((section) => tops[section.id] !== void 0);
  const last = measured.at(-1);
  if (isAtEnd && last !== undefined) return last.id;
  const reached = measured.filter((section) => (tops[section.id] ?? 0) <= scrollTop + reachMargin);
  return reached.at(-1)?.id ?? settingsSections[0].id;
};
