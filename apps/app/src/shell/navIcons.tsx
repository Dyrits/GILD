import { Image } from "react-native";
import { colorScheme } from "../foundation/colorScheme";

/**
 * The sidebar's own icons, one per destination, cropped to their drawing and sized for a high-density screen. Each look
 * has its own set: the dark one is silver metal for a dark page, the light one the same drawings toned to dark slate
 * (`assets/nav/light/`), so they keep their contrast on cream.
 */
const sources = {
  dark: {
    archive: require("../../assets/nav/archive.png"),
    // The Borderlands' mountains; the file keeps the name of the former Free Realms (CHG-0161).
    borderlands: require("../../assets/nav/free-realms.png"),
    charter: require("../../assets/nav/charter.png"),
    craft: require("../../assets/nav/craft.png"),
    "guild-hall": require("../../assets/nav/guild-hall.png"),
    library: require("../../assets/nav/library.png"),
    lore: require("../../assets/nav/lore.png"),
    realms: require("../../assets/nav/realms.png"),
    reserves: require("../../assets/nav/reserves.png"),
    rituals: require("../../assets/nav/rituals.png"),
    "the-keep": require("../../assets/nav/the-keep.png"),
    workshop: require("../../assets/nav/workshop.png"),
  },
  light: {
    archive: require("../../assets/nav/light/archive.png"),
    borderlands: require("../../assets/nav/light/free-realms.png"),
    charter: require("../../assets/nav/light/charter.png"),
    craft: require("../../assets/nav/light/craft.png"),
    "guild-hall": require("../../assets/nav/light/guild-hall.png"),
    library: require("../../assets/nav/light/library.png"),
    lore: require("../../assets/nav/light/lore.png"),
    realms: require("../../assets/nav/light/realms.png"),
    reserves: require("../../assets/nav/light/reserves.png"),
    rituals: require("../../assets/nav/light/rituals.png"),
    "the-keep": require("../../assets/nav/light/the-keep.png"),
    workshop: require("../../assets/nav/light/workshop.png"),
  },
} as const;

/** The name of a sidebar icon. */
export type NavIconName = keyof (typeof sources)["dark"];

/** One sidebar icon at a square size; it is decoration, and its row carries the label. */
export function NavIcon({ name, size = 22 }: { name: NavIconName; size?: number }) {
  return (
    <Image accessibilityElementsHidden source={sources[colorScheme][name]} style={{ height: size, width: size }} />
  );
}
