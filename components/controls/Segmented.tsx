'use client';

/** A row of mutually exclusive options. Used for aspect ratio and export scale. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex border border-line-strong">
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`px-3 py-1.5 text-xs tabular-nums transition-colors ${
              index > 0 ? 'border-l border-line-strong' : ''
            } ${
              selected
                ? 'bg-ink text-canvas'
                : 'bg-surface text-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
