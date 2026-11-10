import {
  type MissionId,
  type Ritual,
  type RitualCard,
  type RitualId,
  type RitualSchedule,
  startingModel,
} from "@gild/contracts";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { newRequestId, type ServiceClient } from "./client";
import { Toggle } from "./controls";
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
import { styles } from "./styles";
import { colors, fonts } from "./theme";
import { useServiceQuery } from "./useServiceQuery";
import { RealmChooser } from "./workspaces";

// Rituals in the interface: the form that makes or edits one, its mark on a board card, and its controls in the quest's panel.

const messageOf = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

const weekdays = ["0", "1", "2", "3", "4", "5", "6"] as const;
const monthDays = Array.from({ length: 28 }, (_, index) => String(index + 1));

/** One row of a form: a name over its field. */
function Field({ children, name }: { children: React.ReactNode; name: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldName}>{name}</Text>
      {children}
    </View>
  );
}

/** When the Ritual runs: a preset, then the time, day, or hours it needs. */
function ScheduleFields({ onChange, value }: { onChange: (schedule: RitualSchedule) => void; value: RitualSchedule }) {
  return (
    <View style={styles.fields}>
      <Field name="Schedule">
        <Menu
          accessibilityLabel="Schedule"
          isField
          label={(kind) => scheduleKindLabels[kind]}
          onChange={(kind) => onChange(scheduleOfKind(kind, value))}
          options={scheduleKinds}
          value={value._tag}
        />
      </Field>
      {value._tag === "Weekly" && (
        <Field name="Day">
          <Menu
            accessibilityLabel="Day of the week"
            isField
            label={(day) => weekdayLabelOf(Number(day))}
            onChange={(day) => onChange({ ...value, day: Number(day) })}
            options={weekdays}
            value={String(value.day) as (typeof weekdays)[number]}
          />
        </Field>
      )}
      {value._tag === "Monthly" && (
        <Field name="Day of the month">
          <Menu
            accessibilityLabel="Day of the month"
            isField
            label={(day) => day}
            onChange={(day) => onChange({ ...value, day: Number(day) })}
            options={monthDays}
            value={String(value.day)}
          />
        </Field>
      )}
      {value._tag === "Hourly" ? (
        <Field name="Every how many hours (1 to 168)">
          <TextInput
            accessibilityLabel="Hours between runs"
            keyboardType="numeric"
            onChangeText={(text) => onChange({ ...value, hours: Number.parseInt(text, 10) || 0 })}
            style={styles.input}
            value={value.hours === 0 ? "" : String(value.hours)}
          />
        </Field>
      ) : (
        <Field name="At (24-hour time, such as 07:00)">
          <TextInput
            accessibilityLabel="Time of day"
            onChangeText={(time) => onChange({ ...value, time })}
            placeholder="07:00"
            placeholderTextColor={colors.placeholder}
            style={[styles.input, !isTimeValid(value.time) && local.invalid]}
            value={value.time}
          />
        </Field>
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
      <Text style={styles.heading}>{ritual === null ? "New Ritual" : "Edit Ritual"}</Text>
      <View style={styles.fields}>
        <Field name="Title">
          <TextInput
            accessibilityLabel="Ritual title"
            maxLength={80}
            onChangeText={setTitle}
            placeholder="Morning digest"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            value={title}
          />
        </Field>
        <Field name="Instruction, sent to the quest at each run">
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
        </Field>
        <ScheduleFields onChange={setSchedule} value={schedule} />
        <Text style={styles.label}>Companion</Text>
        <RunnerPickers harnesses={harnesses} isCompact={false} onChange={setPrimary} value={primary} />
        <Text style={styles.label}>Fallback Companions, tried in order when a run fails</Text>
        {fallbacks.map((fallback, index) => (
          // A fallback has no identity but its place in the list.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <View key={index} style={local.fallback}>
            <View style={styles.inlineRow}>
              <Text style={styles.fieldName}>Fallback {index + 1}</Text>
              <Pressable
                accessibilityLabel={`Remove fallback ${index + 1}`}
                accessibilityRole="button"
                onPress={() => setFallbacks(fallbacks.filter((_, other) => other !== index))}
              >
                <Text style={styles.link}>Remove</Text>
              </Pressable>
            </View>
            <RunnerPickers
              harnesses={harnesses}
              isCompact={false}
              onChange={(next) => setFallbacks(fallbacks.map((current, other) => (other === index ? next : current)))}
              value={fallback}
            />
          </View>
        ))}
        {fallbacks.length < 5 && (
          <Pressable accessibilityRole="button" onPress={addFallback} style={styles.buttonSecondary}>
            <Text style={styles.buttonSecondaryText}>Add a fallback Companion</Text>
          </Pressable>
        )}
        {ritual === null ? (
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
        ) : (
          <View style={styles.inlineRow}>
            <Toggle onValueChange={setIsOn} value={isOn} />
            <Text style={styles.body}>{isOn ? "On: runs on its schedule" : "Off: runs only when you run it"}</Text>
          </View>
        )}
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <View style={styles.inlineRow}>
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
        style={[styles.buttonSecondary, isUnderway && styles.buttonDisabled]}
      >
        <Text style={styles.buttonSecondaryText}>Run now</Text>
      </Pressable>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/** What a Ritual's card on the board shows beyond a quest's: its schedule, next run, last run, and Run now. */
export function RitualMark({ client, ritual }: { client: ServiceClient; ritual: RitualCard }) {
  return (
    <View style={local.mark}>
      <Text style={local.markSchedule}>{scheduleLabelOf(ritual.schedule)}</Text>
      <Text style={local.markLine}>
        {nextRunLabelOf(ritual.isOn ? ritual.nextRunAt : null, Date.now())}
        {ritual.lastRunState === null ? "" : ` · Last run: ${runStateLabels[ritual.lastRunState]}`}
      </Text>
      <RunNowButton client={client} isUnderway={ritual.lastRunState === "Underway"} ritualId={ritual.id} />
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
      <Text style={local.markSchedule}>Ritual · {scheduleLabelOf(ritual.schedule)}</Text>
      <Text style={local.markLine}>
        {nextRunLabelOf(ritual.isOn ? ritual.nextRunAt : null, Date.now())}
        {ritual.lastRunState === null ? "" : ` · Last run: ${runStateLabels[ritual.lastRunState]}`}
      </Text>
      <Text style={local.markLine}>
        {ritual.fallbacks.length === 0
          ? "No fallback Companion"
          : `Falls back to ${ritual.fallbacks.length} other Companion${ritual.fallbacks.length === 1 ? "" : "s"}`}
      </Text>
      <View style={styles.inlineRow}>
        <Toggle
          onValueChange={(isOn) =>
            guard(
              client.request({
                _tag: "UpdateRitual",
                fallbacks: ritual.fallbacks,
                instruction: ritual.instruction,
                isOn,
                primary: ritual.primary,
                ritualId: ritual.id,
                schedule: ritual.schedule,
                title: ritual.title,
              }),
            )
          }
          value={ritual.isOn}
        />
        <Text style={styles.body}>{ritual.isOn ? "On" : "Off"}</Text>
      </View>
      <RunNowButton client={client} isUnderway={ritual.lastRunState === "Underway"} ritualId={ritual.id} />
      <View style={styles.inlineRow}>
        <Pressable accessibilityRole="button" onPress={() => setIsEditing(true)}>
          <Text style={styles.link}>Edit</Text>
        </Pressable>
        {isConfirming ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => guard(client.request({ _tag: "DeleteRitual", ritualId: ritual.id }))}
          >
            <Text style={[styles.link, { color: colors.dangerText }]}>Confirm: delete the Ritual, keep the quest</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setIsConfirming(true)}>
            <Text style={[styles.link, { color: colors.dangerText }]}>Delete Ritual</Text>
          </Pressable>
        )}
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const local = StyleSheet.create({
  controls: { gap: 8, marginVertical: 10 },
  fallback: { borderColor: colors.border, borderLeftWidth: 3, gap: 8, paddingLeft: 10 },
  form: { backgroundColor: colors.canvas, borderColor: colors.gold, borderWidth: 1.5, gap: 14, padding: 16 },
  instruction: { minHeight: 90, textAlignVertical: "top" },
  invalid: { borderColor: colors.danger },
  mark: { gap: 4, marginTop: 4 },
  markLine: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 14 },
  markSchedule: { color: colors.violet, fontFamily: fonts.hand, fontSize: 14, fontWeight: "700", letterSpacing: 0.6 },
  runNow: { alignItems: "flex-start", gap: 4 },
});
