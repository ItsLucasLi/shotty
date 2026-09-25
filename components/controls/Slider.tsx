'use client';

import { useEffect, useId, useRef } from 'react';
import { SPRING, hold, onFrame, rubber, spring, type Spring } from '@/lib/fluid';

/** The existing thumb, and how much it grows while grabbed — still inside the 20px track. */
const THUMB = 13;
const THUMB_GRABBED = 1.4;
/** Rail thins by up to 22 % at full stretch, in proportion to the reference. */
const THIN = 0.22;
/** The committed value keeps the old range input's 0.01 step. */
const quantize = (v: number) => Math.round(v * 100) / 100;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * A labelled 0–1 slider with direct manipulation.
 *
 * While the pointer is down the value comes straight from the pointer — no
 * spring, no lag. Past either end the rail rubber-bands and thins, then
 * springs back from wherever it was let go. The number rolls, except during a
 * drag, where it tracks the pointer exactly like the thumb does.
 *
 * Clicking the rail away from the thumb springs the thumb to that point;
 * grabbing the thumb itself never makes it jump under the pointer. Keyboard
 * works as it does on a native range input, including Shift for tenths.
 */
export function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const labelId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);

  // Inline styles below are computed from this once and never change, so
  // React never re-applies them over the ones the springs are writing.
  const initial = useRef(value).current;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  /**
   * Values sent upstream that React has not yet echoed back, oldest first.
   *
   * The spring commits a value on every frame, but React runs effects after
   * paint, so by the time an echo arrives the spring has usually emitted
   * newer ones. Comparing against only the latest emission would mistake that
   * stale echo for an outside change and retarget the slider backwards.
   */
  const inFlight = useRef<number[]>([]);
  const lastEmitted = useRef(value);

  const motion = useRef<{ v: Spring; over: Spring; grab: Spring; roll: Spring } | null>(null);
  const drag = useRef<{ x: number; v: number; width: number; release: () => void } | null>(null);
  /** Rubber-band radius, proportional to track length (the reference uses 70px on a 384px track). */
  const band = useRef(35);

  useEffect(() => {
    const m = {
      v: spring(initial, SPRING.snap),
      over: spring(0, SPRING.snap),
      grab: spring(0, SPRING.snap),
      roll: spring(initial, SPRING.roll),
    };
    motion.current = m;

    const stop = onFrame((t) => {
      const val = m.v.get(t);
      const s = m.over.get(t);
      const railLeft = Math.min(0, s);
      const thin = 1 - THIN * Math.min(1, Math.abs(s) / band.current);

      // Percent-plus-pixel positioning needs no measurement, so the slider
      // stays correct through window resizes while the loop is asleep.
      const rail = railRef.current!;
      rail.style.left = `${railLeft}px`;
      rail.style.right = `${-Math.max(0, s)}px`;
      rail.style.transform = `scaleY(${thin})`;

      const fill = fillRef.current!;
      fill.style.left = `${railLeft}px`;
      fill.style.width = `calc(${val * 100}% + ${s - railLeft}px)`;
      fill.style.transform = `scaleY(${thin})`;

      const thumb = thumbRef.current!;
      thumb.style.left = `calc(${val * 100}% + ${s - THUMB / 2}px)`;
      thumb.style.transform = `scale(${1 + (THUMB_GRABBED - 1) * m.grab.get(t)})`;

      const text = numberRef.current?.firstChild;
      if (text) text.nodeValue = String(Math.round(m.roll.get(t) * 100));

      const committed = quantize(val);
      if (committed !== lastEmitted.current) {
        lastEmitted.current = committed;
        inFlight.current.push(committed);
        // Only drains when React echoes a value back; a parent that rewrites
        // values would otherwise grow it forever.
        if (inFlight.current.length > 64) inFlight.current.shift();
        onChangeRef.current(committed);
      }
    });

    return () => {
      stop();
      drag.current?.release();
      drag.current = null;
      [m.v, m.over, m.grab, m.roll].forEach((s) => s.dispose());
      motion.current = null;
    };
  }, [initial]);

  // Our own echo — possibly a stale one — or a change from somewhere else?
  useEffect(() => {
    const m = motion.current;
    if (!m) return;
    const queue = inFlight.current;
    const echo = queue.indexOf(value);
    if (echo !== -1) {
      // Everything up to this value has now come back; none of it is news.
      queue.splice(0, echo + 1);
      return;
    }
    if (value === lastEmitted.current) return;
    // Genuinely from elsewhere: retarget from wherever the slider is now.
    queue.length = 0;
    lastEmitted.current = value;
    m.v.set(value);
    m.roll.set(value);
  }, [value]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const m = motion.current;
    const track = trackRef.current;
    if (!m || !track || event.button !== 0) return;
    // No preventDefault and no scripted focus(): the browser's own
    // focus-on-press then counts as pointer focus, so the keyboard focus ring
    // stays hidden. touch-none and select-none cover scrolling and selection.
    track.setPointerCapture(event.pointerId);

    const rect = track.getBoundingClientRect();
    band.current = Math.min(70, rect.width * 0.18);
    const pointer = clamp01((event.clientX - rect.left) / rect.width);
    const current = m.v.get();
    const onThumb = Math.abs(pointer - current) * rect.width <= THUMB / 2 + 6;

    // Grabbing the thumb keeps it where it is; clicking the rail springs it over.
    const from = onThumb ? current : pointer;
    if (!onThumb) {
      m.v.set(pointer);
      m.roll.set(pointer);
    }
    m.grab.set(1);
    drag.current = { x: event.clientX, v: from, width: rect.width, release: hold() };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const m = motion.current;
    const d = drag.current;
    if (!m || !d) return;
    const raw = d.v + (event.clientX - d.x) / d.width;
    const within = clamp01(raw);
    m.v.jump(within);
    m.roll.jump(within);
    m.over.jump(rubber((raw - within) * d.width, band.current));
  };

  const endDrag = () => {
    const m = motion.current;
    const d = drag.current;
    if (!m || !d) return;
    drag.current = null;
    d.release();
    // Both spring back from exactly where they were let go.
    m.over.set(0);
    m.grab.set(0);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const m = motion.current;
    if (!m) return;
    const step = event.shiftKey ? 0.1 : 0.01;
    const deltas: Record<string, number> = {
      ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step,
      PageUp: 0.1, PageDown: -0.1,
    };
    let next: number;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 1;
    else if (event.key in deltas) next = quantize(clamp01(m.v.target() + deltas[event.key]));
    else return;
    event.preventDefault();
    m.v.set(next);
    m.roll.set(next);
  };

  const percent = Math.round(value * 100);

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between">
        <span id={labelId} className="text-xs text-muted">
          {label}
        </span>
        <span ref={numberRef} aria-hidden="true" className="text-xs tabular-nums text-faint">
          {Math.round(initial * 100)}
        </span>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={String(percent)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={onKeyDown}
        // The visible track is 20px; the hit area extends to 44px without
        // moving anything, weighted downward so it does not cover the label.
        className="group relative h-5 w-full cursor-pointer touch-none outline-none select-none before:absolute before:inset-x-0 before:-top-2 before:-bottom-4 before:content-['']"
      >
        <div
          ref={railRef}
          className="absolute top-1/2 -mt-px h-[2px] rounded-full bg-line-strong"
          style={{ left: 0, right: 0 }}
        />
        <div
          ref={fillRef}
          className="absolute top-1/2 -mt-px h-[2px] rounded-full bg-ink"
          style={{ left: 0, width: `${initial * 100}%` }}
        />
        <div
          ref={thumbRef}
          className="absolute top-1/2 rounded-full bg-ink group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ink"
          style={{
            width: THUMB,
            height: THUMB,
            marginTop: -THUMB / 2,
            left: `calc(${initial * 100}% - ${THUMB / 2}px)`,
          }}
        />
      </div>
    </div>
  );
}
