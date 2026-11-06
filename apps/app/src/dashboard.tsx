import {
  type EffortChoice,
  EffortChoice as EffortChoices,
  type MissionId,
  type MissionState,
  MissionState as MissionStates,
  type MissionSummary,
  type ModelChoice,
  ModelChoice as ModelChoices,
  type WorkspaceId,
} from "@openmission/contracts";
import { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { newRequestId, type ServiceClient } from "./client";
import { Choice, Composer, StateBadge } from "./controls";
import { effortLabel, modelLabels, timeOf, usageText } from "./formatting";
import { threadCountOf } from "./labels";
import { MissionEndingActions, MissionPromptCard } from "./missionActions";
import { QuestionCard } from "./questions";
import { styles } from "./styles";
import { useServiceQuery } from "./useServiceQuery";
import { WorkspacePicker } from "./workspaces";

/** The states the dashboard filters by; Archived missions have their own view. */
const dashboardStates = MissionStates.literals.filter((state) => state !== "Archived");

/** Starts a mission with one message, prefilled from the last mission's choices (mission-tracking). */
function MissionStarter({ client, onOpen }: { client: ServiceClient; onOpen: (id: MissionId) => void }) {
  const { data: last } = useServiceQuery(client, { _tag: "ReadStartChoices" }, "start-choices");
  const [model, setModel] = useState<ModelChoice | null>(null);
  const [effort, setEffort] = useState<EffortChoice | null>(null);
  // Null until the owner picks a workspace or none; the last mission's applies until then.
  const [workspace, setWorkspace] = useState<{ readonly path: string | null } | null>(null);
  const chosenModel = model ?? last?.model ?? "default";
  const chosenEffort = effort ?? last?.effort ?? "default";
  const chosenWorkspace = workspace === null ? (last?.workspacePath ?? null) : workspace.path;
  return (
    <View>
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
                workspacePath: chosenWorkspace,
              })
            ).missionId,
          )
        }
        placeholder="Start a mission with one message…"
      />
      <Choice label={(m) => modelLabels[m]} onChange={setModel} options={ModelChoices.literals} value={chosenModel} />
      <Choice label={effortLabel} onChange={setEffort} options={EffortChoices.literals} value={chosenEffort} />
      <WorkspacePicker onChange={(path) => setWorkspace({ path })} value={chosenWorkspace} />
    </View>
  );
}

function MissionRow({
  client,
  mission,
  onOpen,
}: {
  client: ServiceClient;
  mission: MissionSummary;
  onOpen: () => void;
}) {
  return (
    <View>
      <Pressable onPress={onOpen} style={styles.row}>
        <Text numberOfLines={1} style={styles.title}>
          {mission.title}
        </Text>
        {mission.workspaceName !== null && <Text style={styles.muted}>{mission.workspaceName}</Text>}
        <StateBadge state={mission.state} />
        <Text style={styles.muted}>{threadCountOf(mission)}</Text>
        <Text style={styles.muted}>{usageText(mission.usage)}</Text>
        <Text style={styles.muted}>{timeOf(mission.lastActivityAt)}</Text>
      </Pressable>
      <MissionEndingActions client={client} mission={mission} />
    </View>
  );
}

/** The missions list with its filters and search: the dashboard, or the Archived view. */
export function Dashboard({
  client,
  isArchived,
  onArchived,
  onBack,
  onOpen,
  onSettings,
}: {
  client: ServiceClient;
  isArchived: boolean;
  onArchived: () => void;
  onBack: () => void;
  onOpen: (id: MissionId) => void;
  onSettings: () => void;
}) {
  const [search, setSearch] = useState("");
  const [state, setState] = useState<MissionState | null>(null);
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId | null>(null);
  const request = { _tag: "ListMissions", isArchived, search, state, workspaceId } as const;
  const { data, error } = useServiceQuery(client, request, `missions:${JSON.stringify(request)}`);
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const { data: questions } = useServiceQuery(client, { _tag: "ListOpenQuestions" }, "open-questions");
  // The questions cover every mission on the dashboard, whatever the filters show.
  const { data: all } = useServiceQuery(
    client,
    { _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null },
    "missions:all",
  );
  const asking = isArchived ? [] : (all?.missions.filter((mission) => mission.prompt !== null) ?? []);
  const workspaceNames = new Map((data?.workspaces ?? []).map((w) => [w.id, w.name]));
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {isArchived && (
          <Pressable onPress={onBack}>
            <Text style={styles.link}>← Missions</Text>
          </Pressable>
        )}
        <Text style={[styles.heading, styles.flex]}>{isArchived ? "Archived missions" : "Missions"}</Text>
        {!isArchived && (
          <Pressable onPress={onArchived}>
            <Text style={styles.link}>Archived</Text>
          </Pressable>
        )}
        <Pressable onPress={onSettings}>
          <Text style={styles.link}>Settings</Text>
        </Pressable>
      </View>
      {!isArchived && questions !== null && questions.length > 0 && (
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
      {asking.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>Missions to settle</Text>
          {asking.map((mission) => (
            <MissionPromptCard
              client={client}
              inactivityDays={settings?.inactivityDays ?? 14}
              key={`${mission.id}:${mission.prompt}`}
              mission={mission}
              onOpen={() => onOpen(mission.id)}
            />
          ))}
        </View>
      )}
      {!isArchived && <MissionStarter client={client} onOpen={onOpen} />}
      <TextInput
        accessibilityLabel="Search missions"
        onChangeText={setSearch}
        placeholder="Search titles and briefings"
        style={styles.input}
        value={search}
      />
      {!isArchived && (
        <Choice
          label={(s) => s ?? "All states"}
          onChange={setState}
          options={[null, ...dashboardStates]}
          value={state}
        />
      )}
      {workspaceNames.size > 0 && (
        <Choice
          label={(id) => (id === null ? "All workspaces" : (workspaceNames.get(id) ?? ""))}
          onChange={setWorkspaceId}
          options={[null, ...workspaceNames.keys()]}
          value={workspaceId}
        />
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <FlatList<MissionSummary>
        data={data?.missions ?? []}
        keyExtractor={(mission) => mission.id}
        ListEmptyComponent={
          data === null ? (
            void 0
          ) : (
            <Text style={styles.muted}>{isArchived ? "No archived missions." : "No missions here."}</Text>
          )
        }
        renderItem={({ item }) => <MissionRow client={client} mission={item} onOpen={() => onOpen(item.id)} />}
      />
    </View>
  );
}
