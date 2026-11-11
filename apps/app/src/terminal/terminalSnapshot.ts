import type { IBufferLine } from "@xterm/xterm";

/** The rendered lines needed for a transcript, shared by xterm and its tests. */
interface RenderedBuffer {
  getLine(index: number): Pick<IBufferLine, "isWrapped" | "translateToString"> | undefined;
  readonly length: number;
}

/** Reads the rendered terminal rather than escape sequences or hidden keystrokes. */
export const terminalTextOf = (buffer: RenderedBuffer) => {
  let text = "";
  for (let index = 0; index < buffer.length; index++) {
    const line = buffer.getLine(index);
    if (line === undefined) continue;
    const isContinued = buffer.getLine(index + 1)?.isWrapped === true;
    text += `${index === 0 || line.isWrapped ? "" : "\n"}${line.translateToString(!isContinued)}`;
  }
  text = text.trimEnd();
  return text.length > 20000 ? `[Earlier terminal output omitted]\n${text.slice(-20000)}` : text;
};

/** Makes owner-run terminal output part of the persisted message and harness context. */
export const messageWithTerminal = (text: string, cwd: string, output: string) => {
  const runs = output.match(/`+/g) ?? [];
  const fence = "`".repeat(Math.max(3, ...runs.map((run) => run.length + 1)));
  return `Terminal snapshot (owner's shell, started in ${cwd}):\n${fence}text\n${output}\n${fence}${text.trim() === "" ? "" : `\n\n${text.trim()}`}`;
};

/** Recognizes Iskios's serialized terminal block while leaving ordinary messages intact. */
export const terminalSnapshotOf = (text: string) => {
  const match =
    /^([\s\S]*?)Terminal snapshot \(owner's shell, started in ([^\n]*)\):\n(`{3,})text\n([\s\S]*?)\n\3(?:\n\n([\s\S]*))?$/.exec(
      text,
    );
  if (match === null) return null;
  return { after: match[5] ?? "", before: match[1]?.trimEnd() ?? "", cwd: match[2] ?? "", output: match[4] ?? "" };
};
