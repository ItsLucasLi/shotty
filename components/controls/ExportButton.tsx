'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveLayout, type Composition, type SourceImage } from '@/lib/composition';
import { downloadPng, type ExportScale } from '@/lib/export';
import {
  CHECK_SPRING,
  SPRING,
  layer,
  onFrame,
  spring,
  type Layer,
  type Spring,
} from '@/lib/fluid';
import { Segmented } from './Segmented';

const SCALES: readonly { value: ExportScale; label: string }[] = [
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
];

/** Resting geometry matches the previous plain button exactly: 34px tall, --radius-lg. */
const HEIGHT = 34;
const REST_RADIUS = 14;
/** The check "pops" the circle by the same ratio as the reference (64 → 78). */
const POP = Math.round(HEIGHT * (78 / 64));
/** Anything past h/2 clamps to a perfect circle. */
const CIRCLE = 999;

/** Spinner geometry: an arc on an 18 % track, stroke 2.25. */
const ARC_R = 7.25;
const ARC_C = 2 * Math.PI * ARC_R;

/**
 * The canvas draw is one synchronous task: it holds the main thread for about
 * 20–25 ms per output megapixel (measured: 200 ms at 10 MP, 1.17 s at 47 MP).
 * From here up that freeze is long enough to see, so the draw waits for the
 * loader to finish forming first — otherwise the button freezes half-collapsed
 * with no spinner showing, then cuts straight to the circle.
 */
const LEAD_IN_MEGAPIXELS = 4;
/** Long enough for the circle to form and the spinner to be ~95 % in, under 1px of blur — it is frozen on screen for the length of the draw. */
const LOADER_LEAD_IN_MS = 320;

type Phase = 'idle' | 'exporting' | 'done' | 'toast';
type Message = { title: string; detail: string };

/** Resolve after the browser has painted the current frame. */
const afterPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Download PNG, as one morphing shape: button → loader → check → toast.
 *
 * The same element springs between sizes while its content swaps through a
 * short blur; nothing is ever cut. The loader runs for exactly as long as the
 * export does: it starts on click and resolves when the PNG is ready. The
 * arc's rotation is a compositor-thread CSS animation, so it keeps turning
 * through the synchronous canvas draw that holds the main thread; for large
 * exports the draw waits for the loader to form first (see LEAD_IN_MEGAPIXELS).
 */
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
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<Message | null>(null);

  const slotRef = useRef<HTMLSpanElement>(null);
  const shapeRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const spinnerRef = useRef<HTMLSpanElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);
  const checkRef = useRef<HTMLSpanElement>(null);
  const checkPathRef = useRef<SVGPathElement>(null);
  const toastRef = useRef<HTMLSpanElement>(null);

  const motion = useRef<{
    w: Spring; h: Spring; r: Spring; press: Spring; arc: Spring; draw: Spring;
    label: Layer; spinner: Layer; check: Layer; toast: Layer;
  } | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const busy = useRef(false);

  const after = useCallback((ms: number, fn: () => void) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);

  /** The resting width: whatever the in-flow sizer measures, so layout is unchanged. */
  const restWidth = () => slotRef.current?.offsetWidth ?? 123;

  useEffect(() => {
    const shape = shapeRef.current!;
    const m = {
      w: spring(restWidth()),
      h: spring(HEIGHT),
      r: spring(REST_RADIUS),
      press: spring(0, SPRING.press),
      arc: spring(70),
      draw: spring(0, CHECK_SPRING),
      label: layer(labelRef.current!, { visible: true }),
      spinner: layer(spinnerRef.current!),
      check: layer(checkRef.current!),
      toast: layer(toastRef.current!),
    };
    motion.current = m;

    const stop = onFrame((t) => {
      const W = m.w.get(t);
      const H = m.h.get(t);
      shape.style.width = `${W}px`;
      shape.style.height = `${H}px`;
      shape.style.borderRadius = `${Math.min(m.r.get(t), W / 2, H / 2)}px`;
      shape.style.transform = `translateY(-50%) scale(${1 - 0.035 * m.press.get(t)})`;
      arcRef.current?.setAttribute(
        'stroke-dasharray',
        `${(Math.min(360, m.arc.get(t)) / 360) * ARC_C} ${ARC_C}`,
      );
      if (checkPathRef.current) {
        checkPathRef.current.style.strokeDashoffset = String(1 - m.draw.get(t));
      }
    });

    // Press feedback lands on pointerdown; the morph waits for the click.
    const release = () => m.press.set(0);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    // Keep the resting width honest if fonts load late or the text reflows.
    const sizer = new ResizeObserver(() => {
      if (!busy.current) m.w.jump(restWidth());
    });
    if (slotRef.current) sizer.observe(slotRef.current);

    const pending = timers.current;
    return () => {
      stop();
      sizer.disconnect();
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      pending.forEach(clearTimeout);
      pending.clear();
      [m.w, m.h, m.r, m.press, m.arc, m.draw].forEach((s) => s.dispose());
      [m.label, m.spinner, m.check, m.toast].forEach((l) => l.dispose());
      motion.current = null;
    };
  }, []);

  const settleToIdle = useCallback(
    (holdFor: number) => {
      after(holdFor, () => {
        const m = motion.current;
        if (!m) return;
        m.toast.hide();
        m.label.show();
        setPhase('idle');
        busy.current = false;
      });
    },
    [after],
  );

  const handleExport = useCallback(async () => {
    const m = motion.current;
    if (!m || busy.current) return;
    busy.current = true;
    setMessage(null);
    setPhase('exporting');

    // Button → loader: the same shape collapses to a circle.
    m.label.hide();
    m.spinner.show();
    m.arc.jump(70);
    m.w.set(HEIGHT);
    m.r.set(CIRCLE);
    // Next beat: the arc lengthens, if the export is still running by then.
    after(380, () => {
      if (busy.current && m.arc.target() < 360) m.arc.set(250);
    });

    // Let the loader reach the screen before the synchronous draw holds the
    // main thread. Small exports need only one paint, so their loader stays as
    // short as the export; large ones wait for it to form, since it will be
    // frozen on screen for the length of the draw.
    const { canvas } = resolveLayout(composition, image);
    const megapixels = (canvas.width * canvas.height * scale * scale) / 1e6;
    await (megapixels >= LEAD_IN_MEGAPIXELS ? wait(LOADER_LEAD_IN_MS) : afterPaint());

    let result: Awaited<ReturnType<typeof downloadPng>> | null = null;
    try {
      result = await downloadPng(composition, image, scale);
    } catch {
      result = null;
    }
    // Unmounted while exporting (e.g. Replace image): the file still
    // downloaded, but there is no button left to animate.
    if (motion.current !== m) return;

    if (!result) {
      // Loader → toast, skipping the check: the shape reopens with the error.
      setMessage({ title: 'Export failed', detail: 'Try 1x' });
      m.spinner.hide();
      m.toast.show();
      m.w.set(restWidth());
      m.r.set(REST_RADIUS);
      setPhase('toast');
      settleToIdle(2400);
      return;
    }

    const capped = result.scale < result.requestedScale;
    setMessage({
      title: capped ? 'Saved, capped' : 'Saved',
      detail: `${result.width} × ${result.height}`,
    });

    // Loader → check: close the ring, then draw the tick and pop the circle.
    m.arc.set(360, { cfg: SPRING.lead });
    after(140, () => {
      m.spinner.hide();
      m.check.show();
      m.draw.jump(0);
      after(90, () => m.draw.set(1));
      m.w.set(POP, { cfg: SPRING.lead });
      m.h.set(POP, { cfg: SPRING.lead });
      after(90, () => {
        m.w.set(HEIGHT, { cfg: SPRING.shape });
        m.h.set(HEIGHT, { cfg: SPRING.shape });
      });
      setPhase('done');
    });

    // Check → toast: the circle stretches back into a pill carrying the result.
    after(140 + 640, () => {
      m.check.hide();
      m.toast.show();
      m.w.set(restWidth());
      m.r.set(REST_RADIUS);
      setPhase('toast');
      settleToIdle(capped ? 2600 : 1700);
    });
  }, [after, composition, image, scale, settleToIdle]);

  const accessibleName =
    phase === 'exporting' ? 'Exporting PNG' : phase === 'idle' ? 'Download PNG' : 'Saved';

  return (
    <div className="flex items-center gap-2">
      <Segmented label="Export scale" options={SCALES} value={scale} onChange={onScaleChange} />

      {/* The slot keeps the button's resting footprint in the layout, so the
          morph happens over it without nudging its neighbours. */}
      <span className="relative inline-block">
        <span
          ref={slotRef}
          aria-hidden="true"
          className="invisible block whitespace-nowrap border border-transparent px-4 py-2 text-xs"
        >
          Download PNG
        </span>

        <button
          ref={shapeRef}
          type="button"
          onClick={handleExport}
          onPointerDown={() => motion.current?.press.set(1)}
          aria-label={accessibleName}
          aria-busy={phase === 'exporting'}
          aria-disabled={phase !== 'idle'}
          data-phase={phase}
          // Hover dimming applies only at rest. The cursor is still over the
          // button after the click, and dimming the loader, check and toast
          // would put muddy grey frames through the whole sequence.
          className="absolute top-1/2 right-0 overflow-hidden bg-ink text-canvas transition-opacity [contain:layout_paint] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink data-[phase=idle]:hover:opacity-85"
          style={{ width: 123, height: HEIGHT, borderRadius: REST_RADIUS, transform: 'translateY(-50%)' }}
        >
          <span ref={labelRef} className="absolute inset-0 flex items-center justify-center whitespace-nowrap text-xs">
            Download PNG
          </span>

          <span ref={spinnerRef} className="invisible absolute inset-0 flex items-center justify-center">
            {/* Paused, not removed, outside the export: a hidden element's
                animation still ticks, and an idle page should cost nothing. */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              className="animate-[shotty-spin_0.9s_linear_infinite]"
              style={{ animationPlayState: phase === 'exporting' ? 'running' : 'paused' }}
              aria-hidden="true"
            >
              <circle cx="9" cy="9" r={ARC_R} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2.25" />
              <circle
                ref={arcRef}
                cx="9"
                cy="9"
                r={ARC_R}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeDasharray={`${(70 / 360) * ARC_C} ${ARC_C}`}
                transform="rotate(-90 9 9)"
              />
            </svg>
          </span>

          <span ref={checkRef} className="invisible absolute inset-0 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                ref={checkPathRef}
                d="M5 9.4 7.8 12.2 13 6.3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset="1"
              />
            </svg>
          </span>

          <span
            ref={toastRef}
            className="invisible absolute inset-0 flex flex-col items-center justify-center leading-none whitespace-nowrap"
          >
            <span className="text-[11px] font-medium">{message?.title}</span>
            <span className="mt-[3px] text-[10px] tabular-nums opacity-70">{message?.detail}</span>
          </span>
        </button>
      </span>

      <span className="sr-only" aria-live="polite">
        {phase === 'toast' && message ? `${message.title}. ${message.detail} pixels.` : ''}
      </span>
    </div>
  );
}
