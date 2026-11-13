import { StyleSheet } from "react-native";
import { colors, fontSizes, fonts } from "../foundation/theme";

/** The app's connection screen and remote-host banner around the window frame. */
export const appStyles = StyleSheet.create({
  backButton: { marginTop: 16 },
  backText: { color: colors.highlight, fontSize: fontSizes.md, textDecorationLine: "underline" },
  banner: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderBottomColor: colors.danger,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bannerLink: { color: colors.highlight, fontSize: fontSizes.md, textDecorationLine: "underline" },
  bannerText: { color: colors.dangerText, flex: 1, fontSize: fontSizes.md },
  center: { alignItems: "center", backgroundColor: colors.frame, flex: 1, justifyContent: "center" },
  connecting: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.base },
  root: { flex: 1 },
});
