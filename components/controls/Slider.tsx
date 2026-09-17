'use client';

import { useId } from 'react';

/** A labelled 0–1 slider with its value shown as a percentage. */
export function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-xs text-muted">
          {label}
        </label>
        <span className="text-xs tabular-nums text-faint">{Math.round(value * 100)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
