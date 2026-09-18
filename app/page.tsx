'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ControlBar } from '@/components/controls/ControlBar';
import { Dropzone } from '@/components/Dropzone';
import { Logo } from '@/components/Logo';
import { Preview } from '@/components/Preview';
import { useImageInput } from '@/hooks/useImageInput';
import { DEFAULT_COMPOSITION, type Composition } from '@/lib/composition';
import type { ExportScale } from '@/lib/export';
import { ImageLoadError, loadImage } from '@/lib/image';

export default function Page() {
  // One composition object. The preview reads it, the exporter reads it, and
  // nothing else holds a second copy of these numbers.
  const [composition, setComposition] = useState<Composition>(DEFAULT_COMPOSITION);
  const [exportScale, setExportScale] = useState<ExportScale>(2);

  const { image, error, isDraggingOver, dropHandlers, accept, clear, setError } =
    useImageInput();

  // There are two independent image inputs now — the screenshot and the
  // background — so each owns its own object URL. This ref tracks the
  // background's; useImageInput keeps its own for the screenshot.
  const backgroundUrl = useRef<string | null>(null);

  const update = useCallback((patch: Partial<Composition>) => {
    // Releasing here rather than inside the state updater keeps the updater
    // pure: React may call it more than once per commit.
    if (patch.background) {
      const nextUrl = patch.background.kind === 'image' ? patch.background.source.objectUrl : null;
      if (backgroundUrl.current && backgroundUrl.current !== nextUrl) {
        URL.revokeObjectURL(backgroundUrl.current);
      }
      backgroundUrl.current = nextUrl;
    }
    setComposition((current) => ({ ...current, ...patch }));
  }, []);

  const pickBackgroundImage = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      try {
        const source = await loadImage(file);
        update({ background: { kind: 'image', source, fit: 'cover' } });
        setError(null);
      } catch (cause) {
        setError(
          cause instanceof ImageLoadError
            ? cause.message
            : 'That background image could not be opened.',
        );
      }
    },
    [update, setError],
  );

  // Release the background image when the app unmounts.
  useEffect(
    () => () => {
      if (backgroundUrl.current) URL.revokeObjectURL(backgroundUrl.current);
    },
    [],
  );

  return (
    <div className="flex h-dvh flex-col" {...dropHandlers}>
      <header className="flex flex-col gap-1 border-b border-line px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2.5 text-sm tracking-[0.18em] uppercase">
          <Logo size={20} />
          Shotty
        </h1>
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
          onPickBackgroundImage={pickBackgroundImage}
        />
      )}
    </div>
  );
}
