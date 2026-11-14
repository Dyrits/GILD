import type { MissionId, RealmArchivePreview } from "@iskios/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { styles } from "../foundation/styles";
import { colors, outline, radii } from "../foundation/theme";

/** The quests the owner may carry out of the realm, each with a checkbox; one at work cannot be chosen. */
export function QuestChecklist({
  isBusy,
  moved,
  onToggle,
  quests,
}: {
  isBusy: boolean;
  moved: ReadonlySet<MissionId>;
  onToggle: (id: MissionId) => void;
  quests: RealmArchivePreview["quests"];
}) {
  return (
    <View style={local.list}>
      {quests.map((quest) => {
        const isChecked = moved.has(quest.id);
        return (
          <Pressable
            accessibilityLabel={`Move ${quest.title} to the Borderlands`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isChecked, disabled: isBusy || quest.isWorking }}
            disabled={isBusy || quest.isWorking}
            key={quest.id}
            onPress={() => onToggle(quest.id)}
            style={[local.row, isChecked && local.checked, quest.isWorking && local.dim]}
          >
            <View style={[local.box, isChecked && local.boxChecked]}>
              {isChecked && <Text style={local.tick}>✓</Text>}
            </View>
            <View style={local.text}>
              <Text numberOfLines={2} style={styles.body}>
                {quest.title}
              </Text>
              <Text style={styles.muted}>
                {quest.isWorking
                  ? "At work: stop it first to move it. It will be stopped and archived."
                  : isChecked
                    ? "Moves to the Borderlands"
                    : "Archived with the realm"}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const local = StyleSheet.create({
  box: {
    ...outline,
    alignItems: "center",
    borderRadius: radii.sm,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  boxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checked: { backgroundColor: colors.controlActive, borderColor: colors.accent },
  dim: { opacity: 0.6 },
  list: { gap: 8 },
  row: { ...outline, alignItems: "center", borderRadius: radii.md, flexDirection: "row", gap: 12, padding: 10 },
  text: { flex: 1, gap: 2, minWidth: 0 },
  tick: { color: colors.page, fontSize: 14, fontWeight: "700", lineHeight: 16 },
});
