import type { AttachmentMediaType } from "@iskios/contracts";
import { isAcceptedSignature, signatureOf, sizeRefusalOf, typeRefusalOf } from "./attachmentRules";
import { reduceImage } from "./imageReduction";

/** A file checked and, when it was too large a picture, scaled down: what is shown and sent. */
export interface PreparedImage {
  readonly blob: Blob;
  readonly mediaType: AttachmentMediaType;
}

/** The file's name as sent: the service takes 255 characters at most, and a file may come with none. */
export const attachmentNameOf = (file: File) => (file.name === "" ? "image" : file.name.slice(-255));

/** Checks a file by its first bytes and size and reduces it; rejects with the reason it is refused. */
export const prepareImage = async (file: File): Promise<PreparedImage> => {
  const name = attachmentNameOf(file);
  const signature = signatureOf(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!isAcceptedSignature(signature)) throw new Error(typeRefusalOf(name, signature));
  const blob =
    signature === "image/gif"
      ? file
      : await reduceImage(file, signature).catch(() => {
          throw new Error(`"${name}" could not be read as an image.`);
        });
  const tooLarge = sizeRefusalOf(name, signature, blob.size);
  if (tooLarge !== null) throw new Error(tooLarge);
  return { blob, mediaType: signature };
};

/** A blob's bytes as base64, the way a request carries a file. */
export const base64Of = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // String.fromCharCode takes its arguments on the stack, so a large file goes through in slices.
  let binary = "";
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary);
};
