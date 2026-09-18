'use client';

import { useState } from 'react';
import type { Composition, SourceImage } from '@/lib/composition';
import { downloadPng, type ExportScale } from '@/lib/export';
import { Segmented } from './Segmented';

const SCALES: readonly { value: ExportScale; label: string }[] = [
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
];

export function ExportButton({
  composition,
  image,
  scale,
  onScaleChange,
}: {
  composition: Composition;
  image: SourceImage;
  scale: ExportScale;
  onScaleChange: (scale: ExportScale) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const handleExport = async () => {
    setBusy(true);
    setNote(null);
    try {
      const result = await downloadPng(composition, image, scale);
      if (result.scale < result.requestedScale) {
        setNote(`Capped at ${result.width} × ${result.height} — the browser's canvas limit.`);
      }
    } catch {
      setNote('Export failed. Try a smaller scale.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Segmented
        label="Export scale"
        options={SCALES}
        value={scale}
        onChange={onScaleChange}
      />
      <button
        type="button"
        onClick={handleExport}
        disabled={busy}
        className="rounded-md border border-ink bg-ink px-4 py-1.5 text-xs text-canvas transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {busy ? 'Exporting…' : 'Download PNG'}
      </button>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}
