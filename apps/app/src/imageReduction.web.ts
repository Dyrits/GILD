import { type AttachmentMediaType, maxImageSide } from "@gild/contracts";
import { fittedSizeOf } from "./attachmentRules";

/** The quality a JPEG or WebP is saved at when it is scaled down; PNG ignores it. */
const quality = 0.85;

/**
 * The image scaled down to the longest side the harnesses read, in its own type; the file itself when it already fits.
 * A scaled WebP loses an animation it had, as the canvas draws one frame.
 */
export const reduceImage = async (file: Blob, mediaType: AttachmentMediaType): Promise<Blob> => {
  const bitmap = await createImageBitmap(file);
  try {
    const size = fittedSizeOf(bitmap.width, bitmap.height, maxImageSide);
    if (size.width === bitmap.width && size.height === bitmap.height) return file;
    const canvas = new OffscreenCanvas(size.width, size.height);
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("The canvas cannot draw.");
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    return await canvas.convertToBlob({ quality, type: mediaType });
  } finally {
    bitmap.close();
  }
};
