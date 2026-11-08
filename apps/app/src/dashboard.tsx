import type { MissionId, WorkspaceId } from "@canopy/contracts";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MissionBoard, MissionCard } from "./board";
import { BudgetMeters, BudgetScreen, BudgetStopCard } from "./budgets";
import { newRequestId, type ServiceClient } from "./client";
import { Composer } from "./controls";
import { MissionPromptCard } from "./missionActions";
import { Menu } from "./pickers";
import { allMissions } from "./queries";
import { QuestionCard } from "./questions";
import { type Runner, RunnerPickers, useHarnesses } from "./runners";
import { useHasSidebar } from "./sidebar";
import { styles } from "./styles";
import { colors } from "./theme";
import { useServiceQuery } from "./useServiceQuery";
import { WorkspacePicker } from "./workspaces";

/** The panel width from which the board's columns stand side by side. */
const boardBreakpoint = 720;

/** Starts a mission with one message, prefilled from the last mission's choices (mission-tracking). */
function MissionStarter({ client, onOpen }: { client: ServiceClient; onOpen: (id: MissionId) => void }) {
  const { data: last } = useServiceQuery(client, { _tag: "ReadStartChoices" }, "start-choices");
  const { data: harnesses } = useHarnesses(client);
  // Null until the owner picks; the last mission's runner applies until then.
  const [runner, setRunner] = useState<Runner | null>(null);
  // Null until the owner picks a workspace or none; the last mission's applies until then.
  const [workspace, setWorkspace] = useState<{ readonly path: string | null } | null>(null);
  const chosen: Runner =
    runner ??
    (last === null
      ? { accountId: null, effort: "default", harness: "claude", model: "default" }
      : { accountId: last.accountId, effort: last.effort, harness: last.harness, model: last.model });
  const chosenWorkspace = workspace === null ? (last?.workspacePath ?? null) : workspace.path;
  return (
    // Above the list below it, so a picker's open list covers the search and the filters.
    <View style={[styles.section, styles.raised]}>
      <Composer
        accessory={<RunnerPickers harnesses={harnesses} isCompact={true} onChange={setRunner} value={chosen} />}
        onSend={async (text) =>
          onOpen(
            (
              await client.request({
                _tag: "StartMission",
                accountId: chosen.accountId,
                effort: chosen.effort,
                harness: chosen.harness,
                model: chosen.model,
                requestId: newRequestId(),
                text,
                workspacePath: chosenWorkspace,
              })
            ).missionId,
          )
        }
        placeholder="Start a mission with one message…"
      />
      <WorkspacePicker onChange={(path) => setWorkspace({ path })} value={chosenWorkspace} />
    </View>
  );
}

/**
 * The missions as a board by what needs the owner, with a workspace breadcrumb and search: the dashboard; or, for
 * the Archived view, the archived missions as cards.
 */
export function Dashboard({
  client,
  isArchived,
  onArchived,
  onBack,
  onOpen,
  onSettings,
  onIntel,
}: {
  client: ServiceClient;
  isArchived: boolean;
  onArchived: () => void;
  onBack: () => void;
  onOpen: (id: MissionId) => void;
  onSettings: () => void;
  /** Opens the intel panel with all intel. */
  onIntel: () => void;
}) {
  const hasSidebar = useHasSidebar();
  const [search, setSearch] = useState("");
  const [width, setWidth] = useState(0);
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId | null>(null);
  const [isGlobalBudgetOpen, setIsGlobalBudgetOpen] = useState(false);
  const { data: global } = useServiceQuery(client, { _tag: "ReadBudget", missionId: null }, "budget:global");
  const request = { _tag: "ListMissions", isArchived, search, state: null, workspaceId } as const;
  const { data, error } = useServiceQuery(client, request, `missions:${JSON.stringify(request)}`);
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const { data: questions } = useServiceQuery(client, { _tag: "ListOpenQuestions" }, "open-questions");
  // The questions cover every mission on the dashboard, whatever the filters show.
  const { data: all } = useServiceQuery(client, allMissions.request, allMissions.key);
  const asking = isArchived ? [] : (all?.missions.filter((mission) => mission.prompt !== null) ?? []);
  const workspaceNames = new Map((data?.workspaces ?? []).map((w) => [w.id, w.name]));
  if (isGlobalBudgetOpen) {
    return (
      <BudgetScreen
        client={client}
        missionId={null}
        onBack={() => setIsGlobalBudgetOpen(false)}
        title="Global budget"
      />
    );
  }
  return (
    <ScrollView
      contentContainerStyle={local.content}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={local.scroll}
    >
      <View style={styles.header}>
        {isArchived && !hasSidebar && (
          <Pressable onPress={onBack}>
            <Text style={styles.link}>← Missions</Text>
          </Pressable>
        )}
        <View style={styles.flex}>
          {workspaceNames.size > 0 && (
            <View style={local.crumb}>
              {workspaceId !== null && <Text style={styles.muted}>All workspaces ›</Text>}
              <Menu
                accessibilityLabel="Workspace"
                label={(id) => (id === null ? "All workspaces" : (workspaceNames.get(id) ?? ""))}
                onChange={setWorkspaceId}
                options={[null, ...workspaceNames.keys()]}
                value={workspaceId}
              />
            </View>
          )}
          <Text style={styles.heading}>{isArchived ? "Archived missions" : "Missions"}</Text>
        </View>
        {global !== null && <BudgetMeters onPress={() => setIsGlobalBudgetOpen(true)} use={global} />}
        {!isArchived && !hasSidebar && (
          <Pressable onPress={onArchived}>
            <Text style={styles.link}>Archived</Text>
          </Pressable>
        )}
        {!isArchived && !hasSidebar && (
          <Pressable onPress={onIntel}>
            <Text style={styles.link}>Intel</Text>
          </Pressable>
        )}
        {!hasSidebar && (
          <Pressable onPress={onSettings}>
            <Text style={styles.link}>Settings</Text>
          </Pressable>
        )}
      </View>
      {!isArchived && global?.stop != null && (
        <BudgetStopCard client={client} onRaise={() => setIsGlobalBudgetOpen(true)} stop={global.stop} />
      )}
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
        placeholderTextColor={colors.placeholder}
        style={styles.input}
        value={search}
      />
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {data !== null &&
        (isArchived ? (
          data.missions.length === 0 ? (
            <Text style={styles.muted}>No archived missions.</Text>
          ) : (
            data.missions.map((mission) => (
              <MissionCard
                client={client}
                column={null}
                key={mission.id}
                mission={mission}
                onOpen={() => onOpen(mission.id)}
              />
            ))
          )
        ) : (
          <MissionBoard
            client={client}
            isWide={width >= boardBreakpoint}
            missions={data.missions}
            onOpen={(mission) => onOpen(mission.id)}
          />
        ))}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  content: { gap: 14, paddingHorizontal: 28, paddingVertical: 20 },
  crumb: { alignItems: "center", flexDirection: "row", gap: 2, zIndex: 3 },
  scroll: { backgroundColor: colors.paper, flex: 1 },
});
