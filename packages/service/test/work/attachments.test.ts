import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "@effect/vitest";
import type { AttachmentId, ThreadId } from "@gild/contracts";
import { Effect, Layer } from "effect";
import { afterEach } from "vitest";
import { fakeHarnessLayer, fakeHarnessToolsLayer, HarnessTools, serviceLayer } from "../../src/index.ts";
import { call, fixture, read, settle, start } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const withService = <A, E, R>(body: Effect.Effect<A, E, R>, harnessTools?: Layer.Layer<HarnessTools>) => {
  const value = fixture(harnessTools);
  fixtures.push(value);
  return body.pipe(Effect.provide(value.layer));
};

const checksum = (bytes: Buffer) => {
  let value = ~0;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  }
  return ~value >>> 0;
};

const pngChunk = (type: string, data: Buffer) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(checksum(body));
  return Buffer.concat([length, body, crc]);
};

/** A real one-colour PNG. */
const png = (side = 4) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(side, 0);
  header.writeUInt32BE(side, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(side * 3, 200)]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: side }, () => row)))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
};

const gif = () => Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(20)]);
const webp = () => Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 "), Buffer.alloc(20)]);

const add = (name: string, bytes: Buffer) => call({ _tag: "AddAttachment", data: bytes.toString("base64"), name });

const sendWith = (threadId: ThreadId, text: string, attachmentIds: ReadonlyArray<AttachmentId>) =>
  call({
    _tag: "SendMessage",
    attachmentIds,
    delivery: null,
    requestId: crypto.randomUUID(),
    text,
    threadId,
  });

const idle = (detail: { thread: { state: string } }) => detail.thread.state === "Idle";

const attachmentFiles = (directory: string) => {
  const folder = join(directory, "attachments");
  return existsSync(folder) ? readdirSync(folder) : [];
};

/** Codex models one of which cannot read images. */
const codexModelsLayer = Layer.effect(
  HarnessTools,
  Effect.gen(function* () {
    const fake = yield* HarnessTools;
    return HarnessTools.of({
      ...fake,
      listModels: (harness, configDirectory) =>
        harness === "codex"
          ? Effect.succeed([
              { id: "gpt-seeing", inputsImages: true, label: "Seeing" },
              { id: "gpt-blind", inputsImages: false, label: "Blind" },
            ])
          : fake.listModels(harness, configDirectory),
    });
  }),
).pipe(Layer.provide(fakeHarnessToolsLayer()));

describe("message attachments: images added to the owner's messages", () => {
  it.live("an added image is answered as a card and its bytes are read back by identifier", () =>
    withService(
      Effect.gen(function* () {
        const bytes = png();
        const card = yield* add("shot.png", bytes);
        expect(card).toMatchObject({ mediaType: "image/png", name: "shot.png", size: bytes.length });
        const content = yield* call({ _tag: "ReadAttachment", attachmentId: card.id });
        expect(content.mediaType).toBe("image/png");
        expect(Buffer.from(content.data, "base64").equals(bytes)).toBe(true);
      }),
    ),
  );

  it.live("the kind of image is told by its first bytes, not by its name", () =>
    withService(
      Effect.gen(function* () {
        expect((yield* add("not-a-png.png", gif())).mediaType).toBe("image/gif");
        expect((yield* add("picture", webp())).mediaType).toBe("image/webp");
        expect(
          (yield* add("x.txt", Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(10)]))).mediaType,
        ).toBe("image/jpeg");
      }),
    ),
  );

  it.live("a file that is not an image is refused with the reason", () =>
    withService(
      Effect.gen(function* () {
        const failure = yield* Effect.flip(add("notes.png", Buffer.from("just some text")));
        expect(failure.message).toContain("PNG, JPEG, GIF, or WebP");
      }),
    ),
  );

  it.live("a HEIC photo is refused by name", () =>
    withService(
      Effect.gen(function* () {
        const heic = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypheic"), Buffer.alloc(20)]);
        const failure = yield* Effect.flip(add("photo.heic", heic));
        expect(failure.message).toContain("HEIC");
      }),
    ),
  );

  it.live("an image over 5 MB and an empty file are refused", () =>
    withService(
      Effect.gen(function* () {
        const large = Buffer.concat([png(), Buffer.alloc(5 * 1024 * 1024)]);
        expect((yield* Effect.flip(add("big.png", large))).message).toContain("5 MB");
        expect((yield* Effect.flip(add("empty.png", Buffer.alloc(0)))).message).toContain("empty");
      }),
    ),
  );

  it.live("a message carries its images, with or without text, and the harness is given them", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start("Hello");
        const first = yield* settle(started.missionId, idle);
        const card = yield* add("shot.png", png());
        const second = yield* add("two.png", png(8));
        yield* sendWith(first.thread.id, "", [card.id, second.id]);
        const after = yield* settle(started.missionId, (d) => d.messages.length === 4 && idle(d));
        const sent = after.messages.find((message) => message.sender === "user" && message.attachments.length > 0);
        expect(sent?.attachments.map((attachment) => attachment.name)).toEqual(["shot.png", "two.png"]);
        expect(after.messages.at(-1)?.text).toContain("[images: shot.png, two.png]");
      }),
    ),
  );

  it.live("a mission is started and a thread opened with images", () =>
    withService(
      Effect.gen(function* () {
        const card = yield* add("first.png", png());
        const started = yield* call({
          _tag: "StartMission",
          attachmentIds: [card.id],
          effort: "default",
          model: "default",
          requestId: crypto.randomUUID(),
          text: "Look at this",
          workspacePath: null,
        });
        const detail = yield* settle(started.missionId, idle);
        expect(detail.messages[0]?.attachments.map((attachment) => attachment.id)).toEqual([card.id]);
        expect(detail.messages.at(-1)?.text).toContain("[images: first.png]");
        const second = yield* add("child.png", png());
        const opened = yield* call({
          _tag: "OpenThread",
          attachmentIds: [second.id],
          effort: "default",
          model: "default",
          parentThreadId: detail.thread.id,
          requestId: crypto.randomUUID(),
          shouldStartAnyway: false,
          text: "",
        });
        const child = yield* settle(started.missionId, (d) => d.messages.length === 2 && idle(d), opened.threadId);
        expect(child.messages.at(-1)?.text).toContain("[images: child.png]");
      }),
    ),
  );

  it.live("a message with neither text nor images is refused", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start("Hello");
        const first = yield* settle(started.missionId, idle);
        const failure = yield* Effect.flip(sendWith(first.thread.id, "  ", []));
        expect(failure.message).toBe("The message is empty.");
      }),
    ),
  );

  it.live("a draft is removed when discarded, and a sent image cannot be discarded", () =>
    withService(
      Effect.gen(function* () {
        const draft = yield* add("draft.png", png());
        yield* call({ _tag: "DiscardAttachment", attachmentId: draft.id });
        expect((yield* Effect.flip(call({ _tag: "ReadAttachment", attachmentId: draft.id }))).kind).toBe("NotFound");
        const started = yield* start("Hello");
        const first = yield* settle(started.missionId, idle);
        const sent = yield* add("sent.png", png());
        yield* sendWith(first.thread.id, "x", [sent.id]);
        const failure = yield* Effect.flip(call({ _tag: "DiscardAttachment", attachmentId: sent.id }));
        expect(failure.message).toContain("already sent");
      }),
    ),
  );

  it.live("an unknown or already sent image cannot be attached to another message", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start("Hello");
        const first = yield* settle(started.missionId, idle);
        const card = yield* add("once.png", png());
        yield* sendWith(first.thread.id, "one", [card.id]);
        const again = yield* Effect.flip(sendWith(first.thread.id, "two", [card.id]));
        expect(again.message).toContain("no longer available");
        const unknown = yield* Effect.flip(sendWith(first.thread.id, "three", ["nope" as AttachmentId]));
        expect(unknown.message).toContain("no longer available");
        // The refused messages left no trace.
        const detail = yield* read(started.missionId);
        expect(detail.messages.filter((message) => message.sender === "user")).toHaveLength(2);
      }),
    ),
  );

  it.live("a model that cannot read images is refused with the reason, and the message is not sent", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* call({
          _tag: "StartMission",
          effort: "default",
          harness: "codex",
          model: "gpt-blind",
          requestId: crypto.randomUUID(),
          text: "Hello",
          workspacePath: null,
        });
        const first = yield* settle(started.missionId, idle);
        const card = yield* add("shot.png", png());
        const failure = yield* Effect.flip(sendWith(first.thread.id, "see", [card.id]));
        expect(failure.message).toContain("cannot read images");
        expect((yield* read(started.missionId)).messages).toHaveLength(2);
        // The same image goes to a model that reads them.
        yield* call({
          _tag: "ChangeThreadRunner",
          accountId: null,
          effort: "default",
          harness: "codex",
          model: "gpt-seeing",
          threadId: first.thread.id,
        });
        yield* sendWith(first.thread.id, "see", [card.id]);
        const after = yield* settle(started.missionId, (d) => d.messages.length === 4 && idle(d));
        expect(after.messages.at(-1)?.text).toContain("[images: shot.png]");
      }),
      codexModelsLayer,
    ),
  );

  it.live("a handover to a model that cannot read images is refused while a message holding images waits", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start("Hello");
        const first = yield* settle(started.missionId, idle);
        const threadId = first.thread.id;
        yield* call({ _tag: "StopThread", threadId });
        const card = yield* add("shot.png", png());
        yield* sendWith(threadId, "see", [card.id]);
        const change = (model: string) =>
          call({ _tag: "ChangeThreadRunner", accountId: null, effort: "default", harness: "codex", model, threadId });
        const failure = yield* Effect.flip(change("gpt-blind"));
        expect(failure.message).toContain("cannot read images");
        expect((yield* read(started.missionId)).thread.harness).toBe("claude");
        // A model that reads images takes the waiting message.
        yield* change("gpt-seeing");
        expect((yield* read(started.missionId)).thread.harness).toBe("codex");
      }),
      codexModelsLayer,
    ),
  );

  it.live("starting a mission or opening a thread on a model that cannot read images is refused", () =>
    withService(
      Effect.gen(function* () {
        const card = yield* add("shot.png", png());
        const failure = yield* Effect.flip(
          call({
            _tag: "StartMission",
            attachmentIds: [card.id],
            effort: "default",
            harness: "codex",
            model: "gpt-blind",
            requestId: crypto.randomUUID(),
            text: "see",
            workspacePath: null,
          }),
        );
        expect(failure.message).toContain("cannot read images");
      }),
      codexModelsLayer,
    ),
  );

  it.live("a handover's replay of the conversation names an image as text", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start("Hello");
        const first = yield* settle(started.missionId, idle);
        const card = yield* add("shot.png", png());
        yield* sendWith(first.thread.id, "see this", [card.id]);
        yield* settle(started.missionId, (d) => d.messages.length === 4 && idle(d));
        yield* call({
          _tag: "ChangeThreadRunner",
          accountId: null,
          effort: "default",
          harness: "codex",
          model: "gpt-5",
          threadId: first.thread.id,
        });
        yield* sendWith(first.thread.id, "context", []);
        const after = yield* settle(started.missionId, (d) => d.messages.length === 6 && idle(d));
        const history = after.messages.at(-1)?.text.split("Conversation so far")[1] ?? "";
        expect(history).toContain("The owner: see this\nimage: shot.png");
      }),
    ),
  );

  it.live("a draft nobody sent is erased when the service starts again, and a sent image stays", () =>
    Effect.gen(function* () {
      const value = fixture();
      fixtures.push(value);
      const { draft, sent } = yield* Effect.gen(function* () {
        const sent = yield* add("sent.png", png());
        yield* call({
          _tag: "StartMission",
          attachmentIds: [sent.id],
          effort: "default",
          model: "default",
          requestId: crypto.randomUUID(),
          text: "see",
          workspacePath: null,
        });
        return { draft: yield* add("draft.png", png(8)), sent };
      }).pipe(Effect.provide(value.layer));
      expect(attachmentFiles(value.directory)).toHaveLength(2);
      // The same folder, a new service: as after a restart.
      const restarted = serviceLayer({
        filename: join(value.directory, "store.sqlite"),
        harness: fakeHarnessLayer("10 millis"),
        homeFolder: value.directory,
        scratchRoot: join(value.directory, "missions"),
      });
      yield* Effect.gen(function* () {
        expect((yield* Effect.flip(call({ _tag: "ReadAttachment", attachmentId: draft.id }))).kind).toBe("NotFound");
        expect((yield* call({ _tag: "ReadAttachment", attachmentId: sent.id })).mediaType).toBe("image/png");
      }).pipe(Effect.provide(restarted));
      expect(attachmentFiles(value.directory)).toHaveLength(1);
    }),
  );

  it.live("deleting a quest erases its images from disk", () =>
    withService(
      Effect.gen(function* () {
        const card = yield* add("shot.png", png());
        const started = yield* call({
          _tag: "StartMission",
          attachmentIds: [card.id],
          effort: "default",
          model: "default",
          requestId: crypto.randomUUID(),
          text: "see",
          workspacePath: null,
        });
        const detail = yield* settle(started.missionId, idle);
        const { directory } = fixtures[0] ?? { directory: "" };
        expect(attachmentFiles(directory)).toHaveLength(1);
        const preview = yield* call({ _tag: "PreviewDeletion", threadId: detail.thread.id });
        yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: detail.thread.id });
        expect(attachmentFiles(directory)).toHaveLength(0);
        expect((yield* Effect.flip(call({ _tag: "ReadAttachment", attachmentId: card.id }))).kind).toBe("NotFound");
      }),
    ),
  );
});
