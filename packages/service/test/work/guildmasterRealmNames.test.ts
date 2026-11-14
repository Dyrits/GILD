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
