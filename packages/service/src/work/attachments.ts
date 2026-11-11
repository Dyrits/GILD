import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type AttachmentCard,
  type AttachmentContent,
  AttachmentId,
  type AttachmentMediaType,
  maxAttachmentBytes,
  maxAttachmentsPerMessage,
} from "@iskios/contracts";
import { Clock, Context, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound, ServiceFailure } from "../core/index.ts";

// Files the owner attaches to a message (message-attachments): checked by their first bytes, kept in one folder
// of the data directory outside every thread's working folder, and read by the harness at the turn.
// This module alone writes and erases them; bytes never enter the database or a log line.

/** The folder holding every attached file, drafts and sent ones. */
export class AttachmentsRoot extends Context.Service<AttachmentsRoot, string>()("iskios/AttachmentsRoot") {}

const extensionOf = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} satisfies Record<AttachmentMediaType, string>;

const startsWith = (bytes: Uint8Array, at: number, text: ReadonlyArray<number>) =>
  text.every((byte, index) => bytes[at + index] === byte);
const asciiOf = (text: string) => [...text].map((character) => character.charCodeAt(0));

/** What kind of image a file's first bytes say it is, or null when they say none of the accepted kinds. */
export const mediaTypeOf = (bytes: Uint8Array): AttachmentMediaType | null => {
  if (startsWith(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, 0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, 0, asciiOf("GIF87a")) || startsWith(bytes, 0, asciiOf("GIF89a"))) return "image/gif";
  if (startsWith(bytes, 0, asciiOf("RIFF")) && startsWith(bytes, 8, asciiOf("WEBP"))) return "image/webp";
  return null;
};

/** Whether the first bytes are a HEIC or HEIF photo, which the owner's browser cannot reduce and no harness takes. */
const isHeic = (bytes: Uint8Array) =>
  startsWith(bytes, 4, asciiOf("ftyp")) &&
  ["heic", "heix", "hevc", "mif1", "msf1"].some((brand) => startsWith(bytes, 8, asciiOf(brand)));

/** One stored file as the harness reads it: where it is, relative to the root, with its name and type. */
export interface StoredAttachment {
  readonly file: string;
  readonly id: string;
  readonly mediaType: AttachmentMediaType;
  readonly name: string;
}

const failed = (action: string) => (error: unknown) =>
  new ServiceFailure({ kind: "ExecutionFailure", message: `Could not ${action}: ${String(error)}` });

/** Checks and stores a file as a draft, not yet part of any message, and answers its card. */
export const addAttachment = (name: string, data: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const root = yield* AttachmentsRoot;
    const bytes = Buffer.from(data, "base64");
    if (bytes.length === 0) return yield* invalid(`${name} is empty.`);
    if (bytes.length > maxAttachmentBytes)
      return yield* invalid(`${name} is over ${maxAttachmentBytes / (1024 * 1024)} MB.`);
    const mediaType = mediaTypeOf(bytes);
    if (mediaType === null)
      return yield* invalid(
        isHeic(bytes)
          ? `${name} is a HEIC photo. Export it as JPEG or PNG first.`
          : `${name} is not a PNG, JPEG, GIF, or WebP image.`,
      );
    const id = AttachmentId.make(crypto.randomUUID());
    const file = `${id}.${extensionOf[mediaType]}`;
    yield* Effect.tryPromise({
      catch: failed("store the file"),
      try: async () => {
        await mkdir(root, { recursive: true });
        await writeFile(join(root, file), bytes);
      },
    });
    const now = yield* Clock.currentTimeMillis;
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    yield* sql`INSERT INTO attachments (id, file, name, media_type, size, sha256, created_at)
      VALUES (${id}, ${file}, ${name}, ${mediaType}, ${bytes.length}, ${sha256}, ${now})`;
    return { id, mediaType, name, size: bytes.length } satisfies AttachmentCard;
  });

/** Removes a draft the owner took out of the message; a file already sent stays with its message. */
export const discardAttachment = (attachmentId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const root = yield* AttachmentsRoot;
    const [row] = yield* sql<{
      file: string;
      messageId: string | null;
    }>`SELECT file, message_id AS messageId FROM attachments WHERE id = ${attachmentId}`;
    if (row === undefined) return yield* notFound("No such file.");
    if (row.messageId !== null) return yield* invalid("This file was already sent with a message.");
    yield* sql`DELETE FROM attachments WHERE id = ${attachmentId}`;
    yield* Effect.promise(() => rm(join(root, row.file), { force: true }));
  });

/** An attached file's bytes, base64, for the app to show. */
export const readAttachment = (attachmentId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const root = yield* AttachmentsRoot;
    const [row] = yield* sql<{
      file: string;
      mediaType: AttachmentMediaType;
    }>`SELECT file, media_type AS mediaType FROM attachments WHERE id = ${attachmentId}`;
    if (row === undefined) return yield* notFound("No such file.");
    const bytes = yield* Effect.tryPromise({
      catch: () => notFound("The file is no longer on this computer."),
      try: () => readFile(join(root, row.file)),
    });
    return { data: bytes.toString("base64"), mediaType: row.mediaType } satisfies AttachmentContent;
  });

/**
 * Makes the drafts part of the message, in order. A draft that is unknown, already sent, or listed twice refuses the
 * whole message. Callers run it in a transaction.
 */
export const attachToMessage = (messageId: string, attachmentIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if (attachmentIds.length > maxAttachmentsPerMessage)
      return yield* invalid(`A message holds at most ${maxAttachmentsPerMessage} files.`);
    for (const [position, attachmentId] of attachmentIds.entries()) {
      const rows = yield* sql<{ id: string }>`UPDATE attachments SET message_id = ${messageId}, position = ${position}
        WHERE id = ${attachmentId} AND message_id IS NULL RETURNING id`;
      if (rows.length === 0) return yield* invalid("A file of this message is no longer available. Attach it again.");
    }
  });

/** The files attached to each of the messages, in order, keyed by message. */
export const readStoredAttachments = (messageIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const byMessage = new Map<string, Array<StoredAttachment & { readonly size: number }>>();
    if (messageIds.length === 0) return byMessage;
    const rows = yield* sql<StoredAttachment & { messageId: string; size: number }>`
      SELECT id, file, name, media_type AS mediaType, size, message_id AS messageId FROM attachments
      WHERE message_id IN ${sql.in(messageIds)} ORDER BY message_id, position`;
    for (const { messageId, ...row } of rows) byMessage.set(messageId, [...(byMessage.get(messageId) ?? []), row]);
    return byMessage;
  });

/** The cards of the files attached to each message, keyed by message. */
export const readCards = (messageIds: ReadonlyArray<string>) =>
  readStoredAttachments(messageIds).pipe(
    Effect.map(
      (byMessage) =>
        new Map(
          [...byMessage].map(([messageId, files]) => [
            messageId,
            files.map(
              ({ id, mediaType, name, size }): AttachmentCard => ({ id: AttachmentId.make(id), mediaType, name, size }),
            ),
          ]),
        ),
    ),
  );

/** Erases the files of every message of the threads, from disk and from the records. Callers run it before the messages go. */
export const eraseAttachmentsOf = (threadIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const root = yield* AttachmentsRoot;
    const rows = yield* sql<{ file: string }>`SELECT file FROM attachments
      WHERE message_id IN (SELECT id FROM messages WHERE thread_id IN ${sql.in(threadIds)})`;
    yield* sql`DELETE FROM attachments WHERE message_id IN (SELECT id FROM messages WHERE thread_id IN ${sql.in(threadIds)})`;
    yield* Effect.promise(() => Promise.all(rows.map((row) => rm(join(root, row.file), { force: true }))));
  });

/** Erases every draft nobody sent, as the service starts: no message box survives a restart. */
export const sweepDrafts = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const root = yield* AttachmentsRoot;
  const rows = yield* sql<{ file: string }>`SELECT file FROM attachments WHERE message_id IS NULL`;
  yield* sql`DELETE FROM attachments WHERE message_id IS NULL`;
  yield* Effect.promise(() => Promise.all(rows.map((row) => rm(join(root, row.file), { force: true }))));
});
