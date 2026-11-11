import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { messageOf } from "../foundation/client";
import { colors, fontSizes, fonts, outline, radii } from "../foundation/theme";
import type { MoveConfirmation } from "./questMove";

/**
 * The confirmation before a quest changes place: it names where the quest goes from and to and what happens to the
 * lore. Confirm applies the move; Cancel, the backdrop, and Escape leave the quest where it is. A refusal from the
 * service, such as a thread still at work, shows here and leaves the quest where it is.
 */
export function MoveQuestModal({
  confirmation,
  onCancel,
  onConfirm,
}: {
  confirmation: MoveConfirmation;
  onCancel: () => void;
  /** Moves the quest; rejects with the reason when refused. */
  onConfirm: () => Promise<unknown>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const confirm = () => {
    setIsBusy(true);
    onConfirm()
      .then(onCancel, (reason) => setError(messageOf(reason)))
      .finally(() => setIsBusy(false));
  };
  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible>
      <View style={local.backdrop}>
        <Pressable accessibilityLabel="Cancel the move" onPress={onCancel} style={StyleSheet.absoluteFill} />
        <View accessibilityRole="alert" style={local.menu}>
          <Text style={local.title}>{confirmation.title}</Text>
          <Text style={local.body}>{confirmation.body}</Text>
          {error !== null && <Text style={local.error}>{error}</Text>}
          <View style={local.footer}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={local.button}>
              <Text style={local.buttonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy || error !== null}
              onPress={confirm}
              style={[local.done, (isBusy || error !== null) && local.doneOff]}
            >
              <Text style={local.doneText}>Move the quest</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const local = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(5,10,18,0.7)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  body: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.base, lineHeight: 20 },
  button: {
    ...outline,
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  buttonText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  done: { backgroundColor: colors.accent, borderRadius: radii.sm, paddingHorizontal: 18, paddingVertical: 8 },
  doneOff: { opacity: 0.4 },
  doneText: { color: colors.onAccent, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "700" },
  error: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.md },
  footer: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  menu: {
    ...outline,
    backgroundColor: colors.page,
    borderRadius: radii.xl,
    gap: 12,
    maxWidth: 480,
    padding: 20,
    width: "100%",
  },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.xl, fontWeight: "700" },
});
