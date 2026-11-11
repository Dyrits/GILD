import { Image, type ImageSourcePropType } from "react-native";
import { colorScheme, theme } from "../foundation/colorScheme";
import type { ColorScheme } from "../foundation/colorSchemeRules";
import type { Theme } from "../foundation/themeRules";

/** The name of a sidebar icon: one per destination, in every set of every theme and look. */
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
 * The sidebar's own icons, one per destination, cropped to their drawing and sized for a high-density screen. Each look
 * has its own set: the dark one is silver metal for a dark page, the light one the same drawings toned to dark slate
 * (`assets/nav/light/`), so they keep their contrast on cream. Gild has its own two sets, the same drawings toned to gilt on brown
 * (`assets/nav/gild/`) and to bronze on parchment (`assets/nav/gild-light/`). The bundler needs each `require` written
 * out, so the sets are spelled in full; the type below fails when a theme, a look, or an icon is missing from one.
 */
const sources = {
  gild: {
    dark: {
      archive: require("../../assets/nav/gild/archive.png"),
      // The Borderlands' mountains; each set keeps the file name of the former Free Realms (CHG-0161).
      borderlands: require("../../assets/nav/gild/free-realms.png"),
      charter: require("../../assets/nav/gild/charter.png"),
      craft: require("../../assets/nav/gild/craft.png"),
      "guild-hall": require("../../assets/nav/gild/guild-hall.png"),
      library: require("../../assets/nav/gild/library.png"),
      lore: require("../../assets/nav/gild/lore.png"),
      realms: require("../../assets/nav/gild/realms.png"),
      reserves: require("../../assets/nav/gild/reserves.png"),
      rituals: require("../../assets/nav/gild/rituals.png"),
      "the-keep": require("../../assets/nav/gild/the-keep.png"),
      workshop: require("../../assets/nav/gild/workshop.png"),
    },
    light: {
      archive: require("../../assets/nav/gild-light/archive.png"),
      borderlands: require("../../assets/nav/gild-light/free-realms.png"),
      charter: require("../../assets/nav/gild-light/charter.png"),
      craft: require("../../assets/nav/gild-light/craft.png"),
      "guild-hall": require("../../assets/nav/gild-light/guild-hall.png"),
      library: require("../../assets/nav/gild-light/library.png"),
      lore: require("../../assets/nav/gild-light/lore.png"),
      realms: require("../../assets/nav/gild-light/realms.png"),
      reserves: require("../../assets/nav/gild-light/reserves.png"),
      rituals: require("../../assets/nav/gild-light/rituals.png"),
      "the-keep": require("../../assets/nav/gild-light/the-keep.png"),
      workshop: require("../../assets/nav/gild-light/workshop.png"),
    },
  },
  iskios: {
    dark: {
      archive: require("../../assets/nav/archive.png"),
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
  },
} as const satisfies Record<Theme, Record<ColorScheme, Record<NavIconName, ImageSourcePropType>>>;

/** One sidebar icon at a square size; it is decoration, and its row carries the label. */
export function NavIcon({ name, size = 22 }: { name: NavIconName; size?: number }) {
  return (
    <Image
      accessibilityElementsHidden
      source={sources[theme][colorScheme][name]}
      style={{ height: size, width: size }}
    />
  );
}
