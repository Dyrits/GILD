import {
  type AttachmentMediaType,
  type HarnessList,
  type HarnessName,
  type ModelChoice,
  maxAttachmentBytes,
  maxAttachmentsPerMessage,
} from "@iskios/contracts";

// The pure rules for a file the owner attaches to a message: what it is, whether it fits, and whether the Companion can read it (message-attachments).

/** What a file's first bytes say it is: an accepted image, a HEIC photo (refused with its own reason), or neither. */
export type Signature = AttachmentMediaType | "heic" | null;

const textOf = (bytes: Uint8Array, from: number, length: number) =>
  String.fromCharCode(...bytes.slice(from, from + length));

const startsWith = (bytes: Uint8Array, prefix: ReadonlyArray<number>) =>
  prefix.every((byte, index) => bytes[index] === byte);

const heicBrands: ReadonlyArray<string> = ["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"];

/** Tells the file's kind from its first bytes, never from its name or its declared type; 16 bytes are enough. */
export const signatureOf = (bytes: Uint8Array): Signature => {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (textOf(bytes, 0, 4) === "GIF8" && /^[79]a$/.test(textOf(bytes, 4, 2))) return "image/gif";
  if (textOf(bytes, 0, 4) === "RIFF" && textOf(bytes, 8, 4) === "WEBP") return "image/webp";
  if (textOf(bytes, 4, 4) === "ftyp" && heicBrands.includes(textOf(bytes, 8, 4))) return "heic";
  return null;
};

/** Whether the file is one of the image kinds a message accepts. */
export const isAcceptedSignature = (signature: Signature): signature is AttachmentMediaType =>
  signature !== null && signature !== "heic";

/** Why a file whose kind is not accepted is refused. */
export const typeRefusalOf = (name: string, signature: "heic" | null) =>
  signature === "heic"
    ? `"${name}" is a HEIC image; convert it to PNG or JPEG first.`
    : `"${name}" is not a PNG, JPEG, GIF, or WebP image.`;

/** Whether the app may scale this kind down: a GIF is never changed, as its frames would be lost. */
export const isReducible = (mediaType: AttachmentMediaType) => mediaType !== "image/gif";

/** A size that keeps the proportions with the longer side at most `side`; a smaller size is returned as it is. */
export const fittedSizeOf = (width: number, height: number, side: number) => {
  const scale = Math.min(1, side / Math.max(width, height));
  return { height: Math.max(1, Math.round(height * scale)), width: Math.max(1, Math.round(width * scale)) };
};

/** How many more files a message holds, counting those already attached or on their way. */
export const roomLeftOf = (attached: number) => Math.max(0, maxAttachmentsPerMessage - attached);

/** What the owner is told when some of the files chosen do not fit in the message. */
export const limitRefusalOf = (leftOut: number) =>
  `A message holds ${maxAttachmentsPerMessage} images at most; ${leftOut} left out.`;

/** What the message box says when images are attached and the Companion cannot read them, or null when it can. */
export const imageRefusalOf = (harnesses: HarnessList | null, harness: HarnessName, model: ModelChoice) =>
  canReadImages(harnesses, harness, model)
    ? null
    : "This Companion cannot read images. Choose a Companion that can, or take the images out.";

/** Why a file is refused for its size once it has been reduced, or null when it fits. */
export const sizeRefusalOf = (name: string, mediaType: AttachmentMediaType, bytes: number) => {
  if (bytes <= maxAttachmentBytes) return null;
  const megabytes = (size: number) => `${Math.round((size / (1024 * 1024)) * 10) / 10} MB`;
  const advice = isReducible(mediaType) ? "" : " A GIF is sent as it is.";
  return `"${name}" is ${megabytes(bytes)}; the limit is ${megabytes(maxAttachmentBytes)}.${advice}`;
};

/**
 * Whether the harness and Companion (model) read images, as the service answers: Claude Code always does, Codex unless
 * the chosen model says it does not, and OpenCode is allowed since it is unknown until its agent starts.
 */
export const canReadImages = (harnesses: HarnessList | null, harness: HarnessName, model: ModelChoice) => {
  if (harness !== "codex") return true;
  const models = harnesses?.harnesses.find((candidate) => candidate.name === harness)?.models ?? [];
  // "default" stands for the harness's own model, the first one it lists, as the pickers take it.
  const option = model === "default" ? models[0] : models.find((candidate) => candidate.id === model);
  return option?.inputsImages !== false;
};
