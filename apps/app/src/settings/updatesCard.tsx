import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { messageOf } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, outline, radii } from "../foundation/theme";
import { canCheckNow, lastCheckedTextOf, statusTextOf } from "../foundation/updateText";
import { useAppUpdates } from "../foundation/useAppUpdates";
import { UpdateModal } from "../shell/updateModal";
import { Button } from "../ui/button";
import { SettingsCard, ToggleRow } from "./settingsParts";

/**
 * The installed app's updates: the version, whether Iskios looks for new releases, what the last look found, and,
 * once one has downloaded, its notes and the button that installs it (app-updates). Only the desktop window of this
 * computer can update; elsewhere the card says so.
 */
export function UpdatesCard() {
  const updates = useAppUpdates();
  const [error, setError] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  if (updates === null)
    return (
      <SettingsCard icon="gear" title="Updates">
        <Text style={styles.muted}>
          Iskios updates itself in its desktop app, on the computer it runs on. Open the desktop app on this computer to
          see its updates.
        </Text>
      </SettingsCard>
    );
  const { state } = updates;
  if (state === null)
    return (
      <SettingsCard icon="gear" title="Updates">
        {updates.error !== null && <Text style={styles.error}>{updates.error}</Text>}
      </SettingsCard>
    );
  const { status } = state;
  const act = (request: Promise<unknown>) =>
    request.then(
      () => setError(null),
      (reason) => setError(messageOf(reason)),
    );
  return (
    <SettingsCard icon="gear" summary={`Installed: ${state.currentVersion}`} title="Updates">
      <ToggleRow
        label="Look for new releases (once at start, then every 6 hours)"
        onChange={(isEnabled) => act(updates.bridge.setEnabled(isEnabled))}
        value={state.isEnabled}
      />
      <Text style={status._tag === "Failed" ? styles.error : styles.muted}>{statusTextOf(state)}</Text>
      {status._tag !== "Unsupported" && state.isEnabled && (
        <Text style={styles.muted}>{lastCheckedTextOf(state.lastCheckedAt, Date.now())}</Text>
      )}
      {status._tag === "Ready" && (
        <View style={local.notes}>
          <Text selectable style={local.notesText}>
            {status.notes === "" ? "This release has no notes." : status.notes}
          </Text>
        </View>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <View style={local.actions}>
        {status._tag === "Ready" && <Button label="Restart and update" onPress={() => setIsAsking(true)} />}
        {status._tag === "Failed" && status.pageUrl !== null && (
          <Button
            isPrimary={false}
            label="Open the release page"
            onPress={() => void act(updates.bridge.openReleasePage(status.pageUrl ?? ""))}
          />
        )}
        <Button
          isDisabled={!canCheckNow(state)}
          isPrimary={false}
          label="Check now"
          onPress={() => void act(updates.bridge.check())}
        />
      </View>
      {isAsking && status._tag === "Ready" && (
        <UpdateModal
          bridge={updates.bridge}
          notes={status.notes}
          onClose={() => setIsAsking(false)}
          version={status.version}
        />
      )}
    </SettingsCard>
  );
}

const local = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  notes: { ...outline, backgroundColor: colors.page, borderRadius: radii.md, padding: 10 },
  notesText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, lineHeight: 19 },
});
