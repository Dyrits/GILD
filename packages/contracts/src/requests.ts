import { Schema } from "effect";
import { BudgetLimits, BudgetWindow } from "./budgets.ts";
import {
  BudgetStopId,
  MessageId,
  MissionId,
  PermissionId,
  QuestionId,
  SuggestionId,
  ThreadId,
  WorkspaceId,
} from "./ids.ts";
import { JournalView } from "./journal.ts";
import { PermissionsView, Question } from "./questions.ts";
import {
  EffortChoice,
  EndingPreview,
  MessageDelivery,
  MissionDetail,
  MissionEnding,
  MissionList,
  MissionPrompt,
  MissionState,
  ModelChoice,
  RequestId,
  Settings,
  StartChoices,
  Suggestion,
} from "./records.ts";
import { Folder, FolderListing } from "./workspaces.ts";

// Requests

const MessageText = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100_000));

/** Starts a mission with its first message, model, effort, and workspace. */
export const StartMission = Schema.TaggedStruct("StartMission", {
  effort: EffortChoice,
  model: ModelChoice,
  requestId: RequestId,
  text: MessageText,
  /** An existing folder, chosen in the system's folder dialog, or null for the mission's scratch folder. */
  workspacePath: Schema.NullOr(Schema.String),
});
/** Sends the owner's message to a thread, steered or queued. */
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
/** Asks for the new-mission choices prefilled from the last mission started. */
export const ReadStartChoices = Schema.TaggedStruct("ReadStartChoices", {});
/** The owner renames a mission; `set_mission_title` is refused afterwards. */
export const RenameMission = Schema.TaggedStruct("RenameMission", { missionId: MissionId, title: Schema.String });
/** Asks what ending a mission would stop, before the owner confirms. */
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

/** Reads the owner's settings. */
export const ReadSettings = Schema.TaggedStruct("ReadSettings", {});

/** Reads a mission's journal. */
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
/** The owner's answer to an approval question. */
export const AnswerQuestion = Schema.TaggedStruct("AnswerQuestion", {
  answer: Answer,
  /** On Deny, an optional message: why, or what to do instead. */
  message: Schema.NullOr(Schema.String),
  questionId: QuestionId,
});
/** Lists the open approval questions of every mission. */
export const ListOpenQuestions = Schema.TaggedStruct("ListOpenQuestions", {});
/** The owner sets, changes, or removes a mission's budget; raising past the spending resumes stopped threads. */
export const SetMissionBudget = Schema.TaggedStruct("SetMissionBudget", { limits: BudgetLimits, missionId: MissionId });
/** Reads a mission's budget window, or the global one with null. */
export const ReadBudget = Schema.TaggedStruct("ReadBudget", { missionId: Schema.NullOr(MissionId) });
/** The owner answers Stop (or Stop all) to a reached budget: its threads stay stopped. */
export const StopAtBudget = Schema.TaggedStruct("StopAtBudget", { stopId: BudgetStopId });
/** The owner's choice for an off-topic request (thread-tree, Off-topic requests). */
export const SuggestionAnswer = Schema.Union([
  Schema.TaggedStruct("Continue", { missionId: MissionId }),
  Schema.TaggedStruct("NewMission", { effort: EffortChoice, model: ModelChoice }),
  Schema.TaggedStruct("Aside", {}),
]);
export type SuggestionAnswer = typeof SuggestionAnswer.Type;
/** The owner's choice for an off-topic suggestion. */
export const AnswerSuggestion = Schema.TaggedStruct("AnswerSuggestion", {
  answer: SuggestionAnswer,
  suggestionId: SuggestionId,
});
/** Ends a running thread's current turn and keeps the thread usable (thread-messaging, Interruptions). */
export const InterruptThread = Schema.TaggedStruct("InterruptThread", { threadId: ThreadId });
/** Stops a thread's work; threads beneath keep running. */
export const StopThread = Schema.TaggedStruct("StopThread", { threadId: ThreadId });
/** Continues a Stopped thread with the messages kept for it (thread-tree, Stopping). */
export const ResumeThread = Schema.TaggedStruct("ResumeThread", { threadId: ThreadId });
/** Tries again a thread waiting in Attention on its missing workspace folder (Retry). */
export const RetryThread = Schema.TaggedStruct("RetryThread", { threadId: ThreadId });
/** Reads the standing permissions, for one mission or all. */
export const ReadPermissions = Schema.TaggedStruct("ReadPermissions", { missionId: Schema.NullOr(MissionId) });
/** Widens a standing permission to every mission. */
export const WidenPermission = Schema.TaggedStruct("WidenPermission", { permissionId: PermissionId });
/** Removes a standing permission. */
export const RemovePermission = Schema.TaggedStruct("RemovePermission", { permissionId: PermissionId });
/** Saves the owner's settings. */
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

/** Every request the app can make of the service. */
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

/** A started mission's identifiers. */
export const StartMissionResult = Schema.Struct({ messageId: MessageId, missionId: MissionId, threadId: ThreadId });
export type StartMissionResult = typeof StartMissionResult.Type;
/** A sent message's identifier. */
export const SendMessageResult = Schema.Struct({ messageId: MessageId });
export type SendMessageResult = typeof SendMessageResult.Type;
/** An opened thread's identifier and its first message's. */
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

/** The kinds of failure the app tells apart. */
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

/** A failure as the app receives it. */
export const ServiceError = Schema.Struct({ kind: ErrorKind, message: Schema.String });
export type ServiceError = typeof ServiceError.Type;
