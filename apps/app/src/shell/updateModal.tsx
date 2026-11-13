import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { messageOf } from "../foundation/client";
import { colors, fontSizes, fonts, outline, radii } from "../foundation/theme";
import type { UpdatesBridge } from "../foundation/updateState";
import { restartWarningOf } from "../foundation/updateText";

/**
 * The question before an update installs: the release's notes as written, what a restart costs, and **Restart and
 * update** or **Later**. Nothing installs without this answer (app-updates, Download in the background).
 */
export function UpdateModal({
  bridge,
  notes,
  onClose,
  version,
}: {
  bridge: UpdatesBridge;
  notes: string;
  onClose: () => void;
  version: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const install = () => {
    setIsBusy(true);
    bridge.install().then(
      () => setError(null),
      (reason) => {
        setError(messageOf(reason));
        setIsBusy(false);
      },
    );
  };
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={local.backdrop}>
        <Pressable accessibilityLabel="Later" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View accessibilityRole="alert" style={local.menu}>
          <Text style={local.title}>Update to {version}?</Text>
          <Text style={local.heading}>What's new</Text>
          <ScrollView style={local.notes}>
            <Text selectable style={local.notesText}>
              {notes === "" ? "This release has no notes." : notes}
            </Text>
          </ScrollView>
          <Text style={local.body}>{restartWarningOf(version)}</Text>
          {error !== null && <Text style={local.error}>{error}</Text>}
          <View style={local.footer}>
            <Pressable accessibilityRole="button" disabled={isBusy} onPress={onClose} style={local.button}>
              <Text style={local.buttonText}>Later</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={install}
              style={[local.done, isBusy && local.doneOff]}
            >
              <Text style={local.doneText}>{isBusy ? "Restarting…" : "Restart and update"}</Text>
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
  heading: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "700" },
  menu: {
    ...outline,
    backgroundColor: colors.page,
    borderRadius: radii.xl,
    gap: 12,
    maxWidth: 520,
    padding: 20,
    width: "100%",
  },
  notes: { ...outline, backgroundColor: colors.canvas, borderRadius: radii.md, maxHeight: 240, padding: 10 },
  notesText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, lineHeight: 19 },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.xl, fontWeight: "700" },
});
