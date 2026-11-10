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
import { suggestionLabels } from "./labels";

/** A quest or Ritual a reply leads to, which the conversation draws as a button beside that reply. */
export type QuestLink = { key: string; label: string; missionId: MissionId; title: string };

/** One entry of a thread's conversation, with the key the list keeps it by. */
export type Entry = { key: string; at: number } & (
  | { _tag: "Message"; message: Message; links: ReadonlyArray<QuestLink> }
  | { _tag: "Question"; question: Question }
  | { _tag: "Suggestion"; suggestion: Suggestion }
  | { _tag: "BudgetEvent"; event: BudgetEvent }
  | { _tag: "Handover"; handover: Handover }
  | { _tag: "LoreChange"; change: LoreChange }
  | { _tag: "ThreadOpened"; thread: ThreadSummary }
  /** A link whose reply is not written yet, which stands on its own until it is. */
  | { _tag: "QuestLink"; label: string; missionId: MissionId; title: string }
);

/** A line sits just after the reply that answers what it belongs to. */
const afterReply = 0.5;

/** What the Guildmaster did with a request it settled. */
const settledLabelOf = (suggestion: Suggestion) =>
  suggestion.isRitual
    ? "Created Ritual"
    : suggestion.outcome === "MovedToMission"
      ? "Opened quest"
      : suggestionLabels[suggestion.outcome ?? "Continued"];

/**
 * Messages, questions, off-topic suggestions, budget lines, handovers, lore changes, and the threads opened beneath, in the order they happened.
 * An aside is left out: its suggestion line already leads to it.
 * In the Guildmaster's conversation what it opened, created, or continued, and each report from a quest, becomes a link carried by the Guildmaster's own reply to it, so its confirmation comes first and the link stands beside it.
 */
export const entriesOf = (detail: MissionDetail): Array<Entry> => {
  const replies = detail.messages.filter((message) => message.sender === "agent");
  /** The first reply written at or after the time. */
  const replyFrom = (time: number) => replies.find((reply) => reply.sentAt >= time);
  const isSettledByGuildmaster = (suggestion: Suggestion) =>
    suggestion.isFromGuildmaster && suggestion.outcome !== null && suggestion.outcome !== "Withdrawn";
  const links: Array<QuestLink & { at: number }> = [
    ...detail.messages.flatMap((message) =>
      message.sender === "thread" && message.fromMissionId !== null && message.fromMissionId !== detail.mission.id
        ? [
            {
              at: message.sentAt + 1,
              key: `link:${message.id}`,
              label: "Open quest",
              missionId: message.fromMissionId,
              title: message.fromTitle ?? "",
            },
          ]
        : [],
    ),
    ...detail.suggestions.flatMap((suggestion) =>
      isSettledByGuildmaster(suggestion) && suggestion.targetMissionId !== null
        ? [
            {
              at: suggestion.resolvedAt ?? suggestion.askedAt,
              key: suggestion.id,
              label: settledLabelOf(suggestion),
              missionId: suggestion.targetMissionId,
              title: suggestion.targetTitle ?? "",
            },
          ]
        : [],
    ),
  ].sort((a, b) => a.at - b.at);
  const linksByReply = new Map<string, Array<QuestLink>>();
  const waitingLinks: Array<Entry> = [];
  for (const { at, ...link } of links) {
    const reply = replyFrom(at);
    if (reply === undefined) waitingLinks.push({ _tag: "QuestLink", at: at + afterReply, ...link });
    else linksByReply.set(reply.id, [...(linksByReply.get(reply.id) ?? []), link]);
  }
  return [
    ...detail.threads
      .filter((thread) => thread.parentId === detail.thread.id && !thread.isAside)
      .map((thread): Entry => ({ _tag: "ThreadOpened", at: thread.openedAt, key: `opened:${thread.id}`, thread })),
    ...detail.messages.map(
      (message): Entry => ({
        _tag: "Message",
        at: message.sentAt,
        key: message.id,
        links: linksByReply.get(message.id) ?? [],
        message,
      }),
    ),
    ...waitingLinks,
    ...detail.questions.map(
      (question): Entry => ({ _tag: "Question", at: question.askedAt, key: question.id, question }),
    ),
    ...detail.suggestions
      .filter((suggestion) => !(isSettledByGuildmaster(suggestion) && suggestion.targetMissionId !== null))
      .map(
        (suggestion): Entry => ({
          _tag: "Suggestion",
          // What the Guildmaster settled with nowhere to lead shows after its confirmation; the rest where it was asked.
          at: isSettledByGuildmaster(suggestion)
            ? (replyFrom(suggestion.resolvedAt ?? suggestion.askedAt)?.sentAt ??
                suggestion.resolvedAt ??
                suggestion.askedAt) + afterReply
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
