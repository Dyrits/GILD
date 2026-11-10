import type { HarnessName, Message, MissionId, Skill, ThreadId } from "@gild/contracts";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MessageImages } from "./attachmentViews";
import { ChipText } from "./chips";
import type { ServiceClient } from "./client";
import { Emblem } from "./emblems";
import type { Entry, QuestLink, Step } from "./entries";
import { clockOf, replyWriterOf, spanOf } from "./formatting";
import { LoreChangeCard, LoreChangeLine } from "./lore";
import { Markdown } from "./markdown";
import { ProviderMark } from "./providerMarks";
import { QuestionCard, QuestionLine } from "./questions";
import { styles } from "./styles";
import { SuggestionCard, SuggestionLine } from "./suggestions";
import { TerminalMessage } from "./terminalMessage";
import { terminalSnapshotOf } from "./terminalSnapshot";
import { colors } from "./theme";

const shortened = (title: string) => (title.length > 60 ? `${title.slice(0, 59)}…` : title);

/** Each sender's card. */
const cardStyles = {
  agent: styles.messageCardAgent,
  thread: styles.messageCardThread,
  user: styles.messageCardUser,
} satisfies Record<Message["sender"], unknown>;

/** The small button at a card's top right corner that opens the quest or Ritual the card speaks of. */
function QuestButton({
  link,
  onOpenMission,
}: {
  link: Pick<QuestLink, "label" | "missionId" | "title">;
  onOpenMission: (missionId: MissionId) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${link.label}: ${link.title}`}
      accessibilityRole="button"
      onPress={() => onOpenMission(link.missionId)}
      style={({ pressed }) => [styles.cardCornerButton, pressed && styles.questButtonPressed]}
    >
      <Emblem name="sword" tint={colors.goldHi} />
    </Pressable>
  );
}

/**
 * A reply from the thread's agent: the provider's mark beside a parchment card that names the model and its time.
 * A draft has no time yet and is drawn faded.
 */
export function AgentReply({
  harness,
  isDraft = false,
  label,
  text,
  time,
}: {
  harness: HarnessName;
  isDraft?: boolean;
  label: string;
  text: string;
  time: string | null;
}) {
  return (
    <View style={[styles.messageRow, isDraft && styles.draft]}>
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
}

/** While a thread works: its provider's mark and the step it is on, in place of lines of updates. */
export function WorkingIndicator({ harness, label }: { harness: HarnessName; label: string }) {
  return (
    <View style={styles.stepsHeader}>
      <ProviderMark harness={harness} />
      <Text style={styles.stepText}>{label}</Text>
    </View>
  );
}

/** A turn's settled actions, folded under "2 steps · 16s" and listed when opened. */
function StepsGroup({ seconds, steps }: { seconds: number; steps: ReadonlyArray<Step> }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityLabel={`${steps.length === 1 ? "1 step" : `${steps.length} steps`}, ${spanOf(seconds)}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen(!isOpen)}
        style={styles.stepsHeader}
      >
        <Text style={styles.stepsCount}>{steps.length === 1 ? "1 step" : `${steps.length} steps`}</Text>
        <Text style={styles.muted}>{spanOf(seconds)}</Text>
        <Text style={styles.muted}>{isOpen ? "⌃" : "⌄"}</Text>
      </Pressable>
      {isOpen && (
        <View style={styles.stepsList}>
          {steps.map((step) => (
            <QuestionLine key={step.id} question={step.question} />
          ))}
        </View>
      )}
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
  fromQuest,
  harness,
  message,
  onOpenMission,
  skills,
  workspacePath,
}: {
  client: ServiceClient;
  /** The quest a report came from, which its card opens by a small button at its corner. */
  fromQuest: MissionId | null;
  harness: HarnessName;
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
      <AgentReply harness={writer.harness} label={writer.label} text={message.text} time={clockOf(message.sentAt)} />
    );
  }
  const sender = senderLabelOf(message);
  const terminal = message.sender === "user" ? terminalSnapshotOf(message.text) : null;
  return (
    <View style={[styles.messageRow, message.sender === "user" && styles.messageRowUser]}>
      <View style={[styles.messageCard, cardStyles[message.sender], fromQuest !== null && styles.cardWithCorner]}>
        {/* The owner's own messages need no label, as in a chat; a queued one says it waits. */}
        {sender !== null && <Text style={styles.senderName}>{sender}</Text>}
        {message.sender === "user" ? (
          terminal !== null ? (
            <View style={{ gap: 10 }}>
              {terminal.before !== "" && (
                <ChipText client={client} skills={skills} text={terminal.before} workspacePath={workspacePath} />
              )}
              <TerminalMessage cwd={terminal.cwd} output={terminal.output} />
              {terminal.after !== "" && (
                <ChipText client={client} skills={skills} text={terminal.after} workspacePath={workspacePath} />
              )}
            </View>
          ) : message.text === "" ? null : (
            <ChipText client={client} skills={skills} text={message.text} workspacePath={workspacePath} />
          )
        ) : (
          <Markdown text={message.text} />
        )}
        <MessageImages cards={message.attachments} client={client} />
        {fromQuest !== null && (
          <QuestButton
            link={{ label: "Open quest", missionId: fromQuest, title: message.fromTitle ?? "" }}
            onOpenMission={onOpenMission}
          />
        )}
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
  if (entry._tag === "Steps") return <StepsGroup seconds={entry.seconds} steps={entry.steps} />;
  if (entry._tag === "QuestLink")
    return (
      <View style={styles.messageRow}>
        <View style={[styles.messageCard, styles.messageCardThread, styles.cardWithCorner]}>
          <View style={styles.senderHeader}>
            <Text style={styles.senderName}>{entry.label}</Text>
            <Text style={styles.senderTime}>{clockOf(entry.sentAt)}</Text>
          </View>
          <Text style={styles.muted}>{shortened(entry.title)}</Text>
          <QuestButton link={entry} onOpenMission={onOpenMission} />
        </View>
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
      fromQuest={entry.fromQuest}
      harness={harness}
      message={entry.message}
      onOpenMission={onOpenMission}
      skills={skills}
      workspacePath={workspacePath}
    />
  );
}
