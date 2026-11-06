import { Schema } from "effect";

// Records shared by the service and the app. The app may only call Schema's
// decode and encode functions on them (CHG-0025, ADR 0010 amendment).

export const MissionId = Schema.String.pipe(Schema.brand("MissionId"));
export type MissionId = typeof MissionId.Type;

export const ThreadId = Schema.String.pipe(Schema.brand("ThreadId"));
export type ThreadId = typeof ThreadId.Type;

export const MessageId = Schema.String.pipe(Schema.brand("MessageId"));
export type MessageId = typeof MessageId.Type;

export const WorkspaceId = Schema.String.pipe(Schema.brand("WorkspaceId"));
export type WorkspaceId = typeof WorkspaceId.Type;

/** A folder a thread works in, kept by identity rather than by path (workspace-attachment). */
export const Workspace = Schema.Struct({
  id: WorkspaceId,
  /** Whether the folder still exists at its path. */
  isMissing: Schema.Boolean,
  name: Schema.String,
  path: Schema.String,
});
export type Workspace = typeof Workspace.Type;

/** One folder shown by the folder browser. */
export const Folder = Schema.Struct({ name: Schema.String, path: Schema.String });
export type Folder = typeof Folder.Type;

/** A folder's subfolders, or the browsable roots when `path` is null. */
export const FolderListing = Schema.Struct({
  folders: Schema.Array(Folder),
  /** The folder above, or null at a browsable root and at the list of roots. */
  parent: Schema.NullOr(Schema.String),
  path: Schema.NullOr(Schema.String),
});
export type FolderListing = typeof FolderListing.Type;

/** A client-chosen identifier; repeating a command with it returns the original outcome. */
export const RequestId = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128));

export const ThreadState = Schema.Literals(["Running", "Waiting", "Attention", "Idle", "Done", "Failed", "Stopped"]);
export type ThreadState = typeof ThreadState.Type;

/** Who wrote a message: the owner, the thread's own agent, or another thread of the mission (thread-messaging). */
export const SenderKind = Schema.Literals(["user", "agent", "thread"]);
export type SenderKind = typeof SenderKind.Type;

export const ModelChoice = Schema.Literals(["default", "fable", "opus", "sonnet", "haiku"]);
export type ModelChoice = typeof ModelChoice.Type;

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

/** A budget's two optional limits; null means no limit (budget-control, Budgets). */
export const BudgetLimits = Schema.Struct({
  /** For API-key spending, in the provider's currency. */
  cost: Schema.NullOr(Schema.Number.check(Schema.isGreaterThan(0))),
  /** For subscription spending; tokens are never priced. */
  tokens: Schema.NullOr(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
});
export type BudgetLimits = typeof BudgetLimits.Type;

/** The global budget's period; it starts at local midnight, on Monday for a week, on the 1st for a month. */
export const BudgetPeriod = Schema.Literals(["Day", "Week", "Month"]);
export type BudgetPeriod = typeof BudgetPeriod.Type;

/** Spending in each unit: API-key cost, and subscription tokens. */
export const Spending = Schema.Struct({ cost: Schema.Number, tokens: Schema.Number });
export type Spending = typeof Spending.Type;

/** A budget's limits with what is spent against them. */
export const BudgetUse = Schema.Struct({ limits: BudgetLimits, spent: Spending });
export type BudgetUse = typeof BudgetUse.Type;

/** How much asks for approval: sensitive actions only, or also commands and edits (action-approval, Approval level; CHG-0035). */
export const ApprovalLevel = Schema.Literals(["RiskyOnly", "CommandsAndEdits"]);
export type ApprovalLevel = typeof ApprovalLevel.Type;

/** How an owner message reaches a running thread: joining its current turn, or waiting for its next (thread-messaging, Delivery; CHG-0039). */
export const MessageDelivery = Schema.Literals(["Steer", "Queue"]);
export type MessageDelivery = typeof MessageDelivery.Type;

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
  /** Copied onto each new mission; empty at first. */
  defaultMissionBudget: BudgetLimits,
  defaultModel: ModelChoice,
  /** Covers all missions over its period; empty at first. */
  globalBudget: BudgetLimits,
  globalBudgetPeriod: BudgetPeriod,
  /** Days without activity before the dashboard asks to archive or mark a mission done (mission-tracking). */
  inactivityDays: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /** Whether Done missions are archived automatically, off by default (mission-tracking, Ending a mission). */
  shouldAutoArchive: Schema.Boolean,
  /** Whether an off-topic request opens a new mission without asking when no mission matches (thread-tree). */
  shouldOpenOffTopicMissions: Schema.Boolean,
  shouldShowAgentThreads: Schema.Boolean,
  shouldStreamReplies: Schema.Boolean,
});
export type Settings = typeof Settings.Type;

const MessageText = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100_000));

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

export const MissionSummary = Schema.Struct({
  /** The mission's budget and its spending over the mission's life. */
  budget: BudgetUse,
  id: MissionId,
  /** Whether the owner renamed it, after which `set_mission_title` is refused. */
  isTitleByUser: Schema.Boolean,
  lastActivityAt: Schema.Number,
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
  workspaceId: Schema.NullOr(WorkspaceId),
  workspaceName: Schema.NullOr(Schema.String),
});
export type MissionSummary = typeof MissionSummary.Type;

/** One workspace the dashboard can filter by. */
export const WorkspaceChoice = Schema.Struct({ id: WorkspaceId, name: Schema.String });
export type WorkspaceChoice = typeof WorkspaceChoice.Type;

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
  effort: EffortChoice,
  model: ModelChoice,
  workspacePath: Schema.NullOr(Schema.String),
});
export type StartChoices = typeof StartChoices.Type;

export const Message = Schema.Struct({
  /** The sending thread, for a thread message; null otherwise. */
  fromThreadId: Schema.NullOr(ThreadId),
  /** The sending thread's title, for a thread message; null otherwise. */
  fromTitle: Schema.NullOr(Schema.String),
  id: MessageId,
  /** Whether it is an owner message sent as Queue that still waits for the thread's next turn. */
  isQueued: Schema.Boolean,
  /** Whether it is a result reported by a thread beneath (thread-tree, Results). */
  isResult: Schema.Boolean,
  sender: SenderKind,
  sentAt: Schema.Number,
  sequence: Schema.Number,
  text: Schema.String,
  threadId: ThreadId,
});
export type Message = typeof Message.Type;

export const QuestionId = Schema.String.pipe(Schema.brand("QuestionId"));
export type QuestionId = typeof QuestionId.Type;

export const PermissionId = Schema.String.pipe(Schema.brand("PermissionId"));
export type PermissionId = typeof PermissionId.Type;

/** Who raised a question: the thread through `request_approval`, or the harness's own permission prompt. */
export const QuestionSource = Schema.Literals(["Thread", "Harness"]);
export type QuestionSource = typeof QuestionSource.Type;

/** How a question ended; null while it is open. */
export const QuestionOutcome = Schema.Literals([
  "Allowed",
  "AlwaysAllowed",
  "Denied",
  "Discarded",
  "Withdrawn",
  "AllowedByMessage",
  "AllowedByPermission",
  /** A harness prompt that is not a sensitive action, run without a question (CHG-0035). */
  "AllowedAutomatically",
]);
export type QuestionOutcome = typeof QuestionOutcome.Type;

/** One approval question about one action, open or recorded. */
export const Question = Schema.Struct({
  askedAt: Schema.Number,
  /** The exact command, file, or target. */
  details: Schema.String,
  /** Where it was answered, such as "desktop"; null while open or when no person answered. */
  device: Schema.NullOr(Schema.String),
  id: QuestionId,
  /** The owner's message on a denial, if any. */
  message: Schema.NullOr(Schema.String),
  missionId: MissionId,
  missionTitle: Schema.String,
  outcome: Schema.NullOr(QuestionOutcome),
  /** The command pattern Always allow would save, such as `git push *`. */
  pattern: Schema.NullOr(Schema.String),
  /** The short sentence Always allow would save, such as "Push code to GitHub". */
  permission: Schema.NullOr(Schema.String),
  resolvedAt: Schema.NullOr(Schema.Number),
  source: QuestionSource,
  /** One natural-language sentence: what the thread wants to do and why. */
  summary: Schema.String,
  threadId: ThreadId,
});
export type Question = typeof Question.Type;

/** A standing permission the owner granted with Always allow. */
export const StandingPermission = Schema.Struct({
  createdAt: Schema.Number,
  id: PermissionId,
  /** The mission it applies to, for threads with no workspace; null otherwise. */
  missionId: Schema.NullOr(MissionId),
  missionTitle: Schema.NullOr(Schema.String),
  pattern: Schema.String,
  sentence: Schema.String,
  /** The workspace it applies to; null for a mission's permission. Both null: everywhere. */
  workspaceId: Schema.NullOr(WorkspaceId),
  workspaceName: Schema.NullOr(Schema.String),
});
export type StandingPermission = typeof StandingPermission.Type;

export const PermissionsView = Schema.Struct({
  /** Answered, discarded, and withdrawn questions, newest first. */
  history: Schema.Array(Question),
  level: ApprovalLevel,
  permissions: Schema.Array(StandingPermission),
  /** Why the sandbox is unavailable, so the default level asks for every prompt; null when available. */
  sandboxProblem: Schema.NullOr(Schema.String),
});
export type PermissionsView = typeof PermissionsView.Type;

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
  parentId: Schema.NullOr(ThreadId),
  state: ThreadState,
  title: Schema.String,
  /** Messages kept for the thread and not yet delivered, such as while it is Stopped. */
  waitingCount: Schema.Number,
});
export type ThreadSummary = typeof ThreadSummary.Type;

export const ThreadView = Schema.Struct({
  /** Why the thread waits in Attention for Retry, or null. */
  blocker: Schema.NullOr(ThreadBlocker),
  /** Levels beneath the top thread, which is 0. */
  depth: Schema.Number,
  effort: EffortChoice,
  /** Why the last turn failed, while the thread is Failed. */
  failure: Schema.NullOr(Schema.String),
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

export const SuggestionId = Schema.String.pipe(Schema.brand("SuggestionId"));
export type SuggestionId = typeof SuggestionId.Type;

/** Where an off-topic request went: continued in another mission, a new mission, an aside, or nowhere (withdrawn). */
export const SuggestionOutcome = Schema.Literals(["Continued", "MovedToMission", "KeptAsAside", "Withdrawn"]);
export type SuggestionOutcome = typeof SuggestionOutcome.Type;

/** A mission offered for an off-topic request, with its state when read. */
export const SuggestionMatch = Schema.Struct({ missionId: MissionId, state: MissionState, title: Schema.String });
export type SuggestionMatch = typeof SuggestionMatch.Type;

/** A thread's suggestion for an off-topic request, open or resolved (thread-tree, Off-topic requests). */
export const Suggestion = Schema.Struct({
  askedAt: Schema.Number,
  /** The suggesting thread's effort, prefilled for Open as new mission. */
  effort: EffortChoice,
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

/** A budget reached and not yet answered: the mission's, or the global one (budget-control, Reaching a limit). */
export const BudgetStop = Schema.Struct({
  id: Schema.String,
  /** Null for the global budget. */
  missionId: Schema.NullOr(MissionId),
  missionTitle: Schema.NullOr(Schema.String),
  reachedAt: Schema.Number,
  scope: Schema.Literals(["Mission", "Global"]),
  /** The thread that holds the question. */
  threadId: ThreadId,
});
export type BudgetStop = typeof BudgetStop.Type;

/** A line recording a budget change or a stop at a limit, shown in the mission's top thread. */
export const BudgetEvent = Schema.Struct({ at: Schema.Number, id: Schema.String, text: Schema.String });
export type BudgetEvent = typeof BudgetEvent.Type;

/** What one part spent: a thread of a mission, or a mission under the global budget. */
export const BudgetPart = Schema.Struct({ id: Schema.String, spent: Spending, title: Schema.String });
export type BudgetPart = typeof BudgetPart.Type;

/** The budget window: used of limit, the split, and for the global budget its period. */
export const BudgetWindow = Schema.Struct({
  limits: BudgetLimits,
  /** When the global period starts over; null for a mission. */
  nextStart: Schema.NullOr(Schema.Number),
  parts: Schema.Array(BudgetPart),
  period: Schema.NullOr(BudgetPeriod),
  periodStart: Schema.NullOr(Schema.Number),
  spent: Spending,
  /** The open stop in this scope, or null. */
  stop: Schema.NullOr(BudgetStop),
});
export type BudgetWindow = typeof BudgetWindow.Type;

/** A mission with its thread tree and one selected thread's conversation. */
export const MissionDetail = Schema.Struct({
  /** Budget lines, shown in the top thread only. */
  budgetEvents: Schema.Array(BudgetEvent),
  /** The mission's open budget stop when the selected thread holds its question. */
  budgetStop: Schema.NullOr(BudgetStop),
  chatter: Schema.Array(ChatterNotice),
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

/** Who wrote a journal entry: a thread of the mission, or the owner (mission-journal, Content). */
export const JournalAuthorKind = Schema.Literals(["thread", "user"]);
export type JournalAuthorKind = typeof JournalAuthorKind.Type;

/** One change log entry; never edited or deleted. */
export const JournalEntry = Schema.Struct({
  authorKind: JournalAuthorKind,
  /** The writing thread's title when it wrote the entry; null for the owner. */
  authorTitle: Schema.NullOr(Schema.String),
  /** The entry's place in the change log, from 1. */
  number: Schema.Number,
  text: Schema.String,
  writtenAt: Schema.Number,
});
export type JournalEntry = typeof JournalEntry.Type;

/** A mission's journal as the owner reads it: the briefing and the whole change log, newest first. */
export const JournalView = Schema.Struct({
  briefing: Schema.String,
  /** The briefing's estimated size and its limit, in tokens. */
  briefingTokens: Schema.Number,
  entries: Schema.Array(JournalEntry),
  limit: Schema.Number,
  missionId: MissionId,
  /** Increases with each rewrite; a rewrite names the version it was based on. */
  version: Schema.Number,
});
export type JournalView = typeof JournalView.Type;

// Requests

export const StartMission = Schema.TaggedStruct("StartMission", {
  effort: EffortChoice,
  model: ModelChoice,
  requestId: RequestId,
  text: MessageText,
  /** An existing folder, chosen in the system's folder dialog, or null for the mission's scratch folder. */
  workspacePath: Schema.NullOr(Schema.String),
});
export const SendMessage = Schema.TaggedStruct("SendMessage", {
  /** Steer or Queue while the thread runs; null uses the owner's default. */
  delivery: Schema.NullOr(MessageDelivery),
  requestId: RequestId,
  text: MessageText,
  threadId: ThreadId,
});
/** The dashboard (not archived) or the Archived view, filtered by state and workspace and searched. */
export const ListMissions = Schema.TaggedStruct("ListMissions", {
  isArchived: Schema.Boolean,
  /** Matched against titles and briefings, ignoring case; null or blank matches all. */
  search: Schema.NullOr(Schema.String),
  state: Schema.NullOr(MissionState),
  workspaceId: Schema.NullOr(WorkspaceId),
});
export const ReadStartChoices = Schema.TaggedStruct("ReadStartChoices", {});
/** The owner renames a mission; `set_mission_title` is refused afterwards. */
export const RenameMission = Schema.TaggedStruct("RenameMission", { missionId: MissionId, title: Schema.String });
export const PreviewEnding = Schema.TaggedStruct("PreviewEnding", { ending: MissionEnding, missionId: MissionId });
/** Marks Done or archives, stopping the threads the preview named; a changed set asks for a fresh preview. */
export const EndMission = Schema.TaggedStruct("EndMission", {
  ending: MissionEnding,
  missionId: MissionId,
  snapshot: Schema.String,
});
/** Returns a Done or archived mission to the state worked out from its threads. */
export const ReopenMission = Schema.TaggedStruct("ReopenMission", { missionId: MissionId });
/** Not now on a dashboard question; the inactivity question comes back after another inactive period. */
export const DismissMissionPrompt = Schema.TaggedStruct("DismissMissionPrompt", {
  missionId: MissionId,
  prompt: MissionPrompt,
});
/** Reads a mission with the conversation of one of its threads; null reads the top thread. */
export const ReadMission = Schema.TaggedStruct("ReadMission", {
  missionId: MissionId,
  threadId: Schema.NullOr(ThreadId),
});
/** The owner opens a thread beneath any thread of a mission, with its first message (thread-tree, Opening a thread). */
export const OpenThread = Schema.TaggedStruct("OpenThread", {
  effort: EffortChoice,
  model: ModelChoice,
  parentThreadId: ThreadId,
  requestId: RequestId,
  text: MessageText,
});

/** The counts and snapshot covered by one permanent deletion confirmation. */
export const DeletionPreview = Schema.Struct({
  confirmation: Schema.String,
  descendantCount: Schema.Number,
  isMission: Schema.Boolean,
  runningCount: Schema.Number,
});
export type DeletionPreview = typeof DeletionPreview.Type;
/** Reads the subtree before the owner confirms its deletion. */
export const PreviewDeletion = Schema.TaggedStruct("PreviewDeletion", { threadId: ThreadId });
/** Deletes exactly the subtree the owner reviewed, or asks for a fresh preview if it changed. */
export const DeleteThread = Schema.TaggedStruct("DeleteThread", { confirmation: Schema.String, threadId: ThreadId });

/** The owner resolves exactly one chatter pause. */
export const ResolveChatter = Schema.TaggedStruct("ResolveChatter", {
  choice: Schema.Literals(["Continue", "Stop"]),
  id: Schema.String,
});

export const ReadSettings = Schema.TaggedStruct("ReadSettings", {});

export const ReadJournal = Schema.TaggedStruct("ReadJournal", { missionId: MissionId });
/** The owner rewrites the briefing; refused when another rewrite came after `basedOn` (mission-journal, The user). */
export const RewriteBriefing = Schema.TaggedStruct("RewriteBriefing", {
  basedOn: Schema.Number,
  briefing: Schema.String,
  /** The entry recorded with the rewrite; null records "Rewrote the briefing". */
  entry: Schema.NullOr(Schema.String),
  missionId: MissionId,
  requestId: RequestId,
});
/** The owner adds a change log entry. */
export const AddJournalEntry = Schema.TaggedStruct("AddJournalEntry", {
  missionId: MissionId,
  requestId: RequestId,
  text: MessageText,
});

/** The owner's answer to one open question. */
export const Answer = Schema.Literals(["Allow", "AlwaysAllow", "Deny"]);
export type Answer = typeof Answer.Type;
export const AnswerQuestion = Schema.TaggedStruct("AnswerQuestion", {
  answer: Answer,
  /** On Deny, an optional message: why, or what to do instead. */
  message: Schema.NullOr(Schema.String),
  questionId: QuestionId,
});
export const ListOpenQuestions = Schema.TaggedStruct("ListOpenQuestions", {});
/** The owner sets, changes, or removes a mission's budget; raising past the spending resumes stopped threads. */
export const SetMissionBudget = Schema.TaggedStruct("SetMissionBudget", { limits: BudgetLimits, missionId: MissionId });
/** Reads a mission's budget window, or the global one with null. */
export const ReadBudget = Schema.TaggedStruct("ReadBudget", { missionId: Schema.NullOr(MissionId) });
/** The owner answers Stop (or Stop all) to a reached budget: its threads stay stopped. */
export const StopAtBudget = Schema.TaggedStruct("StopAtBudget", { stopId: Schema.String });
/** The owner's choice for an off-topic request (thread-tree, Off-topic requests). */
export const SuggestionAnswer = Schema.Union([
  Schema.TaggedStruct("Continue", { missionId: MissionId }),
  Schema.TaggedStruct("NewMission", { effort: EffortChoice, model: ModelChoice }),
  Schema.TaggedStruct("Aside", {}),
]);
export type SuggestionAnswer = typeof SuggestionAnswer.Type;
export const AnswerSuggestion = Schema.TaggedStruct("AnswerSuggestion", {
  answer: SuggestionAnswer,
  suggestionId: SuggestionId,
});
/** Ends a running thread's current turn and keeps the thread usable (thread-messaging, Interruptions). */
export const InterruptThread = Schema.TaggedStruct("InterruptThread", { threadId: ThreadId });
export const StopThread = Schema.TaggedStruct("StopThread", { threadId: ThreadId });
/** Continues a Stopped thread with the messages kept for it (thread-tree, Stopping). */
export const ResumeThread = Schema.TaggedStruct("ResumeThread", { threadId: ThreadId });
/** Tries again a thread waiting in Attention on its missing workspace folder (Retry). */
export const RetryThread = Schema.TaggedStruct("RetryThread", { threadId: ThreadId });
export const ReadPermissions = Schema.TaggedStruct("ReadPermissions", { missionId: Schema.NullOr(MissionId) });
export const WidenPermission = Schema.TaggedStruct("WidenPermission", { permissionId: PermissionId });
export const RemovePermission = Schema.TaggedStruct("RemovePermission", { permissionId: PermissionId });
export const UpdateSettings = Schema.TaggedStruct("UpdateSettings", { settings: Settings });
// Folder browsing under the browsable roots, kept for the phone; the desktop uses the system dialog (CHG-0035).
/** Lists a folder's subfolders under the browsable roots; null lists the roots. */
export const BrowseFolders = Schema.TaggedStruct("BrowseFolders", {
  path: Schema.NullOr(Schema.String),
  /** Whether folders whose names start with a dot are listed too (Show hidden). */
  shouldIncludeHidden: Schema.Boolean,
});
/** Makes a folder inside a browsable folder (New folder). */
export const CreateFolder = Schema.TaggedStruct("CreateFolder", { name: Schema.String, parent: Schema.String });
/** Adds an existing folder to the browsable roots (Add root). */
export const AddBrowsableRoot = Schema.TaggedStruct("AddBrowsableRoot", { path: Schema.String });

export const Request = Schema.Union([
  StartMission,
  PreviewDeletion,
  ResolveChatter,
  DeleteThread,
  SendMessage,
  ListMissions,
  ReadStartChoices,
  RenameMission,
  PreviewEnding,
  EndMission,
  ReopenMission,
  DismissMissionPrompt,
  ReadMission,
  ReadSettings,
  UpdateSettings,
  ReadJournal,
  RewriteBriefing,
  AddJournalEntry,
  AnswerQuestion,
  AnswerSuggestion,
  SetMissionBudget,
  ReadBudget,
  StopAtBudget,
  ListOpenQuestions,
  StopThread,
  RetryThread,
  InterruptThread,
  OpenThread,
  ResumeThread,
  ReadPermissions,
  WidenPermission,
  RemovePermission,
  BrowseFolders,
  CreateFolder,
  AddBrowsableRoot,
]);
export type Request = typeof Request.Type;
export type RequestTag = Request["_tag"];

export const StartMissionResult = Schema.Struct({ messageId: MessageId, missionId: MissionId, threadId: ThreadId });
export type StartMissionResult = typeof StartMissionResult.Type;
export const SendMessageResult = Schema.Struct({ messageId: MessageId });
export type SendMessageResult = typeof SendMessageResult.Type;
export const OpenThreadResult = Schema.Struct({ messageId: MessageId, threadId: ThreadId });
export type OpenThreadResult = typeof OpenThreadResult.Type;

/** The result schema of each request, used by both sides to encode and decode. */
export const Results = {
  AddBrowsableRoot: FolderListing,
  AddJournalEntry: JournalView,
  AnswerQuestion: Question,
  AnswerSuggestion: Suggestion,
  BrowseFolders: FolderListing,
  CreateFolder: Folder,
  DeleteThread: Schema.Null,
  DismissMissionPrompt: Schema.Null,
  EndMission: Schema.Null,
  InterruptThread: Schema.Null,
  ListMissions: MissionList,
  ListOpenQuestions: Schema.Array(Question),
  OpenThread: OpenThreadResult,
  PreviewDeletion: DeletionPreview,
  PreviewEnding: EndingPreview,
  ReadBudget: BudgetWindow,
  ReadJournal: JournalView,
  ReadMission: MissionDetail,
  ReadPermissions: PermissionsView,
  ReadSettings: Settings,
  ReadStartChoices: StartChoices,
  RemovePermission: Schema.Null,
  RenameMission: Schema.Null,
  ReopenMission: Schema.Null,
  ResolveChatter: Schema.Null,
  ResumeThread: Schema.Null,
  RetryThread: Schema.Null,
  RewriteBriefing: JournalView,
  SendMessage: SendMessageResult,
  SetMissionBudget: Schema.Null,
  StartMission: StartMissionResult,
  StopAtBudget: Schema.Null,
  StopThread: Schema.Null,
  UpdateSettings: Settings,
  WidenPermission: Schema.Null,
} as const;
export type ResultOf<T extends RequestTag> = (typeof Results)[T]["Type"];

export const ErrorKind = Schema.Literals([
  "InvalidInput",
  "NotFound",
  "StaleVersion",
  "AccessRefused",
  "Unsupported",
  "MissingDependency",
  "ExecutionFailure",
]);
export type ErrorKind = typeof ErrorKind.Type;

export const ServiceError = Schema.Struct({ kind: ErrorKind, message: Schema.String });
export type ServiceError = typeof ServiceError.Type;

// Frames on the loopback WebSocket

export const ClientFrame = Schema.Struct({ id: Schema.String, request: Request });
export type ClientFrame = typeof ClientFrame.Type;

export const Success = Schema.TaggedStruct("Success", { id: Schema.String, value: Schema.Unknown });
export const Failure = Schema.TaggedStruct("Failure", { error: ServiceError, id: Schema.String });
/** Sent after each committed change; clients refetch what they show. */
export const Changed = Schema.TaggedStruct("Changed", { sequence: Schema.Number });

/** The reply a thread is writing, sent only while "Show replies as they're written" is on; never saved. */
export const Draft = Schema.TaggedStruct("Draft", { text: Schema.String, threadId: ThreadId });

export const ServerFrame = Schema.Union([Success, Failure, Changed, Draft]);
export type ServerFrame = typeof ServerFrame.Type;

export const ClientFrameJson = Schema.fromJsonString(ClientFrame);
export const ServerFrameJson = Schema.fromJsonString(ServerFrame);
