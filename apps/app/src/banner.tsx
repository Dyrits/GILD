import { Image, StyleSheet, View } from "react-native";

/** The banner of each kind of cloth: a painted gilt rod, tassels, and the column's name in the cloth. */
const cloths = {
  blue: require("../assets/banners/underway.png"),
  green: require("../assets/banners/fulfilled.png"),
  red: require("../assets/banners/summons.png"),
  violet: require("../assets/banners/resting.png"),
} as const;

/** The names of the painted cloths a banner can hang from. */
export type BannerCloth = keyof typeof cloths;

/** The painted banners' shared size, so every kind scales to its column in the same proportion. */
const imageSize = { height: 345, width: 580 } as const;

/**
 * A hanging banner, a painted image scaled to its column's width. The column's name is part of the painting.
 */
export function Banner({
  cloth,
  title,
}: {
  cloth: BannerCloth;
  /** The name painted on the banner; spoken to screen readers, as the image cannot be read. */
  title: string;
}) {
  return (
    <View accessibilityLabel={title} accessibilityRole="header" style={local.frame}>
      <Image resizeMode="contain" source={cloths[cloth]} style={local.art} />
    </View>
  );
}

const local = StyleSheet.create({
  art: { height: "100%", width: "100%" },
  frame: { aspectRatio: imageSize.width / imageSize.height, marginBottom: 12, width: "100%" },
});
