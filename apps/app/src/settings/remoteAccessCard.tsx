import type { PairingCode, RemoteAccessView } from "@iskios/contracts";
import { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, TextInput, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { useActiveHost } from "../foundation/hostContext";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Button } from "../ui/button";
import {
  cloudflareTokensUrl,
  codeLifeOf,
  deviceLineOf,
  ownRelayNoticeOf,
  relayLineOf,
  relayStatusTextOf,
} from "./remoteAccess";
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
      <RelayChoice client={client} deviceCount={view.devices.length} view={view} />
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

/**
 * Which relay this host uses. The shared relay needs nothing; the owner may deploy one to their own Cloudflare account
 * with one API token, which is used once and not kept (device-pairing, own relay).
 */
function RelayChoice({
  client,
  deviceCount,
  view,
}: {
  client: ServiceClient;
  deviceCount: number;
  view: RemoteAccessView;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [token, setToken] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setIsOpen(false);
    setToken("");
    setError(null);
  };
  const deploy = () => {
    setIsWorking(true);
    setError(null);
    client.request({ _tag: "UseOwnRelay", token }).then(
      () => {
        setIsWorking(false);
        close();
      },
      (reason) => {
        setIsWorking(false);
        setError(messageOf(reason));
      },
    );
  };
  const returnToShared = () => {
    setError(null);
    client.request({ _tag: "UseSharedRelay" }).then(
      () => undefined,
      (reason) => setError(messageOf(reason)),
    );
  };
  return (
    <View style={{ gap: 8 }}>
      <Text style={local.label}>Relay</Text>
      <Text accessibilityLabel="Relay in use" style={styles.body}>
        {relayLineOf(view)}
      </Text>
      {!isOpen && (
        <View style={local.row}>
          <Button
            isPrimary={false}
            label={view.isOwnRelay ? "Update my relay" : "Use my own Cloudflare account"}
            onPress={() => setIsOpen(true)}
          />
          {view.isOwnRelay && <Button isPrimary={false} label="Use the shared relay" onPress={returnToShared} />}
        </View>
      )}
      {isOpen && (
        <View style={local.codeBox}>
          <Text style={styles.body}>
            Deploy the relay to your own Cloudflare account instead of sharing the project's. A free Cloudflare account
            is enough.
          </Text>
          <Text style={styles.muted}>
            1. Open Cloudflare's token page, choose Create Token, and use the “Edit Cloudflare Workers” template. Under
            Account Resources, choose your one account.
          </Text>
          <View style={local.row}>
            <Button
              isPrimary={false}
              label="Open Cloudflare's token page"
              onPress={() => void Linking.openURL(cloudflareTokensUrl)}
            />
          </View>
          <Text style={styles.muted}>2. Paste the token here.</Text>
          <TextInput
            accessibilityLabel="Cloudflare API token"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isWorking}
            onChangeText={setToken}
            placeholder="Cloudflare API token"
            placeholderTextColor={colors.textDim}
            secureTextEntry
            style={local.input}
            value={token}
          />
          <Text style={styles.muted}>{ownRelayNoticeOf(deviceCount)}</Text>
          <View style={local.row}>
            <Button
              isDisabled={isWorking || token.trim() === ""}
              label={isWorking ? "Deploying…" : "Deploy and use"}
              onPress={deploy}
            />
            <Button isDisabled={isWorking} isPrimary={false} label="Cancel" onPress={close} />
          </View>
          {isWorking && <Text style={styles.muted}>This takes up to a minute.</Text>}
        </View>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
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
