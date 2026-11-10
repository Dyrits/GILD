import { Schema } from "effect";
import { BudgetEvent, BudgetLimits, BudgetPeriod, BudgetStop, BudgetUse, Spending } from "./budgets.ts";
import { Crest } from "./crest.ts";
import { HarnessName } from "./harnesses.ts";
import { AccountId, MessageId, MissionId, SuggestionId, ThreadId, WorkspaceId } from "./ids.ts";
import { LoreChange, LoreGauge } from "./lore.ts";
import { ApprovalLevel, Question } from "./questions.ts";
import { Workspace, WorkspaceChoice } from "./workspaces.ts";

// Stored and wire names keep `intel` so existing data and agents still work: settings keys (`intelHalfLives`, `intelWarningPercent`).

// Missions, threads, settings, and off-topic suggestions.

/** A client-chosen identifier; repeating a command with it returns the original outcome. */
export const RequestId = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128));

/** A thread's state (thread-tree, Thread states). */
export const ThreadState = Schema.Literals(["Running", "Waiting", "Attention", "Idle", "Done", "Failed", "Stopped"]);
export type ThreadState = typeof ThreadState.Type;

/** Who wrote a message: the owner, the thread's own agent, or another thread of the mission (thread-messaging). */
export const SenderKind = Schema.Literals(["user", "agent", "thread"]);
export type SenderKind = typeof SenderKind.Type;

/**
 * The model a thread runs with, by the identifier its harness takes, such as "opus" for Claude Code or
 * "gpt-6.1-sol" for Codex; "default" is the harness's own (provider-accounts, Models).
 */
export const ModelChoice = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200));
export type ModelChoice = typeof ModelChoice.Type;

/** The effort a thread runs with; default is the harness's own. */
export const EffortChoice = Schema.Literals(["default", "low", "medium", "high", "xhigh", "max"]);
export type EffortChoice = typeof EffortChoice.Type;

/** Token counts in the provider's own unit; never converted to a price. */
export const TokenUsage = Schema.Struct({
  cacheCreation: Schema.Number,
  cacheRead: Schema.Number,
  input: Schema.Number,
  output: Schema.Number,
});
export type TokenUsage = typeof TokenUsage.Type;

/** How an owner message reaches a running thread: joining its current turn, or waiting for its next (thread-messaging, Delivery; CHG-0039). */
export const MessageDelivery = Schema.Literals(["Steer", "Queue"]);
export type MessageDelivery = typeof MessageDelivery.Type;

/** The owner's settings. */
export const Settings = Schema.Struct({
  approvalLevel: ApprovalLevel,
  /** Days after a Done mission was marked Done before it is archived, when auto-archive is on. */
  autoArchiveDays: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /** The most tokens a mission's briefing may hold, estimated at about 4 characters per token (mission-journal, Size). */
  briefingLimit: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /** Messages between two threads before the owner decides how they continue. */
  chatterThreshold: Schema.Int.check(Schema.isGreaterThanOrEqualTo(2)),
  /** What Send does while a thread runs; the second button does the other. */
  defaultDelivery: MessageDelivery,
  defaultEffort: EffortChoice,
  /** The harness a new mission starts on before any mission was started (provider-accounts). */
  defaultHarness: HarnessName,
  /** Copied onto each new mission; empty at first. */
  defaultMissionBudget: BudgetLimits,
  defaultModel: ModelChoice,
  /** Covers all missions over its period; empty at first. */
  globalBudget: BudgetLimits,
  globalBudgetPeriod: BudgetPeriod,
  /** Days without activity before the dashboard asks to archive or mark a mission done (mission-tracking). */
  inactivityDays: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /** The share of the chosen model's context window, in percent, past which a thread's lore icon turns red (scoped-intel). */
  /** Days over which an unused lore entry's strength halves, by kind; a rule never fades (scoped-intel, Kinds). */
  intelHalfLives: Schema.Struct({
    decision: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
    fact: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
    preference: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
    temporary: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  }),
  intelWarningPercent: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(100)),
  /** Whether Done missions are archived automatically, off by default (mission-tracking, Ending a mission). */
  shouldAutoArchive: Schema.Boolean,
  /** Whether an off-topic request opens a new mission without asking when no mission matches (thread-tree). */
  shouldOpenOffTopicMissions: Schema.Boolean,
  shouldShowAgentThreads: Schema.Boolean,
  shouldStreamReplies: Schema.Boolean,
});
export type Settings = typeof Settings.Type;

/** How a mission ended: marked Done, or archived (mission-tracking, Ending a mission). */
export const MissionEnding = Schema.Literals(["Done", "Archived"]);
export type MissionEnding = typeof MissionEnding.Type;

/**
 * The most urgent state among a mission's threads while it is not ended, or how it ended
 * (mission-tracking, Mission state).
 */
export const MissionState = Schema.Literals(["Attention", "Failed", "Running", "Waiting", "Idle", "Done", "Archived"]);
export type MissionState = typeof MissionState.Type;

/** What the dashboard asks of a mission: "Mark as done?" after its result, or the inactivity question. */
export const MissionPrompt = Schema.Literals(["MarkDone", "Inactive"]);
export type MissionPrompt = typeof MissionPrompt.Type;

/** One mission as the dashboard lists it. */
export const MissionSummary = Schema.Struct({
  /** The mission's budget and its spending over the mission's life. */
  budget: BudgetUse,
  /** The top thread's harness and model, for the card. */
  harness: HarnessName,
  id: MissionId,
  /** Whether the owner renamed it, after which `set_mission_title` is refused. */
  isTitleByUser: Schema.Boolean,
  lastActivityAt: Schema.Number,
  model: ModelChoice,
  /** The question the dashboard asks of it, or null. */
  prompt: Schema.NullOr(MissionPrompt),
  /** Threads Running now. */
  runningCount: Schema.Number,
  state: MissionState,
  threadCount: Schema.Number,
  title: Schema.String,
  topThreadId: ThreadId,
  usage: TokenUsage,
  /** The top thread's workspace; both null when it runs in the mission's scratch folder. */
  workspaceCrest: Schema.NullOr(Crest),
  workspaceId: Schema.NullOr(WorkspaceId),
  workspaceName: Schema.NullOr(Schema.String),
});
export type MissionSummary = typeof MissionSummary.Type;

/** The dashboard's or the Archived view's missions, and the workspaces among that view's missions. */
export const MissionList = Schema.Struct({
  missions: Schema.Array(MissionSummary),
  workspaces: Schema.Array(WorkspaceChoice),
});
export type MissionList = typeof MissionList.Type;

/** What ending a mission would stop, for the one confirmation (mission-tracking, Ending a mission). */
export const EndingPreview = Schema.Struct({
  /** The question naming the threads still at work, or null when none are. */
  question: Schema.NullOr(Schema.String),
  /** Identifies the threads at work when previewed; ending refuses a changed set. */
  snapshot: Schema.String,
  workingCount: Schema.Number,
});
export type EndingPreview = typeof EndingPreview.Type;

/** A new mission's choices, prefilled from the last mission started (mission-tracking, Starting a mission). */
export const StartChoices = Schema.Struct({
  /** The provider account, or null for the harness's own sign-in on this computer. */
  accountId: Schema.NullOr(AccountId),
  effort: EffortChoice,
  harness: HarnessName,
  model: ModelChoice,
  workspacePath: Schema.NullOr(Schema.String),
});
export type StartChoices = typeof StartChoices.Type;

/** One message in a thread's conversation. */
export const Message = Schema.Struct({
  /** The sending thread, for a thread message; null otherwise. */
  fromThreadId: Schema.NullOr(ThreadId),
  /** The sending thread's title, for a thread message; null otherwise. */
  fromTitle: Schema.NullOr(Schema.String),
  /** The harness that wrote an agent reply, which a handover leaves behind; null for other messages. */
  harness: Schema.NullOr(HarnessName),
  id: MessageId,
  /** Whether it is an owner message sent as Queue that still waits for the thread's next turn. */
  isQueued: Schema.Boolean,
  /** Whether it is a result reported by a thread beneath (thread-tree, Results). */
  isResult: Schema.Boolean,
  /** The model that wrote an agent reply, as its harness named it (such as `claude-sonnet-5-5`); null when unreported. */
  model: Schema.NullOr(Schema.String),
  sender: SenderKind,
  sentAt: Schema.Number,
  sequence: Schema.Number,
  text: Schema.String,
  threadId: ThreadId,
});
export type Message = typeof Message.Type;

/** What keeps a thread in Attention besides an open question: its workspace folder is gone (workspace-attachment, Missing folder). */
export const ThreadBlocker = Schema.Literals(["MissingWorkspace", "Chatter", "Budget"]);
export type ThreadBlocker = typeof ThreadBlocker.Type;

/** One thread in a mission's tree, as the side tree lists it. */
export const ThreadSummary = Schema.Struct({
  /** Levels beneath the top thread, which is 0. */
  depth: Schema.Number,
  id: ThreadId,
  /** Whether it holds an off-topic request the owner kept as an aside (thread-tree, Off-topic requests). */
  isAside: Schema.Boolean,
  /** Whether a thread opened it with `open_thread`, rather than the owner. */
  isOpenedByAgent: Schema.Boolean,
  /** When it was opened: the time of its first message. */
  openedAt: Schema.Number,
  parentId: Schema.NullOr(ThreadId),
  state: ThreadState,
  title: Schema.String,
  /** Messages kept for the thread and not yet delivered, such as while it is Stopped. */
  waitingCount: Schema.Number,
});
export type ThreadSummary = typeof ThreadSummary.Type;

/** What the owner can do with a thread now, worked out by the service so every interface offers the same. */
export const ThreadActions = Schema.Struct({
  /** Whether the owner may open a thread beneath it (thread-tree, Limits). */
  canOpenBeneath: Schema.Boolean,
  /** Whether it is Stopped and continues with Resume (thread-tree, Stopping). */
  canResume: Schema.Boolean,
  /** Whether it is at work, so Stop ends its work (thread-tree, Stopping). */
  canStop: Schema.Boolean,
  /** Whether it is at work in a turn: a message can join it, and Interrupt ends it (thread-messaging). */
  isInTurn: Schema.Boolean,
});
export type ThreadActions = typeof ThreadActions.Type;

/** The selected thread as its conversation shows it, with the owner's actions on it. */
export const ThreadView = Schema.Struct({
  /** The provider account it runs with, or null for the harness's own sign-in on this computer. */
  accountId: Schema.NullOr(AccountId),
  /** The account's label as Settings shows it. */
  accountLabel: Schema.String,
  actions: ThreadActions,
  /** Why the thread waits in Attention for Retry, or null. */
  blocker: Schema.NullOr(ThreadBlocker),
  /** Levels beneath the top thread, which is 0. */
  depth: Schema.Number,
  effort: EffortChoice,
  /** Why the last turn failed, while the thread is Failed. */
  failure: Schema.NullOr(Schema.String),
  harness: HarnessName,
  id: ThreadId,
  model: ModelChoice,
  parentId: Schema.NullOr(ThreadId),
  state: ThreadState,
  title: Schema.String,
  waitingCount: Schema.Number,
  /** Null when the thread runs in its mission's scratch folder. */
  workspace: Schema.NullOr(Workspace),
});
export type ThreadView = typeof ThreadView.Type;

/** One paused exchange, identified independently of later pauses of the same pair. */
export const ChatterNotice = Schema.Struct({
  count: Schema.Number,
  firstId: ThreadId,
  firstTitle: Schema.String,
  id: Schema.String,
  secondId: ThreadId,
  secondTitle: Schema.String,
});
export type ChatterNotice = typeof ChatterNotice.Type;

/** Where an off-topic request went: continued in another mission, a new mission, an aside, or nowhere (withdrawn). */
export const SuggestionOutcome = Schema.Literals(["Continued", "MovedToMission", "KeptAsAside", "Withdrawn"]);
export type SuggestionOutcome = typeof SuggestionOutcome.Type;

/** A mission offered for an off-topic request, with its state when read. */
export const SuggestionMatch = Schema.Struct({ missionId: MissionId, state: MissionState, title: Schema.String });
export type SuggestionMatch = typeof SuggestionMatch.Type;

/** A thread's suggestion for an off-topic request, open or resolved (thread-tree, Off-topic requests). */
export const Suggestion = Schema.Struct({
  /** The suggesting thread's account, prefilled for Open as new mission. */
  accountId: Schema.NullOr(AccountId),
  askedAt: Schema.Number,
  /** The suggesting thread's effort, prefilled for Open as new mission. */
  effort: EffortChoice,
  /** The suggesting thread's harness, prefilled for Open as new mission. */
  harness: HarnessName,
  id: SuggestionId,
  /** Whether the setting opened a new mission without asking. */
  isAutomatic: Schema.Boolean,
  /** Matching missions, best first, at most 3. */
  matches: Schema.Array(SuggestionMatch),
  /** The suggesting thread's model, prefilled for Open as new mission. */
  model: ModelChoice,
  outcome: Schema.NullOr(SuggestionOutcome),
  resolvedAt: Schema.NullOr(Schema.Number),
  targetMissionId: Schema.NullOr(MissionId),
  targetThreadId: Schema.NullOr(ThreadId),
  /** The mission or aside it went to, as titled then. */
  targetTitle: Schema.NullOr(Schema.String),
  /** The off-topic part of the owner's message. */
  text: Schema.String,
  threadId: ThreadId,
  /** The thread's proposed title for a new mission or aside. */
  title: Schema.String,
});
export type Suggestion = typeof Suggestion.Type;

/** What a new thread's starting context takes, in estimated tokens, by part (thread-tree, Opening a thread). */
export const StartingContextParts = Schema.Struct({
  /** The budget line; none without a budget. */
  budget: Schema.Number,
  /** The instructions every thread receives: on threads, the journal, lore, and approvals. */
  instructions: Schema.Number,
  /** The mission's briefing and its latest entries. */
  journal: Schema.Number,
  /** The lore in the new thread's scope: scoped lore in full and the global index. */
  lore: Schema.Number,
  /** The opener's messages since the journal's latest entry. */
  openerMessages: Schema.Number,
  /** The line naming the new thread's title and its opener's. */
  position: Schema.Number,
  /** The opener's request, the new thread's first message. */
  request: Schema.Number,
  /** The working folder: the workspace with its own instructions, or the mission's scratch folder. */
  workspace: Schema.Number,
});
export type StartingContextParts = typeof StartingContextParts.Type;

/** How much of the chosen model's context window a new thread's starting context would take (thread-tree, Opening a thread). */
export const StartingContext = Schema.Struct({
  /** Whether it takes more than the warning share, so the owner is warned before the thread starts. */
  isOverWarning: Schema.Boolean,
  /** The models with a larger context window than the chosen one, largest first. */
  largerModels: Schema.Array(ModelChoice),
  parts: StartingContextParts,
  /** The whole starting context: the sum of its parts. */
  tokens: Schema.Number,
  /** The share in percent above which the owner is warned. */
  warningPercent: Schema.Number,
  /** The chosen model's context window, in tokens. */
  windowTokens: Schema.Number,
});
export type StartingContext = typeof StartingContext.Type;

/** What fills a thread's context window (thread-panel, The context gauge). */
export const ContextPartKind = Schema.Literals(["Instructions", "Lore", "Journal", "Messages", "ToolsAndResults"]);
export type ContextPartKind = typeof ContextPartKind.Type;

/** One part of a thread's context and its tokens. */
export const ContextPart = Schema.Struct({ kind: ContextPartKind, tokens: Schema.Number });
export type ContextPart = typeof ContextPart.Type;

/** How full a thread's context window is and what fills it (thread-panel, The context gauge). */
export const ContextGauge = Schema.Struct({
  /** What fills the context, in the order the gauge draws it; the tokens add up to `tokens`. */
  parts: Schema.Array(ContextPart),
  /** What the harness reported for the thread's latest model call: its input, cached input, and output. */
  tokens: Schema.Number,
  /** The chosen model's context window, in tokens. */
  windowTokens: Schema.Number,
});
export type ContextGauge = typeof ContextGauge.Type;

/** What the thread panel shows beyond the thread itself (thread-panel, The panel). */
export const ThreadPanel = Schema.Struct({
  /** The mission's budget and its spending, as the quest panel shows them. */
  budget: BudgetUse,
  /** Null until a turn reported usage: shown as "Not measured yet", never guessed. */
  context: Schema.NullOr(ContextGauge),
  /** What this thread alone spent. */
  spending: Spending,
  /** Turns this thread has run with usage reported. */
  turnCount: Schema.Number,
});
export type ThreadPanel = typeof ThreadPanel.Type;

/** A line in a thread's conversation recording a handover: its harness, account, model, or effort changed. */
export const Handover = Schema.Struct({ at: Schema.Number, id: Schema.String, text: Schema.String });
export type Handover = typeof Handover.Type;

/** A mission with its thread tree and one selected thread's conversation. */
export const MissionDetail = Schema.Struct({
  /** Budget lines, shown in the top thread only. */
  budgetEvents: Schema.Array(BudgetEvent),
  /** The mission's open budget stop when the selected thread holds its question. */
  budgetStop: Schema.NullOr(BudgetStop),
  chatter: Schema.Array(ChatterNotice),
  /** The selected thread's handovers, oldest first. */
  handovers: Schema.Array(Handover),
  /** The selected thread's changes to lore, done and awaiting approval, in the order made. */
  loreChanges: Schema.Array(LoreChange),
  /** How much of its model's context window the lore in the selected thread's scope takes. */
  loreGauge: LoreGauge,
  /** The selected thread's messages. */
  messages: Schema.Array(Message),
  mission: MissionSummary,
  /** The selected thread's questions, open and recorded, in the order asked. */
  questions: Schema.Array(Question),
  /** The selected thread's off-topic suggestions, open and resolved, in the order made. */
  suggestions: Schema.Array(Suggestion),
  /** The selected thread: the one asked for, or the top thread. */
  thread: ThreadView,
  /** Every thread of the mission, each parent before the threads beneath it. */
  threads: Schema.Array(ThreadSummary),
});
export type MissionDetail = typeof MissionDetail.Type;
