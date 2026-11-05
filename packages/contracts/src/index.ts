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

export const SenderKind = Schema.Literals(["user", "agent"]);
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

/** How much asks for approval (action-approval, Approval level; CHG-0031). */
export const ApprovalLevel = Schema.Literals(["RiskyOnly", "CommandsAndEdits"]);
export type ApprovalLevel = typeof ApprovalLevel.Type;

export const Settings = Schema.Struct({
  approvalLevel: ApprovalLevel,
  defaultEffort: EffortChoice,
  defaultModel: ModelChoice,
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
  id: MessageId,
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

export const ThreadView = Schema.Struct({
  effort: EffortChoice,
  /** Why the last turn failed, while the thread is Failed. */
  failure: Schema.NullOr(Schema.String),
  id: ThreadId,
  model: ModelChoice,
  state: ThreadState,
  /** Null when the thread runs in its mission's scratch folder. */
  workspace: Schema.NullOr(Workspace),
});

export const MissionDetail = Schema.Struct({
  messages: Schema.Array(Message),
  mission: MissionSummary,
  /** The thread's questions, open and recorded, in the order asked. */
  questions: Schema.Array(Question),
  thread: ThreadView,
});
export type MissionDetail = typeof MissionDetail.Type;

// Requests

export const StartMission = Schema.TaggedStruct("StartMission", {
  effort: EffortChoice,
  model: ModelChoice,
  requestId: RequestId,
  text: MessageText,
  /** A folder under a browsable root, or null for the mission's scratch folder. */
  workspacePath: Schema.NullOr(Schema.String),
});
export const SendMessage = Schema.TaggedStruct("SendMessage", {
  requestId: RequestId,
  text: MessageText,
  threadId: ThreadId,
});
export const ListMissions = Schema.TaggedStruct("ListMissions", {});
export const ReadMission = Schema.TaggedStruct("ReadMission", { missionId: MissionId });

export const ReadSettings = Schema.TaggedStruct("ReadSettings", {});

/** The owner's answer to one open question. */
export const Answer = Schema.Literals(["Allow", "AlwaysAllow", "Deny", "Discard"]);
export type Answer = typeof Answer.Type;
export const AnswerQuestion = Schema.TaggedStruct("AnswerQuestion", {
  answer: Answer,
  /** Deny with a message: why, or what to do instead. */
  message: Schema.NullOr(Schema.String),
  questionId: QuestionId,
});
export const ListOpenQuestions = Schema.TaggedStruct("ListOpenQuestions", {});
export const StopThread = Schema.TaggedStruct("StopThread", { threadId: ThreadId });
export const ReadPermissions = Schema.TaggedStruct("ReadPermissions", { missionId: Schema.NullOr(MissionId) });
export const WidenPermission = Schema.TaggedStruct("WidenPermission", { permissionId: PermissionId });
export const RemovePermission = Schema.TaggedStruct("RemovePermission", { permissionId: PermissionId });
export const UpdateSettings = Schema.TaggedStruct("UpdateSettings", { settings: Settings });
/** Lists a folder's subfolders under the browsable roots; null lists the roots. */
export const BrowseFolders = Schema.TaggedStruct("BrowseFolders", { path: Schema.NullOr(Schema.String) });
/** Makes a folder inside a browsable folder (New folder). */
export const CreateFolder = Schema.TaggedStruct("CreateFolder", { name: Schema.String, parent: Schema.String });
/** Adds an existing folder to the browsable roots (Add root). */
export const AddBrowsableRoot = Schema.TaggedStruct("AddBrowsableRoot", { path: Schema.String });

export const Request = Schema.Union([
  StartMission,
  SendMessage,
  ListMissions,
  ReadMission,
  ReadSettings,
  UpdateSettings,
  AnswerQuestion,
  ListOpenQuestions,
  StopThread,
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

/** The result schema of each request, used by both sides to encode and decode. */
export const Results = {
  AddBrowsableRoot: FolderListing,
  AnswerQuestion: Question,
  BrowseFolders: FolderListing,
  CreateFolder: Folder,
  ListMissions: Schema.Array(MissionSummary),
  ListOpenQuestions: Schema.Array(Question),
  ReadMission: MissionDetail,
  ReadPermissions: PermissionsView,
  ReadSettings: Settings,
  RemovePermission: Schema.Null,
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
