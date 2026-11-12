import { Image, type ImageSourcePropType } from "react-native";
import { colorScheme } from "../foundation/colorScheme";
import type { ColorScheme } from "../foundation/colorSchemeRules";

/** The name of a sidebar icon: one per destination, in each look's set. */
export type NavIconName =
  | "archive"
  | "borderlands"
  | "charter"
  | "craft"
  | "guild-hall"
  | "library"
  | "lore"
  | "realms"
  | "reserves"
  | "rituals"
  | "the-keep"
  | "workshop";

/**
 * The sidebar's own icons, one per destination, cropped to their drawing and sized for a high-density screen. Both
 * themes share the same flat drawings: ivory on a dark page (`assets/nav/dark/`) and the same drawings in slate blue on
 * a light one (`assets/nav/light/`). The bundler needs each `require` written out, so the sets are spelled in full; the
 * type below fails when a look or an icon is missing from one.
 */
const sources = {
  dark: {
    archive: require("../../assets/nav/dark/archive.png"),
    // The Borderlands' mountains; each set keeps the file name of the former Free Realms (CHG-0161).
    borderlands: require("../../assets/nav/dark/free-realms.png"),
    charter: require("../../assets/nav/dark/charter.png"),
    craft: require("../../assets/nav/dark/craft.png"),
    "guild-hall": require("../../assets/nav/dark/guild-hall.png"),
    library: require("../../assets/nav/dark/library.png"),
    lore: require("../../assets/nav/dark/lore.png"),
    realms: require("../../assets/nav/dark/realms.png"),
    reserves: require("../../assets/nav/dark/reserves.png"),
    rituals: require("../../assets/nav/dark/rituals.png"),
    "the-keep": require("../../assets/nav/dark/the-keep.png"),
    workshop: require("../../assets/nav/dark/workshop.png"),
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
} as const satisfies Record<ColorScheme, Record<NavIconName, ImageSourcePropType>>;

/** One sidebar icon at a square size; it is decoration, and its row carries the label. */
export function NavIcon({ name, size = 22 }: { name: NavIconName; size?: number }) {
  return (
    <Image accessibilityElementsHidden source={sources[colorScheme][name]} style={{ height: size, width: size }} />
  );
}
