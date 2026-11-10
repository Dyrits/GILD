import type { HarnessName, Message, MissionId, Skill, ThreadId } from "@gild/contracts";
import { Pressable, Text, View } from "react-native";
import { MessageImages } from "./attachmentViews";
import { ChipText } from "./chips";
import type { ServiceClient } from "./client";
import type { Entry, QuestLink } from "./entries";
import { clockOf, replyWriterOf } from "./formatting";
import { LoreChangeCard, LoreChangeLine } from "./lore";
import { Markdown } from "./markdown";
import { ProviderMark } from "./providerMarks";
import { QuestionCard, QuestionLine } from "./questions";
import { styles } from "./styles";
import { SuggestionCard, SuggestionLine } from "./suggestions";

const shortened = (title: string) => (title.length > 60 ? `${title.slice(0, 59)}…` : title);

/** Each sender's card. */
const cardStyles = {
  agent: styles.messageCardAgent,
  thread: styles.messageCardThread,
  user: styles.messageCardUser,
} satisfies Record<Message["sender"], unknown>;

/** The button that opens the quest or Ritual a reply led to: what happened to it above its title. */
function QuestButton({
  link,
  onOpenMission,
}: {
  link: Omit<QuestLink, "key">;
  onOpenMission: (missionId: MissionId) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${link.label}: ${link.title}`}
      accessibilityRole="button"
      onPress={() => onOpenMission(link.missionId)}
      style={({ pressed }) => [styles.questButton, pressed && styles.questButtonPressed]}
    >
      <Text style={styles.questButtonLabel}>{link.label} →</Text>
      <Text numberOfLines={2} style={styles.questButtonTitle}>
        {link.title}
      </Text>
    </Pressable>
  );
}

/**
 * A reply from the thread's agent: the provider's mark beside a parchment card that names the model and its time.
 * A draft has no time yet and is drawn faded.
 * The quests and Rituals the reply led to stand as buttons on its right, and beneath it where the window is too narrow.
 */
export function AgentReply({
  harness,
  isDraft = false,
  label,
  links = [],
  onOpenMission,
  text,
  time,
}: {
  harness: HarnessName;
  isDraft?: boolean;
  label: string;
  links?: ReadonlyArray<QuestLink>;
  onOpenMission?: (missionId: MissionId) => void;
  text: string;
  time: string | null;
}) {
  const hasLinks = links.length > 0 && onOpenMission !== undefined;
  const reply = (
    <View style={[styles.messageRow, isDraft && styles.draft, hasLinks && styles.messageRowLinked]}>
      <View style={styles.medallion}>
        <ProviderMark harness={harness} />
      </View>
      <View style={[styles.messageCard, styles.messageCardAgent]}>
        <View style={styles.senderHeader}>
          <Text style={styles.senderName}>{label}</Text>
          {time !== null && <Text style={styles.senderTime}>{time}</Text>}
        </View>
        <Markdown text={text} />
      </View>
    </View>
  );
  if (!hasLinks) return reply;
  return (
    <View style={styles.replyWithLinks}>
      {reply}
      <View style={styles.replyLinks}>
        {links.map((link) => (
          <QuestButton key={link.key} link={link} onOpenMission={onOpenMission} />
        ))}
      </View>
    </View>
  );
}

/** The label above a message: none for the owner's own unless it waits for the next turn. */
const senderLabelOf = (message: Message) => {
  if (message.sender === "user") return message.isQueued ? "Queued for the next turn" : null;
  return `${message.isResult ? "Result from" : "From"} "${shortened(message.fromTitle ?? "a quest")}"`;
};

/** One message: the agent's reply with its provider's mark, or the owner's and another thread's as a card. */
function MessageBubble({
  client,
  harness,
  links,
  message,
  onOpenMission,
  skills,
  workspacePath,
}: {
  client: ServiceClient;
  harness: HarnessName;
  links: ReadonlyArray<QuestLink>;
  message: Message;
  onOpenMission: (missionId: MissionId) => void;
  skills: ReadonlyArray<Skill>;
  workspacePath: string | null;
}) {
  // A reply keeps the provider and model that wrote it, whatever the thread runs on now (thread-handover); a
  // reply from before the harness was recorded is the thread's own.
  if (message.sender === "agent") {
    const writer = replyWriterOf(message, harness);
    return (
      <AgentReply
        harness={writer.harness}
        label={writer.label}
        links={links}
        onOpenMission={onOpenMission}
        text={message.text}
        time={clockOf(message.sentAt)}
      />
    );
  }
  const sender = senderLabelOf(message);
  return (
    <View style={[styles.messageRow, message.sender === "user" && styles.messageRowUser]}>
      <View style={[styles.messageCard, cardStyles[message.sender]]}>
        {/* The owner's own messages need no label, as in a chat; a queued one says it waits. */}
        {sender !== null && <Text style={styles.senderName}>{sender}</Text>}
        {message.sender === "user" ? (
          message.text === "" ? null : (
            <ChipText client={client} skills={skills} text={message.text} workspacePath={workspacePath} />
          )
        ) : (
          <Markdown text={message.text} />
        )}
        <MessageImages cards={message.attachments} client={client} />
      </View>
    </View>
  );
}

/** One conversation entry: an open question or suggestion as a card, a settled one as a line. */
export function EntryView({
  client,
  entry,
  harness,
  onOpenMission,
  onSelectThread,
  skills,
  workspacePath,
}: {
  client: ServiceClient;
  entry: Entry;
  /** The harness the thread runs on now: the mark of a reply that records none. */
  harness: HarnessName;
  /** The skills and workspace the owner's messages are read against, to draw what they named as chips. */
  skills: ReadonlyArray<Skill>;
  workspacePath: string | null;
  onOpenMission: (missionId: MissionId) => void;
  onSelectThread: (threadId: ThreadId) => void;
}) {
  if (entry._tag === "ThreadOpened") {
    const { thread } = entry;
    return (
      <View style={styles.questionLine}>
        <Pressable onPress={() => onSelectThread(thread.id)}>
          <Text style={styles.link}>
            {thread.isOpenedByAgent ? "Companion opened a side-quest" : "Opened a side-quest"}:{" "}
            {shortened(thread.title)}
          </Text>
        </Pressable>
      </View>
    );
  }
  if (entry._tag === "QuestLink")
    return (
      <View style={styles.replyLinks}>
        <QuestButton link={entry} onOpenMission={onOpenMission} />
      </View>
    );
  if (entry._tag === "BudgetEvent")
    return (
      <View style={styles.questionLine}>
        <Text style={styles.muted}>
          {entry.event.text} · {clockOf(entry.event.at)}
        </Text>
      </View>
    );
  if (entry._tag === "Handover")
    return (
      <View style={styles.questionLine}>
        <Text style={styles.muted}>
          {entry.handover.text} · {clockOf(entry.handover.at)}
        </Text>
      </View>
    );
  if (entry._tag === "LoreChange")
    return entry.change.status === "Awaiting" ? (
      <LoreChangeCard change={entry.change} client={client} />
    ) : (
      <LoreChangeLine change={entry.change} />
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
  return (
    <MessageBubble
      client={client}
      harness={harness}
      links={entry.links}
      message={entry.message}
      onOpenMission={onOpenMission}
      skills={skills}
      workspacePath={workspacePath}
    />
  );
}
