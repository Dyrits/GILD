import type { KnownHost } from "@iskios/contracts";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { messageOf } from "../foundation/client";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { Button } from "../ui/button";

/**
 * The dialog that pairs this installation with a host: the pairing code the host shows, pasted, and the name this
 * computer will have in the host's list of devices (device-pairing, Behavior).
 */
export function AddHostModal({
  computerName,
  onCancel,
  onPair,
}: {
  /** The name offered for this computer. */
  computerName: string;
  onCancel: () => void;
  /** Pairs with the host and resolves with it; rejects with the reason the owner reads. */
  onPair: (code: string, deviceName: string) => Promise<KnownHost>;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState(computerName);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const isReady = code.trim() !== "" && name.trim() !== "" && !isBusy;
  const pair = () => {
    setIsBusy(true);
    setError(null);
    onPair(code.trim(), name.trim()).then(
      () => setIsBusy(false),
      (reason) => {
        setIsBusy(false);
        setError(messageOf(reason));
      },
    );
  };
  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible>
      <View style={local.backdrop}>
        <Pressable accessibilityLabel="Close" onPress={onCancel} style={StyleSheet.absoluteFill} />
        <View style={local.panel}>
          <Text style={local.title}>Add a host</Text>
          <Text style={local.help}>
            On the other computer, open the Charter, turn on Allow paired devices, and choose Pair a device. Paste the
            code it shows here. It works once and expires after ten minutes.
          </Text>
          <Text style={local.label}>Pairing code</Text>
          <TextInput
            accessibilityLabel="Pairing code"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            multiline
            onChangeText={setCode}
            placeholder="iskios1-…"
            placeholderTextColor={colors.placeholder}
            style={[local.input, local.codeInput]}
            value={code}
          />
          <Text style={local.label}>Name this computer</Text>
          <TextInput
            accessibilityLabel="Name of this computer"
            maxLength={60}
            onChangeText={setName}
            style={local.input}
            value={name}
          />
          {error !== null && <Text style={local.error}>{error}</Text>}
          <View style={local.footer}>
            <Button isPrimary={false} label="Cancel" onPress={onCancel} />
            <Button isDisabled={!isReady} label={isBusy ? "Pairing…" : "Pair"} onPress={pair} />
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
    padding: 24,
  },
  codeInput: { fontFamily: fonts.mono, minHeight: 64 },
  error: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.md },
  footer: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 4 },
  help: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.md, lineHeight: 20 },
  input: {
    backgroundColor: colors.page,
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    padding: 10,
  },
  label: { color: colors.textDim, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  panel: {
    backgroundColor: colors.sidebar,
    borderColor: colors.edge,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 10,
    maxWidth: 520,
    padding: 20,
    width: "100%",
  },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "600" },
});
