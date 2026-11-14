import { Schema } from "effect";

// What a working thread does, line by line, beside the actions it asked about (action-approval, What a working thread is doing).

/**
 * One tool call a thread's harness reported as it started: plain words for the kind of call, and a short target such as
 * a file or a pattern. A record to read, with no buttons and no permission.
 */
export const Activity = Schema.Struct({
  at: Schema.Number,
  /** A short plain target: a file, a pattern, or a command's description or first line; never output or content. */
  detail: Schema.String,
  /** The harness's own identifier of the call. */
  id: Schema.String,
  /** The kind of call in plain words, such as "Read a file". */
  summary: Schema.String,
});
export type Activity = typeof Activity.Type;
