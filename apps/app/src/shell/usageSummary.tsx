import type { UsageFilter, UsageReport } from "@iskios/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { countedOf } from "../foundation/labels";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Count } from "../ui/count";
import { handCursor, tooltipOf } from "../ui/pointer";
import { ProviderMark } from "../ui/providerMarks";
import { harnessColorOf } from "./usageColors";
import {
  compactCountOf,
  costBasisOf,
  exactCountOf,
  metricValueOf,
  ownTokensOf,
  shareCaptionOf,
  tokenTotalsOf,
  type UsageMetric,
  usageCostTextOf,
} from "./usageFormat";
import { allowanceLinesOf, harnessNameOf, isFilterChosen } from "./usageLabels";

/** The headline: the period's cost (or tokens), and how many quests, threads, and turns it comes from. */
export function UsageHeadline({ metric, report }: { metric: UsageMetric; report: UsageReport }) {
  const { amounts } = report;
  const tokens = ownTokensOf(amounts);
  const basis = costBasisOf(amounts);
  // An empty period has no tokens to count: it reads "No usage", as the cost does.
  const isTokens = metric === "Tokens" && amounts.turns > 0;
  return (
    <View style={local.headline}>
      <Text
        accessibilityLabel={isTokens ? `${exactCountOf(tokens)} tokens without cache reads` : undefined}
        accessibilityRole="header"
        style={local.total}
        {...(isTokens ? tooltipOf(exactCountOf(tokens)) : {})}
      >
        {isTokens ? compactCountOf(tokens) : usageCostTextOf(amounts)}
      </Text>
      <Text style={local.caption}>
        {[
          countedOf(report.quests, "quest"),
          countedOf(report.threads, "thread"),
          countedOf(amounts.turns, "turn"),
          ...(metric === "Cost" ? (basis === null ? [] : [`${basis} · USD`]) : ["tokens without cache reads"]),
        ].join(" · ")}
      </Text>
    </View>
  );
}

/**
 * The harnesses beside the headline, each with its share of the known cost and its tokens; choosing one narrows the
 * page to it, as choosing its row in the breakdown does. The list keeps the other harnesses in view to choose instead.
 */
export function HarnessList({
  filters,
  metric,
  onSelect,
  report,
}: {
  filters: ReadonlyArray<UsageFilter>;
  metric: UsageMetric;
  onSelect: (filter: UsageFilter, label: string) => void;
  report: UsageReport;
}) {
  const breakdown = report.breakdowns.find((candidate) => candidate.dimension === "Harness");
  if (breakdown === undefined) return null;
  return (
    <View style={{ gap: 6 }}>
      {breakdown.rows.map((row) => {
        const filter = { dimension: "Harness", key: row.key } as const;
        const label = harnessNameOf(row.harness);
        const tokens = ownTokensOf(row.amounts);
        return (
          <Pressable
            accessibilityLabel={`${label}: ${usageCostTextOf(row.amounts)}, ${compactCountOf(tokens)} tokens`}
            accessibilityRole="button"
            accessibilityState={{ selected: isFilterChosen(filters, filter) }}
            key={row.key}
            onPress={() => onSelect(filter, label)}
            style={[local.harness, handCursor, isFilterChosen(filters, filter) && local.harnessSelected]}
          >
            <View style={local.harnessLine}>
              <View style={[local.dot, { backgroundColor: harnessColorOf(row.harness) }]} />
              {row.harness !== null && <ProviderMark harness={row.harness} size={18} />}
              <Text style={local.harnessName}>{label}</Text>
              <Text style={local.harnessCost}>
                {metric === "Cost"
                  ? usageCostTextOf(row.amounts)
                  : compactCountOf(metricValueOf(row.amounts, "Tokens") ?? 0)}
              </Text>
            </View>
            <Count
              compact={shareCaptionOf(row, breakdown.total, metric)}
              style={local.caption}
              unit="tokens without cache reads"
              value={tokens}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/** One figure of the totals: its name above its shortened value, "No usage" for an empty period, "Unavailable" when not known. */
function Figure({
  isEmpty,
  label,
  unit = "tokens",
  value,
}: {
  isEmpty: boolean;
  label: string;
  unit?: string;
  value: number | null;
}) {
  return (
    <View style={local.figure}>
      <Text style={local.caption}>{label}</Text>
      {isEmpty ? (
        <Text style={[local.figureValue, local.unavailable]}>No usage</Text>
      ) : value === null ? (
        <Text style={[local.figureValue, local.unavailable]}>Unavailable</Text>
      ) : (
        <Count compact={compactCountOf(value)} style={local.figureValue} unit={unit} value={value} />
      )}
    </View>
  );
}

/**
 * The totals under the graph (budget-control, Reserves usage page): tokens without cache reads and processed with
 * them, the parts, and the messages sent and replies completed. Cached input is cache reads, which can outnumber the
 * rest because a conversation's context is read again with each turn. When every turn's token record is empty the
 * harness reported no counts, and the totals say so instead of showing zeros.
 */
export function UsageTotals({ report }: { report: UsageReport }) {
  const isEmpty = report.amounts.turns === 0;
  const areTokensUnreported = !isEmpty && report.gaps.emptyTokenTurns === report.amounts.turns;
  const totals = tokenTotalsOf(report.amounts.tokens);
  const figure = (value: number) => (areTokensUnreported ? null : value);
  return (
    <View style={local.figures}>
      <Figure isEmpty={isEmpty} label="Tokens without cache reads" value={figure(totals.withoutCacheReads)} />
      <Figure isEmpty={isEmpty} label="Processed tokens with cache reads" value={figure(totals.processed)} />
      <Figure isEmpty={isEmpty} label="Cached input" value={figure(totals.cachedInput)} />
      <Figure isEmpty={isEmpty} label="Uncached input" value={figure(totals.uncachedInput)} />
      <Figure isEmpty={isEmpty} label="Cache creation" value={figure(totals.cacheCreation)} />
      <Figure isEmpty={isEmpty} label="Output" value={figure(totals.output)} />
      <Figure isEmpty={false} label="User messages" unit="messages" value={report.messages?.user ?? null} />
      <Figure isEmpty={false} label="Assistant replies" unit="replies" value={report.messages?.assistant ?? null} />
    </View>
  );
}

const levelColors = { normal: colors.textSecondary, reached: colors.danger, warning: colors.warning } as const;

/** What the owner still has, beside what was used: the global budget, each account's budget, and the limits a plan reports. */
export function UsageAllowances({ client }: { client: ServiceClient }) {
  const { data: global } = useServiceQuery(client, { _tag: "ReadBudget", missionId: null }, "usage-global-budget");
  const { data: accounts } = useServiceQuery(client, { _tag: "ReadAccountBudgets" }, "usage-account-budgets");
  const { isGlobalBudgetSet, lines } = allowanceLinesOf(global, accounts ?? []);
  return (
    <View accessibilityLabel="Allowances" style={{ gap: 8 }}>
      {isGlobalBudgetSet === false && <Text style={local.caption}>No global budget is set.</Text>}
      {lines.map((line) => (
        <View key={line.key} style={local.allowance}>
          <Text style={local.allowanceName}>{line.name}</Text>
          <Text style={[local.allowanceText, { color: levelColors[line.level] }]}>{line.text}</Text>
        </View>
      ))}
    </View>
  );
}

const local = StyleSheet.create({
  allowance: { gap: 2 },
  allowanceName: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
  allowanceText: { fontFamily: fonts.sans, fontSize: fontSizes.md },
  caption: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md },
  dot: { borderRadius: radii.pill, height: 8, width: 8 },
  figure: { gap: 4, minWidth: 140 },
  figures: { columnGap: 28, flexDirection: "row", flexWrap: "wrap", rowGap: 16 },
  figureValue: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.xl, fontWeight: "500" },
  harness: { borderRadius: radii.md, gap: 3, padding: 8 },
  harnessCost: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "700" },
  harnessLine: { alignItems: "center", flexDirection: "row", gap: 8 },
  harnessName: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.base },
  harnessSelected: { backgroundColor: colors.controlActive },
  headline: { gap: 4 },
  total: { color: colors.text, fontFamily: fonts.sans, fontSize: 44, fontWeight: "700" },
  unavailable: { color: colors.textMuted },
});
