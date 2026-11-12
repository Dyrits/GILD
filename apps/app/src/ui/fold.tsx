import type { HarnessName } from "@iskios/contracts";
import { createContext, type ReactNode, useContext, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fonts, outline, round } from "../foundation/theme";
import { BowArrow } from "./bowArrow";
import { ProviderMark } from "./providerMarks";

/** Which fold of a group is unfolded: one at a time, so the column stays short. */
const FoldContext = createContext<{ open: string | null; setOpen: (id: string | null) => void }>({
  open: null,
  setOpen: () => {},
});

/** Holds a group of folds, with `initial` unfolded first. */
export function FoldGroup({ children, initial }: { children: ReactNode; initial: string | null }) {
  const [open, setOpen] = useState<string | null>(initial);
  return <FoldContext.Provider value={{ open, setOpen }}>{children}</FoldContext.Provider>;
}

/** Unfolds a fold of the enclosing group, for one just added. */
export const useOpenFold = () => useContext(FoldContext).setOpen;

/**
 * One fold of a group: a header saying what it is (its title, then, in short, the choice it holds, with its harness's
 * logo) that unfolds its content below, and folds the group's other one away.
 */
export function Fold({
  children,
  grip,
  harness,
  id,
  summary,
  title,
}: {
  children: ReactNode;
  /** The handle a sortable fold is picked up by, drawn before its header. */
  grip?: ReactNode;
  harness?: HarnessName;
  id: string;
  /** What the fold holds, in a few words. */
  summary: string;
  title: string;
}) {
  const { open, setOpen } = useContext(FoldContext);
  const isOpen = open === id;
  return (
    <View style={[local.fold, isOpen && local.foldOpen]}>
      <View style={local.row}>
        {grip}
        <Pressable
          accessibilityLabel={title}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          onPress={() => setOpen(isOpen ? null : id)}
          style={({ pressed }) => [local.header, pressed && local.pressed]}
        >
          <Text style={local.title}>{title}</Text>
          <BowArrow color={colors.textMuted} isOpen={isOpen} size={15} />
          <View style={local.summary}>
            {harness !== undefined && <ProviderMark harness={harness} size={13} />}
            <Text numberOfLines={1} style={local.summaryText}>
              {summary}
            </Text>
          </View>
        </Pressable>
      </View>
      {isOpen && <View style={local.body}>{children}</View>}
    </View>
  );
}

const local = StyleSheet.create({
  body: { gap: 8, paddingBottom: 10, paddingHorizontal: 10 },
  fold: { ...outline, ...round, backgroundColor: colors.surface, overflow: "hidden" },
  foldOpen: { backgroundColor: colors.page },
  header: { alignItems: "center", flex: 1, flexDirection: "row", gap: 8, minHeight: 38, paddingHorizontal: 10 },
  pressed: { opacity: 0.8 },
  row: { alignItems: "center", flexDirection: "row", paddingLeft: 6 },
  summary: { alignItems: "center", flex: 1, flexDirection: "row", gap: 6, justifyContent: "flex-end", minWidth: 0 },
  summaryText: { color: colors.textSecondary, flexShrink: 1, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
});
