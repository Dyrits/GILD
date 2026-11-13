import type { BackupCompanion, ThreadId } from "@iskios/contracts";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BackupsEditor } from "../editors/backupsEditor";
import { useHarnesses } from "../editors/runners";
import { useOwnBackups } from "../editors/useOwnBackups";
import { messageOf, type ServiceClient } from "../foundation/client";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";

/**
 * The thread's backup Companions (thread-panel, Backup companions), under its own Companion in the Companions tab:
 * what the list does, then one fold for each, with the same picker as the Companion above. Every change is saved at
 * once.
 */
export function ThreadBackups({ client, threadId }: { client: ServiceClient; threadId: ThreadId }) {
  const { data: panel } = useServiceQuery(client, { _tag: "ReadThreadPanel", threadId }, threadId);
  const { data: harnesses } = useHarnesses(client);
  const { backups, discard, edit } = useOwnBackups(panel?.backups ?? []);
  const [error, setError] = useState<string | null>(null);
  const save = (next: ReadonlyArray<BackupCompanion>) => {
    edit(next);
    setError(null);
    client.request({ _tag: "SetThreadBackups", backups: next, threadId }).catch((reason) => {
      discard();
      setError(messageOf(reason));
    });
  };
  return (
    <View style={local.backups}>
      <Text style={local.title}>Backup companions</Text>
      <Text style={local.note}>
        When a turn of this thread fails, it carries on with the first of these that differs from its own, with the
        conversation so far.
      </Text>
      <BackupsEditor backups={backups} harnesses={harnesses} isCompact={false} isFolded={true} onChange={save} />
      {error !== null && <Text style={local.error}>{error}</Text>}
    </View>
  );
}

const local = StyleSheet.create({
  backups: { gap: 8, paddingTop: 8 },
  error: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  note: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  title: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.xs, fontWeight: "600" },
});
