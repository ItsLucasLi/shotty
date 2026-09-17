import {
  resolveLayout,
  scaleLayout,
  type Composition,
  type Layout,
  type SourceImage,
} from './composition';
import { backgroundToCanvasStyle } from './backgrounds';

/**
 * The export renderer.
 *
 * The composition is redrawn from the original image data onto a canvas — it is
 * never a screenshot of the DOM. Same `Composition` in, same pixels out, on any
 * machine and in any browser.
 */

export type ExportScale = 1 | 2;

/**
 * Browsers refuse to allocate unbounded canvases. These are the conservative
 * limits across current engines; past them, `toBlob` silently yields a blank
 * image, so we scale down to fit rather than hand back an empty PNG.
 */
const MAX_CANVAS_DIMENSION = 16384;
const MAX_CANVAS_AREA = 2.6e8;

export type ExportResult = {
  width: number;
  height: number;
  /** The factor actually used — below `requested` if the canvas hit a limit. */
  scale: number;
  requestedScale: ExportScale;
};

/** A rounded rectangle path, with a fallback for engines lacking roundRect. */
function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/** Largest factor at or below `scale` that the canvas limits will allow. */
function fitScaleToCanvasLimits(layout: Layout, scale: number): number {
  const { width, height } = layout.canvas;
  const byDimension = MAX_CANVAS_DIMENSION / Math.max(width, height);
  const byArea = Math.sqrt(MAX_CANVAS_AREA / (width * height));
  return Math.min(scale, byDimension, byArea);
}

/**
 * Draw the whole composition onto a canvas at `scale`.
 *
 * Geometry comes from the same `resolveLayout` the preview uses, multiplied by
 * the export factor. Nothing here re-derives padding, radius or shadow.
 */
export function renderComposition(
  composition: Composition,
  image: SourceImage,
  scale: ExportScale,
): { canvas: HTMLCanvasElement; result: ExportResult } {
  const base = resolveLayout(composition, image);
  const effectiveScale = fitScaleToCanvasLimits(base, scale);
  const layout = scaleLayout(base, effectiveScale);

  const width = Math.max(1, Math.round(layout.canvas.width));
  const height = Math.max(1, Math.round(layout.canvas.height));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D canvas context.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Background.
  ctx.fillStyle = backgroundToCanvasStyle(ctx, composition.background, width, height);
  ctx.fillRect(0, 0, width, height);

  const img = layout.image;

  // 2. Shadow.
  //
  // Canvas has no spread, so the caster is the image rect inflated by `spread`
  // with a matching concentric radius. The caster itself is drawn far off the
  // left edge and the shadow is offset back into place, so only the blur lands
  // on the canvas — filling it in place would leave a visible ring of caster
  // showing past the image.
  if (layout.shadow.blur > 0 || layout.shadow.spread > 0 || layout.shadow.offsetY > 0) {
    const casterShift = width + layout.shadow.blur + layout.shadow.spread + 100;
    ctx.save();
    ctx.shadowColor = layout.shadow.color;
    ctx.shadowBlur = layout.shadow.blur;
    ctx.shadowOffsetX = casterShift;
    ctx.shadowOffsetY = layout.shadow.offsetY;
    ctx.fillStyle = '#000';
    roundedRectPath(
      ctx,
      img.x - layout.shadow.spread - casterShift,
      img.y - layout.shadow.spread,
      img.width + layout.shadow.spread * 2,
      img.height + layout.shadow.spread * 2,
      layout.radius + layout.shadow.spread,
    );
    ctx.fill();
    ctx.restore();
  }

  // 3. The image, with corners clipped — a real clip path, not an overlay, so
  //    the rounded corners show the background rather than a painted-on colour.
  ctx.save();
  roundedRectPath(ctx, img.x, img.y, img.width, img.height, layout.radius);
  ctx.clip();
  ctx.drawImage(image.element, img.x, img.y, img.width, img.height);
  ctx.restore();

  return {
    canvas,
    result: { width, height, scale: effectiveScale, requestedScale: scale },
  };
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode the PNG.'));
    }, 'image/png');
  });
}

export function exportFileName(sourceName: string, scale: ExportScale): string {
  const base = sourceName.replace(/\.[^./\\]+$/, '').trim() || 'screenshot';
  const suffix = scale > 1 ? `@${scale}x` : '';
  return `${base}-shotty${suffix}.png`;
}

/** Render, encode and hand the PNG to the browser's downloader. */
export async function downloadPng(
  composition: Composition,
  image: SourceImage,
  scale: ExportScale,
): Promise<ExportResult> {
  const { canvas, result } = renderComposition(composition, image, scale);
  const blob = await toBlob(canvas);
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = exportFileName(image.name, scale);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Give the download a tick to start before the blob goes away.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  // Free the backing store immediately; a 2x export can be hundreds of MB.
  canvas.width = 0;
  canvas.height = 0;

  return result;
}
