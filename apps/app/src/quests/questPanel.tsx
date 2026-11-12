import type { MissionDetail, MissionId, MissionSummary, WorkspaceChoice } from "@iskios/contracts";
import { type ReactNode, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CrestBadge } from "../crest/crest";
import { BudgetMeters } from "../editors/budgets";
import { boardOf } from "../foundation/boardColumns";
import type { ServiceClient } from "../foundation/client";
import { timeOf, usageDetail } from "../foundation/formatting";
import {
  consumptionDetailsOf,
  costTextOf,
  threadCountOf,
  tokenCountOf,
  totalTokensOf,
  usedTextOf,
} from "../foundation/labels";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, outline, radii, stateLabels, stateTones } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { RitualControls } from "../rituals/rituals";
import { RowChevron, RowIcon, type RowIconName } from "../ui/rowIcons";
import { MissionEndingActions, MissionTitle } from "./missionActions";

/** A labelled group of rows in a rounded card, as in the quest's side panel; the rows are set apart by thin rules. */
export function Group({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={local.group}>
      <Text style={local.groupLabel}>{label}</Text>
      <View style={local.card}>
        <View style={local.cardRows}>{children}</View>
      </View>
    </View>
  );
}

/** One row of a group: an icon, its name, a short value, and a chevron when pressing it opens something. */
export function Row({
  icon,
  onPress,
  label,
  value,
}: {
  icon?: RowIconName;
  label: string;
  onPress?: () => void;
  value?: string;
}) {
  const content = (
    <>
      {icon !== undefined && <RowIcon name={icon} tint={colors.textSecondary} />}
      <Text numberOfLines={1} style={local.rowLabel}>
        {label}
      </Text>
      {value !== undefined && (
        <Text numberOfLines={1} style={local.rowValue}>
          {value}
        </Text>
      )}
      {onPress !== undefined && <RowChevron tint={colors.textMuted} />}
    </>
  );
  return onPress === undefined ? (
    <View style={local.row}>{content}</View>
  ) : (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [local.row, pressed && local.pressed]}
    >
      {content}
    </Pressable>
  );
}

/** What a quest's budget shows as a row value: what is spent against the limit, or that there is none. */
export const budgetValueOf = (budget: MissionDetail["mission"]["budget"]) => {
  const { limits, spent } = budget;
  if (limits.tokens !== null) return `${tokenCountOf(spent.tokens)} of ${tokenCountOf(limits.tokens)} tokens`;
  if (limits.cost !== null) return `$${spent.cost.toFixed(2)} of $${limits.cost.toFixed(2)}`;
  return "No limit";
};

/** What the panel adds for the thread open in the conversation: its Companions group and its rows in Knows and Does. */
export type ThreadSections = {
  /** The thread's Companions group: what it runs on, its backups, and its context. */
  companions: ReactNode;
  knows: ReactNode;
  /** Given for a side-quest: it names the quest it belongs to and ends on its own. */
  sideQuest: { action: ReactNode; onOpenQuest: () => void; title: string } | null;
  spends: ReactNode;
};

/**
 * The quest's side panel shows the quest's emblem and name (press to rename), how it stands, and the open thread's Companions, Knows, and Does groups.
 * It leaves the thread's own conversation alone.
 */
export function QuestSidebar({
  client,
  mission,
  onOpenBudget,
  onOpenJournal,
  onBack,
  onOpenQuest,
  thread,
}: {
  client: ServiceClient;
  mission: MissionDetail["mission"];
  /** Given where the panel previews a quest from the board: returns to the board's overview. */
  onBack?: () => void;
  onOpenBudget: () => void;
  onOpenJournal: () => void;
  /** Given where the panel previews a quest from the board: opens the quest's conversation, under the brief. */
  onOpenQuest?: () => void;
  /** Given in the quest's conversation: what the open thread adds. */
  thread?: ThreadSections;
}) {
  const { usage } = mission;
  const tone = stateTones[mission.state];
  return (
    <View style={local.panel}>
      <ScrollView contentContainerStyle={local.content} style={styles.flex}>
        <View style={local.hero}>
          {onBack === undefined ? (
            // A plain quest is already named by the column's Quest tab; only a side-quest or a Ritual says what it is.
            (thread?.sideQuest != null || mission.ritual !== null) && (
              <Text style={local.kicker}>{thread?.sideQuest != null ? "Side-quest" : "Ritual"}</Text>
            )
          ) : (
            <Pressable accessibilityRole="button" onPress={onBack}>
              <Text style={local.kicker}>‹ The council</Text>
            </Pressable>
          )}
          <View style={local.heroRow}>
            <CrestBadge
              crest={mission.workspaceCrest}
              id={mission.workspaceId ?? mission.id}
              isLoose={mission.workspaceId === null}
              size={56}
            />
            {thread?.sideQuest != null ? (
              <Text style={[local.heroName, styles.flex]}>{thread.sideQuest.title}</Text>
            ) : (
              <MissionTitle client={client} key={mission.title} mission={mission} textStyle={local.heroName} />
            )}
          </View>
          <Text numberOfLines={2} style={local.meta}>
            <Text style={[local.metaState, { color: tone.color }]}>{stateLabels[mission.state]}</Text>
            {[mission.workspaceName, threadCountOf(mission)]
              .filter((part) => part !== null)
              .map((part) => ` · ${part}`)
              .join("")}
          </Text>
        </View>
        {mission.ritual !== null && <RitualControls client={client} missionId={mission.id} />}
        {onOpenQuest !== undefined && (
          <Pressable
            accessibilityRole="button"
            onPress={onOpenQuest}
            style={({ pressed }) => [local.open, pressed && local.openPressed]}
          >
            <Text style={local.openText}>Open quest</Text>
          </Pressable>
        )}
        {thread?.sideQuest != null && (
          <Group label="Quest">
            <Row icon="state" label={mission.title} onPress={thread.sideQuest.onOpenQuest} />
          </Group>
        )}
        {thread !== undefined && <Group label="Companions">{thread.companions}</Group>}
        <Group label="Knows">
          <Row icon="book" label="Journal" onPress={onOpenJournal} value="Where it stands" />
          {thread?.knows}
        </Group>
        <Group label="Does">
          {thread?.spends}
          <Row icon="wallet" label="Quest budget" onPress={onOpenBudget} value={budgetValueOf(mission.budget)} />
          <Row icon="chart" label="Quest usage" value={usedTextOf(mission.consumption)} />
          {/* A Ritual is never marked done or archived: it is switched off or deleted from its controls above. */}
          {thread?.sideQuest != null ? (
            <View style={local.does}>{thread.sideQuest.action}</View>
          ) : (
            mission.ritual === null && (
              <View style={local.does}>
                <MissionEndingActions client={client} isButtons={true} mission={mission} />
              </View>
            )
          )}
        </Group>
        <View style={local.spends}>
          <BudgetMeters onPress={onOpenBudget} use={mission.budget} />
          <Text style={styles.muted}>{usageDetail(usage)}</Text>
          {consumptionDetailsOf(mission.consumption) !== "" && (
            <Text style={styles.muted}>{consumptionDetailsOf(mission.consumption)}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * The panel for a quest picked on the board: it loads the quest itself and offers to open it, since the board's card
 * only selects it.
 */
export function QuestPreview({
  client,
  missionId,
  onBack,
  onOpenBudget,
  onOpenJournal,
  onOpenQuest,
}: {
  client: ServiceClient;
  missionId: MissionId;
  onBack: () => void;
  onOpenBudget: () => void;
  onOpenJournal: () => void;
  onOpenQuest: () => void;
}) {
  const { data } = useServiceQuery(client, { _tag: "ReadMission", missionId, threadId: null }, `${missionId}:top`);
  if (data === null || data.mission.id !== missionId) return <View style={local.panel} />;
  return (
    <QuestSidebar
      client={client}
      mission={data.mission}
      onBack={onBack}
      onOpenBudget={onOpenBudget}
      onOpenJournal={onOpenJournal}
      onOpenQuest={onOpenQuest}
    />
  );
}

const ledgerColumns = [
  { color: colors.danger, column: "Attention" },
  { color: colors.accent, column: "Running" },
  { color: colors.violet, column: "Idle" },
  { color: colors.success, column: "Done" },
] as const;

/** One row of an overview's list: a quest's name and where it stands; pressing it selects the quest. */
function OverviewRow({ mission, onPress }: { mission: MissionSummary; onPress: () => void }) {
  const tone = stateTones[mission.state];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [local.overviewRow, pressed && local.pressed]}
    >
      <View style={[local.overviewDot, { backgroundColor: tone.color }]} />
      <Text numberOfLines={1} style={local.overviewRowText}>
        {mission.title}
      </Text>
      <Text numberOfLines={1} style={local.overviewRowMeta}>
        {[stateLabels[mission.state], mission.workspaceName].filter((part) => part !== null).join(" · ")}
      </Text>
    </Pressable>
  );
}

/** The count of quests in each column, then what needs the owner and what is underway, each a press away from its panel. */
function QuestLedger({
  missions,
  onSelect,
}: {
  missions: ReadonlyArray<MissionSummary>;
  onSelect: (id: MissionId) => void;
}) {
  const board = boardOf(missions);
  const lists = [
    { label: "Needs you", rows: board.Attention },
    { label: "Underway", rows: board.Running },
  ] as const;
  return (
    <>
      <View style={local.group}>
        <Text style={local.groupLabel}>The quest ledger</Text>
        <View style={local.ledger}>
          {ledgerColumns.map(({ column, color }) => (
            <View key={column} style={local.ledgerTile}>
              <Text style={[local.ledgerCount, { color }]}>{board[column].length}</Text>
              <Text style={local.ledgerLabel}>{stateLabels[column]}</Text>
            </View>
          ))}
        </View>
      </View>
      {lists.map(
        ({ label, rows }) =>
          rows.length > 0 && (
            <View key={label} style={local.group}>
              <Text style={local.groupLabel}>{label}</Text>
              <View style={local.card}>
                {rows.slice(0, 5).map((mission) => (
                  <OverviewRow key={mission.id} mission={mission} onPress={() => onSelect(mission.id)} />
                ))}
                {rows.length > 5 && <Text style={local.overviewMore}>+ {rows.length - 5} more on the board</Text>}
              </View>
            </View>
          ),
      )}
    </>
  );
}

/**
 * What the board's side panel shows for a realm while no quest is chosen: its crest and name, its folder, the ledger
 * of its quests, those needing the owner or underway, and the button that opens the crest studio.
 */
export function RealmPanel({
  missions,
  onCustomize,
  onOpenLore,
  onRename,
  onSelect,
  realm,
}: {
  missions: ReadonlyArray<MissionSummary>;
  onCustomize: () => void;
  /** Opens the lore kept for this realm. */
  onOpenLore: () => void;
  /** Keeps a new name for the realm; rejects with the reason when refused. */
  onRename: (name: string) => Promise<unknown>;
  onSelect: (id: MissionId) => void;
  realm: WorkspaceChoice;
}) {
  // The new name while the realm's name is being edited; null at rest.
  const [draft, setDraft] = useState<string | null>(null);
  // Blur and submit both save; the ref lets the second of the two see that the first already did.
  const draftRef = useRef<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const editName = (value: string | null) => {
    draftRef.current = value;
    setDraft(value);
  };
  const saveName = () => {
    if (draftRef.current === null) return;
    const name = draftRef.current.trim();
    editName(null);
    if (name === "" || name === realm.name) return;
    onRename(name).then(
      () => setRenameError(null),
      (reason: Error) => setRenameError(reason.message),
    );
  };
  const lastActivity = missions.length === 0 ? null : Math.max(...missions.map((mission) => mission.lastActivityAt));
  const cost = costTextOf({
    estimated: missions.reduce((sum, { consumption }) => sum + consumption.estimated, 0),
    reported: missions.reduce((sum, { consumption }) => sum + consumption.reported, 0),
  });
  const tokens = missions.reduce((sum, { consumption }) => sum + totalTokensOf(consumption), 0);
  const spentText = `${tokenCountOf(tokens)} tokens${cost === null ? "" : ` · ${cost}`}`;
  return (
    <View style={local.panel}>
      <ScrollView contentContainerStyle={local.content} style={styles.flex}>
        <View style={local.hero}>
          <Text style={local.kicker}>Realm</Text>
          <View style={local.heroRow}>
            <Pressable
              accessibilityHint="Press to customize the crest"
              accessibilityLabel={`Crest of ${realm.name}`}
              accessibilityRole="button"
              onPress={onCustomize}
            >
              <CrestBadge crest={realm.crest} id={realm.id} size={64} />
            </Pressable>
            {draft === null ? (
              <Pressable
                accessibilityHint="Press to rename the realm"
                accessibilityRole="button"
                onPress={() => editName(realm.name)}
                style={styles.flex}
              >
                <Text numberOfLines={3} style={local.heroName}>
                  {realm.name}
                </Text>
              </Pressable>
            ) : (
              <View style={local.nameField}>
                <TextInput
                  accessibilityLabel="Realm name"
                  autoFocus
                  maxLength={80}
                  onBlur={saveName}
                  onChangeText={editName}
                  onSubmitEditing={saveName}
                  style={[local.heroName, local.nameInput]}
                  value={draft}
                />
              </View>
            )}
          </View>
          {renameError !== null && <Text style={styles.error}>{renameError}</Text>}
          <Text numberOfLines={2} style={local.meta}>
            {realm.path ?? "Tied to no folder"}
          </Text>
        </View>
        <Group label="Details">
          <Row label="Quests" value={String(missions.length)} />
          <Row
            label="Side-quests"
            value={String(missions.reduce((sum, mission) => sum + Math.max(0, mission.threadCount - 1), 0))}
          />
          {lastActivity !== null && <Row label="Last active" value={timeOf(lastActivity)} />}
          <Row label="Spent" value={spentText} />
        </Group>
        <Group label="Lore">
          <Row label="What this realm has learned" onPress={onOpenLore} />
        </Group>
        <QuestLedger missions={missions} onSelect={onSelect} />
      </ScrollView>
    </View>
  );
}

const local = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  // Each row draws a rule above it; the first row's is pushed out of the clipped card.
  cardRows: { marginTop: -1 },
  content: { gap: 18, paddingHorizontal: 28, paddingVertical: 26 },
  does: { borderTopColor: colors.border, borderTopWidth: 1, padding: 12 },
  group: { gap: 6 },
  groupLabel: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "600" },
  hero: { gap: 10 },
  heroName: {
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 27,
  },
  heroRow: { alignItems: "center", flexDirection: "row", gap: 12, paddingRight: 34 },
  kicker: {
    color: colors.edge,
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: "700",
  },
  ledger: { flexDirection: "row", gap: 8 },
  ledgerCount: { fontFamily: fonts.sans, fontSize: 24, fontWeight: "700" },
  ledgerLabel: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  ledgerTile: {
    alignItems: "center",
    backgroundColor: colors.control,
    borderRadius: radii.md,
    flex: 1,
    gap: 2,
    paddingVertical: 10,
  },
  meta: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md },
  metaState: { fontWeight: "700" },
  // The field may not outgrow the panel: a web input is as wide as its text unless told otherwise.
  nameField: { flex: 1, minWidth: 0 },
  nameInput: {
    backgroundColor: colors.canvas,
    borderColor: colors.edge,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    fontSize: 18,
    lineHeight: 24,
    minWidth: 0,
    padding: 6,
    width: "100%",
  },
  open: {
    ...outline,
    alignItems: "center",
    backgroundColor: colors.edge,
    borderRadius: radii.sm,
    paddingVertical: 10,
  },
  openPressed: { backgroundColor: colors.highlight },
  openText: {
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    fontWeight: "700",
  },
  overviewDot: { borderRadius: radii.pill, height: 8, width: 8 },
  overviewMore: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm, padding: 10 },
  overviewRow: { alignItems: "center", flexDirection: "row", gap: 8, minHeight: 38, paddingHorizontal: 12 },
  overviewRowMeta: { color: colors.textMuted, flexShrink: 1, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  overviewRowText: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  panel: { backgroundColor: colors.page, flex: 1 },
  pressed: { backgroundColor: colors.controlActive },
  row: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  rowLabel: { color: colors.text, flexGrow: 1, flexShrink: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  rowValue: { color: colors.textMuted, flexShrink: 3, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  spends: { gap: 10 },
});
