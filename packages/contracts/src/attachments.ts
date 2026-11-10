import { Schema } from "effect";
import { AttachmentId } from "./ids.ts";

// Files the owner attaches to a message (message-attachments); images only so far.

/** The kinds of image a message accepts, told by the file's first bytes. */
export const AttachmentMediaType = Schema.Literals(["image/png", "image/jpeg", "image/gif", "image/webp"]);
export type AttachmentMediaType = typeof AttachmentMediaType.Type;

/** How many files a message holds at most. */
export const maxAttachmentsPerMessage = 8;
/** The largest an attached file is, in bytes: the smaller of the harnesses' per-image limits. */
export const maxAttachmentBytes = 5 * 1024 * 1024;
/** The longest side, in pixels, an image keeps when the app reduces it before sending. */
export const maxImageSide = 1568;

/** One attached file as a message and the message box show it; its bytes are read apart, by identifier. */
export const AttachmentCard = Schema.Struct({
  id: AttachmentId,
  mediaType: AttachmentMediaType,
  name: Schema.String,
  size: Schema.Number,
});
export type AttachmentCard = typeof AttachmentCard.Type;

/** An attached file's bytes, base64, with its type. */
export const AttachmentContent = Schema.Struct({ data: Schema.String, mediaType: AttachmentMediaType });
export type AttachmentContent = typeof AttachmentContent.Type;
