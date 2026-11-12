/**
 * Adapted from Paseo (https://github.com/getpaseo/paseo), Apache-2.0, Copyright (c) Mohamed Boudra; modified for Iskios.
 *
 * Noise_NK_25519_ChaChaPoly_SHA256 test vectors from noise-c (cacophony.txt and noise-c-basic.txt), as Paseo keeps them.
 */
export interface NkVector {
  handshakeHash: string | null;
  initiatorEphemeral: string;
  initiatorPrologue: string;
  messages: ReadonlyArray<{ ciphertext: string; payload: string }>;
  responderEphemeral: string;
  responderPrologue: string;
  responderStatic: string;
  responderStaticPublic: string;
  source: string;
}

const payloads = [
  "4c756477696720766f6e204d69736573",
  "4d757272617920526f746862617264",
  "462e20412e20486179656b",
  "4361726c204d656e676572",
  "4a65616e2d426170746973746520536179",
  "457567656e2042f6686d20766f6e2042617765726b",
];
const transportCiphertexts = [
  "a62de29ce27cb80245d440d986ed816c156e9d757d7008df2198b0",
  "174a35f11c689f4530d7208618e0564ae12f2f50ba8eb4df5382ff",
  "337e475ebb8eae60f91974c4e455a5af38d1d8628d1803b160d60442874b0a1777",
  "047e80e060b7bb08b53c5a23dfe9920cae135b9d1dc6302fc475003062723700366346ac9d",
];

const common = {
  initiatorEphemeral: "893e28b9dc6ca8d611ab664754b8ceb7bac5117349a4439a6b0569da977c464a",
  responderEphemeral: "bbdb4cdbd309f1a1f2e1456967fe288cadd6f712d65dc7b7793d5e63da6b375b",
  responderStatic: "4a3acbfdb163dec651dfa3194dece676d437029c62a408b4c5ea9114246e4893",
  responderStaticPublic: "31e0303fd6418d2f8c0e78b91f22e8caed0fbe48656dcf4767e4834f701b8f62",
};

const withTransport = (first: string, second: string) => [
  { ciphertext: first, payload: payloads[0] ?? "" },
  { ciphertext: second, payload: payloads[1] ?? "" },
  ...transportCiphertexts.map((ciphertext, index) => ({ ciphertext, payload: payloads[index + 2] ?? "" })),
];

export const nkVectors: readonly NkVector[] = [
  {
    ...common,
    handshakeHash: null,
    initiatorPrologue: "4a6f686e2047616c74",
    messages: withTransport(
      "ca35def5ae56cec33dc2036731ab14896bc4c75dbb07a61f879f8e3afa4c79448134d00711fdb390a0d178fa008f6d47d2891e5ea18ae136c3b4c23ac384efb0",
      "95ebc60d2b1fa672c1f46a8aa265ef51bfe38e7ccb39ec5be34069f1448088438ea16e3701bc0d77744f117bee22451c9afa7f4cdbbcff00c04a8ee0913c88",
    ),
    responderPrologue: "4a6f686e2047616c74",
    source: "https://raw.githubusercontent.com/rweather/noise-c/master/tests/vector/cacophony.txt",
  },
  {
    ...common,
    handshakeHash: "d5c4ce9ffe8bcd940aa50f842a5d4d90d3f7163f4b3916deb87a5d747712d718",
    initiatorPrologue: "50726f6c6f677565313233",
    messages: withTransport(
      "ca35def5ae56cec33dc2036731ab14896bc4c75dbb07a61f879f8e3afa4c79448134d00711fdb390a0d178fa008f6d47f49a76e297aa164052a3d842aa8ff7d8",
      "95ebc60d2b1fa672c1f46a8aa265ef51bfe38e7ccb39ec5be34069f1448088438ea16e3701bc0d77744f117bee22451628b075da65d4114bd343e2d93006c4",
    ),
    responderPrologue: "50726f6c6f677565313233",
    source: "https://raw.githubusercontent.com/rweather/noise-c/master/tests/vector/noise-c-basic.txt",
  },
];
