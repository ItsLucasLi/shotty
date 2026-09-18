'use client';

import { useRef } from 'react';
import { ACCEPTED_TYPES } from '@/lib/image';

/** The empty state: drop, pick, or paste. */
export function Dropzone({
  onFile,
  isDraggingOver,
}: {
  onFile: (file: File | null | undefined) => void;
  isDraggingOver: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`flex h-full max-h-[32rem] w-full max-w-3xl flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-8 text-center transition-colors ${
          isDraggingOver
            ? 'border-ink bg-surface'
            : 'border-line-strong hover:border-ink hover:bg-surface'
        }`}
      >
        <span className="text-base text-ink">Drop a screenshot here</span>
        <span className="text-sm text-muted">
          or press <kbd className="font-sans">⌘V</kbd> to paste, or click to choose a file
        </span>
        <span className="mt-4 max-w-sm text-xs leading-relaxed text-faint">
          Everything happens in this browser tab. Your image is never uploaded.
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="sr-only"
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          // Reset so picking the same file twice still fires a change.
          event.target.value = '';
        }}
      />
    </div>
  );
}
