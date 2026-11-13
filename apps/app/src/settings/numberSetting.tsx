import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { styles } from "../foundation/styles";
import { Button } from "../ui/button";

/** A labelled whole-number setting, as one row of a card that holds several. */
export function NumberSetting(props: Parameters<typeof NumberField>[0]) {
  return (
    <View style={local.settingRow}>
      <Text style={[styles.body, styles.flex, local.settingLabel]}>{props.label}</Text>
      <NumberField {...props} />
    </View>
  );
}

/** A whole-number field with its own Save, checked against its minimum before saving. */
export function NumberField({
  label,
  minimum,
  value,
  onSave,
  onInvalid,
}: {
  label: string;
  minimum: number;
  value: number;
  onSave: (value: number) => void;
  onInvalid: (message: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <View style={styles.inlineRow}>
      <TextInput
        accessibilityLabel={label}
        keyboardType="number-pad"
        onChangeText={setDraft}
        style={[styles.input, local.number]}
        value={draft ?? String(value)}
      />
      <Button
        label="Save"
        onPress={() => {
          const parsed = Number(draft ?? value);
          if (!Number.isSafeInteger(parsed) || parsed < minimum) {
            onInvalid(`Use a whole number of at least ${minimum}.`);
            return;
          }
          onSave(parsed);
        }}
      />
    </View>
  );
}

const local = StyleSheet.create({
  number: { textAlign: "center", width: 96 },
  settingLabel: { minWidth: 200 },
  settingRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 12 },
});
