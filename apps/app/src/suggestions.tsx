import {
  type EffortChoice,
  EffortChoice as EffortChoices,
  type MissionId,
  type ModelChoice,
  ModelChoice as ModelChoices,
  type Suggestion,
  type SuggestionAnswer,
  type ThreadId,
} from "@openmission/contracts";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ServiceClient } from "./client";
import { Choice } from "./controls";
import { effortLabel, modelLabels } from "./formatting";
import { suggestionLabels } from "./labels";
import { styles } from "./styles";

/** The line a resolved suggestion leaves in its thread, opening where the request went. */
export function SuggestionLine({
  suggestion,
  onOpenMission,
  onSelectThread,
}: {
  suggestion: Suggestion;
  onOpenMission: (missionId: MissionId) => void;
  onSelectThread: (threadId: ThreadId) => void;
}) {
  if (suggestion.outcome === null) return null;
  const label = suggestionLabels[suggestion.outcome];
  const { targetMissionId, targetThreadId } = suggestion;
  const open =
    suggestion.outcome === "KeptAsAside"
      ? targetThreadId === null
        ? null
        : () => onSelectThread(targetThreadId)
      : targetMissionId === null
        ? null
        : () => onOpenMission(targetMissionId);
  return (
    <View style={styles.questionLine}>
      {open === null ? (
        <Text style={styles.muted}>{label}</Text>
      ) : (
        <Pressable onPress={open}>
          <Text style={styles.link}>
            {label}: {suggestion.targetTitle}
            {suggestion.isAutomatic ? " (opened without asking)" : ""}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** An open suggestion: where the owner sends a message the thread found off topic. */
export function SuggestionCard({ client, suggestion }: { client: ServiceClient; suggestion: Suggestion }) {
  const [model, setModel] = useState<ModelChoice>(suggestion.model);
  const [effort, setEffort] = useState<EffortChoice>(suggestion.effort);
  const [error, setError] = useState<string | null>(null);
  const send = (answer: SuggestionAnswer) =>
    client.request({ _tag: "AnswerSuggestion", answer, suggestionId: suggestion.id }).then(
      () => setError(null),
      (reason: Error) => setError(reason.message),
    );
  return (
    <View style={styles.question}>
      <Text style={styles.questionText}>This message seems off this mission's topic. Where should it go?</Text>
      <Text style={styles.body}>{suggestion.text}</Text>
      {suggestion.matches.map((match) => (
        <Pressable
          key={match.missionId}
          onPress={() => send({ _tag: "Continue", missionId: match.missionId })}
          style={styles.answer}
        >
          <Text style={styles.answerText}>
            Continue in "{match.title}" · {match.state}
          </Text>
        </Pressable>
      ))}
      <View style={styles.details}>
        <Pressable
          onPress={() => send({ _tag: "NewMission", effort, model })}
          style={[styles.answer, styles.answerPrimary]}
        >
          <Text style={[styles.answerText, styles.answerTextPrimary]}>Open as new mission "{suggestion.title}"</Text>
        </Pressable>
        <Choice label={(m) => modelLabels[m]} onChange={setModel} options={ModelChoices.literals} value={model} />
        <Choice label={effortLabel} onChange={setEffort} options={EffortChoices.literals} value={effort} />
      </View>
      <Pressable onPress={() => send({ _tag: "Aside" })} style={styles.answer}>
        <Text style={styles.answerText}>Keep as aside</Text>
      </Pressable>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
