import { Schema } from "effect";

// Records shared by the service and the app. The app may only call Schema's
// decode and encode functions on them (CHG-0025, ADR 0010 amendment).

export const MissionId = Schema.String.pipe(Schema.brand("MissionId"));
export type MissionId = typeof MissionId.Type;

export const ThreadId = Schema.String.pipe(Schema.brand("ThreadId"));
export type ThreadId = typeof ThreadId.Type;

export const MessageId = Schema.String.pipe(Schema.brand("MessageId"));
export type MessageId = typeof MessageId.Type;

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

export const Settings = Schema.Struct({
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

export const ThreadView = Schema.Struct({
  effort: EffortChoice,
  /** Why the last turn failed, while the thread is Failed. */
  failure: Schema.NullOr(Schema.String),
  id: ThreadId,
  model: ModelChoice,
  state: ThreadState,
});

export const MissionDetail = Schema.Struct({
  messages: Schema.Array(Message),
  mission: MissionSummary,
  thread: ThreadView,
});
export type MissionDetail = typeof MissionDetail.Type;

// Requests

export const StartMission = Schema.TaggedStruct("StartMission", {
  effort: EffortChoice,
  model: ModelChoice,
  requestId: RequestId,
  text: MessageText,
});
export const SendMessage = Schema.TaggedStruct("SendMessage", {
  requestId: RequestId,
  text: MessageText,
  threadId: ThreadId,
});
export const ListMissions = Schema.TaggedStruct("ListMissions", {});
export const ReadMission = Schema.TaggedStruct("ReadMission", { missionId: MissionId });

export const ReadSettings = Schema.TaggedStruct("ReadSettings", {});
export const UpdateSettings = Schema.TaggedStruct("UpdateSettings", { settings: Settings });

export const Request = Schema.Union([
  StartMission,
  SendMessage,
  ListMissions,
  ReadMission,
  ReadSettings,
  UpdateSettings,
]);
export type Request = typeof Request.Type;
export type RequestTag = Request["_tag"];

export const StartMissionResult = Schema.Struct({ messageId: MessageId, missionId: MissionId, threadId: ThreadId });
export type StartMissionResult = typeof StartMissionResult.Type;
export const SendMessageResult = Schema.Struct({ messageId: MessageId });
export type SendMessageResult = typeof SendMessageResult.Type;

/** The result schema of each request, used by both sides to encode and decode. */
export const Results = {
  ListMissions: Schema.Array(MissionSummary),
  ReadMission: MissionDetail,
  ReadSettings: Settings,
  SendMessage: SendMessageResult,
  StartMission: StartMissionResult,
  UpdateSettings: Settings,
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
