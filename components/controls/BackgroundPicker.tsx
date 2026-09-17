'use client';

import {
  BACKGROUND_PRESETS,
  backgroundToCss,
  isSameBackground,
} from '@/lib/backgrounds';
import type { Background } from '@/lib/composition';

/** Preset swatches, then a native colour input for anything else. */
export function BackgroundPicker({
  value,
  onChange,
}: {
  value: Background;
  onChange: (background: Background) => void;
}) {
  const isCustom = !BACKGROUND_PRESETS.some((preset) =>
    isSameBackground(preset.background, value),
  );
  const customColor = value.kind === 'solid' ? value.color : '#ffffff';

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
            className={`h-6 w-6 border transition-shadow ${
              selected
                ? 'border-ink shadow-[0_0_0_2px_var(--color-canvas),0_0_0_3px_var(--color-ink)]'
                : 'border-line-strong hover:border-ink'
            }`}
            style={{ background: backgroundToCss(preset.background) }}
          />
        );
      })}
      </div>

      <label
        className={`flex h-6 cursor-pointer items-center gap-1.5 border px-2 text-xs transition-colors ${
          isCustom ? 'border-ink text-ink' : 'border-line-strong text-muted hover:border-ink'
        }`}
        title="Custom colour"
      >
        <input
          type="color"
          className="h-3.5 w-3.5"
          value={customColor}
          onChange={(event) => onChange({ kind: 'solid', color: event.target.value })}
        />
        Custom
      </label>
    </div>
  );
}
