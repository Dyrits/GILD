import type { Request } from "@iskios/contracts";
import { Context, type Effect } from "effect";
import type { ServiceFailure } from "./core/index.ts";

/** The entry point shared by app commands, paired devices, and, later, MCP calls. */
export class Service extends Context.Service<
  Service,
  { readonly handle: (request: Request) => Effect.Effect<unknown, ServiceFailure> }
>()("iskios/Service") {}
