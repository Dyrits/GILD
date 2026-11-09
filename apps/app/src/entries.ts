import type {
  BudgetEvent,
  IntelChange,
  Message,
  MissionDetail,
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
  | { _tag: "IntelChange"; change: IntelChange }
  | { _tag: "ThreadOpened"; thread: ThreadSummary }
);

/**
 * Messages, questions, off-topic suggestions, budget lines, intel changes, and the threads opened beneath,
 * in the order they happened. An aside is left out: its suggestion line already leads to it.
 */
export const entriesOf = (detail: MissionDetail): Array<Entry> =>
  [
    ...detail.threads
      .filter((thread) => thread.parentId === detail.thread.id && !thread.isAside)
      .map((thread): Entry => ({ _tag: "ThreadOpened", at: thread.openedAt, key: `opened:${thread.id}`, thread })),
    ...detail.messages.map((message): Entry => ({ _tag: "Message", at: message.sentAt, key: message.id, message })),
    ...detail.questions.map(
      (question): Entry => ({ _tag: "Question", at: question.askedAt, key: question.id, question }),
    ),
    ...detail.suggestions.map(
      (suggestion): Entry => ({ _tag: "Suggestion", at: suggestion.askedAt, key: suggestion.id, suggestion }),
    ),
    ...detail.budgetEvents.map((event): Entry => ({ _tag: "BudgetEvent", at: event.at, event, key: event.id })),
    ...detail.intelChanges.map((change): Entry => ({ _tag: "IntelChange", at: change.at, change, key: change.id })),
  ].sort((a, b) => a.at - b.at);
