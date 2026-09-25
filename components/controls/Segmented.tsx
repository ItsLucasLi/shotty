'use client';

import { useLayoutEffect, useRef } from 'react';
import { SPRING, onFrame, spring, type Spring } from '@/lib/fluid';

/**
 * A row of mutually exclusive options. Used for aspect ratio and export scale.
 *
 * The selection is one ink pill that travels between options as a liquid
 * indicator: its leading edge rides the fast `lead` spring and its trailing
 * edge the slower `trail` spring, so it stretches toward where it is going and
 * then settles. The labels exist twice — muted in the row, inverted in a copy
 * clipped to the pill — so each label flips colour exactly where the pill
 * passes over it, rather than cross-fading.
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
  const rowRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const invertedRef = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const edges = useRef<{ left: Spring; right: Spring; top: number; height: number } | null>(null);

  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = useRef(selectedIndex);
  selected.current = selectedIndex;

  /** The selected button's box, relative to the row. */
  const measure = (index: number) => {
    const b = buttons.current[index];
    return b ? { l: b.offsetLeft, r: b.offsetLeft + b.offsetWidth, top: b.offsetTop, height: b.offsetHeight } : null;
  };

  // Paint synchronously before the first frame, and set up the springs.
  useLayoutEffect(() => {
    const row = rowRef.current!;
    const pill = pillRef.current!;
    const inverted = invertedRef.current!;
    const start = measure(selected.current) ?? { l: 0, r: 0, top: 0, height: 0 };
    const e = {
      left: spring(start.l, SPRING.lead),
      right: spring(start.r, SPRING.lead),
      top: start.top,
      height: start.height,
    };
    edges.current = e;
    // The inverted labels are clipped to the pill's own corner radius, read
    // from its computed style so the two can never drift from --radius-md.
    let radius = parseFloat(getComputedStyle(pill).borderTopLeftRadius) || 0;

    const paint = (t: number) => {
      const l = e.left.done(t) ? e.left.target() : e.left.get(t);
      const r = e.right.done(t) ? e.right.target() : e.right.get(t);
      const w = Math.max(1, r - l);
      pill.style.transform = `translateX(${l}px)`;
      pill.style.width = `${w}px`;
      pill.style.top = `${e.top}px`;
      pill.style.height = `${e.height}px`;
      // The inverted labels are the same row, clipped to exactly the pill.
      const rowWidth = row.clientWidth;
      const bottom = row.clientHeight - e.top - e.height;
      inverted.style.clipPath = `inset(${e.top}px ${rowWidth - r}px ${bottom}px ${l}px round ${radius}px)`;
    };
    paint(performance.now() / 1000);
    const stop = onFrame(paint);

    // Fonts loading late, or anything else that moves the options: follow
    // without animating, so a reflow never looks like a selection change.
    const observer = new ResizeObserver(() => {
      const box = measure(selected.current);
      if (!box) return;
      e.left.jump(box.l);
      e.right.jump(box.r);
      e.top = box.top;
      e.height = box.height;
      radius = parseFloat(getComputedStyle(pill).borderTopLeftRadius) || 0;
      paint(performance.now() / 1000);
    });
    observer.observe(row);

    return () => {
      stop();
      observer.disconnect();
      e.left.dispose();
      e.right.dispose();
      edges.current = null;
    };
    // The springs are created once; measure() reads refs only.
  }, []);

  // A new selection: the edge on the side of travel leads, the other trails.
  useLayoutEffect(() => {
    const e = edges.current;
    const box = measure(selectedIndex);
    if (!e || !box) return;
    if (box.l === e.left.target() && box.r === e.right.target()) return;
    const movingRight = box.l + box.r > e.left.target() + e.right.target();
    const [lead, trail] = movingRight ? [e.right, e.left] : [e.left, e.right];
    lead.set(movingRight ? box.r : box.l, { cfg: SPRING.lead });
    trail.set(movingRight ? box.l : box.r, { cfg: SPRING.trail });
    e.top = box.top;
    e.height = box.height;
  }, [selectedIndex]);

  const cell = 'rounded-md px-3 py-1.5 text-xs tabular-nums';

  return (
    <div
      ref={rowRef}
      role="group"
      aria-label={label}
      className="relative inline-flex gap-1 rounded-lg border border-line bg-canvas p-[3px]"
    >
      <div
        ref={pillRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 rounded-md bg-ink shadow-[0_1px_2px_rgba(15,23,42,0.18)]"
      />

      {options.map((option, index) => (
        <button
          key={String(option.value)}
          ref={(el) => {
            buttons.current[index] = el;
          }}
          type="button"
          aria-pressed={index === selectedIndex}
          onClick={() => onChange(option.value)}
          className={`relative ${cell} text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
        >
          {option.label}
        </button>
      ))}

      {/* The same labels, inverted, visible only inside the pill. Same
          padding, gap and cells as the row, so every glyph lands exactly on
          the one beneath it. */}
      <div
        ref={invertedRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex gap-1 p-[3px] text-canvas"
      >
        {options.map((option) => (
          <span key={String(option.value)} className={cell}>
            {option.label}
          </span>
        ))}
      </div>
    </div>
  );
}
