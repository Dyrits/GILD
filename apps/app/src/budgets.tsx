import {
  type BudgetLimits,
  type BudgetPeriod,
  BudgetPeriod as BudgetPeriods,
  type BudgetStop,
  type BudgetUse,
  type MissionId,
} from "@canopy/contracts";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { ServiceClient } from "./client";
import { Choice } from "./controls";
import { timeOf } from "./formatting";
import { budgetUseTextOf, meterLevelOf, raisedLimitsOf, tokenCountOf } from "./labels";
import { styles } from "./styles";
import { colors } from "./theme";
import { useServiceQuery } from "./useServiceQuery";

const levelColors = { normal: colors.textMuted, reached: colors.danger, warning: colors.warning } as const;

/** One meter per set limit, orange from 80% and red at 100%; nothing when the budget is empty. */
export function BudgetMeters({ use, onPress }: { use: BudgetUse; onPress?: () => void }) {
  const meters = (["cost", "tokens"] as const).flatMap((unit) => {
    const limit = use.limits[unit];
    return limit === null ? [] : [{ limit, spent: use.spent[unit], unit }];
  });
  if (meters.length === 0) return null;
  const content = (
    <View style={{ gap: 2 }}>
      {meters.map(({ limit, spent, unit }) => {
        const color = levelColors[meterLevelOf(spent, limit)];
        return (
          <View
            accessibilityLabel={`Budget ${unit}`}
            key={unit}
            style={{ alignItems: "center", flexDirection: "row", gap: 6 }}
          >
            <View
              style={{
                backgroundColor: colors.controlActive,
                borderRadius: 3,
                height: 6,
                overflow: "hidden",
                width: 80,
              }}
            >
              <View style={{ backgroundColor: color, height: 6, width: `${Math.min(100, (spent / limit) * 100)}%` }} />
            </View>
            <Text style={[styles.muted, { color, fontSize: 12 }]}>{budgetUseTextOf(unit, spent, limit)}</Text>
          </View>
        );
      })}
    </View>
  );
  return onPress === undefined ? content : <Pressable onPress={onPress}>{content}</Pressable>;
}

const numberOrNull = (text: string) => {
  const value = Number(text.replace(/[$,\s]/g, ""));
  return text.trim() === "" || !Number.isFinite(value) ? null : value;
};

/** The limits with their fields, the quick raises, and removal; saving hands the new limits over. */
export function BudgetEditor({
  limits,
  onSave,
  saveLabel = "Save budget",
}: {
  limits: BudgetLimits;
  onSave: (limits: BudgetLimits) => Promise<unknown>;
  saveLabel?: string;
}) {
  const [cost, setCost] = useState(limits.cost === null ? "" : String(limits.cost));
  const [tokens, setTokens] = useState(limits.tokens === null ? "" : String(limits.tokens));
  const [error, setError] = useState<string | null>(null);
  const save = (next: BudgetLimits) =>
    onSave(next).then(
      () => {
        setCost(next.cost === null ? "" : String(next.cost));
        setTokens(next.tokens === null ? "" : String(next.tokens));
        setError(null);
      },
      (reason: Error) => setError(reason.message),
    );
  const typed = (): BudgetLimits => ({ cost: numberOrNull(cost), tokens: numberOrNull(tokens) });
  const hasLimits = limits.cost !== null || limits.tokens !== null;
  return (
    <View style={styles.section}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          accessibilityLabel="Cost limit"
          onChangeText={setCost}
          placeholder="Cost limit ($), empty for none"
          style={[styles.input, styles.flex]}
          value={cost}
        />
        <TextInput
          accessibilityLabel="Token limit"
          onChangeText={setTokens}
          placeholder="Token limit, empty for none"
          style={[styles.input, styles.flex]}
          value={tokens}
        />
      </View>
      <View style={styles.chips}>
        <Pressable onPress={() => save(typed())} style={styles.button}>
          <Text style={styles.buttonText}>{saveLabel}</Text>
        </Pressable>
        {hasLimits &&
          (
            [
              ["+25%", 1.25],
              ["+50%", 1.5],
              ["Double", 2],
            ] as const
          ).map(([label, factor]) => (
            <Pressable key={label} onPress={() => save(raisedLimitsOf(limits, factor))} style={styles.buttonSecondary}>
              <Text style={styles.buttonSecondaryText}>{label}</Text>
            </Pressable>
          ))}
        {hasLimits && (
          <Pressable onPress={() => save({ cost: null, tokens: null })} style={styles.buttonSecondary}>
            <Text style={styles.buttonSecondaryText}>Remove limit</Text>
          </Pressable>
        )}
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/** The reached-budget question: Raise budget opens the budget window; Stop (or Stop all) keeps the threads stopped. */
export function BudgetStopCard({
  client,
  stop,
  onRaise,
}: {
  client: ServiceClient;
  stop: BudgetStop;
  onRaise: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const isGlobal = stop.scope === "Global";
  return (
    <View style={styles.question}>
      <Text style={styles.questionText}>
        {isGlobal
          ? "The global budget is reached. Every running thread stopped."
          : "This mission's budget is reached. Its running threads stopped."}
      </Text>
      <Text style={styles.muted}>Reached {timeOf(stop.reachedAt)}</Text>
      <View style={styles.chips}>
        <Pressable onPress={onRaise} style={[styles.answer, styles.answerPrimary]}>
          <Text style={[styles.answerText, styles.answerTextPrimary]}>Raise budget</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            client.request({ _tag: "StopAtBudget", stopId: stop.id }).then(
              () => setError(null),
              (reason: Error) => setError(reason.message),
            )
          }
          style={styles.answer}
        >
          <Text style={styles.answerText}>{isGlobal ? "Stop all" : "Stop"}</Text>
        </Pressable>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/**
 * The budget window: used of limit, the split by thread (a mission) or by mission (global), the period,
 * and the limits to change. The global budget is saved in Settings.
 */
export function BudgetScreen({
  client,
  missionId,
  title,
  onBack,
}: {
  client: ServiceClient;
  missionId: MissionId | null;
  title: string;
  onBack: () => void;
}) {
  const { data, error } = useServiceQuery(client, { _tag: "ReadBudget", missionId }, `budget:${missionId ?? "global"}`);
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const saveLimits = (limits: BudgetLimits) =>
    missionId !== null
      ? client.request({ _tag: "SetMissionBudget", limits, missionId })
      : settings === null
        ? Promise.reject(new Error("Settings are still loading."))
        : client.request({ _tag: "UpdateSettings", settings: { ...settings, globalBudget: limits } });
  const savePeriod = (period: BudgetPeriod) =>
    settings === null
      ? Promise.resolve()
      : client.request({ _tag: "UpdateSettings", settings: { ...settings, globalBudgetPeriod: period } });
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>← Back</Text>
        </Pressable>
        <Text style={[styles.heading, styles.flex]}>{title}</Text>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {data !== null && (
        <View style={styles.section}>
          {data.limits.cost === null && data.limits.tokens === null ? (
            <Text style={styles.muted}>
              No limit. Spent ${data.spent.cost.toFixed(2)} and {tokenCountOf(data.spent.tokens)} tokens.
            </Text>
          ) : (
            <BudgetMeters use={data} />
          )}
          {data.period !== null && (
            <View style={styles.section}>
              <Text style={styles.label}>Period</Text>
              <Choice label={(p) => p} onChange={savePeriod} options={BudgetPeriods.literals} value={data.period} />
              {data.nextStart !== null && <Text style={styles.muted}>Starts over {timeOf(data.nextStart)}</Text>}
            </View>
          )}
          {data.stop !== null && (
            <Text style={styles.error}>Reached: raise the limit below to let the stopped threads carry on.</Text>
          )}
          <Text style={styles.label}>Limits</Text>
          <BudgetEditor key={JSON.stringify(data.limits)} limits={data.limits} onSave={saveLimits} />
          <Text style={styles.label}>{missionId === null ? "By mission" : "By thread"}</Text>
          {data.parts.length === 0 && <Text style={styles.muted}>Nothing spent yet.</Text>}
          {data.parts.map((part) => (
            <View key={part.id} style={styles.toggle}>
              <Text numberOfLines={1} style={[styles.body, styles.flex]}>
                {part.title}
              </Text>
              <Text style={styles.muted}>
                {tokenCountOf(part.spent.tokens)} tokens
                {part.spent.cost > 0 ? ` · $${part.spent.cost.toFixed(2)}` : ""}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
