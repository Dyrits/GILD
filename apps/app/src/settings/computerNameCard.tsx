import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Button } from "../ui/button";
import { SettingsCard } from "./settingsParts";

/**
 * The name of the computer this Iskios runs on: its sign-ins and spending carry it, the host menu lists it, and paired
 * devices see it. It starts as the machine's name; a blank name returns to that. From a paired device it names the host.
 */
export function ComputerNameCard({ client, onRenamed }: { client: ServiceClient; onRenamed: () => void }) {
  const { data: current, error: readError } = useServiceQuery(client, { _tag: "ReadHostName" }, "host-name");
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = name ?? current ?? "";
  const rename = () =>
    client.request({ _tag: "RenameHost", name: shown }).then(
      () => {
        setName(null);
        setError(null);
        onRenamed();
      },
      (reason) => setError(messageOf(reason)),
    );
  return (
    <SettingsCard icon="monitor" title="Computer name">
      <Text style={styles.muted}>
        Names this computer, the host that paired devices connect to, and, until you rename one in the list below, its
        own sign-ins and their spending.
      </Text>
      <View style={local.row}>
        <TextInput
          accessibilityLabel="Computer name"
          maxLength={60}
          onChangeText={setName}
          onSubmitEditing={rename}
          style={local.input}
          value={shown}
        />
        <Button
          isDisabled={current === null || shown.trim() === current}
          isPrimary={false}
          label="Rename"
          onPress={rename}
        />
      </View>
      {(error ?? readError) !== null && <Text style={styles.error}>{error ?? readError}</Text>}
    </SettingsCard>
  );
}

const local = StyleSheet.create({
  input: {
    backgroundColor: colors.page,
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    padding: 8,
  },
  row: { alignItems: "center", flexDirection: "row", gap: 10 },
});
