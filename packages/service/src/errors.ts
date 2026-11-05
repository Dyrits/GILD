import { ErrorKind } from "@openmission/contracts";
import { Schema } from "effect";

/** A refusal or failure reported to the caller with one of the contract's error kinds. */
export class ServiceFailure extends Schema.TaggedError<ServiceFailure>()("ServiceFailure", {
  kind: ErrorKind,
  message: Schema.String,
}) {}

export const invalid = (message: string) => new ServiceFailure({ kind: "InvalidInput", message });
export const notFound = (message: string) => new ServiceFailure({ kind: "NotFound", message });
