import { useRef } from "react";
import { colors } from "./theme";

/** The file button of the message box: opens the browser's file chooser for images; the chosen files go through the same step as a paste. */
export function AttachButton({ onFiles }: { onFiles: (files: ReadonlyArray<File>) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          // The same file can be chosen again after it was taken out.
          event.target.value = "";
        }}
        ref={input}
        style={{ display: "none" }}
        type="file"
      />
      <button
        aria-label="Attach images"
        onClick={() => input.current?.click()}
        style={{
          alignItems: "center",
          background: "transparent",
          border: "none",
          color: colors.textDim,
          cursor: "pointer",
          display: "inline-flex",
          height: 28,
          justifyContent: "center",
          padding: 0,
          width: 28,
        }}
        title="Attach images"
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="16"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
          viewBox="0 0 16 16"
          width="16"
        >
          <path d="M8 3v10M3 8h10" />
        </svg>
      </button>
    </>
  );
}
