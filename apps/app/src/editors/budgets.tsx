import {
  type BudgetLimits,
  type BudgetPeriod,
  BudgetPeriod as BudgetPeriods,
  type BudgetStop,
  type BudgetUse,
  type MissionId,
} from "@iskios/contracts";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { Emblem, type EmblemName } from "../foundation/emblems";
import { timeOf } from "../foundation/formatting";
import {
  budgetUseTextOf,
  consumptionDetailsOf,
  meterLevelOf,
  raisedLimitsOf,
  reserveOf,
  usedTextOf,
} from "../foundation/labels";
import { styles } from "../foundation/styles";
import { colors, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Choice } from "../ui/pickers";

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

/** What each limit is called in the rail, and the color of its full bar: tokens are Mana, cost is Gold. */
const reserveKinds = {
  cost: { color: colors.warning, emblem: "gem", name: "Gold" },
  tokens: { color: colors.accent, emblem: "flask", name: "Mana" },
} as const satisfies Record<string, { color: string; emblem: EmblemName; name: string }>;

/**
 * The rail's reserves: one row per set limit, its name and what is left above a bar that drains as the budget is
 * spent, turning orange from 80% spent and red when spent. Only what Iskios counts is shown, not the harnesses' plans.
 */
export function ReserveRows({ use }: { use: BudgetUse }) {
  return (
    <View style={{ gap: 8 }}>
      {(["tokens", "cost"] as const).map((unit) => {
        const limit = use.limits[unit];
        if (limit === null) return null;
        const spent = use.spent[unit];
        const level = meterLevelOf(spent, limit);
        const color = level === "normal" ? reserveKinds[unit].color : levelColors[level];
        const { fraction, text } = reserveOf(unit, spent, limit);
        return (
          <View
            accessibilityLabel={`Reserve ${reserveKinds[unit].name}`}
            key={unit}
            style={{ alignItems: "center", flexDirection: "row", gap: 8 }}
          >
            <Emblem name={reserveKinds[unit].emblem} size={22} tint={reserveKinds[unit].color} />
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.onGround, fontFamily: fonts.sans, fontSize: 16 }}>
                  {reserveKinds[unit].name}
                </Text>
                <Text style={{ color: colors.onGround, fontFamily: fonts.sans, fontSize: 15 }}>{text}</Text>
              </View>
              <View
                style={{
                  backgroundColor: colors.ground,
                  borderColor: colors.edge,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  height: 10,
                  overflow: "hidden",
                  padding: 1,
                }}
              >
                <View
                  style={{ backgroundColor: color, borderRadius: radii.pill, flex: 1, width: `${fraction * 100}%` }}
                />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
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
      (reason) => setError(messageOf(reason)),
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

/** The quick raises of an account's budget: +25%, +50%, and double, as the quest's budget offers them (budget-control). */
function AccountRaises({
  client,
  onError,
  stop,
}: {
  client: ServiceClient;
  onError: (message: string | null) => void;
  stop: BudgetStop;
}) {
  const { data: budgets } = useServiceQuery(client, { _tag: "ReadAccountBudgets" }, `account-stop:${stop.id}`);
  const budget = budgets?.find(
    (candidate) => candidate.harness === stop.account?.harness && candidate.accountId === stop.account?.accountId,
  );
  if (budget === undefined) return null;
  const raises = [
    ["+25%", 1.25],
    ["+50%", 1.5],
    ["Double", 2],
  ] as const;
  return (
    <>
      {raises.map(([label, factor]) => (
        <Pressable
          key={label}
          onPress={() =>
            client
              .request({
                _tag: "SetAccountBudget",
                accountId: budget.accountId,
                harness: budget.harness,
                limits: raisedLimitsOf(budget.limits, factor),
                period: budget.period,
                since: budget.period === null ? budget.since : null,
              })
              .then(
                () => onError(null),
                (reason) => onError(messageOf(reason)),
              )
          }
          style={[styles.answer, styles.answerPrimary]}
        >
          <Text style={[styles.answerText, styles.answerTextPrimary]}>Raise budget {label}</Text>
        </Pressable>
      ))}
    </>
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
  const isAccount = stop.scope === "Account";
  const answer = (request: Parameters<ServiceClient["request"]>[0]) =>
    client.request(request).then(
      () => setError(null),
      (reason) => setError(messageOf(reason)),
    );
  return (
    <View style={styles.question}>
      <Text style={styles.questionText}>
        {isGlobal
          ? "The global budget is reached. All running quests and side-quests stopped."
          : isAccount
            ? `The budget of ${stop.accountLabel ?? "this account"} is reached. Its running quests and side-quests stopped.`
            : "This quest's budget is reached. Its running work stopped."}
      </Text>
      <Text style={styles.muted}>Reached {timeOf(stop.reachedAt)}</Text>
      <View style={styles.chips}>
        {isAccount ? (
          <AccountRaises client={client} onError={setError} stop={stop} />
        ) : (
          <Pressable onPress={onRaise} style={[styles.answer, styles.answerPrimary]}>
            <Text style={[styles.answerText, styles.answerTextPrimary]}>Raise budget</Text>
          </Pressable>
        )}
        {isAccount && (
          <Pressable onPress={() => answer({ _tag: "SwitchAtBudget", stopId: stop.id })} style={styles.answer}>
            <Text style={styles.answerText}>Switch to a backup Companion</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() =>
            client.request({ _tag: "StopAtBudget", stopId: stop.id }).then(
              () => setError(null),
              (reason) => setError(messageOf(reason)),
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
        ? Promise.reject(new Error("The Workshop is still loading."))
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
            <Text style={styles.muted}>No limit. Used {usedTextOf(data.consumption)}.</Text>
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
            <Text style={styles.error}>Reached: raise the limit below to let the stopped work carry on.</Text>
          )}
          <Text style={styles.label}>Limits</Text>
          <BudgetEditor key={JSON.stringify(data.limits)} limits={data.limits} onSave={saveLimits} />
          <Text style={styles.label}>{missionId === null ? "By quest" : "By quest / side-quest"}</Text>
          {data.parts.length === 0 && <Text style={styles.muted}>Nothing spent yet.</Text>}
          {data.parts.map((part) => (
            <View key={part.id} style={styles.toggle}>
              <Text numberOfLines={1} style={[styles.body, styles.flex]}>
                {part.title}
              </Text>
              <Text style={styles.muted}>{usedTextOf(part.consumption)}</Text>
            </View>
          ))}
          {consumptionDetailsOf(data.consumption) !== "" && (
            <Text style={styles.muted}>{consumptionDetailsOf(data.consumption)}</Text>
          )}
          <Text style={styles.label}>By harness</Text>
          {data.byHarness.map((part) => (
            <View key={part.id} style={styles.toggle}>
              <Text numberOfLines={1} style={[styles.body, styles.flex]}>
                {part.title}
              </Text>
              <Text style={styles.muted}>{usedTextOf(part.consumption)}</Text>
            </View>
          ))}
          <Text style={styles.label}>By model</Text>
          {data.byModel.map((part) => (
            <View key={part.id} style={styles.toggle}>
              <Text numberOfLines={1} style={[styles.body, styles.flex]}>
                {part.title}
              </Text>
              <Text style={styles.muted}>{usedTextOf(part.consumption)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
