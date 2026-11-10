import { ErrorKind } from "@gild/contracts";
import { Schema } from "effect";

/** A refusal or failure reported to the caller with one of the contract's error kinds. */
export class ServiceFailure extends Schema.TaggedError<ServiceFailure>()("ServiceFailure", {
  kind: ErrorKind,
  message: Schema.String,
}) {}

/** A request the service refuses as given, with the reason the owner reads. */
export const invalid = (message: string) => new ServiceFailure({ kind: "InvalidInput", message });
/** A request naming something that does not exist, with the reason the owner reads. */
export const notFound = (message: string) => new ServiceFailure({ kind: "NotFound", message });
