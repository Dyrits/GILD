import { Schema } from "effect";
import { AttachmentCard, AttachmentContent, maxAttachmentsPerMessage } from "./attachments.ts";
import { BudgetLimits, BudgetWindow } from "./budgets.ts";
import { Crest } from "./crest.ts";
import { HarnessList, HarnessName } from "./harnesses.ts";
import {
  AccountId,
  AttachmentId,
  BudgetStopId,
  LoreChangeId,
  LoreEntryId,
  LoreHistoryEntryId,
  LoreProposalId,
  MessageId,
  MissionId,
  PermissionId,
  QuestionId,
  SuggestionId,
  ThreadId,
  WorkspaceId,
} from "./ids.ts";
import { JournalView } from "./journal.ts";
import { LoreHistory, LoreScope, LoreStateFilter, LoreView } from "./lore.ts";
import { PermissionsView, Question } from "./questions.ts";
import {
  EffortChoice,
  EndingPreview,
  GuildmasterPlace,
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
  StartingContext,
  Suggestion,
  ThreadPanel,
} from "./records.ts";
import {
  CreateRitual,
  CreateRitualResult,
  DeleteRitual,
  ListRituals,
  ReadRitual,
  Ritual,
  RunRitual,
  UpdateRitual,
} from "./rituals.ts";
import { Skill } from "./skills.ts";
import { WorkspaceEntry } from "./workspaceEntries.ts";
import { Folder, FolderListing } from "./workspaces.ts";

// Requests

const MessageText = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100_000));
/** The text of an owner's message, which may be empty when files are attached (message-attachments). */
const OwnerMessageText = Schema.String.check(Schema.isMaxLength(100_000));
/** The files an owner's message carries, added beforehand with `AddAttachment`; absent is none. */
const AttachmentIds = Schema.optionalKey(
  Schema.Array(AttachmentId).check(Schema.isMaxLength(maxAttachmentsPerMessage)),
);

/** Adds a file to the message the owner is writing: it is checked, stored as a draft, and answered as a card. */
export const AddAttachment = Schema.TaggedStruct("AddAttachment", {
  /** The file's bytes, base64. */
  data: Schema.String,
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(255)),
});
/** Removes a draft the owner took out of the message before sending it. */
export const DiscardAttachment = Schema.TaggedStruct("DiscardAttachment", { attachmentId: AttachmentId });
/** Reads an attached file's bytes; they never ride inside a conversation. */
export const ReadAttachment = Schema.TaggedStruct("ReadAttachment", { attachmentId: AttachmentId });

/** Starts a mission with its first message, model, effort, and workspace. */
export const StartMission = Schema.TaggedStruct("StartMission", {
  /** The provider account, or null for the harness's own sign-in on this computer; absent is null. */
  accountId: Schema.optionalKey(Schema.NullOr(AccountId)),
  attachmentIds: AttachmentIds,
  effort: EffortChoice,
  /** Absent starts on the Settings default harness. */
  harness: Schema.optionalKey(HarnessName),
  model: ModelChoice,
  /**
   * The name and crest the owner gave a folder that is not a realm yet; used when this mission turns it into one, and
   * ignored when the folder already is a realm. Absent names it after its folder, with no crest of its own.
   */
  realm: Schema.optionalKey(
    Schema.Struct({
      crest: Schema.NullOr(Crest),
      name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(80)),
    }),
  ),
  requestId: RequestId,
  text: OwnerMessageText,
  /** An existing folder, chosen in the system's folder dialog, or null for the mission's scratch folder. */
  workspacePath: Schema.NullOr(Schema.String),
});
/** Sends the owner's message to a thread, steered or queued. */
export const SendMessage = Schema.TaggedStruct("SendMessage", {
  attachmentIds: AttachmentIds,
  /** Steer or Queue while the thread runs; null uses the owner's default. */
  delivery: Schema.NullOr(MessageDelivery),
  /** The realm's folder the owner attached, for the Guildmaster: a quest it opens starts there. */
  realmPath: Schema.optionalKey(Schema.NullOr(Schema.String)),
  requestId: RequestId,
  text: OwnerMessageText,
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
/** Where the Guildmaster's conversation is; the service makes it on first use. */
export const ReadGuildmaster = Schema.TaggedStruct("ReadGuildmaster", {});
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
/** Reads what the thread panel shows of a thread: its context gauge and what it spent (thread-panel). */
export const ReadThreadPanel = Schema.TaggedStruct("ReadThreadPanel", { threadId: ThreadId });
/** The owner opens a thread beneath any thread of a mission, with its first message (thread-tree, Opening a thread). */
export const OpenThread = Schema.TaggedStruct("OpenThread", {
  /** Absent keeps the parent's account when the harness is the parent's, else the computer's own sign-in. */
  accountId: Schema.optionalKey(Schema.NullOr(AccountId)),
  attachmentIds: AttachmentIds,
  effort: EffortChoice,
  /** Absent runs on the parent's harness. */
  harness: Schema.optionalKey(HarnessName),
  model: ModelChoice,
  parentThreadId: ThreadId,
  requestId: RequestId,
  /** The owner chose to start it although its starting context is over the warning share. */
  shouldStartAnyway: Schema.Boolean,
  text: OwnerMessageText,
});
/** What a thread the owner opens beneath a thread would start with, before it starts (thread-tree, Opening a thread). */
export const PreviewStartingContext = Schema.TaggedStruct("PreviewStartingContext", {
  /** Absent runs on the parent's harness. */
  harness: Schema.optionalKey(HarnessName),
  model: ModelChoice,
  parentThreadId: ThreadId,
  /** The request typed so far, which may still be empty. */
  text: Schema.String.check(Schema.isMaxLength(100_000)),
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

// Request tags such as "ListIntel" are wire names kept as `intel`; the constants follow the code.
/** The lore panel: the lore in a thread's scope, most specific first, or all lore; filtered by scope and state. */
export const ListLore = Schema.TaggedStruct("ListIntel", {
  scope: Schema.NullOr(LoreScope),
  state: Schema.NullOr(LoreStateFilter),
  threadId: Schema.NullOr(ThreadId),
  /** Only the lore of this realm's own scope; absent shows the lore the other filters give. */
  workspaceId: Schema.optionalKey(Schema.NullOr(WorkspaceId)),
});
/** The owner pins a lore entry so it never fades, or unpins it. */
export const PinLoreEntry = Schema.TaggedStruct("PinIntel", { isPinned: Schema.Boolean, loreEntryId: LoreEntryId });
/** The owner makes a dormant or archived lore entry active again, at full strength. */
export const RestoreLoreEntry = Schema.TaggedStruct("RestoreIntel", { loreEntryId: LoreEntryId });
/** The owner corrects a lore entry's text. */
export const EditLoreEntry = Schema.TaggedStruct("EditIntel", { loreEntryId: LoreEntryId, text: MessageText });
/** The owner deletes a lore entry. */
export const DeleteLoreEntry = Schema.TaggedStruct("DeleteIntel", { loreEntryId: LoreEntryId });
/** A lore entry's history, newest first, deleted lore included (scoped-intel, History and undo). */
export const ReadLoreHistory = Schema.TaggedStruct("ReadIntelHistory", { loreEntryId: LoreEntryId });
/** The owner undoes one change in a lore entry's history; undoing a deletion restores the lore. */
export const UndoLoreChange = Schema.TaggedStruct("UndoIntelChange", { entryId: LoreHistoryEntryId });
/** The owner approves or declines a thread's change awaiting approval: a global save, change, or deletion, or a widening. */
export const ResolveLoreChange = Schema.TaggedStruct("ResolveIntelChange", {
  changeId: LoreChangeId,
  isApproved: Schema.Boolean,
});

/** The owner approves or declines a widening or narrowing the service proposed from evidence. */
export const ResolveLoreProposal = Schema.TaggedStruct("ResolveIntelProposal", {
  isApproved: Schema.Boolean,
  proposalId: LoreProposalId,
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
/** The owner imports a folder as a realm, named and given a crest, before any quest starts in it. */
export const CreateRealm = Schema.TaggedStruct("CreateRealm", {
  crest: Schema.NullOr(Crest),
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(80)),
  path: Schema.String,
});
/** The owner renames a realm; refused when the name is blank. */
export const RenameRealm = Schema.TaggedStruct("RenameRealm", {
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(80)),
  workspaceId: WorkspaceId,
});
/** The owner designs a realm's crest, or clears it with null to go back to the one its id gives. */
export const SetRealmCrest = Schema.TaggedStruct("SetRealmCrest", {
  crest: Schema.NullOr(Crest),
  workspaceId: WorkspaceId,
});
/** Reads a mission's budget window, or the global one with null. */
export const ReadBudget = Schema.TaggedStruct("ReadBudget", { missionId: Schema.NullOr(MissionId) });
/** The owner answers Stop (or Stop all) to a reached budget: its threads stay stopped. */
export const StopAtBudget = Schema.TaggedStruct("StopAtBudget", { stopId: BudgetStopId });
/** The owner's choice for an off-topic request (thread-tree, Off-topic requests). */
export const SuggestionAnswer = Schema.Union([
  Schema.TaggedStruct("Continue", { missionId: MissionId }),
  Schema.TaggedStruct("NewMission", {
    /** Absent keeps the suggesting thread's account and harness, as for the next two. */
    accountId: Schema.optionalKey(Schema.NullOr(AccountId)),
    effort: EffortChoice,
    harness: Schema.optionalKey(HarnessName),
    model: ModelChoice,
  }),
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
/**
 * Hands a thread over to another harness, account, model, or effort between turns (thread-handover). A change of
 * harness or account starts a new session with the thread's whole conversation; the rest carries on.
 */
export const ChangeThreadRunner = Schema.TaggedStruct("ChangeThreadRunner", {
  /** The provider account, or null for the harness's own sign-in on this computer. */
  accountId: Schema.NullOr(AccountId),
  effort: EffortChoice,
  harness: HarnessName,
  model: ModelChoice,
  threadId: ThreadId,
});
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
/** The skills a message in a workspace (or none) can name with a slash; the workspace's win over global ones. */
export const ListSkills = Schema.TaggedStruct("ListSkills", { workspacePath: Schema.NullOr(Schema.String) });
/** The files and folders of a workspace that a typed `@` can name, best matches first; refused for a folder that is not a workspace. */
export const ListWorkspaceEntries = Schema.TaggedStruct("ListWorkspaceEntries", {
  /** What follows the `@`: part of a name or of a path inside the workspace; empty lists the top level. */
  query: Schema.String,
  workspacePath: Schema.String,
});
/** Makes a folder inside a browsable folder (New folder). */
export const CreateFolder = Schema.TaggedStruct("CreateFolder", { name: Schema.String, parent: Schema.String });
/** Adds an existing folder to the browsable roots (Add root). */
export const AddBrowsableRoot = Schema.TaggedStruct("AddBrowsableRoot", { path: Schema.String });

/** Every harness with its accounts, sign-in states, and models (provider-accounts). */
export const ListHarnesses = Schema.TaggedStruct("ListHarnesses", {});

const AccountLabel = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(80));

/** Adds a provider account to a harness, with its own folder; it is signed out until the owner signs in. */
export const AddAccount = Schema.TaggedStruct("AddAccount", { harness: HarnessName, label: AccountLabel });

/** Renames a provider account added in Gild. */
export const RenameAccount = Schema.TaggedStruct("RenameAccount", { accountId: AccountId, label: AccountLabel });

/** Removes a provider account and its folder; refused while a thread that is not ended uses it. */
export const RemoveAccount = Schema.TaggedStruct("RemoveAccount", { accountId: AccountId });

/**
 * Opens the harness's own sign-in for an account in a terminal window on this computer; Gild never
 * sees the credentials (requirements, Comply with provider terms). Null signs in the computer's own account.
 */
export const SignInAccount = Schema.TaggedStruct("SignInAccount", {
  accountId: Schema.NullOr(AccountId),
  harness: HarnessName,
});

/** Every request the app can make of the service. */
export const Request = Schema.Union([
  AddAttachment,
  DiscardAttachment,
  ReadAttachment,
  StartMission,
  PreviewDeletion,
  ResolveChatter,
  DeleteThread,
  SendMessage,
  ListMissions,
  ReadStartChoices,
  ReadGuildmaster,
  RenameMission,
  PreviewEnding,
  EndMission,
  ReopenMission,
  DismissMissionPrompt,
  ReadMission,
  ReadThreadPanel,
  ReadSettings,
  UpdateSettings,
  ReadJournal,
  RewriteBriefing,
  AddJournalEntry,
  ListLore,
  EditLoreEntry,
  DeleteLoreEntry,
  PinLoreEntry,
  RestoreLoreEntry,
  ResolveLoreChange,
  ResolveLoreProposal,
  ReadLoreHistory,
  UndoLoreChange,
  AnswerQuestion,
  AnswerSuggestion,
  SetMissionBudget,
  SetRealmCrest,
  RenameRealm,
  CreateRealm,
  ReadBudget,
  StopAtBudget,
  ListOpenQuestions,
  StopThread,
  RetryThread,
  ChangeThreadRunner,
  CreateRitual,
  UpdateRitual,
  RunRitual,
  DeleteRitual,
  ListRituals,
  ReadRitual,
  InterruptThread,
  OpenThread,
  PreviewStartingContext,
  ResumeThread,
  ReadPermissions,
  WidenPermission,
  RemovePermission,
  BrowseFolders,
  ListSkills,
  ListWorkspaceEntries,
  CreateFolder,
  AddBrowsableRoot,
  ListHarnesses,
  AddAccount,
  RenameAccount,
  RemoveAccount,
  SignInAccount,
]);
export type Request = typeof Request.Type;
/** The name of one kind of request. */
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
  AddAccount: HarnessList,
  AddAttachment: AttachmentCard,
  AddBrowsableRoot: FolderListing,
  AddJournalEntry: JournalView,
  AnswerQuestion: Question,
  AnswerSuggestion: Suggestion,
  BrowseFolders: FolderListing,
  ChangeThreadRunner: Schema.Null,
  CreateFolder: Folder,
  CreateRealm: Schema.Null,
  CreateRitual: CreateRitualResult,
  DeleteIntel: Schema.Null,
  DeleteRitual: Schema.Null,
  DeleteThread: Schema.Null,
  DiscardAttachment: Schema.Null,
  DismissMissionPrompt: Schema.Null,
  EditIntel: Schema.Null,
  EndMission: Schema.Null,
  InterruptThread: Schema.Null,
  ListHarnesses: HarnessList,
  ListIntel: LoreView,
  ListMissions: MissionList,
  ListOpenQuestions: Schema.Array(Question),
  ListRituals: Schema.Array(Ritual),
  ListSkills: Schema.Array(Skill),
  ListWorkspaceEntries: Schema.Array(WorkspaceEntry),
  OpenThread: OpenThreadResult,
  PinIntel: Schema.Null,
  PreviewDeletion: DeletionPreview,
  PreviewEnding: EndingPreview,
  PreviewStartingContext: StartingContext,
  ReadAttachment: AttachmentContent,
  ReadBudget: BudgetWindow,
  ReadGuildmaster: GuildmasterPlace,
  ReadIntelHistory: LoreHistory,
  ReadJournal: JournalView,
  ReadMission: MissionDetail,
  ReadPermissions: PermissionsView,
  ReadRitual: Schema.NullOr(Ritual),
  ReadSettings: Settings,
  ReadStartChoices: StartChoices,
  ReadThreadPanel: ThreadPanel,
  RemoveAccount: HarnessList,
  RemovePermission: Schema.Null,
  RenameAccount: HarnessList,
  RenameMission: Schema.Null,
  RenameRealm: Schema.Null,
  ReopenMission: Schema.Null,
  ResolveChatter: Schema.Null,
  ResolveIntelChange: Schema.Null,
  ResolveIntelProposal: Schema.Null,
  RestoreIntel: Schema.Null,
  ResumeThread: Schema.Null,
  RetryThread: Schema.Null,
  RewriteBriefing: JournalView,
  RunRitual: Schema.Null,
  SendMessage: SendMessageResult,
  SetMissionBudget: Schema.Null,
  SetRealmCrest: Schema.Null,
  SignInAccount: Schema.Null,
  StartMission: StartMissionResult,
  StopAtBudget: Schema.Null,
  StopThread: Schema.Null,
  UndoIntelChange: Schema.Null,
  UpdateRitual: Schema.Null,
  UpdateSettings: Settings,
  WidenPermission: Schema.Null,
} as const;
/** What the service answers to one kind of request. */
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
