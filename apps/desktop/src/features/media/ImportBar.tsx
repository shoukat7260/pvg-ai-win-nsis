import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { MediaImportMode } from "@/types";

export interface ImportFilePayload {
  /** Native absolute path when available (Tauri File.path); else display name. */
  path: string;
  /** Browser File blob for Object URL preview — never sent to native IPC. */
  file?: File;
}

interface ImportBarProps {
  disabled?: boolean;
  busy?: boolean;
  onImport: (
    files: ImportFilePayload[],
    mode: MediaImportMode,
  ) => Promise<void> | void;
}

export function ImportBar({ disabled, busy, onImport }: ImportBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<MediaImportMode>("link");
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const runImport = useCallback(
    async (payloads: ImportFilePayload[]) => {
      setLocalError(null);
      const cleaned = payloads.filter((p) => p.path.trim());
      if (cleaned.length === 0) {
        setLocalError("No files selected");
        return;
      }
      try {
        await onImport(cleaned, mode);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Import failed");
      }
    },
    [mode, onImport],
  );

  const onFileChange = async (files: FileList | null) => {
    if (!files?.length) return;
    const payloads: ImportFilePayload[] = Array.from(files).map((f) => {
      const withPath = f as File & { path?: string };
      return {
        path: withPath.path || f.name,
        file: f,
      };
    });
    await runImport(payloads);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3" data-testid="import-bar">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-charcoal-500">
          Import mode
        </span>
        <div className="flex rounded-xl border border-white/10 p-0.5">
          {(["link", "copy"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={disabled || busy}
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 text-xs capitalize transition ${
                mode === m
                  ? "bg-accent-mute text-accent-bright"
                  : "text-charcoal-400 hover:text-charcoal-100"
              }`}
              data-testid={`import-mode-${m}`}
            >
              {m}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          data-testid="import-browse"
        >
          {busy ? "Importing…" : "Browse files"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept="video/*,audio/*,image/*"
          onChange={(e) => void onFileChange(e.target.files)}
          data-testid="import-file-input"
        />
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled || busy}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled || busy) return;
          void onFileChange(e.dataTransfer.files);
        }}
        className={`rounded-surface border border-dashed px-4 py-6 text-center transition ${
          dragOver
            ? "border-accent/50 bg-accent-mute/40"
            : "border-white/10 bg-charcoal-900/40 hover:border-accent/30"
        } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
        data-testid="import-drop-zone"
        onClick={() => {
          if (!disabled && !busy) inputRef.current?.click();
        }}
      >
        <p className="text-sm text-charcoal-200">
          Drop media here or browse to import
        </p>
        <p className="mt-1 text-xs text-charcoal-500">
          Browser preview uses secure blob URLs; desktop uses validated project paths.
        </p>
      </div>

      {localError ? (
        <p className="text-xs text-danger" data-testid="import-error">
          {localError}
        </p>
      ) : null}
    </div>
  );
}
