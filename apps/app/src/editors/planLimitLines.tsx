import { StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { meterLevelOf, planLimitTextOf } from "../foundation/labels";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";

const levelColors = { normal: colors.textMuted, reached: colors.danger, warning: colors.warning } as const;

/**
 * The plan limits each subscription's harness reports, as the rail shows them beside the reserves: one line per window,
 * orange from 80% and red at 100%. An account whose harness reports none shows nothing here (its Charter row says
 * "Limits not reported"), and nothing is shown before a reading arrives.
 */
export function PlanLimitLines({ client }: { client: ServiceClient }) {
  const { data: budgets } = useServiceQuery(client, { _tag: "ReadAccountBudgets" }, "plan-limits");
  const reported =
    budgets?.filter((budget) => budget.planLimits !== null && budget.planLimits.windows.length > 0) ?? [];
  if (reported.length === 0) return null;
  return (
    <View style={local.lines}>
      {reported.map((budget) => (
        <View key={`${budget.harness}:${budget.accountId ?? ""}`}>
          <Text style={local.name}>{budget.label === "This computer" ? budget.harness : budget.label}</Text>
          {budget.planLimits?.windows.map((window) => (
            <Text
              key={window.label}
              style={[local.line, { color: levelColors[meterLevelOf(window.usedPercent, 100)] }]}
            >
              {planLimitTextOf(window)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const local = StyleSheet.create({
  line: { fontFamily: fonts.sans, fontSize: fontSizes.sm },
  lines: { gap: 6, paddingTop: 6 },
  name: {
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    fontWeight: "700",
    textTransform: "capitalize",
  },
});
