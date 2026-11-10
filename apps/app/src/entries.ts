import type {
  BudgetEvent,
  Handover,
  LoreChange,
  Message,
  MissionDetail,
  MissionId,
  Question,
  Suggestion,
  ThreadSummary,
} from "@gild/contracts";

/** One entry of a thread's conversation, with the key the list keeps it by. */
export type Entry = { key: string; at: number } & (
  | { _tag: "Message"; message: Message }
  | { _tag: "Question"; question: Question }
  | { _tag: "Suggestion"; suggestion: Suggestion }
  | { _tag: "BudgetEvent"; event: BudgetEvent }
  | { _tag: "Handover"; handover: Handover }
  | { _tag: "LoreChange"; change: LoreChange }
  | { _tag: "ThreadOpened"; thread: ThreadSummary }
  /** A link to the quest a report came from, which follows the reply to that report. */
  | { _tag: "QuestLink"; missionId: MissionId; title: string }
);

/** A link line sits just after the reply that answers what it belongs to. */
const afterReply = 0.5;

/**
 * Messages, questions, off-topic suggestions, budget lines, handovers, lore changes, and the threads opened beneath,
 * in the order they happened. An aside is left out: its suggestion line already leads to it. In the Guildmaster's
 * conversation what it opened or continued, and each report from a quest, is followed by a link that stands after the
 * Guildmaster's own reply to it, so its confirmation comes first.
 */
export const entriesOf = (detail: MissionDetail): Array<Entry> => {
  const replies = detail.messages.filter((message) => message.sender === "agent").map((message) => message.sentAt);
  /** Just after the first reply written at or after the time, or at the time itself while none is. */
  const afterFirstReplyFrom = (time: number) => {
    const reply = replies.find((sentAt) => sentAt >= time);
    return (reply ?? time) + afterReply;
  };
  return [
    ...detail.threads
      .filter((thread) => thread.parentId === detail.thread.id && !thread.isAside)
      .map((thread): Entry => ({ _tag: "ThreadOpened", at: thread.openedAt, key: `opened:${thread.id}`, thread })),
    ...detail.messages.map((message): Entry => ({ _tag: "Message", at: message.sentAt, key: message.id, message })),
    ...detail.messages.flatMap(
      (message): Array<Entry> =>
        message.sender === "thread" && message.fromMissionId !== null && message.fromMissionId !== detail.mission.id
          ? [
              {
                _tag: "QuestLink",
                at: afterFirstReplyFrom(message.sentAt + 1),
                key: `link:${message.id}`,
                missionId: message.fromMissionId,
                title: message.fromTitle ?? "",
              },
            ]
          : [],
    ),
    ...detail.questions.map(
      (question): Entry => ({ _tag: "Question", at: question.askedAt, key: question.id, question }),
    ),
    ...detail.suggestions.map(
      (suggestion): Entry => ({
        _tag: "Suggestion",
        // What the Guildmaster settled shows after its confirmation; an open question stays where it was asked.
        at:
          suggestion.isFromGuildmaster && suggestion.outcome !== null && suggestion.outcome !== "Withdrawn"
            ? afterFirstReplyFrom(suggestion.resolvedAt ?? suggestion.askedAt)
            : suggestion.askedAt,
        key: suggestion.id,
        suggestion,
      }),
    ),
    ...detail.budgetEvents.map((event): Entry => ({ _tag: "BudgetEvent", at: event.at, event, key: event.id })),
    ...detail.handovers.map((handover): Entry => ({ _tag: "Handover", at: handover.at, handover, key: handover.id })),
    ...detail.loreChanges.map((change): Entry => ({ _tag: "LoreChange", at: change.at, change, key: change.id })),
  ].sort((a, b) => a.at - b.at);
};
