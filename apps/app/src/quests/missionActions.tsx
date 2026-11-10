import type { MissionEnding, MissionSummary } from "@gild/contracts";
import { useState } from "react";
import { Pressable, type StyleProp, Text, TextInput, type TextStyle, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { promptQuestionOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { useEnding } from "../foundation/useEnding";
import { GoldButton } from "../ui/parchment";

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

/** Mark as done, Archive, or Reopen, by how the mission stands: as links in a card, or as gilt buttons in the quest panel. */
export function MissionEndingActions({
  client,
  isButtons = false,
  mission,
  onOpen,
}: {
  client: ServiceClient;
  isButtons?: boolean;
  mission: MissionSummary;
  /** In a card: opens the quest itself, as the first of its links, when a press on the card only selects it. */
  onOpen?: () => void;
}) {
  const ending = useEnding(client, mission);
  const reopen = () => ending.run(() => client.request({ _tag: "ReopenMission", missionId: mission.id }));
  const actions =
    mission.state === "Archived"
      ? [{ isPrimary: true, label: "Reopen", onPress: reopen }]
      : [
          ...(mission.state === "Done"
            ? []
            : [{ isPrimary: true, label: endingLabels.Done, onPress: () => ending.start("Done") }]),
          {
            isPrimary: mission.state === "Done",
            label: endingLabels.Archived,
            onPress: () => ending.start("Archived"),
          },
        ];
  return (
    <View style={isButtons && { gap: 8 }}>
      <View style={[styles.inlineRow, isButtons && { gap: 10 }]}>
        {onOpen !== undefined && !isButtons && (
          <Pressable accessibilityRole="button" onPress={onOpen}>
            <Text style={[styles.link, { fontWeight: "700" }]}>Open</Text>
          </Pressable>
        )}
        {actions.map(({ isPrimary, label, onPress }) =>
          isButtons ? (
            <GoldButton isDisabled={ending.isBusy} isPrimary={isPrimary} key={label} label={label} onPress={onPress} />
          ) : (
            <Pressable disabled={ending.isBusy && label !== "Reopen"} key={label} onPress={onPress}>
              <Text style={styles.link}>{label}</Text>
            </Pressable>
          ),
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
export function MissionTitle({
  client,
  mission,
  textStyle = styles.heading,
}: {
  client: ServiceClient;
  mission: MissionSummary;
  /** How the title reads at rest; the header's heading unless a panel wants it smaller. */
  textStyle?: StyleProp<TextStyle>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (draft === null) return;
    client.request({ _tag: "RenameMission", missionId: mission.id, title: draft }).then(
      () => {
        setDraft(null);
        setError(null);
      },
      (reason) => setError(messageOf(reason)),
    );
  };
  if (draft === null) {
    return (
      <Pressable accessibilityLabel="Rename the quest" onPress={() => setDraft(mission.title)} style={styles.flex}>
        <Text numberOfLines={2} style={textStyle}>
          {mission.title}
        </Text>
      </Pressable>
    );
  }
  return (
    <View style={[styles.flex, styles.inlineRow]}>
      <TextInput
        accessibilityLabel="Quest title"
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
