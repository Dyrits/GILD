import type { UsageDimension, UsageFilter, UsagePeriod } from "@iskios/contracts";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Choice } from "../ui/pickers";
import { BreakdownTable, BreakdownTabs, RecordsTable } from "./usageBreakdown";
import { UsageChart } from "./usageChart";
import { Estimates, FilterChips, RangeFields } from "./usageControls";
import { metricNames, startedTextOf, type UsageMetric, updatedTextOf } from "./usageFormat";
import { type ChosenFilter, dayLabelOf, noticeOf } from "./usageLabels";
import {
  periodOfChoice,
  periodOfRange,
  type RangeChoice,
  rangeChoiceOf,
  rangeChoices,
  toggledFiltersOf,
} from "./usageScale";
import { HarnessList, UsageAllowances, UsageHeadline, UsageTotals } from "./usageSummary";

const metrics: ReadonlyArray<UsageMetric> = ["Cost", "Tokens"];

/**
 * The Reserves usage page (budget-control, Reserves usage page): what Iskios's turns used, divided by harness,
 * Companion (model), realm, and quest, over the last 7 or 30 days or a range, as cost or tokens. Choosing a row, a
 * harness, or a day narrows the totals and the turn records to it, and leaves the other rows in view to choose instead.
 */
export function UsageScreen({ client }: { client: ServiceClient }) {
  const [period, setPeriod] = useState<UsagePeriod>({ _tag: "Days", days: 30 });
  const [isCustom, setIsCustom] = useState(false);
  const [range, setRange] = useState({ from: "", to: "" });
  const [metric, setMetric] = useState<UsageMetric>("Cost");
  const [dimension, setDimension] = useState<UsageDimension>("Harness");
  const [filters, setFilters] = useState<ReadonlyArray<ChosenFilter>>([]);
  const { data, error } = useServiceQuery(
    client,
    { _tag: "ReadUsage", filters: filters.map(({ dimension, key }) => ({ dimension, key })), period },
    `usage:${JSON.stringify({ filters: filters.map(({ dimension, key }) => [dimension, key]), period })}`,
  );
  // A refused read leaves the report of the period before on hand; it is not shown under the period that was refused.
  const report = error === null ? data : null;
  const choose = (choice: RangeChoice) => {
    setIsCustom(choice === "Custom");
    // The custom days start as the days on show, so the owner edits a range rather than writing one.
    if (choice === "Custom" && report !== null) setRange({ from: report.period.firstDay, to: report.period.lastDay });
    if (choice !== "Custom") setPeriod(periodOfChoice(choice));
  };
  const typeRange = (from: string, to: string) => {
    setRange({ from, to });
    const next = periodOfRange(from, to);
    if (next !== null) setPeriod(next);
  };
  const select = (filter: UsageFilter, label: string) =>
    setFilters((current) => toggledFiltersOf(current, { ...filter, label }));
  const breakdown = report?.breakdowns.find((candidate) => candidate.dimension === dimension);
  const notice = report === null ? null : noticeOf(report.gaps);
  return (
    <View style={local.page}>
      <ScrollView contentContainerStyle={local.content}>
        {error !== null && <Text style={local.invalid}>{error}</Text>}
        {notice !== null && (
          <View accessibilityLabel="Partial data" style={local.notice}>
            <Text style={local.noticeText}>{notice}</Text>
          </View>
        )}
        <View style={local.controls}>
          <Choice<UsageMetric>
            accessibilityLabel="Measure"
            label={(option) => option}
            onChange={setMetric}
            options={metrics}
            value={metric}
          />
          <Choice<RangeChoice>
            accessibilityLabel="Period"
            label={(option) => option}
            onChange={choose}
            options={rangeChoices}
            value={rangeChoiceOf(period, isCustom)}
          />
          {isCustom && <RangeFields from={range.from} onChange={typeRange} to={range.to} />}
        </View>
        {report !== null && (
          <>
            <FilterChips
              filters={filters}
              onClear={(filter) => setFilters((current) => toggledFiltersOf(current, filter))}
              onClearAll={() => setFilters([])}
            />
            <View style={local.top}>
              <View style={local.summary}>
                <UsageHeadline metric={metric} report={report} />
                <HarnessList filters={filters} metric={metric} onSelect={select} report={report} />
              </View>
              <View style={local.chart}>
                <View style={local.chartTitle}>
                  <Text style={local.heading}>Daily {metricNames[metric]}</Text>
                  <Pressable accessibilityRole="button" onPress={() => setDimension("Day")}>
                    <Text style={local.link}>View daily data</Text>
                  </Pressable>
                </View>
                <UsageChart
                  days={report.days}
                  metric={metric}
                  onSelectDay={(day) => select({ dimension: "Day", key: day }, dayLabelOf(day))}
                  selectedDay={filters.find((filter) => filter.dimension === "Day")?.key ?? null}
                />
              </View>
            </View>
            <Text style={local.heading}>Totals</Text>
            <UsageTotals report={report} />
            <Text style={local.heading}>Breakdown</Text>
            <BreakdownTabs onChange={setDimension} value={dimension} />
            {breakdown !== undefined && (
              <BreakdownTable breakdown={breakdown} filters={filters} metric={metric} onSelect={select} />
            )}
            {filters.length > 0 && (
              <>
                <Text style={local.heading}>Turn records</Text>
                <RecordsTable hiddenCount={report.records.hiddenCount} rows={report.records.rows} />
              </>
            )}
            <Text style={local.heading}>Allowances</Text>
            <UsageAllowances client={client} />
            <Text style={local.caption}>
              {report.startedAt === null
                ? "No usage has been collected yet."
                : `Collection started ${startedTextOf(report.startedAt)} · Updated ${updatedTextOf(report.updatedAt ?? report.startedAt)}`}
            </Text>
            <Estimates />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const local = StyleSheet.create({
  caption: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md },
  chart: { flex: 2, gap: 8, minWidth: 320 },
  chartTitle: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  content: { alignSelf: "center", gap: 20, maxWidth: 1160, paddingHorizontal: 28, paddingVertical: 20, width: "100%" },
  controls: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 12 },
  heading: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.xl, fontWeight: "700" },
  invalid: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.md },
  link: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.md },
  notice: { backgroundColor: colors.canvas, borderRadius: radii.lg, paddingHorizontal: 16, paddingVertical: 14 },
  noticeText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.md },
  page: { backgroundColor: colors.page, flex: 1 },
  summary: { flex: 1, gap: 20, minWidth: 300 },
  top: { columnGap: 32, flexDirection: "row", flexWrap: "wrap", rowGap: 24 },
});
