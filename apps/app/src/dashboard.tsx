import type { MissionId, WorkspaceChoice, WorkspaceId } from "@gild/contracts";
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
import { GuildDesk, GuildHero } from "./sketches";
import { styles } from "./styles";
import { colors, fonts } from "./theme";
import { useServiceQuery } from "./useServiceQuery";
import { useSkills } from "./useSkills";
import { WorkspacePicker } from "./workspaces";

/** The panel width from which the board's columns stand side by side. */
const boardBreakpoint = 560;

/**
 * Starts a mission with one message, prefilled from the last mission's choices (mission-tracking). On a workspace's
 * board the mission starts in that workspace, and the workspace cannot be changed there.
 */
export function MissionStarter({
  client,
  onOpen,
  workspace: lockedWorkspace,
}: {
  client: ServiceClient;
  onOpen: (id: MissionId) => void;
  /** The workspace whose board shows, or null on the board of every mission. */
  workspace: WorkspaceChoice | null;
}) {
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
  const chosenWorkspace =
    lockedWorkspace !== null
      ? lockedWorkspace.path
      : workspace === null
        ? (last?.workspacePath ?? null)
        : workspace.path;
  const skills = useSkills(client, chosenWorkspace);
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
        placeholder="Start a quest with one message…"
        skills={skills}
      />
      {lockedWorkspace === null ? (
        <WorkspacePicker onChange={(path) => setWorkspace({ path })} value={chosenWorkspace} />
      ) : (
        <Text style={styles.muted}>
          Starts in <Text style={styles.code}>{lockedWorkspace.name}</Text>. Choose another folder from All realms.
        </Text>
      )}
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
  onWorkspace,
  workspaceId: chosenWorkspaceId,
}: {
  client: ServiceClient;
  isArchived: boolean;
  onArchived: () => void;
  onBack: () => void;
  onOpen: (id: MissionId) => void;
  onSettings: () => void;
  /** Opens the intel panel with all intel. */
  onIntel: () => void;
  /** Shows one workspace's missions, or every mission with null. */
  onWorkspace: (id: WorkspaceId | null) => void;
  /** The workspace whose missions show, or null for every mission. */
  workspaceId: WorkspaceId | null;
}) {
  const hasSidebar = useHasSidebar();
  const [search, setSearch] = useState("");
  const [width, setWidth] = useState(0);
  // The Archived view keeps every workspace; the board shows the one chosen in the sidebar or the breadcrumb.
  const workspaceId = isArchived ? null : chosenWorkspaceId;
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
    <View style={local.scroll}>
      {!isArchived && <GuildDesk />}
      <ScrollView
        contentContainerStyle={local.content}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={styles.flex}
      >
        <GuildHero />
        <View style={styles.header}>
          {isArchived && !hasSidebar && (
            <Pressable onPress={onBack}>
              <Text style={[styles.link, { color: colors.goldHi }]}>← Quests</Text>
            </Pressable>
          )}
          <View style={styles.flex}>
            {workspaceNames.size > 0 && (
              <View style={[local.crumb, { alignSelf: "flex-start", backgroundColor: colors.paper, borderRadius: 3 }]}>
                {workspaceId !== null && <Text style={styles.muted}>All realms ›</Text>}
                <Menu
                  accessibilityLabel="Realm"
                  label={(id) => (id === null ? "All realms" : (workspaceNames.get(id) ?? ""))}
                  onChange={onWorkspace}
                  options={[null, ...workspaceNames.keys()]}
                  value={workspaceId}
                />
              </View>
            )}
            <Text style={local.title}>{isArchived ? "Archives" : "Quests"}</Text>
          </View>
          {global !== null && <BudgetMeters onPress={() => setIsGlobalBudgetOpen(true)} use={global} />}
          {!isArchived && !hasSidebar && (
            <Pressable onPress={onArchived}>
              <Text style={[styles.link, { color: colors.goldHi }]}>Archived</Text>
            </Pressable>
          )}
          {!isArchived && !hasSidebar && (
            <Pressable onPress={onIntel}>
              <Text style={[styles.link, { color: colors.goldHi }]}>Lore</Text>
            </Pressable>
          )}
          {!hasSidebar && (
            <Pressable onPress={onSettings}>
              <Text style={[styles.link, { color: colors.goldHi }]}>Settings</Text>
            </Pressable>
          )}
        </View>
        {!isArchived && global?.stop != null && (
          <BudgetStopCard client={client} onRaise={() => setIsGlobalBudgetOpen(true)} stop={global.stop} />
        )}
        {!isArchived && questions !== null && questions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.onWood }]}>Waiting for your answer</Text>
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
            <Text style={[styles.label, { color: colors.onWood }]}>Quests to settle</Text>
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
        <TextInput
          accessibilityLabel="Search quests"
          onChangeText={setSearch}
          placeholder="Search titles and briefings"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          value={search}
        />
        {error !== null && (
          <Text style={[styles.error, { backgroundColor: colors.dangerSoft, padding: 8 }]}>{error}</Text>
        )}
        {data !== null &&
          (isArchived ? (
            data.missions.length === 0 ? (
              <Text style={[styles.muted, { color: colors.onWood }]}>No archived quests.</Text>
            ) : (
              <View style={local.archive}>
                {data.missions.map((mission) => (
                  <View key={mission.id} style={local.archiveCard}>
                    <MissionCard client={client} column={null} mission={mission} onOpen={() => onOpen(mission.id)} />
                  </View>
                ))}
              </View>
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
    </View>
  );
}

const local = StyleSheet.create({
  archive: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 16 },
  archiveCard: { maxWidth: "100%", width: 360 },
  content: { gap: 14, paddingHorizontal: 28, paddingVertical: 20 },
  crumb: { alignItems: "center", flexDirection: "row", gap: 2, zIndex: 3 },
  scroll: { backgroundColor: colors.wood, flex: 1 },
  title: {
    color: colors.onWood,
    fontFamily: fonts.hand,
    fontSize: 46,
    fontWeight: "700",
    letterSpacing: 2,
    lineHeight: 56,
    marginTop: 4,
    textShadowColor: "#000",
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 6,
    textTransform: "uppercase",
  },
});
