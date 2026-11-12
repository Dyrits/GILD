const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

/** Decodes unpadded base64url, or returns null when the text is not valid base64url. */
export const decodeBase64Url = (text: string): Uint8Array | null => {
  if (!base64UrlPattern.test(text) || text.length % 4 === 1) return null;
  const standard = text.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(standard.padEnd(Math.ceil(standard.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

/** Encodes bytes as unpadded base64url. */
export const encodeBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
