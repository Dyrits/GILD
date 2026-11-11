import { Image } from "react-native";

/** The sidebar's own icons, one per destination, cropped to their drawing and sized for a high-density screen. */
const sources = {
  archive: require("../../assets/nav/archive.png"),
  charter: require("../../assets/nav/charter.png"),
  craft: require("../../assets/nav/craft.png"),
  "free-realms": require("../../assets/nav/free-realms.png"),
  "guild-hall": require("../../assets/nav/guild-hall.png"),
  library: require("../../assets/nav/library.png"),
  lore: require("../../assets/nav/lore.png"),
  realmless: require("../../assets/nav/realmless.png"),
  realms: require("../../assets/nav/realms.png"),
  reserves: require("../../assets/nav/reserves.png"),
  rituals: require("../../assets/nav/rituals.png"),
  "the-keep": require("../../assets/nav/the-keep.png"),
  workshop: require("../../assets/nav/workshop.png"),
} as const;

/** The name of a sidebar icon. */
export type NavIconName = keyof typeof sources;

/** One sidebar icon at a square size; it is decoration, and its row carries the label. */
export function NavIcon({ name, size = 22 }: { name: NavIconName; size?: number }) {
  return <Image accessibilityElementsHidden source={sources[name]} style={{ height: size, width: size }} />;
}
