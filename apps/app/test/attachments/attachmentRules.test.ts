import type { HarnessInfo, HarnessList } from "@gild/contracts";
import { maxAttachmentBytes, maxAttachmentsPerMessage, maxImageSide } from "@gild/contracts";
import { describe, expect, it } from "vitest";
import {
  canReadImages,
  fittedSizeOf,
  imageRefusalOf,
  isAcceptedSignature,
  isReducible,
  limitRefusalOf,
  roomLeftOf,
  signatureOf,
  sizeRefusalOf,
  typeRefusalOf,
} from "../../src/attachments/attachmentRules";

const bytesOf = (...parts: ReadonlyArray<number | string>) =>
  new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : [part])));

describe("signatureOf", () => {
  it("tells a PNG from its eight signature bytes", () => {
    expect(signatureOf(bytesOf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe("image/png");
  });

  it("tells a JPEG from its first three bytes", () => {
    expect(signatureOf(bytesOf(0xff, 0xd8, 0xff, 0xe0, 0, 16))).toBe("image/jpeg");
  });

  it("tells both versions of GIF", () => {
    expect(signatureOf(bytesOf("GIF87a", 1, 0))).toBe("image/gif");
    expect(signatureOf(bytesOf("GIF89a", 1, 0))).toBe("image/gif");
    expect(signatureOf(bytesOf("GIF88a", 1, 0))).toBeNull();
  });

  it("tells a WebP from RIFF and WEBP around the size", () => {
    expect(signatureOf(bytesOf("RIFF", 1, 2, 3, 4, "WEBPVP8 "))).toBe("image/webp");
    expect(signatureOf(bytesOf("RIFF", 1, 2, 3, 4, "WAVEfmt "))).toBeNull();
  });

  it("tells a HEIC photo from its brand", () => {
    expect(signatureOf(bytesOf(0, 0, 0, 24, "ftypheic", 0, 0))).toBe("heic");
    expect(signatureOf(bytesOf(0, 0, 0, 24, "ftypisom", 0, 0))).toBeNull();
  });

  it("refuses text and a file too short to hold a signature", () => {
    expect(signatureOf(bytesOf("hello, world"))).toBeNull();
    expect(signatureOf(bytesOf(0x89, 0x50))).toBeNull();
    expect(signatureOf(new Uint8Array())).toBeNull();
  });
});

describe("typeRefusalOf", () => {
  it("accepts every image kind", () => {
    expect(isAcceptedSignature("image/png")).toBe(true);
    expect(isAcceptedSignature("image/gif")).toBe(true);
    expect(isAcceptedSignature("heic")).toBe(false);
    expect(isAcceptedSignature(null)).toBe(false);
  });

  it("names a HEIC photo and says to convert it", () => {
    expect(typeRefusalOf("IMG_1.heic", "heic")).toContain("HEIC");
  });

  it("names the accepted kinds for anything else", () => {
    expect(typeRefusalOf("notes.png", null)).toBe('"notes.png" is not a PNG, JPEG, GIF, or WebP image.');
  });
});

describe("fittedSizeOf", () => {
  it("scales the longer side down to the limit and keeps the proportions", () => {
    expect(fittedSizeOf(3136, 1568, maxImageSide)).toEqual({ height: 784, width: maxImageSide });
    expect(fittedSizeOf(1000, 4000, 2000)).toEqual({ height: 2000, width: 500 });
  });

  it("keeps a size that already fits", () => {
    expect(fittedSizeOf(800, 600, maxImageSide)).toEqual({ height: 600, width: 800 });
    expect(fittedSizeOf(maxImageSide, maxImageSide, maxImageSide)).toEqual({
      height: maxImageSide,
      width: maxImageSide,
    });
  });

  it("never rounds a side to nothing", () => {
    expect(fittedSizeOf(10_000, 1, maxImageSide).height).toBe(1);
  });
});

describe("isReducible", () => {
  it("leaves a GIF alone and scales the others", () => {
    expect(isReducible("image/gif")).toBe(false);
    expect(isReducible("image/png")).toBe(true);
    expect(isReducible("image/jpeg")).toBe(true);
    expect(isReducible("image/webp")).toBe(true);
  });
});

describe("roomLeftOf", () => {
  it("counts the files already attached against the limit", () => {
    expect(roomLeftOf(0)).toBe(maxAttachmentsPerMessage);
    expect(roomLeftOf(5)).toBe(maxAttachmentsPerMessage - 5);
    expect(roomLeftOf(maxAttachmentsPerMessage)).toBe(0);
  });

  it("never answers a negative room", () => {
    expect(roomLeftOf(maxAttachmentsPerMessage + 2)).toBe(0);
  });

  it("says how many files were left out", () => {
    expect(limitRefusalOf(3)).toContain("3 left out");
  });
});

describe("sizeRefusalOf", () => {
  it("accepts a file at the limit", () => {
    expect(sizeRefusalOf("a.png", "image/png", maxAttachmentBytes)).toBeNull();
  });

  it("refuses a file over the limit with both sizes", () => {
    expect(sizeRefusalOf("big.jpg", "image/jpeg", 6 * 1024 * 1024)).toBe('"big.jpg" is 6 MB; the limit is 5 MB.');
  });

  it("says a GIF is never reduced", () => {
    expect(sizeRefusalOf("big.gif", "image/gif", 6 * 1024 * 1024)).toContain("A GIF is sent as it is.");
  });
});

const harnessOf = (name: HarnessInfo["name"], models: HarnessInfo["models"]): HarnessInfo => ({
  accounts: [],
  models,
  name,
  problem: null,
  update: null,
  version: null,
});

const list: HarnessList = {
  harnesses: [
    harnessOf("claude", [{ id: "claude-a", label: "A" }]),
    harnessOf("codex", [
      { id: "gpt-seeing", inputsImages: true, label: "Seeing" },
      { id: "gpt-blind", inputsImages: false, label: "Blind" },
      { id: "gpt-unknown", label: "Unknown" },
    ]),
  ],
};

describe("canReadImages", () => {
  it("lets Claude Code and OpenCode take images whatever the list says", () => {
    expect(canReadImages(list, "claude", "claude-a")).toBe(true);
    expect(canReadImages(null, "opencode", "anything")).toBe(true);
  });

  it("refuses a Codex model that says it does not read images", () => {
    expect(canReadImages(list, "codex", "gpt-blind")).toBe(false);
  });

  it("allows a Codex model that reads them or whose support is unknown", () => {
    expect(canReadImages(list, "codex", "gpt-seeing")).toBe(true);
    expect(canReadImages(list, "codex", "gpt-unknown")).toBe(true);
    expect(canReadImages(list, "codex", "gpt-not-listed")).toBe(true);
    expect(canReadImages(null, "codex", "gpt-blind")).toBe(true);
  });

  it("reads the first listed model for the default", () => {
    expect(canReadImages(list, "codex", "default")).toBe(true);
    const blindFirst: HarnessList = { harnesses: [harnessOf("codex", [{ id: "x", inputsImages: false, label: "X" }])] };
    expect(canReadImages(blindFirst, "codex", "default")).toBe(false);
  });
});

describe("imageRefusalOf", () => {
  it("says why a Companion that cannot read images is refused, and nothing for one that can", () => {
    const harnesses = {
      harnesses: [
        {
          models: [
            { id: "gpt-seeing", inputsImages: true, label: "Seeing" },
            { id: "gpt-blind", inputsImages: false, label: "Blind" },
          ],
          name: "codex",
        },
      ],
    } as unknown as HarnessList;
    expect(imageRefusalOf(harnesses, "codex", "gpt-blind")).toContain("cannot read images");
    expect(imageRefusalOf(harnesses, "codex", "gpt-seeing")).toBeNull();
    expect(imageRefusalOf(null, "claude", "default")).toBeNull();
  });
});
