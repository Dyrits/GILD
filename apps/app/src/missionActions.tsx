import type { MissionEnding, MissionSummary } from "@canopy/contracts";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { ServiceClient } from "./client";
import { promptQuestionOf } from "./labels";
import { styles } from "./styles";
import { useEnding } from "./useEnding";

const endingLabels = { Archived: "Archive", Done: "Mark as done" } as const satisfies Record<MissionEnding, string>;

function EndingConfirmation({ ending }: { ending: ReturnType<typeof useEnding> }) {
  if (ending.pending === null) return null;
  return (
    <View style={styles.failure}>
      <Text style={styles.body}>{ending.pending.preview.question}</Text>
      <View style={styles.inlineRow}>
        <Pressable disabled={ending.isBusy} onPress={ending.confirm}>
          <Text style={styles.link}>Stop and {endingLabels[ending.pending.ending].toLowerCase()}</Text>
        </Pressable>
        <Pressable disabled={ending.isBusy} onPress={ending.cancel}>
          <Text style={styles.link}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Mark as done, Archive, or Reopen in the mission header, by how the mission stands. */
export function MissionEndingActions({ client, mission }: { client: ServiceClient; mission: MissionSummary }) {
  const ending = useEnding(client, mission);
  const reopen = () => ending.run(() => client.request({ _tag: "ReopenMission", missionId: mission.id }));
  return (
    <View>
      <View style={styles.inlineRow}>
        {mission.state === "Archived" ? (
          <Pressable onPress={reopen}>
            <Text style={styles.link}>Reopen</Text>
          </Pressable>
        ) : (
          <>
            {mission.state !== "Done" && (
              <Pressable disabled={ending.isBusy} onPress={() => ending.start("Done")}>
                <Text style={styles.link}>Mark as done</Text>
              </Pressable>
            )}
            <Pressable disabled={ending.isBusy} onPress={() => ending.start("Archived")}>
              <Text style={styles.link}>Archive</Text>
            </Pressable>
          </>
        )}
      </View>
      <EndingConfirmation ending={ending} />
      {ending.error !== null && <Text style={styles.error}>{ending.error}</Text>}
    </View>
  );
}

/** A dashboard question about one mission: Mark as done after its result, or its inactivity. */
export function MissionPromptCard({
  client,
  inactivityDays,
  mission,
  onOpen,
}: {
  client: ServiceClient;
  inactivityDays: number;
  mission: MissionSummary;
  onOpen: () => void;
}) {
  const ending = useEnding(client, mission);
  const prompt = mission.prompt;
  if (prompt === null) return null;
  const dismiss = () =>
    ending.run(() => client.request({ _tag: "DismissMissionPrompt", missionId: mission.id, prompt }));
  return (
    <View style={styles.failure}>
      <Pressable onPress={onOpen}>
        <Text numberOfLines={1} style={styles.title}>
          {mission.title}
        </Text>
      </Pressable>
      <Text style={styles.body}>{promptQuestionOf(prompt, inactivityDays)}</Text>
      <View style={styles.inlineRow}>
        {prompt === "Inactive" && (
          <Pressable disabled={ending.isBusy} onPress={() => ending.start("Archived")}>
            <Text style={styles.link}>Archive</Text>
          </Pressable>
        )}
        <Pressable disabled={ending.isBusy} onPress={() => ending.start("Done")}>
          <Text style={styles.link}>Mark as done</Text>
        </Pressable>
        <Pressable disabled={ending.isBusy} onPress={dismiss}>
          <Text style={styles.link}>Not now</Text>
        </Pressable>
      </View>
      <EndingConfirmation ending={ending} />
      {ending.error !== null && <Text style={styles.error}>{ending.error}</Text>}
    </View>
  );
}

/** The mission's title in its header; pressing it renames the mission (mission-tracking, Title). */
export function MissionTitle({ client, mission }: { client: ServiceClient; mission: MissionSummary }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (draft === null) return;
    client.request({ _tag: "RenameMission", missionId: mission.id, title: draft }).then(
      () => {
        setDraft(null);
        setError(null);
      },
      (reason: Error) => setError(reason.message),
    );
  };
  if (draft === null) {
    return (
      <Pressable accessibilityLabel="Rename the mission" onPress={() => setDraft(mission.title)} style={styles.flex}>
        <Text numberOfLines={1} style={styles.heading}>
          {mission.title}
        </Text>
      </Pressable>
    );
  }
  return (
    <View style={[styles.flex, styles.inlineRow]}>
      <TextInput
        accessibilityLabel="Mission title"
        autoFocus
        onChangeText={setDraft}
        onSubmitEditing={save}
        style={[styles.input, styles.flex]}
        value={draft}
      />
      <Pressable onPress={save}>
        <Text style={styles.link}>Save</Text>
      </Pressable>
      <Pressable onPress={() => setDraft(null)}>
        <Text style={styles.link}>Cancel</Text>
      </Pressable>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
