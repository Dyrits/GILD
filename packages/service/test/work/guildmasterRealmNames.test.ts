import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { approvedCall, guildmaster, isIdle, listed, say } from "../fixtures/guildmaster.ts";
import { call, settle, withService } from "../fixtures/service.ts";

describe("confirming duplicate realm names through Iskios", () => {
  it.live("asks even for an exactly named owner action and leaves both realms unchanged on Deny", () =>
    withService(
      Effect.gen(function* () {
        const place = yield* guildmaster;
        yield* approvedCall(place, "create_realm", { name: "Garden" });
        yield* say(place.threadId, 'Create the realm Garden.\ncall create_realm {"name":"Garden"}');
        const detail = yield* settle(
          place.missionId,
          (current) => isIdle(current) || current.questions.some((question) => question.outcome === null),
          place.threadId,
        );
        const question = detail.questions.find((current) => current.outcome === null);
        expect(question?.summary).toContain("Another active realm");
        if (question === undefined) return yield* Effect.die("No duplicate-name confirmation");
        expect((yield* listed).workspaces).toHaveLength(1);
        yield* call({ _tag: "AnswerQuestion", answer: "Deny", message: null, questionId: question.id });
        yield* settle(place.missionId, isIdle, place.threadId);
        expect((yield* listed).workspaces).toHaveLength(1);
        yield* approvedCall(place, "create_realm", { name: "Garden" });
        yield* approvedCall(place, "create_realm", { name: "Notes" });
        yield* say(
          place.threadId,
          'Rename the realm Notes to Garden.\ncall rename_realm {"realm":"Notes","name":"Garden"}',
        );
        const rename = yield* settle(
          place.missionId,
          (current) => isIdle(current) || current.questions.some((current) => current.outcome === null),
          place.threadId,
        );
        const confirmation = rename.questions.find((current) => current.outcome === null);
        expect(confirmation?.summary).toContain("Another active realm");
        if (confirmation === undefined) return yield* Effect.die("No duplicate rename confirmation");
        yield* call({ _tag: "AnswerQuestion", answer: "Deny", message: null, questionId: confirmation.id });
        yield* settle(place.missionId, isIdle, place.threadId);
        expect((yield* listed).workspaces.map((realm) => realm.name).sort()).toEqual(["Garden", "Garden", "Notes"]);
      }),
    ),
  );
});

describe("taking a realm's folder from the owner's words only when they name that exact folder", () => {
  const createIn = (folder: string) => `call create_realm ${JSON.stringify({ folder, name: "Garden" })}`;

  it.live(
    "asks when the owner named a longer or sibling path, and runs at once when they named the folder itself",
    () => {
      const folder = realpathSync(mkdtempSync(join(tmpdir(), "iskios-realm-folder-")));
      return withService(
        Effect.gen(function* () {
          const place = yield* guildmaster;
          for (const broader of [`${folder}//projects`, `${folder}-old`]) {
            yield* say(place.threadId, `Create realm Garden at ${broader}.\n${createIn(folder)}`);
            const asked = yield* settle(
              place.missionId,
              (current) => isIdle(current) || current.questions.some((question) => question.outcome === null),
              place.threadId,
            );
            const question = asked.questions.find((current) => current.outcome === null);
            if (question === undefined) return yield* Effect.die(`The folder was taken from the words ${broader}`);
            yield* call({ _tag: "AnswerQuestion", answer: "Deny", message: null, questionId: question.id });
            yield* settle(place.missionId, isIdle, place.threadId);
            expect((yield* listed).workspaces).toHaveLength(0);
          }
          yield* say(place.threadId, `Create realm Garden at ${folder}.\n${createIn(folder)}`);
          const done = yield* settle(
            place.missionId,
            (current) => isIdle(current) && current.questions.length === 3,
            place.threadId,
          );
          expect(done.questions.at(-1)?.outcome).toBe("AllowedByMessage");
          expect((yield* listed).workspaces.map((realm) => realm.path)).toEqual([folder]);
        }),
      ).pipe(Effect.ensuring(Effect.sync(() => rmSync(folder, { force: true, recursive: true }))));
    },
  );
});
