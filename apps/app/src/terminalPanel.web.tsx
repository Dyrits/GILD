import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { styles } from "./styles";
import type { TerminalPanelProps } from "./terminalPanelTypes";
import { terminalTextOf } from "./terminalSnapshot";
import { colors, fonts } from "./theme";

/** An interactive desktop shell whose output can be attached to the next message. */
export function TerminalPanel({ id, cwd, ref, onReady }: TerminalPanelProps) {
  const container = useRef<HTMLDivElement>(null);
  const surface = useRef<Terminal | null>(null);
  const folder = useRef("");
  const isReady = useRef(false);
  const ready = useRef(onReady);
  ready.current = onReady;
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [generation, setGeneration] = useState(0);
  useImperativeHandle(ref, () => ({
    focus: () => surface.current?.focus(),
    snapshot: () =>
      new Promise((resolve, reject) => {
        const terminal = surface.current;
        if (terminal === null || !isReady.current) {
          reject(new Error("Wait for the terminal to open before sending."));
          return;
        }
        // xterm parses asynchronously, so a flush must finish before reading its buffer.
        terminal.write("", () => resolve({ cwd: folder.current, text: terminalTextOf(terminal.buffer.active) }));
      }),
  }));
  // A new shell deliberately recreates the emulator even when its conversation and folder stay the same.
  // biome-ignore lint/correctness/useExhaustiveDependencies: generation explicitly resets the terminal after its shell exits.
  useEffect(() => {
    const bridge = window.gild;
    const element = container.current;
    if (bridge === undefined || element === null) return;
    let active = true;
    let sequence: number | null = null;
    const pending: { text: string; sequence: number }[] = [];
    const pendingInput: string[] = [];
    isReady.current = false;
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: fonts.mono,
      fontSize: 13,
      scrollback: 3000,
      theme: {
        background: colors.accentSoft,
        black: colors.text,
        blue: colors.accentText,
        brightBlack: colors.textMuted,
        brightBlue: colors.accentText,
        brightCyan: colors.accent,
        brightGreen: colors.successText,
        brightMagenta: colors.violet,
        brightRed: colors.danger,
        brightWhite: colors.text,
        brightYellow: colors.warningText,
        cursor: colors.text,
        cyan: colors.accent,
        foreground: colors.text,
        green: colors.successText,
        magenta: colors.violet,
        red: colors.danger,
        white: colors.textSecondary,
        yellow: colors.warningText,
      },
    });
    surface.current = terminal;
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(element);
    const onError = (reason: unknown) => {
      if (active) setError(String(reason));
    };
    const write = (text: string, next: number) => {
      if (sequence === null) {
        pending.push({ sequence: next, text });
        return;
      }
      if (next > sequence) {
        terminal.write(text);
        sequence = next;
      }
    };
    const unsubscribe = bridge.terminalListen(
      (session, data, next) => {
        if (session === id && active) write(data, next);
      },
      (session) => {
        if (session === id && active) setIsRunning(false);
      },
    );
    const input = terminal.onData((data) => {
      if (isReady.current) void bridge.terminalWrite(id, data).catch(onError);
      else pendingInput.push(data);
    });
    const resize = () => {
      if (!active || element.clientWidth === 0 || element.clientHeight === 0) return;
      fit.fit();
      void bridge.terminalResize(id, Math.min(500, terminal.cols), Math.min(200, terminal.rows)).catch(onError);
    };
    const observer = new ResizeObserver(resize);
    void bridge
      .terminalOpen(id, cwd)
      .then((session) => {
        if (!active) return;
        folder.current = session.cwd;
        setIsRunning(session.isRunning);
        sequence = session.sequence;
        terminal.write(session.output);
        for (const chunk of pending) write(chunk.text, chunk.sequence);
        terminal.write("", () => {
          if (active) {
            isReady.current = true;
            for (const data of pendingInput.splice(0)) void bridge.terminalWrite(id, data).catch(onError);
            ready.current();
          }
        });
        resize();
        observer.observe(element);
        terminal.focus();
      })
      .catch(onError);
    return () => {
      active = false;
      isReady.current = false;
      surface.current = null;
      observer.disconnect();
      input.dispose();
      unsubscribe();
      terminal.dispose();
    };
  }, [id, cwd, generation]);
  const restart = () => {
    void window.gild
      ?.terminalClose(id)
      .then(() => {
        setError(null);
        setGeneration((value) => value + 1);
      })
      .catch((reason: Error) => setError(reason.message));
  };
  return (
    <View style={{ backgroundColor: colors.accentSoft, borderRadius: 8, gap: 4, padding: 8 }}>
      {!isRunning && (
        <View style={styles.row}>
          <Text style={{ color: colors.textSecondary }}>Shell exited</Text>
          <Pressable onPress={restart}>
            <Text style={{ color: colors.textSecondary }}>New shell</Text>
          </Pressable>
        </View>
      )}
      {error !== null && (
        <Text accessibilityRole="alert" style={{ color: colors.marker }}>
          {error}
        </Text>
      )}
      <section aria-label="Interactive terminal" ref={container} style={{ height: 160, width: "100%" }} />
    </View>
  );
}
