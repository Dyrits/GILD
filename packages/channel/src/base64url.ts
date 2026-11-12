const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const indexOfChar = new Map([...alphabet].map((char, index) => [char, index]));

/** Encodes bytes as base64url (RFC 4648 section 5) without padding. */
export function encodeBase64Url(bytes: Uint8Array): string {
  let text = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const chunk = (a << 16) | (b << 8) | c;
    const remaining = bytes.length - i;
    text += alphabet[(chunk >> 18) & 63];
    text += alphabet[(chunk >> 12) & 63];
    if (remaining > 1) text += alphabet[(chunk >> 6) & 63];
    if (remaining > 2) text += alphabet[chunk & 63];
  }
  return text;
}

/**
 * Decodes unpadded base64url, or returns null when the text is not exactly what `encodeBase64Url` would produce
 * (other characters, padding, an impossible length, or nonzero spare bits).
 */
export function decodeBase64Url(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let outIndex = 0;
  let buffer = 0;
  let bits = 0;
  for (const char of text) {
    const value = indexOfChar.get(char);
    if (value === void 0) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[outIndex] = (buffer >> bits) & 0xff;
      outIndex += 1;
      buffer &= (1 << bits) - 1;
    }
  }
  // Spare bits of the last character must be zero, or two texts would decode to the same bytes.
  return buffer === 0 ? out : null;
}
