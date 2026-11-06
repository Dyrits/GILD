import type {
  BudgetEvent,
  Message,
  MissionDetail,
  MissionId,
  Question,
  Suggestion,
  ThreadId,
} from "@openmission/contracts";
import { Text, View } from "react-native";
import type { ServiceClient } from "./client";
import { QuestionCard, QuestionLine } from "./questions";
import { styles } from "./styles";
import { SuggestionCard, SuggestionLine } from "./suggestions";

/** One entry of a thread's conversation, with the key the list keeps it by. */
export type Entry = { key: string; at: number } & (
  | { _tag: "Message"; message: Message }
  | { _tag: "Question"; question: Question }
  | { _tag: "Suggestion"; suggestion: Suggestion }
  | { _tag: "BudgetEvent"; event: BudgetEvent }
);

/** Messages, questions, off-topic suggestions, and budget lines in the order they happened. */
export const entriesOf = (detail: MissionDetail): Array<Entry> =>
  [
    ...detail.messages.map((message): Entry => ({ _tag: "Message", at: message.sentAt, key: message.id, message })),
    ...detail.questions.map(
      (question): Entry => ({ _tag: "Question", at: question.askedAt, key: question.id, question }),
    ),
    ...detail.suggestions.map(
      (suggestion): Entry => ({ _tag: "Suggestion", at: suggestion.askedAt, key: suggestion.id, suggestion }),
    ),
    ...detail.budgetEvents.map((event): Entry => ({ _tag: "BudgetEvent", at: event.at, event, key: event.id })),
  ].sort((a, b) => a.at - b.at);

const shortened = (title: string) => (title.length > 60 ? `${title.slice(0, 59)}…` : title);

/** One message, labelled by its sender: the owner, the thread's agent, or another thread. */
function MessageBubble({ message }: { message: Message }) {
  const sender =
    message.sender === "user"
      ? message.isQueued
        ? "You · Queued for the next turn"
        : "You"
      : message.sender === "agent"
        ? "Agent"
        : `${message.isResult ? "Result from" : "From"} "${shortened(message.fromTitle ?? "a thread")}"`;
  const style =
    message.sender === "user" ? styles.fromUser : message.sender === "agent" ? styles.fromAgent : styles.fromThread;
  return (
    <View style={[styles.message, style]}>
      <Text style={styles.sender}>{sender}</Text>
      <Text style={styles.body}>{message.text}</Text>
    </View>
  );
}

/** One conversation entry: an open question or suggestion as a card, a settled one as a line. */
export function EntryView({
  client,
  entry,
  onOpenMission,
  onSelectThread,
}: {
  client: ServiceClient;
  entry: Entry;
  onOpenMission: (missionId: MissionId) => void;
  onSelectThread: (threadId: ThreadId) => void;
}) {
  if (entry._tag === "BudgetEvent")
    return (
      <View style={styles.questionLine}>
        <Text style={styles.muted}>
          {entry.event.text} · {new Date(entry.event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    );
  if (entry._tag === "Suggestion")
    return entry.suggestion.outcome === null ? (
      <SuggestionCard client={client} suggestion={entry.suggestion} />
    ) : (
      <SuggestionLine onOpenMission={onOpenMission} onSelectThread={onSelectThread} suggestion={entry.suggestion} />
    );
  if (entry._tag === "Question")
    return entry.question.outcome === null ? (
      <QuestionCard client={client} question={entry.question} />
    ) : (
      <QuestionLine question={entry.question} />
    );
  return <MessageBubble message={entry.message} />;
}
