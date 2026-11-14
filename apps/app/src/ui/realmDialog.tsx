import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { styles } from "../foundation/styles";
import { colors, outline, radii } from "../foundation/theme";

/** A realm decision above the page, with bounded scrolling and no dismiss while a save is pending. */
export function RealmDialog({
  children,
  isBusy = false,
  onCancel,
  title,
}: {
  children: ReactNode;
  isBusy?: boolean;
  onCancel: () => void;
  title: string;
}) {
  const cancel = () => {
    if (!isBusy) onCancel();
  };
  return (
    <Modal animationType="fade" onRequestClose={cancel} transparent visible>
      <View style={local.backdrop}>
        <Pressable accessibilityLabel="Cancel" disabled={isBusy} onPress={cancel} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={local.dialog}>
          <ScrollView contentContainerStyle={local.content}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            {children}
          </ScrollView>
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
  content: { gap: 18, padding: 24 },
  dialog: {
    ...outline,
    backgroundColor: colors.page,
    borderRadius: radii.xl,
    maxHeight: "90%",
    maxWidth: 640,
    width: "100%",
  },
});
