'use client';

import {
  ASPECTS,
  ASPECT_LABELS,
  type Aspect,
  type Composition,
  type SourceImage,
} from '@/lib/composition';
import type { ExportScale } from '@/lib/export';
import { BackgroundPicker } from './BackgroundPicker';
import { ExportButton } from './ExportButton';
import { Segmented } from './Segmented';
import { Slider } from './Slider';

const ASPECT_OPTIONS = ASPECTS.map((aspect) => ({
  value: aspect,
  label: ASPECT_LABELS[aspect],
}));

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-[11px] uppercase tracking-[0.12em] text-faint">{label}</span>
      {children}
    </div>
  );
}

export function ControlBar({
  composition,
  onChange,
  image,
  exportScale,
  onExportScaleChange,
  onReplace,
  onPickBackgroundImage,
}: {
  composition: Composition;
  onChange: (patch: Partial<Composition>) => void;
  image: SourceImage;
  exportScale: ExportScale;
  onExportScaleChange: (scale: ExportScale) => void;
  onReplace: () => void;
  onPickBackgroundImage: (file: File | null | undefined) => void;
}) {
  return (
    <div className="rounded-t-xl border border-b-0 border-line bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-5">
        <div className="grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <Group label="Background">
            <BackgroundPicker
              value={composition.background}
              onChange={(background) => onChange({ background })}
              onPickImage={onPickBackgroundImage}
            />
          </Group>

          <Group label="Padding">
            <Slider
              label="Amount"
              value={composition.padding}
              onChange={(padding) => onChange({ padding })}
            />
          </Group>

          <Group label="Corners">
            <Slider
              label="Radius"
              value={composition.radius}
              onChange={(radius) => onChange({ radius })}
            />
          </Group>

          <Group label="Shadow">
            <Slider
              label="Depth"
              value={composition.shadow}
              onChange={(shadow) => onChange({ shadow })}
            />
          </Group>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
          <Group label="Ratio">
            <Segmented
              label="Canvas aspect ratio"
              options={ASPECT_OPTIONS}
              value={composition.aspect}
              onChange={(aspect: Aspect) => onChange({ aspect })}
            />
          </Group>

          <div className="flex flex-wrap items-end gap-4">
            <button
              type="button"
              onClick={onReplace}
              className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-xs text-muted transition-colors hover:border-ink hover:text-ink"
            >
              Replace image
            </button>
            <ExportButton
              composition={composition}
              image={image}
              scale={exportScale}
              onScaleChange={onExportScaleChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
