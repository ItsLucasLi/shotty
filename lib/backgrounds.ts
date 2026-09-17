import type { Background } from './composition';

/**
 * Backgrounds are declared once and translated on demand: to a CSS string for
 * the DOM preview, and to a canvas paint style for the export. Both readers
 * consume the same `Background` value, so a swatch cannot render one way on
 * screen and another way in the PNG.
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

/** The CSS `background` value for the preview. */
export function backgroundToCss(background: Background): string {
  if (background.kind === 'solid') return background.color;

  const stops = background.stops
    .map((stop) => `${stop.color} ${(stop.offset * 100).toFixed(2)}%`)
    .join(', ');

  return `linear-gradient(${background.angle}deg, ${stops})`;
}

/**
 * The canvas paint style for the export.
 *
 * CSS measures gradient angles clockwise from "towards the top", and runs the
 * gradient line through the centre of the box, long enough to cover its
 * corners. Canvas wants two endpoints, so we reconstruct that line here rather
 * than approximating it — otherwise a 145deg swatch would land at a visibly
 * different angle in the PNG than on screen.
 */
export function backgroundToCanvasStyle(
  ctx: CanvasRenderingContext2D,
  background: Background,
  width: number,
  height: number,
): string | CanvasGradient {
  if (background.kind === 'solid') return background.color;

  const radians = (background.angle * Math.PI) / 180;
  // Canvas y grows downwards, so "towards the top" is -cos.
  const dirX = Math.sin(radians);
  const dirY = -Math.cos(radians);

  const lineLength = Math.abs(width * dirX) + Math.abs(height * dirY);
  const centreX = width / 2;
  const centreY = height / 2;
  const halfX = (dirX * lineLength) / 2;
  const halfY = (dirY * lineLength) / 2;

  const canvasGradient = ctx.createLinearGradient(
    centreX - halfX,
    centreY - halfY,
    centreX + halfX,
    centreY + halfY,
  );

  for (const stop of background.stops) {
    canvasGradient.addColorStop(Math.min(1, Math.max(0, stop.offset)), stop.color);
  }

  return canvasGradient;
}

/** True when a preset is the composition's current background. */
export function isSameBackground(a: Background, b: Background): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'solid' && b.kind === 'solid') {
    return a.color.toLowerCase() === b.color.toLowerCase();
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
