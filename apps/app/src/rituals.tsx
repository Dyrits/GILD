import {
  type MissionId,
  type Ritual,
  type RitualId,
  type RitualRunState,
  type RitualSchedule,
  startingModel,
} from "@gild/contracts";
import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { newRequestId, type ServiceClient } from "./client";
import { Toggle } from "./controls";
import { Emblem } from "./emblems";
import { harnessLabels, modelLabelOf } from "./formatting";
import { Menu } from "./pickers";
import { allMissions } from "./queries";
import {
  isTimeValid,
  nextRunLabelOf,
  runStateLabels,
  scheduleKindLabels,
  scheduleKinds,
  scheduleLabelOf,
  scheduleOfKind,
  weekdayLabelOf,
} from "./ritualLabels";
import { type Runner, RunnerPickers, useHarnesses } from "./runners";
import { EmptyBoard } from "./sketches";
import { styles } from "./styles";
import { colors, cut, fontSizes, fonts, ink, lift } from "./theme";
import { useServiceQuery } from "./useServiceQuery";
import { RealmChooser } from "./workspaces";

// Rituals in the interface: their own place, apart from the quests: a screen of cards, the form that makes or edits one,
// and its controls in the panel of its quest (rituals).

const messageOf = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

/** The Rituals, the latest first; they refetch when anything changes. */
export const useRituals = (client: ServiceClient) => useServiceQuery(client, { _tag: "ListRituals" }, "rituals").data;

const weekdays = ["0", "1", "2", "3", "4", "5", "6"] as const;
const monthDays = Array.from({ length: 28 }, (_, index) => String(index + 1));

const runStateColors = {
  Done: colors.successText,
  Failed: colors.dangerText,
  Interrupted: colors.textMuted,
  Underway: colors.accentText,
} as const satisfies Record<RitualRunState, string>;

/** Switches a Ritual on or off, keeping everything else as it is. */
const setRitualOn = (client: ServiceClient, ritual: Ritual, isOn: boolean) =>
  client.request({
    _tag: "UpdateRitual",
    fallbacks: ritual.fallbacks,
    instruction: ritual.instruction,
    isOn,
    primary: ritual.primary,
    ritualId: ritual.id,
    schedule: ritual.schedule,
    title: ritual.title,
  });

/** A word in a row of fields, such as the "at" between a day and a time. */
function Word({ text }: { text: string }) {
  return <Text style={local.word}>{text}</Text>;
}

/** One labelled part of the form, under a small gilt rule. */
function Part({ children, name }: { children: ReactNode; name: string }) {
  return (
    <View style={local.part}>
      <Text style={local.partName}>{name}</Text>
      {children}
    </View>
  );
}

/** When the Ritual runs, as a sentence of pickers: "Every week on Monday at 07:00". */
function ScheduleRow({ onChange, value }: { onChange: (schedule: RitualSchedule) => void; value: RitualSchedule }) {
  return (
    <View style={local.sentence}>
      <Menu
        accessibilityLabel="Schedule"
        label={(kind) => scheduleKindLabels[kind]}
        onChange={(kind) => onChange(scheduleOfKind(kind, value))}
        options={scheduleKinds}
        value={value._tag}
      />
      {value._tag === "Weekly" && (
        <>
          <Word text="on" />
          <Menu
            accessibilityLabel="Day of the week"
            label={(day) => weekdayLabelOf(Number(day))}
            onChange={(day) => onChange({ ...value, day: Number(day) })}
            options={weekdays}
            value={String(value.day) as (typeof weekdays)[number]}
          />
        </>
      )}
      {value._tag === "Monthly" && (
        <>
          <Word text="on day" />
          <Menu
            accessibilityLabel="Day of the month"
            label={(day) => day}
            onChange={(day) => onChange({ ...value, day: Number(day) })}
            options={monthDays}
            value={String(value.day)}
          />
        </>
      )}
      {value._tag === "Hourly" ? (
        <>
          <Word text="every" />
          <TextInput
            accessibilityLabel="Hours between runs"
            keyboardType="numeric"
            onChangeText={(text) => onChange({ ...value, hours: Number.parseInt(text, 10) || 0 })}
            style={[styles.input, local.small, (value.hours < 1 || value.hours > 168) && local.invalid]}
            value={value.hours === 0 ? "" : String(value.hours)}
          />
          <Word text="hours (1 to 168)" />
        </>
      ) : (
        <>
          <Word text="at" />
          <TextInput
            accessibilityLabel="Time of day"
            onChangeText={(time) => onChange({ ...value, time })}
            placeholder="07:00"
            placeholderTextColor={colors.placeholder}
            style={[styles.input, local.small, !isTimeValid(value.time) && local.invalid]}
            value={value.time}
          />
          <Word text="(24-hour)" />
        </>
      )}
    </View>
  );
}

/** Whether the schedule can be sent: a valid time, or hours within the allowed range. */
const isScheduleValid = (schedule: RitualSchedule) =>
  schedule._tag === "Hourly" ? schedule.hours >= 1 && schedule.hours <= 168 : isTimeValid(schedule.time);

/**
 * Makes a Ritual, or edits one: its title, instruction, schedule, the Companion it runs on, and the Companions it falls
 * back to, in order, when a run fails. A new Ritual gets a quest of its own, in a realm if one is chosen.
 */
export function RitualForm({
  client,
  onCancel,
  onDone,
  ritual,
}: {
  client: ServiceClient;
  onCancel: () => void;
  /** Called once saved, with the Ritual's quest. */
  onDone: (missionId: MissionId) => void;
  /** The Ritual to edit, or null to make one. */
  ritual: Ritual | null;
}) {
  const { data: harnesses } = useHarnesses(client);
  const { data: known } = useServiceQuery(client, allMissions.request, allMissions.key);
  const [title, setTitle] = useState(ritual?.title ?? "");
  const [instruction, setInstruction] = useState(ritual?.instruction ?? "");
  const [schedule, setSchedule] = useState<RitualSchedule>(ritual?.schedule ?? { _tag: "Daily", time: "07:00" });
  const [primary, setPrimary] = useState<Runner>(
    ritual?.primary ?? { accountId: null, effort: "default", harness: "claude", model: startingModel },
  );
  const [fallbacks, setFallbacks] = useState<ReadonlyArray<Runner>>(ritual?.fallbacks ?? []);
  const [isOn, setIsOn] = useState(ritual?.isOn ?? true);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const canSave = title.trim() !== "" && instruction.trim() !== "" && isScheduleValid(schedule) && !isSaving;
  const addFallback = () => {
    // The first harness other than the primary's, on its first listed model.
    const other = harnesses?.harnesses.find((candidate) => candidate.name !== primary.harness);
    setFallbacks([
      ...fallbacks,
      {
        accountId: null,
        effort: "default",
        harness: other?.name ?? "codex",
        model: other?.models[0]?.id ?? "default",
      },
    ]);
  };
  const save = () => {
    setIsSaving(true);
    setError(null);
    const saved =
      ritual === null
        ? client
            .request({
              _tag: "CreateRitual",
              fallbacks,
              instruction: instruction.trim(),
              primary,
              requestId: newRequestId(),
              schedule,
              title: title.trim(),
              workspacePath,
            })
            .then((created) => created.missionId)
        : client
            .request({
              _tag: "UpdateRitual",
              fallbacks,
              instruction: instruction.trim(),
              isOn,
              primary,
              ritualId: ritual.id,
              schedule,
              title: title.trim(),
            })
            .then(() => ritual.missionId);
    saved.then(onDone, (reason) => setError(messageOf(reason))).finally(() => setIsSaving(false));
  };
  return (
    <View style={local.form}>
      <View style={local.formHeading}>
        <Emblem name="moon" size={26} tint={colors.violet} />
        <Text style={local.formTitle}>{ritual === null ? "New Ritual" : "Edit Ritual"}</Text>
      </View>
      <Part name="Name">
        <TextInput
          accessibilityLabel="Ritual title"
          maxLength={80}
          onChangeText={setTitle}
          placeholder="Morning digest"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          value={title}
        />
      </Part>
      <Part name="Instruction, sent to its quest at each run">
        <TextInput
          accessibilityLabel="Ritual instruction"
          multiline
          numberOfLines={4}
          onChangeText={setInstruction}
          placeholder="Summarise what changed in the repository since yesterday."
          placeholderTextColor={colors.placeholder}
          style={[styles.input, local.instruction]}
          value={instruction}
        />
      </Part>
      <Part name="Runs">
        <ScheduleRow onChange={setSchedule} value={schedule} />
      </Part>
      <Part name="Companion">
        <View style={local.sentence}>
          <RunnerPickers harnesses={harnesses} isCompact={true} onChange={setPrimary} value={primary} />
        </View>
      </Part>
      <Part name="If a run fails, fall back to">
        {fallbacks.map((fallback, index) => (
          // A fallback has no identity but its place in the list.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <View key={index} style={local.sentence}>
            <Word text={index === 0 ? "first" : "then"} />
            <RunnerPickers
              harnesses={harnesses}
              isCompact={true}
              onChange={(next) => setFallbacks(fallbacks.map((current, other) => (other === index ? next : current)))}
              value={fallback}
            />
            <Pressable
              accessibilityLabel={`Remove fallback ${index + 1}`}
              accessibilityRole="button"
              onPress={() => setFallbacks(fallbacks.filter((_, other) => other !== index))}
            >
              <Text style={local.remove}>Remove</Text>
            </Pressable>
          </View>
        ))}
        {fallbacks.length < 5 && (
          <Pressable accessibilityRole="button" onPress={addFallback}>
            <Text style={styles.link}>+ Add a fallback Companion</Text>
          </Pressable>
        )}
      </Part>
      {ritual === null ? (
        <Part name="Realm">
          <RealmChooser
            missions={known?.missions ?? []}
            onChange={setWorkspacePath}
            onCreate={(realm) =>
              client
                .request({ _tag: "CreateRealm", crest: realm.crest, name: realm.name, path: realm.path })
                .then(() => setWorkspacePath(realm.path))
            }
            realms={known?.workspaces ?? []}
            value={workspacePath}
          />
        </Part>
      ) : (
        <View style={local.sentence}>
          <Toggle onValueChange={setIsOn} value={isOn} />
          <Text style={styles.body}>{isOn ? "On: runs on its schedule" : "Off: runs only when you run it"}</Text>
        </View>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <View style={local.sentence}>
        <Pressable
          accessibilityLabel={ritual === null ? "Create Ritual" : "Save Ritual"}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          disabled={!canSave}
          onPress={save}
          style={[styles.button, !canSave && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>{ritual === null ? "Create Ritual" : "Save"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.buttonSecondary}>
          <Text style={styles.buttonSecondaryText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Runs the Ritual now, showing the reason when it is refused. */
function RunNowButton({
  client,
  isUnderway,
  ritualId,
}: {
  client: ServiceClient;
  isUnderway: boolean;
  ritualId: RitualId;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={local.runNow}>
      <Pressable
        accessibilityLabel="Run now"
        accessibilityRole="button"
        accessibilityState={{ disabled: isUnderway }}
        disabled={isUnderway}
        onPress={() => {
          setError(null);
          client.request({ _tag: "RunRitual", ritualId }).catch((reason) => setError(messageOf(reason)));
        }}
        style={[local.runButton, isUnderway && styles.buttonDisabled]}
      >
        <Text style={local.runButtonText}>Run now</Text>
      </Pressable>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/** A Ritual's Companion and its fallbacks in a line, such as "Sonnet 5.5 · Claude Code · 1 fallback". */
const companionLineOf = (ritual: Ritual) =>
  [
    modelLabelOf(ritual.primary.model),
    harnessLabels[ritual.primary.harness],
    ...(ritual.fallbacks.length === 0
      ? []
      : [`${ritual.fallbacks.length} fallback${ritual.fallbacks.length === 1 ? "" : "s"}`]),
  ].join(" · ");

/** A Ritual as a card: its name, schedule, next and last run, Companion, and what can be done with it. */
function RitualCard({
  client,
  onEdit,
  onOpen,
  ritual,
}: {
  client: ServiceClient;
  onEdit: () => void;
  onOpen: () => void;
  ritual: Ritual;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={[local.card, !ritual.isOn && local.cardOff]}>
      <Pressable accessibilityRole="button" onPress={onOpen} style={local.cardTop}>
        <View style={local.seal}>
          <Emblem name="moon" size={26} tint={colors.goldHi} />
        </View>
        <View style={local.cardText}>
          <Text numberOfLines={2} style={local.cardTitle}>
            {ritual.title}
          </Text>
          <Text style={local.cardSchedule}>{scheduleLabelOf(ritual.schedule)}</Text>
        </View>
      </Pressable>
      <View style={local.facts}>
        <Text style={local.fact}>{nextRunLabelOf(ritual.isOn ? ritual.nextRunAt : null, Date.now())}</Text>
        {ritual.lastRunState !== null && (
          <Text style={local.fact}>
            Last run:{" "}
            <Text style={{ color: runStateColors[ritual.lastRunState] }}>{runStateLabels[ritual.lastRunState]}</Text>
          </Text>
        )}
        <Text style={local.fact}>{companionLineOf(ritual)}</Text>
      </View>
      <View style={local.actions}>
        <RunNowButton client={client} isUnderway={ritual.lastRunState === "Underway"} ritualId={ritual.id} />
        <View style={local.switch}>
          <Toggle
            onValueChange={(isOn) =>
              setRitualOn(client, ritual, isOn).then(
                () => setError(null),
                (reason) => setError(messageOf(reason)),
              )
            }
            value={ritual.isOn}
          />
          <Text style={local.fact}>{ritual.isOn ? "On" : "Off"}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onOpen}>
          <Text style={styles.link}>Open</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onEdit}>
          <Text style={styles.link}>Edit</Text>
        </Pressable>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/** The Rituals place: a button to make one, its form when open, and a card for each Ritual. */
export function RitualsScreen({
  client,
  onOpen,
}: {
  client: ServiceClient;
  /** Opens a Ritual's quest, where its runs happen. */
  onOpen: (missionId: MissionId) => void;
}) {
  const rituals = useRituals(client);
  // A Ritual being edited, a new one being made, or none.
  const [editing, setEditing] = useState<Ritual | "new" | null>(null);
  return (
    <View style={local.page}>
      <ScrollView contentContainerStyle={local.content}>
        <View style={local.header}>
          <View style={local.headerText}>
            <Text style={local.heading}>Rituals</Text>
            <Text style={local.subheading}>Standing orders that run by themselves, each in a quest of its own.</Text>
          </View>
          {editing === null && (
            <Pressable
              accessibilityLabel="New Ritual"
              accessibilityRole="button"
              onPress={() => setEditing("new")}
              style={styles.button}
            >
              <Text style={styles.buttonText}>+ New Ritual</Text>
            </Pressable>
          )}
        </View>
        {editing !== null && (
          <RitualForm
            client={client}
            key={editing === "new" ? "new" : editing.id}
            onCancel={() => setEditing(null)}
            onDone={(missionId) => {
              setEditing(null);
              if (editing === "new") onOpen(missionId);
            }}
            ritual={editing === "new" ? null : editing}
          />
        )}
        {rituals !== null && rituals.length === 0 && editing === null && (
          <EmptyBoard line="No Ritual yet. A Ritual sends an instruction to its own quest on a schedule." />
        )}
        <View style={local.grid}>
          {(rituals ?? []).map((ritual) => (
            <RitualCard
              client={client}
              key={ritual.id}
              onEdit={() => setEditing(ritual)}
              onOpen={() => onOpen(ritual.missionId)}
              ritual={ritual}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** The Ritual's controls in its quest's panel: its schedule, Run now, the switch, Edit, and Delete. */
export function RitualControls({ client, missionId }: { client: ServiceClient; missionId: MissionId }) {
  const { data: ritual } = useServiceQuery(client, { _tag: "ReadRitual", missionId }, `ritual:${missionId}`);
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (ritual === null) return null;
  if (isEditing) {
    return (
      <RitualForm
        client={client}
        onCancel={() => setIsEditing(false)}
        onDone={() => setIsEditing(false)}
        ritual={ritual}
      />
    );
  }
  const guard = (work: Promise<unknown>) =>
    work.then(
      () => setError(null),
      (reason) => setError(messageOf(reason)),
    );
  return (
    <View style={local.controls}>
      <Text style={local.cardSchedule}>Ritual · {scheduleLabelOf(ritual.schedule)}</Text>
      <Text style={local.fact}>
        {nextRunLabelOf(ritual.isOn ? ritual.nextRunAt : null, Date.now())}
        {ritual.lastRunState === null ? "" : ` · Last run: ${runStateLabels[ritual.lastRunState]}`}
      </Text>
      <Text style={local.fact}>{companionLineOf(ritual)}</Text>
      <View style={local.switch}>
        <Toggle onValueChange={(isOn) => guard(setRitualOn(client, ritual, isOn))} value={ritual.isOn} />
        <Text style={styles.body}>{ritual.isOn ? "On" : "Off"}</Text>
      </View>
      <RunNowButton client={client} isUnderway={ritual.lastRunState === "Underway"} ritualId={ritual.id} />
      <View style={local.switch}>
        <Pressable accessibilityRole="button" onPress={() => setIsEditing(true)}>
          <Text style={styles.link}>Edit</Text>
        </Pressable>
        {isConfirming ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => guard(client.request({ _tag: "DeleteRitual", ritualId: ritual.id }))}
          >
            <Text style={local.remove}>Confirm: delete the Ritual, keep the quest</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setIsConfirming(true)}>
            <Text style={local.remove}>Delete Ritual</Text>
          </Pressable>
        )}
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const local = StyleSheet.create({
  actions: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    ...ink,
    ...cut,
    ...lift,
    backgroundColor: colors.canvas,
    borderColor: colors.violet,
    borderStyle: "dashed",
    borderTopColor: colors.violet,
    borderTopWidth: 5,
    borderWidth: 1.5,
    gap: 12,
    maxWidth: "100%",
    padding: 16,
    width: 380,
  },
  cardOff: { opacity: 0.6 },
  cardSchedule: { color: colors.violet, fontFamily: fonts.hand, fontSize: 14, fontWeight: "700", letterSpacing: 0.6 },
  cardText: { flex: 1, gap: 2 },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.hand,
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  cardTop: { alignItems: "center", flexDirection: "row", gap: 12 },
  content: { gap: 18, paddingHorizontal: 28, paddingVertical: 20 },
  controls: { gap: 8, marginVertical: 10 },
  fact: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.lg },
  facts: { gap: 2 },
  form: {
    ...ink,
    ...cut,
    ...lift,
    alignSelf: "stretch",
    backgroundColor: colors.canvas,
    gap: 16,
    maxWidth: 760,
    padding: 22,
  },
  formHeading: { alignItems: "center", flexDirection: "row", gap: 10 },
  formTitle: { color: colors.text, fontFamily: fonts.hand, fontSize: 24, fontWeight: "700", letterSpacing: 0.5 },
  grid: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 18 },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "space-between",
  },
  headerText: { flexShrink: 1, gap: 4 },
  heading: {
    color: colors.onWood,
    fontFamily: fonts.hand,
    fontSize: 40,
    fontWeight: "700",
    letterSpacing: 2,
    lineHeight: 48,
    textShadowColor: "#000",
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 6,
    textTransform: "uppercase",
  },
  instruction: { minHeight: 90, textAlignVertical: "top" },
  invalid: { borderColor: colors.danger },
  page: { backgroundColor: colors.wood, flex: 1 },
  part: { borderTopColor: colors.border, borderTopWidth: 1, gap: 8, paddingTop: 10 },
  partName: { color: colors.textSecondary, fontFamily: fonts.hand, fontSize: 14, letterSpacing: 0.6 },
  remove: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "500" },
  runButton: { ...ink, ...cut, backgroundColor: colors.gold, paddingHorizontal: 14, paddingVertical: 6 },
  runButtonText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "700" },
  runNow: { alignItems: "flex-start", gap: 4 },
  seal: {
    alignItems: "center",
    backgroundColor: colors.leather,
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  sentence: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10 },
  small: { textAlign: "center", width: 76 },
  subheading: {
    color: colors.onWood,
    fontFamily: fonts.sans,
    fontSize: fontSizes.lg,
    fontStyle: "italic",
    opacity: 0.8,
  },
  switch: { alignItems: "center", flexDirection: "row", gap: 8 },
  word: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.base },
});
