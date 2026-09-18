'use client';

import { useRef } from 'react';
import {
  BACKGROUND_PRESETS,
  backgroundToStyle,
  isSameBackground,
} from '@/lib/backgrounds';
import type { Background } from '@/lib/composition';
import { ACCEPTED_TYPES } from '@/lib/image';

/** Preset swatches, then a colour of your own, then an image of your own. */
export function BackgroundPicker({
  value,
  onChange,
  onPickImage,
}: {
  value: Background;
  onChange: (background: Background) => void;
  onPickImage: (file: File | null | undefined) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const isPreset = BACKGROUND_PRESETS.some((preset) =>
    isSameBackground(preset.background, value),
  );
  const isImage = value.kind === 'image';
  const isCustomColor = !isPreset && !isImage;
  const customColor = value.kind === 'solid' ? value.color : '#ffffff';

  const chip = (active: boolean) =>
    `flex h-7 cursor-pointer items-center gap-1.5 rounded-sm border px-2 text-xs transition-colors ${
      active ? 'border-ink text-ink' : 'border-line-strong text-muted hover:border-ink'
    }`;

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="grid grid-cols-6 gap-1.5">
        {BACKGROUND_PRESETS.map((preset) => {
          const selected = isSameBackground(preset.background, value);
          return (
            <button
              key={preset.id}
              type="button"
              title={preset.label}
              aria-label={preset.label}
              aria-pressed={selected}
              onClick={() => onChange(preset.background)}
              className={`h-7 w-7 rounded-sm border transition-shadow ${
                selected
                  ? 'border-ink shadow-[0_0_0_2px_var(--color-surface),0_0_0_3px_var(--color-ink)]'
                  : 'border-line-strong hover:border-ink'
              }`}
              style={backgroundToStyle(preset.background)}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-1.5">
        <label className={chip(isCustomColor)} title="Custom colour">
          <input
            type="color"
            className="h-4 w-4"
            value={customColor}
            onChange={(event) => onChange({ kind: 'solid', color: event.target.value })}
          />
          Colour
        </label>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={chip(isImage)}
          title="Use your own image as the background"
        >
          <span
            aria-hidden
            className="h-4 w-4 rounded-sm border border-line-strong"
            style={
              isImage
                ? { ...backgroundToStyle(value), borderColor: 'transparent' }
                : undefined
            }
          />
          Image
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="sr-only"
        onChange={(event) => {
          onPickImage(event.target.files?.[0]);
          // Reset so picking the same file twice still fires a change.
          event.target.value = '';
        }}
      />
    </div>
  );
}
