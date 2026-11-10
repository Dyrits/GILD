import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChipEditor } from "./chipEditor.web";
import type { Chip, ChipEditorHandle, Trigger } from "./chipEditorTypes";

// A page holding only the web message box: Tab completes the trigger with a fixed skill or folder, and the last text and trigger are kept on `window.__out`.
const chips: Record<Trigger["character"], Chip> = {
  "@": { kind: "folder", label: "src/", token: "@src/" },
  "/": { kind: "skill", label: "architect", token: "/architect" },
};

declare global {
  interface Window {
    __out?: { text: string; trigger: Trigger | null };
  }
}

function App() {
  const editor = useRef<ChipEditorHandle>(null);
  const [out, setOut] = useState<{ text: string; trigger: Trigger | null }>({ text: "", trigger: null });
  return (
    <div style={{ background: "#f8edd2", fontFamily: "sans-serif", width: 600 }}>
      <ChipEditor
        onChange={(text, trigger) => {
          setOut({ text, trigger });
          window.__out = { text, trigger };
        }}
        onKeyDown={({ key }) => {
          const trigger = window.__out?.trigger;
          if (key !== "Tab" || !trigger) return false;
          editor.current?.insertChip(chips[trigger.character]);
          return true;
        }}
        placeholder="Start a quest with one message…"
        ref={editor}
      />
      <pre id="out">{JSON.stringify(out)}</pre>
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
