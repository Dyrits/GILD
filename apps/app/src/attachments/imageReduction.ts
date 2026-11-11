import type { AttachmentMediaType } from "@iskios/contracts";

/** Where there is no canvas to draw on (the phone, until it can attach), a file is sent as it is. */
export const reduceImage = async (file: Blob, _mediaType: AttachmentMediaType): Promise<Blob> => file;
