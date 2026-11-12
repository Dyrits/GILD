import type { Answer, Question } from "@iskios/contracts";

/**
 * The answers a question card offers. Always allow saves the question's permission and pattern, so a question with
 * neither (a one-time confirmation, such as a thread folder that is a link) offers only Allow and Deny, as the service
 * refuses Always allow for it.
 */
export const answersOf = (question: Pick<Question, "pattern" | "permission">): ReadonlyArray<Answer> =>
  question.pattern === null || question.permission === null ? ["Allow", "Deny"] : ["Allow", "AlwaysAllow", "Deny"];
