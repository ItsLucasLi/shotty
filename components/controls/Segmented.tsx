'use client';

/**
 * A row of mutually exclusive options. Used for aspect ratio and export scale.
 *
 * The shell is a recessed track and the active option is a pill inset within
 * it, rather than a hard block stamped across the full cell — same contrast,
 * softer edge.
 */
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
    <div
      role="group"
      aria-label={label}
      className="inline-flex gap-1 rounded-lg border border-line bg-canvas p-[3px]"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-3 py-1.5 text-xs tabular-nums transition-colors ${
              selected
                ? 'bg-ink text-canvas shadow-[0_1px_2px_rgba(15,23,42,0.18)]'
                : 'text-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
