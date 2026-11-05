import type { ErrorKind } from "@openmission/contracts";
import { Data } from "effect";

/** A refusal or failure reported to the caller with one of the contract's error kinds. */
export class ServiceFailure extends Data.TaggedError("ServiceFailure")<{ kind: ErrorKind; message: string }> {}

export const invalid = (message: string) => new ServiceFailure({ kind: "InvalidInput", message });
export const notFound = (message: string) => new ServiceFailure({ kind: "NotFound", message });
