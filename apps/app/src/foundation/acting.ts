import { messageOf } from "./client";

/** A function that runs a request the owner asked for, clearing the error shown when it succeeds and showing the failure when it does not. */
export const actWith = (setError: (error: string | null) => void) => (request: Promise<unknown>) =>
  request.then(
    () => setError(null),
    (reason) => setError(messageOf(reason)),
  );
