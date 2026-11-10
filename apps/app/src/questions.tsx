import type { Answer, Question, QuestionOutcome } from "@gild/contracts";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { messageOf, type ServiceClient } from "./client";
import { clockOf } from "./formatting";
import { styles } from "./styles";

const outcomeLabels = {
  Allowed: "Allowed",
  AllowedAutomatically: "Ran",
  AllowedByMessage: "Allowed by your message",
  AllowedByPermission: "Allowed by a standing permission",
  AlwaysAllowed: "Always allowed",
  Denied: "Denied",
  Discarded: "Discarded",
  Withdrawn: "Withdrawn",
} as const satisfies Record<QuestionOutcome, string>;

const lineLength = 80;

/** The first line of a command or target, cut to fit a short line; Show details keeps the whole. */
const shortDetailOf = (details: string) => {
  const [first = ""] = details.trim().split("\n");
  return first.length > lineLength || first !== details.trim() ? `${first.slice(0, lineLength).trimEnd()}…` : first;
};

/** The short line an answered or withdrawn question, or an action run without one, leaves in its thread. */
export function QuestionLine({ question }: { question: Question }) {
  const parts = [
    question.outcome === null ? "Open" : outcomeLabels[question.outcome],
    // An action run without a question is told in plain words; its command stays in the history.
    question.outcome === "AllowedAutomatically" ? question.summary.replace(/\.$/, "") : shortDetailOf(question.details),
    question.resolvedAt === null ? null : clockOf(question.resolvedAt),
    question.device,
  ].filter((part) => part !== null);
  return (
    <View style={styles.questionLine}>
      <Text style={styles.muted}>{parts.join(" · ")}</Text>
      {question.message !== null && <Text style={styles.muted}>{question.message}</Text>}
    </View>
  );
}

function AnswerButton({
  label,
  onPress,
  isPrimary = false,
}: {
  label: string;
  onPress: () => void;
  isPrimary?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.answer, isPrimary && styles.answerPrimary]}>
      <Text style={[styles.answerText, isPrimary && styles.answerTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

/** An open question with its buttons; outside its thread it also names its mission. */
export function QuestionCard({
  client,
  question,
  onOpenMission,
}: {
  client: ServiceClient;
  question: Question;
  onOpenMission?: () => void;
}) {
  const [isShowingDetails, setIsShowingDetails] = useState(false);
  const [denial, setDenial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const send = (answer: Answer, message: string | null = null) =>
    client.request({ _tag: "AnswerQuestion", answer, message, questionId: question.id }).then(
      () => setError(null),
      (reason) => setError(messageOf(reason)),
    );
  return (
    <View style={styles.question}>
      {onOpenMission !== void 0 && (
        <Pressable onPress={onOpenMission}>
          <Text numberOfLines={1} style={styles.link}>
            {question.missionTitle}
          </Text>
        </Pressable>
      )}
      <Text style={styles.questionText}>{question.summary}</Text>
      <Pressable onPress={() => setIsShowingDetails(!isShowingDetails)}>
        <Text style={styles.link}>{isShowingDetails ? "Hide details" : "Show details"}</Text>
      </Pressable>
      {isShowingDetails && (
        <View style={styles.details}>
          <Text style={styles.code}>{question.details}</Text>
          {question.permission !== null && (
            <Text style={styles.muted}>
              Always allow saves: {question.permission}
              {question.pattern === null ? "" : ` (${question.pattern})`}
            </Text>
          )}
        </View>
      )}
      <View style={styles.chips}>
        <AnswerButton isPrimary label="Allow" onPress={() => send("Allow")} />
        <AnswerButton label="Always allow" onPress={() => send("AlwaysAllow")} />
        <AnswerButton label="Deny" onPress={() => send("Deny", denial.trim() === "" ? null : denial)} />
      </View>
      <TextInput
        onChangeText={setDenial}
        placeholder="Optional, with Deny: why, or what to do instead"
        style={styles.input}
        value={denial}
      />
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
