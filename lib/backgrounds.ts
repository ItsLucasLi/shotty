import type { CSSProperties } from 'react';
import type { Background } from './composition';

/**
 * Backgrounds are declared once and translated on demand: to CSS for the DOM
 * preview, and to canvas painting for the export. Both readers consume the
 * same `Background` value, so a swatch cannot render one way on screen and
 * another way in the PNG.
 */

export type BackgroundPreset = {
  id: string;
  label: string;
  background: Background;
};

const gradient = (angle: number, from: string, to: string): Background => ({
  kind: 'gradient',
  angle,
  stops: [
    { color: from, offset: 0 },
    { color: to, offset: 1 },
  ],
});

export const BACKGROUND_PRESETS: readonly BackgroundPreset[] = [
  { id: 'white', label: 'White', background: { kind: 'solid', color: '#ffffff' } },
  { id: 'paper', label: 'Paper', background: { kind: 'solid', color: '#f4f4f2' } },
  { id: 'sand', label: 'Sand', background: { kind: 'solid', color: '#e6dfd4' } },
  { id: 'mist', label: 'Mist', background: { kind: 'solid', color: '#d6dde5' } },
  { id: 'ink', label: 'Ink', background: { kind: 'solid', color: '#16181d' } },
  { id: 'slate', label: 'Slate', background: { kind: 'solid', color: '#3f4754' } },
  { id: 'dawn', label: 'Dawn', background: gradient(145, '#e0e7ff', '#f5d0e0') },
  { id: 'dusk', label: 'Dusk', background: gradient(145, '#2b3a55', '#63527a') },
  { id: 'meadow', label: 'Meadow', background: gradient(145, '#d7ead8', '#bfd9e8') },
  { id: 'ember', label: 'Ember', background: gradient(145, '#f8d8c0', '#e8b4b8') },
  { id: 'graphite', label: 'Graphite', background: gradient(145, '#1c1e24', '#454b57') },
  { id: 'linen', label: 'Linen', background: gradient(145, '#fbf8f3', '#e4ded3') },
] as const;

/**
 * Where a 'cover' image lands inside the canvas.
 *
 * This is the arithmetic CSS performs for `background-size: cover` with
 * `background-position: center`: scale until both axes are filled, then centre
 * the overflow. The canvas has no equivalent shorthand, so the export calls
 * this to land on the same rectangle the preview gets for free.
 */
export function coverRect(
  image: { width: number; height: number },
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  return {
    x: (width - drawWidth) / 2,
    y: (height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  };
}

/** The CSS for the preview. A style object, since images need several properties. */
export function backgroundToStyle(background: Background): CSSProperties {
  switch (background.kind) {
    case 'solid':
      return { background: background.color };

    case 'gradient': {
      const stops = background.stops
        .map((stop) => `${stop.color} ${(stop.offset * 100).toFixed(2)}%`)
        .join(', ');
      return { background: `linear-gradient(${background.angle}deg, ${stops})` };
    }

    case 'image':
      return {
        backgroundImage: `url("${background.source.objectUrl}")`,
        backgroundSize: background.fit,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
  }
}

/**
 * Paint the background across the whole canvas, for the export.
 *
 * This fills the canvas itself rather than returning a paint style, because
 * an image background is drawn, not filled.
 *
 * CSS measures gradient angles clockwise from "towards the top", and runs the
 * gradient line through the centre of the box, long enough to cover its
 * corners. Canvas wants two endpoints, so we reconstruct that line here rather
 * than approximating it — otherwise a 145deg swatch would land at a visibly
 * different angle in the PNG than on screen.
 */
export function paintBackground(
  ctx: CanvasRenderingContext2D,
  background: Background,
  width: number,
  height: number,
): void {
  switch (background.kind) {
    case 'solid': {
      ctx.fillStyle = background.color;
      ctx.fillRect(0, 0, width, height);
      return;
    }

    case 'gradient': {
      const radians = (background.angle * Math.PI) / 180;
      // Canvas y grows downwards, so "towards the top" is -cos.
      const dirX = Math.sin(radians);
      const dirY = -Math.cos(radians);

      const lineLength = Math.abs(width * dirX) + Math.abs(height * dirY);
      const halfX = (dirX * lineLength) / 2;
      const halfY = (dirY * lineLength) / 2;

      const canvasGradient = ctx.createLinearGradient(
        width / 2 - halfX,
        height / 2 - halfY,
        width / 2 + halfX,
        height / 2 + halfY,
      );
      for (const stop of background.stops) {
        canvasGradient.addColorStop(Math.min(1, Math.max(0, stop.offset)), stop.color);
      }

      ctx.fillStyle = canvasGradient;
      ctx.fillRect(0, 0, width, height);
      return;
    }

    case 'image': {
      const rect = coverRect(background.source, width, height);
      // Anything outside the canvas is clipped by the canvas itself.
      ctx.drawImage(background.source.element, rect.x, rect.y, rect.width, rect.height);
      return;
    }
  }
}

/** True when two backgrounds are the same choice. */
export function isSameBackground(a: Background, b: Background): boolean {
  if (a.kind !== b.kind) return false;

  if (a.kind === 'solid' && b.kind === 'solid') {
    return a.color.toLowerCase() === b.color.toLowerCase();
  }

  if (a.kind === 'image' && b.kind === 'image') {
    return a.source.objectUrl === b.source.objectUrl && a.fit === b.fit;
  }

  if (a.kind === 'gradient' && b.kind === 'gradient') {
    return (
      a.angle === b.angle &&
      a.stops.length === b.stops.length &&
      a.stops.every(
        (stop, i) =>
          stop.color.toLowerCase() === b.stops[i].color.toLowerCase() &&
          stop.offset === b.stops[i].offset,
      )
    );
  }

  return false;
}
