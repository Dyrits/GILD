import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { spanOf } from "../foundation/formatting";
import { countedOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { QuestionLine } from "../ui/questions";
import type { Step } from "./entries";
import { callTextOf } from "./stepLabels";

/** A turn's settled actions and reported tool calls, folded under "2 steps · 16s" and listed when opened. */
export function StepsGroup({ seconds, steps }: { seconds: number; steps: ReadonlyArray<Step> }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityLabel={`${countedOf(steps.length, "step")}, ${spanOf(seconds)}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen(!isOpen)}
        style={styles.stepsHeader}
      >
        <Text style={styles.stepsCount}>{countedOf(steps.length, "step")}</Text>
        <Text style={styles.muted}>{spanOf(seconds)}</Text>
        <Text style={styles.muted}>{isOpen ? "⌃" : "⌄"}</Text>
      </Pressable>
      {isOpen && (
        <View style={styles.stepsList}>
          {steps.map((step) =>
            step._tag === "Action" ? (
              <QuestionLine key={step.id} question={step.question} />
            ) : (
              <View key={step.id} style={styles.questionLine}>
                <Text style={styles.muted}>{callTextOf(step.activity, step.at)}</Text>
              </View>
            ),
          )}
        </View>
      )}
    </View>
  );
}
