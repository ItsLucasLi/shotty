'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveLayout, type Composition, type SourceImage } from '@/lib/composition';
import { backgroundToStyle } from '@/lib/backgrounds';

/**
 * The live preview: DOM and CSS, so slider changes land on the next frame.
 *
 * It renders the *same* resolved layout the exporter draws, multiplied by a
 * fit-to-container factor. Every number below comes from `resolveLayout` — the
 * preview never computes padding, radius or shadow itself.
 */
export function Preview({
  composition,
  image,
}: {
  composition: Composition;
  image: SourceImage;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
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

  const outputWidth = Math.round(layout.canvas.width);
  const outputHeight = Math.round(layout.canvas.height);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4">
      <div ref={frameRef} className="flex min-h-0 w-full flex-1 items-center justify-center">
        {scale > 0 && (
          <div
            className="relative overflow-hidden"
            style={{
              width: layout.canvas.width * scale,
              height: layout.canvas.height * scale,
              ...backgroundToStyle(composition.background),
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.objectUrl}
              alt={image.name}
              draggable={false}
              className="absolute"
              style={{
                left: layout.image.x * scale,
                top: layout.image.y * scale,
                width: layout.image.width * scale,
                height: layout.image.height * scale,
                borderRadius: layout.radius * scale,
                boxShadow: `0 ${layout.shadow.offsetY * scale}px ${
                  layout.shadow.blur * scale
                }px ${layout.shadow.spread * scale}px ${layout.shadow.color}`,
              }}
            />
          </div>
        )}
      </div>

      <p className="text-xs tabular-nums text-faint">
        {outputWidth} × {outputHeight}
        {scale > 0 && scale < 1 ? ` · preview at ${Math.round(scale * 100)}%` : ''}
      </p>
    </div>
  );
}
