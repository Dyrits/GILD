import {
  type EffortChoice,
  EffortChoice as EffortChoices,
  type MissionId,
  type MissionSummary,
  type ModelChoice,
  ModelChoice as ModelChoices,
} from "@openmission/contracts";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { newRequestId, type ServiceClient } from "./client";
import { Choice, Composer, StateBadge } from "./controls";
import { effortLabel, modelLabels, timeOf, usageText } from "./formatting";
import { QuestionCard } from "./questions";
import { styles } from "./styles";
import { useServiceQuery } from "./useServiceQuery";
import { WorkspacePicker } from "./workspaces";

export function Dashboard({
  client,
  onOpen,
  onSettings,
}: {
  client: ServiceClient;
  onOpen: (id: MissionId) => void;
  onSettings: () => void;
}) {
  const { data: missions, error } = useServiceQuery(client, { _tag: "ListMissions" }, "missions");
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const { data: questions } = useServiceQuery(client, { _tag: "ListOpenQuestions" }, "open-questions");
  const [model, setModel] = useState<ModelChoice | null>(null);
  const [effort, setEffort] = useState<EffortChoice | null>(null);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const chosenModel = model ?? settings?.defaultModel ?? "default";
  const chosenEffort = effort ?? settings?.defaultEffort ?? "default";
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={[styles.heading, styles.flex]}>Missions</Text>
        <Pressable onPress={onSettings}>
          <Text style={styles.link}>Settings</Text>
        </Pressable>
      </View>
      {questions !== null && questions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>Waiting for your answer</Text>
          {questions.map((question) => (
            <QuestionCard
              client={client}
              key={question.id}
              onOpenMission={() => onOpen(question.missionId)}
              question={question}
            />
          ))}
        </View>
      )}
      <Composer
        onSend={async (text) =>
          onOpen(
            (
              await client.request({
                _tag: "StartMission",
                effort: chosenEffort,
                model: chosenModel,
                requestId: newRequestId(),
                text,
                workspacePath,
              })
            ).missionId,
          )
        }
        placeholder="Start a mission with one message…"
      />
      <Choice label={(m) => modelLabels[m]} onChange={setModel} options={ModelChoices.literals} value={chosenModel} />
      <Choice label={effortLabel} onChange={setEffort} options={EffortChoices.literals} value={chosenEffort} />
      <WorkspacePicker client={client} onChange={setWorkspacePath} value={workspacePath} />
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <FlatList<MissionSummary>
        data={missions ?? []}
        keyExtractor={(mission) => mission.id}
        ListEmptyComponent={missions === null ? void 0 : <Text style={styles.muted}>No missions yet.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpen(item.id)} style={styles.row}>
            <Text numberOfLines={1} style={styles.title}>
              {item.title}
            </Text>
            {item.workspaceName !== null && <Text style={styles.muted}>{item.workspaceName}</Text>}
            <StateBadge state={item.state} />
            <Text style={styles.muted}>{usageText(item.usage)}</Text>
            <Text style={styles.muted}>{timeOf(item.lastActivityAt)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
