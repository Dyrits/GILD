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

/** How much asks for approval: sensitive actions only, or also commands and edits (action-approval, Approval level; CHG-0035). */
export const ApprovalLevel = Schema.Literals(["RiskyOnly", "CommandsAndEdits"]);
export type ApprovalLevel = typeof ApprovalLevel.Type;

/** How an owner message reaches a running thread: joining its current turn, or waiting for its next (thread-messaging, Delivery; CHG-0039). */
export const MessageDelivery = Schema.Literals(["Steer", "Queue"]);
export type MessageDelivery = typeof MessageDelivery.Type;

export const Settings = Schema.Struct({
  approvalLevel: ApprovalLevel,
  /** The most tokens a mission's briefing may hold, estimated at about 4 characters per token (mission-journal, Size). */
  briefingLimit: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /** Messages between two threads before the owner decides how they continue. */
  chatterThreshold: Schema.Int.check(Schema.isGreaterThanOrEqualTo(2)),
  /** What Send does while a thread runs; the second button does the other. */
  defaultDelivery: MessageDelivery,
  defaultEffort: EffortChoice,
  defaultModel: ModelChoice,
  shouldShowAgentThreads: Schema.Boolean,
  shouldStreamReplies: Schema.Boolean,
});
export type Settings = typeof Settings.Type;

const MessageText = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100_000));

export const MissionSummary = Schema.Struct({
  id: MissionId,
  lastActivityAt: Schema.Number,
  state: ThreadState,
  title: Schema.String,
  topThreadId: ThreadId,
  usage: TokenUsage,
  /** The top thread's workspace name; null when it runs in the mission's scratch folder. */
  workspaceName: Schema.NullOr(Schema.String),
});
export type MissionSummary = typeof MissionSummary.Type;

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
export const ThreadBlocker = Schema.Literals(["MissingWorkspace", "Chatter"]);
export type ThreadBlocker = typeof ThreadBlocker.Type;

/** One thread in a mission's tree, as the side tree lists it. */
export const ThreadSummary = Schema.Struct({
  /** Levels beneath the top thread, which is 0. */
  depth: Schema.Number,
  id: ThreadId,
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

/** A mission with its thread tree and one selected thread's conversation. */
export const MissionDetail = Schema.Struct({
  chatter: Schema.Array(ChatterNotice),
  /** The selected thread's messages. */
  messages: Schema.Array(Message),
  mission: MissionSummary,
  /** The selected thread's questions, open and recorded, in the order asked. */
  questions: Schema.Array(Question),
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
export const ListMissions = Schema.TaggedStruct("ListMissions", {});
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
  ReadMission,
  ReadSettings,
  UpdateSettings,
  ReadJournal,
  RewriteBriefing,
  AddJournalEntry,
  AnswerQuestion,
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
  BrowseFolders: FolderListing,
  CreateFolder: Folder,
  DeleteThread: Schema.Null,
  InterruptThread: Schema.Null,
  ListMissions: Schema.Array(MissionSummary),
  ListOpenQuestions: Schema.Array(Question),
  OpenThread: OpenThreadResult,
  PreviewDeletion: DeletionPreview,
  ReadJournal: JournalView,
  ReadMission: MissionDetail,
  ReadPermissions: PermissionsView,
  ReadSettings: Settings,
  RemovePermission: Schema.Null,
  ResolveChatter: Schema.Null,
  ResumeThread: Schema.Null,
  RetryThread: Schema.Null,
  RewriteBriefing: JournalView,
  SendMessage: SendMessageResult,
  StartMission: StartMissionResult,
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
