import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../foundation/theme";
import { EmptyBoard } from "../ui/brand";

/** A place's page: a title, then what the place holds. */
function Page({
  children,
  footer,
  title,
}: {
  children?: ReactNode;
  /** What stays at the foot of the page, outside its scrolling: the message that starts a quest. */
  footer?: ReactNode;
  /** The page's heading; none where the top bar already names the place. */
  title?: string;
}) {
  return (
    <View style={local.page}>
      <ScrollView contentContainerStyle={local.content}>
        {title !== undefined && <Text style={local.title}>{title}</Text>}
        {children}
      </ScrollView>
      {footer !== undefined && <View style={local.footer}>{footer}</View>}
    </View>
  );
}

const local = StyleSheet.create({
  content: { gap: 18, paddingHorizontal: 28, paddingVertical: 20 },
  footer: { paddingBottom: 18, paddingHorizontal: 28, paddingTop: 6, zIndex: 2 },
  page: { backgroundColor: colors.page, flex: 1 },
  title: {
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 28,
    fontWeight: "700",
  },
});

/** What each place that is specified but not built yet says; its entry is in the sidebar in its agreed place. */
const unbuilt = {
  Charter: "The Charter page is not built yet.",
  Craft: "Craft will hold workflows. It is not built yet.",
  FreeRealms: "The Free Realms page is not built yet. The sidebar lists them.",
  Library: "Library will hold generated and uploaded artifacts. It is not built yet.",
  Realms: "The Realms page is not built yet. The sidebar lists them.",
  Reserves: "The detailed usage page is not built yet. The sidebar shows the compact summary.",
} as const;

/** The page of a place that is not built yet: one quiet line saying so. */
export function UnbuiltScreen({ place }: { place: keyof typeof unbuilt }) {
  return (
    <Page>
      <EmptyBoard line={unbuilt[place]} />
    </Page>
  );
}
