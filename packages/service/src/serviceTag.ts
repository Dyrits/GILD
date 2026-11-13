import type { Request } from "@iskios/contracts";
import { Context, type Effect } from "effect";
import type { ServiceFailure } from "./core/index.ts";

/** The entry point shared by app commands, paired devices, and, later, MCP calls. */
export class Service extends Context.Service<
  Service,
  {
    /** Answers a request; a paired device's folder requests are limited to the browsable roots (CHG-0253). */
    readonly handle: (
      request: Request,
      source?: { readonly isPairedDevice: boolean },
    ) => Effect.Effect<unknown, ServiceFailure>;
  }
>()("iskios/Service") {}
