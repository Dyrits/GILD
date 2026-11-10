/** A thread tool's answer before it is wrapped for MCP. */
export interface ToolAnswer {
  readonly isError: boolean;
  readonly text: string;
}
