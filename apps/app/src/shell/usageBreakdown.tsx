import type { UsageBreakdown, UsageDimension, UsageFilter, UsageRecord } from "@iskios/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { Count } from "../ui/count";
import { handCursor, isHovered } from "../ui/pointer";
import { ProviderMark } from "../ui/providerMarks";
import {
  compactCountOf,
  dollarsTextOf,
  ownTokensOf,
  shareTextOf,
  tokenTotalsOf,
  type UsageMetric,
  usageCostTextOf,
} from "./usageFormat";
import { dimensionNames, isFilterChosen, recordDetailOf, rowLabelOf } from "./usageLabels";

/** The breakdowns the page offers, in order. Skills are not among them: their usage cannot yet be attributed reliably (budget-control, Reserves usage page). */
const breakdownTabs: ReadonlyArray<UsageDimension> = ["Harness", "Model", "Realm", "Quest", "Account", "Day"];

/** The tabs of the breakdown: choosing one divides the same usage another way. */
export function BreakdownTabs({
  onChange,
  value,
}: {
  onChange: (dimension: UsageDimension) => void;
  value: UsageDimension;
}) {
  return (
    <View accessibilityRole="tablist" style={local.tabs}>
      {breakdownTabs.map((dimension) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: dimension === value }}
          key={dimension}
          onPress={() => onChange(dimension)}
          style={[local.tab, dimension === value && local.tabSelected]}
        >
          <Text style={[local.tabText, dimension === value && local.tabTextSelected]}>{dimensionNames[dimension]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * One breakdown as a table: each row's name, cost, share of the breakdown's total, and tokens without cache reads.
 * Choosing a row narrows the whole page to it, naming it for its chip; choosing it again lets go.
 */
export function BreakdownTable({
  breakdown,
  filters,
  metric,
  onSelect,
}: {
  breakdown: UsageBreakdown;
  filters: ReadonlyArray<UsageFilter>;
  metric: UsageMetric;
  onSelect: (filter: UsageFilter, label: string) => void;
}) {
  const { dimension, rows } = breakdown;
  if (rows.length === 0) return <Text style={local.empty}>No usage in this period.</Text>;
  return (
    <View accessibilityRole="list">
      <View style={local.headerRow}>
        <Text style={[local.header, local.nameCell]}>{dimensionNames[dimension]}</Text>
        <Text style={[local.header, local.numberCell]}>Cost</Text>
        <Text style={[local.header, local.numberCell]}>Share</Text>
        <Text accessibilityLabel="Tokens without cache reads" style={[local.header, local.numberCell]}>
          Tokens
        </Text>
      </View>
      {rows.map((row) => {
        const filter = { dimension, key: row.key } as const;
        const label = rowLabelOf(dimension, row);
        const hasNoPrice = row.amounts.turns > 0 && row.amounts.pricedTurns === 0;
        return (
          <Pressable
            accessibilityLabel={`${label}: ${usageCostTextOf(row.amounts)}, ${shareTextOf(row, breakdown.total, metric)}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isFilterChosen(filters, filter) }}
            key={row.key}
            onPress={() => onSelect(filter, label)}
            style={(state) => [
              local.row,
              handCursor,
              (isFilterChosen(filters, filter) || isHovered(state)) && local.rowActive,
            ]}
          >
            <View style={[local.nameCell, local.nameRow]}>
              {row.harness !== null && <ProviderMark harness={row.harness} size={16} />}
              <Text numberOfLines={1} style={local.cell}>
                {label}
              </Text>
            </View>
            <Text style={[local.cell, local.numberCell, hasNoPrice && local.unavailable]}>
              {usageCostTextOf(row.amounts)}
            </Text>
            <Text style={[local.cell, local.numberCell, hasNoPrice && metric === "Cost" && local.unavailable]}>
              {shareTextOf(row, breakdown.total, metric)}
            </Text>
            <Count
              compact={compactCountOf(ownTokensOf(row.amounts))}
              style={[local.cell, local.numberCell]}
              value={ownTokensOf(row.amounts)}
            />
          </Pressable>
        );
      })}
      {breakdown.hiddenRows > 0 && <Text style={local.hint}>{breakdown.hiddenRows} smaller rows are not shown.</Text>}
    </View>
  );
}

/** One turn behind the selected usage: when, where, on what, and what it used. */
function RecordRow({ record }: { record: UsageRecord }) {
  const where = [
    ...new Set([record.questName ?? "Deleted quest", record.threadTitle ?? ""].filter((part) => part !== "")),
  ];
  const tokens = tokenTotalsOf(record.tokens).withoutCacheReads;
  return (
    <View style={local.row}>
      <Text numberOfLines={1} style={[local.cell, local.timeCell]}>
        {new Date(record.endedAt).toLocaleString("en-US", {
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          month: "short",
        })}
      </Text>
      <View style={local.nameCell}>
        <Text numberOfLines={1} style={local.cell}>
          {where.join(" · ")}
        </Text>
        <Text numberOfLines={1} style={local.detail}>
          {recordDetailOf(record)}
        </Text>
      </View>
      <Text style={[local.cell, local.numberCell, record.cost === null && local.unavailable]}>
        {record.cost === null ? "Unavailable" : dollarsTextOf(record.cost, !record.isReported)}
      </Text>
      <Count compact={compactCountOf(tokens)} style={[local.cell, local.numberCell]} value={tokens} />
    </View>
  );
}

/** The turns behind the filters, newest first; the rest are counted. */
export function RecordsTable({ hiddenCount, rows }: { hiddenCount: number; rows: ReadonlyArray<UsageRecord> }) {
  return (
    <View accessibilityLabel="Turn records">
      <View style={local.headerRow}>
        <Text style={[local.header, local.timeCell]}>When</Text>
        <Text style={[local.header, local.nameCell]}>Quest · side-quest</Text>
        <Text style={[local.header, local.numberCell]}>Cost</Text>
        <Text accessibilityLabel="Tokens without cache reads" style={[local.header, local.numberCell]}>
          Tokens
        </Text>
      </View>
      {rows.map((record) => (
        <RecordRow key={record.turnId} record={record} />
      ))}
      {hiddenCount > 0 && <Text style={local.hint}>{hiddenCount} older turns are not shown.</Text>}
    </View>
  );
}

const local = StyleSheet.create({
  cell: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base },
  detail: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  empty: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md, paddingVertical: 12 },
  header: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md },
  headerRow: { alignItems: "center", flexDirection: "row", gap: 12, paddingBottom: 8, paddingHorizontal: 8 },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  nameCell: { flex: 1, minWidth: 0 },
  nameRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  numberCell: { textAlign: "right", width: 96 },
  row: {
    alignItems: "center",
    borderRadius: radii.md,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 40,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  rowActive: { backgroundColor: colors.controlActive },
  tab: { borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 6 },
  tabSelected: { backgroundColor: colors.controlActive },
  tabs: {
    alignSelf: "flex-start",
    backgroundColor: colors.canvas,
    borderColor: colors.edge,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    padding: 3,
  },
  tabText: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md },
  tabTextSelected: { color: colors.text },
  timeCell: { width: 120 },
  unavailable: { color: colors.textMuted },
});
