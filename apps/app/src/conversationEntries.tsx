import type { Message, MissionId, ThreadId } from "@canopy/contracts";
import { Pressable, Text, View } from "react-native";
import type { ServiceClient } from "./client";
import type { Entry } from "./entries";
import { clockOf } from "./formatting";
import { IntelChangeCard, IntelChangeLine } from "./intel";
import { QuestionCard, QuestionLine } from "./questions";
import { styles } from "./styles";
import { SuggestionCard, SuggestionLine } from "./suggestions";

const shortened = (title: string) => (title.length > 60 ? `${title.slice(0, 59)}…` : title);

/** Each sender's bubble. */
const senderStyles = {
  agent: styles.fromAgent,
  thread: styles.fromThread,
  user: styles.fromUser,
} satisfies Record<Message["sender"], unknown>;

/** The label above a message: none for the owner's own unless it waits for the next turn. */
const senderLabelOf = (message: Message) => {
  if (message.sender === "user") return message.isQueued ? "Queued for the next turn" : null;
  if (message.sender === "agent") return "Agent";
  return `${message.isResult ? "Result from" : "From"} "${shortened(message.fromTitle ?? "a thread")}"`;
};

/** One message, labelled by its sender: the owner, the thread's agent, or another thread. */
function MessageBubble({ message }: { message: Message }) {
  const sender = senderLabelOf(message);
  return (
    <View style={[styles.message, senderStyles[message.sender]]}>
      {/* The owner's own messages need no label, as in a chat; a queued one says it waits. */}
      {sender !== null && <Text style={styles.sender}>{sender}</Text>}
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
  if (entry._tag === "ThreadOpened") {
    const { thread } = entry;
    return (
      <View style={styles.questionLine}>
        <Pressable onPress={() => onSelectThread(thread.id)}>
          <Text style={styles.link}>
            {thread.isOpenedByAgent ? "Agent opened beneath" : "Opened beneath"}: {shortened(thread.title)}
          </Text>
        </Pressable>
      </View>
    );
  }
  if (entry._tag === "BudgetEvent")
    return (
      <View style={styles.questionLine}>
        <Text style={styles.muted}>
          {entry.event.text} · {clockOf(entry.event.at)}
        </Text>
      </View>
    );
  if (entry._tag === "IntelChange")
    return entry.change.status === "Awaiting" ? (
      <IntelChangeCard change={entry.change} client={client} />
    ) : (
      <IntelChangeLine change={entry.change} />
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
