import type { PairingCode } from "@iskios/contracts";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { useActiveHost } from "../foundation/hostContext";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Button } from "../ui/button";
import { codeLifeOf, deviceLineOf, relayStatusTextOf } from "./remoteAccess";
import { SettingsCard, SettingsRule, ToggleRow } from "./settingsParts";

/**
 * Charter's remote access section: whether other devices may pair with this computer, its name as a host, a pairing
 * code to give to another Iskios, and the devices already paired, each with a Disconnect (device-pairing).
 */
export function RemoteAccessCard({ client }: { client: ServiceClient }) {
  const host = useActiveHost();
  if (host.hostId !== null) {
    return (
      <SettingsCard icon="monitor" title="Remote access · paired devices">
        <HostNameEditor client={client} />
        <Text style={styles.muted}>
          Paired devices are managed on {host.name} itself. Switch to this computer in the host menu to manage the
          devices paired with it.
        </Text>
      </SettingsCard>
    );
  }
  return <RemoteAccessOnHost client={client} />;
}

function RemoteAccessOnHost({ client }: { client: ServiceClient }) {
  const { data: view, error: readError } = useServiceQuery(client, { _tag: "ReadRemoteAccess" }, "remote-access");
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // The clock behind "expires in" and "last active" moves on once a minute.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const attempt = (work: Promise<unknown>) =>
    work.then(
      () => setError(null),
      (reason) => setError(messageOf(reason)),
    );
  if (view === null) {
    return (
      <SettingsCard icon="monitor" title="Remote access · paired devices">
        <Text style={readError === null ? styles.muted : styles.error}>{readError ?? "Reading…"}</Text>
      </SettingsCard>
    );
  }
  const copy = () => {
    if (pairing === null) return;
    navigator.clipboard?.writeText(pairing.code).then(
      () => setIsCopied(true),
      () => setIsCopied(false),
    );
  };
  return (
    <SettingsCard
      icon="monitor"
      summary="Control this computer from another Iskios"
      title="Remote access · paired devices"
    >
      <ToggleRow
        label="Allow paired devices"
        onChange={(isEnabled) => {
          if (!isEnabled) setPairing(null);
          void attempt(client.request({ _tag: "SetRemoteAccess", isEnabled }));
        }}
        value={view.isEnabled}
      />
      <Text accessibilityLabel="Relay status" style={styles.muted}>
        {relayStatusTextOf(view.status, view.isEnabled)}
      </Text>
      <SettingsRule />
      <HostNameEditor client={client} />
      <SettingsRule />
      <View style={local.row}>
        <Button
          isDisabled={!view.isEnabled}
          label="Pair a device"
          onPress={() => {
            setIsCopied(false);
            void attempt(client.request({ _tag: "CreatePairingCode" }).then(setPairing));
          }}
        />
        {!view.isEnabled && <Text style={styles.muted}>Turn on Allow paired devices first.</Text>}
      </View>
      {pairing !== null && (
        <View style={local.codeBox}>
          <Text accessibilityLabel="Pairing code" selectable style={local.code}>
            {pairing.code}
          </Text>
          <Text style={styles.muted}>
            {codeLifeOf(pairing.expiresAt, now)} Paste it in the other Iskios, under Add a host.
          </Text>
          <Button isPrimary={false} label={isCopied ? "Copied" : "Copy the code"} onPress={copy} />
        </View>
      )}
      <SettingsRule />
      <Text style={local.label}>Paired devices</Text>
      {view.devices.length === 0 && <Text style={styles.muted}>No device is paired with this computer.</Text>}
      {view.devices.map((device) => (
        <View key={device.id} style={local.device}>
          <View style={local.deviceText}>
            <Text style={styles.body}>{device.name}</Text>
            <Text style={styles.muted}>{deviceLineOf(device, now)}</Text>
          </View>
          <Button
            isPrimary={false}
            label="Disconnect"
            onPress={() => void attempt(client.request({ _tag: "DisconnectDevice", deviceId: device.id }))}
          />
        </View>
      ))}
      <Text style={styles.muted}>
        Disconnecting a device ends its connection at once and forgets it; it can pair again with a new code.
      </Text>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </SettingsCard>
  );
}

/** Edits the host's name from either its own window or a paired device. */
function HostNameEditor({ client }: { client: ServiceClient }) {
  const { data: current, error: readError } = useServiceQuery(client, { _tag: "ReadHostName" }, "host-name");
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = name ?? current ?? "";
  return (
    <View style={{ gap: 8 }}>
      <Text style={local.label}>This host's name</Text>
      <View style={local.row}>
        <TextInput
          accessibilityLabel="Host name"
          maxLength={60}
          onChangeText={setName}
          style={local.input}
          value={shown}
        />
        <Button
          isDisabled={current === null || shown.trim() === current}
          isPrimary={false}
          label="Rename"
          onPress={() => {
            void client.request({ _tag: "RenameHost", name: shown }).then(
              () => {
                setName(null);
                setError(null);
              },
              (reason) => setError(messageOf(reason)),
            );
          }}
        />
      </View>
      {(error ?? readError) !== null && <Text style={styles.error}>{error ?? readError}</Text>}
    </View>
  );
}

const local = StyleSheet.create({
  code: {
    color: colors.text,
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
    lineHeight: 18,
  },
  codeBox: {
    backgroundColor: colors.page,
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  device: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  deviceText: { flex: 1, gap: 2 },
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
  label: { color: colors.textDim, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  row: { alignItems: "center", flexDirection: "row", gap: 10 },
});
