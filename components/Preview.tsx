'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { resolveLayout, type Composition, type SourceImage } from '@/lib/composition';
import { backgroundToStyle } from '@/lib/backgrounds';
import { SPRING, onFrame, spring, type Spring } from '@/lib/fluid';

/** On-screen geometry, in CSS px, plus the figures the size label shows. */
type Target = {
  fw: number; fh: number; ix: number; iy: number; iw: number; ih: number;
  outW: number; outH: number; pct: number;
};
const GEOMETRY = ['fw', 'fh', 'ix', 'iy', 'iw', 'ih'] as const;
const FIGURES = ['outW', 'outH', 'pct'] as const;

const label = (w: number, h: number, pct: number) =>
  `${Math.round(w)} × ${Math.round(h)}${
    pct > 0 && Math.round(pct) < 100 ? ` · preview at ${Math.round(pct)}%` : ''
  }`;

/**
 * The live preview: DOM and CSS, so slider changes land on the next frame.
 *
 * It renders the *same* resolved layout the exporter draws, multiplied by a
 * fit-to-container factor. Every number below comes from `resolveLayout` — the
 * preview never computes padding, radius or shadow itself.
 *
 * Changing the aspect ratio morphs the frame as one shape: its size and the
 * screenshot's rect ride identical `shape` springs, retargeted at the same
 * instant, so the screenshot stays centred throughout and a quick second
 * change continues from wherever the first one had got to. Size and position
 * are written as real pixels rather than a transform, so the screenshot is
 * resampled crisply on every frame instead of scaled as a bitmap.
 *
 * Nothing else animates. Padding, radius, a new image or a window resize land
 * instantly — as a shift of each spring's whole trajectory, so a morph that is
 * already running carries on around the new endpoint and the preview never
 * trails a slider being dragged.
 */
export function Preview({
  composition,
  image,
}: {
  composition: Composition;
  image: SourceImage;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setFrame({ width, height });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => resolveLayout(composition, image), [composition, image]);

  // Fit inside the frame, but never blow the image up past 1:1 — an upscaled
  // preview would misrepresent how sharp the export actually is.
  const scale = useMemo(() => {
    if (!frame.width || !frame.height) return 0;
    return Math.min(
      frame.width / layout.canvas.width,
      frame.height / layout.canvas.height,
      1,
    );
  }, [frame, layout]);

  // Latest layout for the painter, which runs outside React's render.
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const motion = useRef<Record<keyof Target, Spring> | null>(null);
  const placed = useRef(false);
  const lastAspect = useRef(composition.aspect);
  // React renders this text once and never again; the painter owns it after.
  const initialLabel = useRef(label(layout.canvas.width, layout.canvas.height, 0)).current;

  const paint = useRef((t: number) => {
    const m = motion.current;
    const box = boxRef.current;
    const img = imgRef.current;
    if (!m || !placed.current || !box || !img) return;
    // Settled springs report their exact target, so the rest state is
    // pixel-identical to the layout rather than a thousandth of a pixel off.
    const v = (s: Spring) => (s.done(t) ? s.target() : s.get(t));

    box.style.width = `${v(m.fw)}px`;
    box.style.height = `${v(m.fh)}px`;

    const iw = v(m.iw);
    img.style.left = `${v(m.ix)}px`;
    img.style.top = `${v(m.iy)}px`;
    img.style.width = `${iw}px`;
    img.style.height = `${v(m.ih)}px`;

    // Radius and shadow scale with whatever size the screenshot is at right now.
    const { radius, shadow, image: rect } = layoutRef.current;
    const k = iw / rect.width;
    img.style.borderRadius = `${radius * k}px`;
    img.style.boxShadow = `0 ${shadow.offsetY * k}px ${shadow.blur * k}px ${shadow.spread * k}px ${shadow.color}`;

    const text = labelRef.current?.firstChild;
    if (text) text.nodeValue = label(v(m.outW), v(m.outH), v(m.pct));
  }).current;

  useLayoutEffect(() => {
    const cfg = { fw: SPRING.shape, fh: SPRING.shape, ix: SPRING.shape, iy: SPRING.shape, iw: SPRING.shape, ih: SPRING.shape, outW: SPRING.roll, outH: SPRING.roll, pct: SPRING.roll };
    const m = Object.fromEntries(
      Object.entries(cfg).map(([key, c]) => [key, spring(0, c)]),
    ) as Record<keyof Target, Spring>;
    motion.current = m;
    const stop = onFrame(paint);
    return () => {
      stop();
      Object.values(m).forEach((s) => s.dispose());
      motion.current = null;
      placed.current = false;
    };
  }, [paint]);

  useLayoutEffect(() => {
    const m = motion.current;
    if (!m) return;
    if (scale <= 0) {
      placed.current = false;
      return;
    }

    const target: Target = {
      fw: layout.canvas.width * scale,
      fh: layout.canvas.height * scale,
      ix: layout.image.x * scale,
      iy: layout.image.y * scale,
      iw: layout.image.width * scale,
      ih: layout.image.height * scale,
      outW: layout.canvas.width,
      outH: layout.canvas.height,
      pct: scale * 100,
    };

    const ratioChanged = lastAspect.current !== composition.aspect;
    lastAspect.current = composition.aspect;

    for (const key of [...GEOMETRY, ...FIGURES]) {
      const s = m[key];
      if (!placed.current) s.jump(target[key]);
      // Only a new ratio animates. All six geometry springs retarget in the
      // same instant, from wherever they are and however fast they are moving.
      else if (ratioChanged) s.set(target[key]);
      // Everything else lands at once, without cancelling a morph in flight.
      else s.shift(target[key] - s.target());
    }
    placed.current = true;
    // Paint now, before the browser does, so no frame shows the old geometry.
    paint(performance.now() / 1000);
  }, [layout, scale, composition.aspect, paint]);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4">
      <div ref={frameRef} className="flex min-h-0 w-full flex-1 items-center justify-center">
        {scale > 0 && (
          <div
            ref={boxRef}
            className="relative shrink-0 overflow-hidden"
            style={backgroundToStyle(composition.background)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={image.objectUrl}
              alt={image.name}
              draggable={false}
              className="absolute max-w-none"
            />
          </div>
        )}
      </div>

      <p ref={labelRef} className="text-xs tabular-nums text-faint">
        {initialLabel}
      </p>
    </div>
  );
}
