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

const MessageText = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100_000));

export const MissionSummary = Schema.Struct({
  id: MissionId,
  title: Schema.String,
  state: ThreadState,
  topThreadId: ThreadId,
  lastActivityAt: Schema.Number,
});
export type MissionSummary = typeof MissionSummary.Type;

export const Message = Schema.Struct({
  id: MessageId,
  threadId: ThreadId,
  sender: SenderKind,
  text: Schema.String,
  sequence: Schema.Number,
  sentAt: Schema.Number,
});
export type Message = typeof Message.Type;

export const ThreadView = Schema.Struct({ id: ThreadId, state: ThreadState });

export const MissionDetail = Schema.Struct({
  mission: MissionSummary,
  thread: ThreadView,
  messages: Schema.Array(Message),
});
export type MissionDetail = typeof MissionDetail.Type;

// Requests

export const StartMission = Schema.TaggedStruct("StartMission", { requestId: RequestId, text: MessageText });
export const SendMessage = Schema.TaggedStruct("SendMessage", {
  requestId: RequestId,
  threadId: ThreadId,
  text: MessageText,
});
export const ListMissions = Schema.TaggedStruct("ListMissions", {});
export const ReadMission = Schema.TaggedStruct("ReadMission", { missionId: MissionId });

export const Request = Schema.Union([StartMission, SendMessage, ListMissions, ReadMission]);
export type Request = typeof Request.Type;
export type RequestTag = Request["_tag"];

export const StartMissionResult = Schema.Struct({ missionId: MissionId, threadId: ThreadId, messageId: MessageId });
export type StartMissionResult = typeof StartMissionResult.Type;
export const SendMessageResult = Schema.Struct({ messageId: MessageId });
export type SendMessageResult = typeof SendMessageResult.Type;

/** The result schema of each request, used by both sides to encode and decode. */
export const Results = {
  StartMission: StartMissionResult,
  SendMessage: SendMessageResult,
  ListMissions: Schema.Array(MissionSummary),
  ReadMission: MissionDetail,
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
export const Failure = Schema.TaggedStruct("Failure", { id: Schema.String, error: ServiceError });
/** Sent after each committed change; clients refetch what they show. */
export const Changed = Schema.TaggedStruct("Changed", { sequence: Schema.Number });

export const ServerFrame = Schema.Union([Success, Failure, Changed]);
export type ServerFrame = typeof ServerFrame.Type;

export const ClientFrameJson = Schema.fromJsonString(ClientFrame);
export const ServerFrameJson = Schema.fromJsonString(ServerFrame);
