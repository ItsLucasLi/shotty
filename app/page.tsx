'use client';

import { useCallback, useState } from 'react';
import { ControlBar } from '@/components/controls/ControlBar';
import { Dropzone } from '@/components/Dropzone';
import { Preview } from '@/components/Preview';
import { useImageInput } from '@/hooks/useImageInput';
import { DEFAULT_COMPOSITION, type Composition } from '@/lib/composition';
import type { ExportScale } from '@/lib/export';

export default function Page() {
  // One composition object. The preview reads it, the exporter reads it, and
  // nothing else holds a second copy of these numbers.
  const [composition, setComposition] = useState<Composition>(DEFAULT_COMPOSITION);
  const [exportScale, setExportScale] = useState<ExportScale>(2);

  const { image, error, isDraggingOver, dropHandlers, accept, clear } = useImageInput();

  const update = useCallback(
    (patch: Partial<Composition>) => setComposition((current) => ({ ...current, ...patch })),
    [],
  );

  return (
    <div className="flex h-dvh flex-col" {...dropHandlers}>
      <header className="flex flex-col gap-1 border-b border-line px-6 py-4 sm:flex-row sm:items-baseline sm:justify-between">
        <h1 className="text-sm tracking-[0.18em] uppercase">Shotty</h1>
        <p className="text-xs text-muted">
          Runs entirely in your browser. Images are never uploaded.
        </p>
      </header>

      <main className="flex min-h-0 flex-1 flex-col px-6 py-8">
        {image ? (
          <Preview composition={composition} image={image} />
        ) : (
          <Dropzone onFile={accept} isDraggingOver={isDraggingOver} />
        )}

        {error && (
          <p role="alert" className="pt-4 text-center text-xs text-ink">
            {error}
          </p>
        )}
      </main>

      {image && (
        <ControlBar
          composition={composition}
          onChange={update}
          image={image}
          exportScale={exportScale}
          onExportScaleChange={setExportScale}
          onReplace={clear}
        />
      )}
    </div>
  );
}
