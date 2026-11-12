import type { UsageDay } from "@iskios/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { handCursor, tooltipOf } from "../ui/pointer";
import { harnessColorOf } from "./usageColors";
import { axisTextOf, metricNames, metricValueOf, type UsageMetric } from "./usageFormat";
import { dayCaptionOf, dayLabelOf } from "./usageLabels";
import { chartScaleOf } from "./usageScale";

/** The stack's order, top to bottom. */
const stackOrder = ["claude", "codex", "opencode", null] as const;

const plotHeight = 180;
const axisWidth = 72;

/** The labels of the days under the graph: at most this many, evenly spaced. */
const maxDayLabels = 6;

/**
 * The daily graph (budget-control, Reserves usage page): one bar for each local day, stacked by harness, with a value
 * axis from zero and the days under it. A day with turns but no known cost has a grey cap, not an empty column, so it is
 * not mistaken for a day with no usage; choosing a bar selects that day.
 */
export function UsageChart({
  days,
  metric,
  onSelectDay,
  selectedDay,
}: {
  days: ReadonlyArray<UsageDay>;
  metric: UsageMetric;
  onSelectDay: (day: string) => void;
  selectedDay: string | null;
}) {
  const bars = days.map((day) => {
    const segments = stackOrder.flatMap((harness) => {
      const entry = day.byHarness.find((candidate) => candidate.harness === harness);
      const value = entry === undefined ? 0 : (metricValueOf(entry.amounts, metric) ?? 0);
      return value > 0 ? [{ harness, value }] : [];
    });
    return {
      caption: dayCaptionOf(day, metric),
      day: day.day,
      segments,
      total: segments.reduce((sum, segment) => sum + segment.value, 0),
    };
  });
  const scale = chartScaleOf(Math.max(0, ...bars.map((bar) => bar.total)));
  const labelStep = Math.ceil(days.length / maxDayLabels);
  const isEmpty = days.every((day) => day.byHarness.length === 0);
  return (
    <View accessibilityLabel={`Daily ${metricNames[metric]}`} style={local.chart}>
      <View style={local.plotRow}>
        <View style={local.axis}>
          {scale.ticks.map((tick) => (
            <Text key={tick} style={[local.axisText, { bottom: (tick / scale.top) * plotHeight - 7 }]}>
              {axisTextOf(tick, metric)}
            </Text>
          ))}
        </View>
        <View style={local.plot}>
          {scale.ticks.map((tick) => (
            <View key={tick} style={[local.gridline, { bottom: (tick / scale.top) * plotHeight }]} />
          ))}
          <View style={local.bars}>
            {bars.map((bar) => (
              <Pressable
                accessibilityLabel={bar.caption.text}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedDay === bar.day }}
                key={bar.day}
                onPress={() => onSelectDay(bar.day)}
                style={[local.bar, handCursor, selectedDay === bar.day && local.barSelected]}
                {...tooltipOf(bar.caption.text)}
              >
                <View style={local.stack}>
                  {bar.caption.hasGap && <View style={local.gap} />}
                  {bar.segments.map((segment) => (
                    <View
                      key={String(segment.harness)}
                      style={{
                        backgroundColor: harnessColorOf(segment.harness),
                        height: Math.max(2, (segment.value / scale.top) * plotHeight),
                      }}
                    />
                  ))}
                </View>
              </Pressable>
            ))}
          </View>
          {isEmpty && <Text style={local.empty}>No usage in this period.</Text>}
        </View>
      </View>
      <View style={local.daysRow}>
        <View style={{ width: axisWidth }} />
        <View style={local.days}>
          {days.map((day, index) => (
            <View key={day.day} style={local.dayCell}>
              {index % labelStep === 0 && <Text style={local.dayText}>{dayLabelOf(day.day).toUpperCase()}</Text>}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  axis: { height: plotHeight, width: axisWidth },
  axisText: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    position: "absolute",
    right: 12,
  },
  bar: { alignItems: "center", flex: 1, justifyContent: "flex-end" },
  barSelected: { backgroundColor: colors.controlActive, borderRadius: radii.sm },
  bars: { alignItems: "flex-end", flexDirection: "row", gap: 2, height: plotHeight },
  chart: { gap: 6 },
  dayCell: { alignItems: "center", flex: 1 },
  days: { flex: 1, flexDirection: "row", gap: 2 },
  daysRow: { flexDirection: "row" },
  dayText: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    // The label is wider than its day: it is centred on it and overflows into the empty cells beside.
    textAlign: "center",
    width: 60,
  },
  empty: {
    alignSelf: "center",
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    position: "absolute",
    top: plotHeight / 2 - 8,
  },
  // Turns on this day have no known cost: a thin grey cap on the column.
  gap: { backgroundColor: colors.borderStrong, height: 3, marginBottom: 1 },
  gridline: { backgroundColor: colors.border, height: 1, left: 0, position: "absolute", right: 0 },
  plot: { flex: 1, height: plotHeight },
  plotRow: { flexDirection: "row" },
  stack: { maxWidth: 24, width: "70%" },
});
