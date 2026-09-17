/**
 * The shared composition model.
 *
 * Everything the preview and the exporter need to agree on lives here. Geometry
 * is expressed in *composition units*, where 1 unit = 1 pixel of the source
 * image. The DOM preview multiplies those units by a fit-to-container factor;
 * the canvas exporter multiplies them by the chosen export factor. Neither one
 * does any geometry of its own, so the two cannot drift apart.
 */

export type GradientStop = {
  color: string;
  /** 0–1 position along the gradient line. */
  offset: number;
};

export type Background =
  | { kind: 'solid'; color: string }
  /** `angle` follows the CSS convention: degrees clockwise, 0 = towards the top. */
  | { kind: 'gradient'; angle: number; stops: GradientStop[] };

export type Aspect = 'auto' | '1:1' | '16:9' | '4:3';

/**
 * The single parameter object. Serializable, DOM-free, and resolution
 * independent: the sliders hold normalized 0–1 values, so the same settings
 * look the same on a 900px screenshot and a 3000px one.
 */
export type Composition = {
  background: Background;
  /** 0–1. Padding around the image, as a fraction of its long edge. */
  padding: number;
  /** 0–1. Corner radius, as a fraction of the image's short edge. */
  radius: number;
  /** 0–1. One knob: drives shadow blur, spread, offset and opacity together. */
  shadow: number;
  aspect: Aspect;
};

/** A decoded image, ready for both an <img> tag and ctx.drawImage(). */
export type SourceImage = {
  element: HTMLImageElement;
  objectUrl: string;
  width: number;
  height: number;
  name: string;
};

export type Rect = { x: number; y: number; width: number; height: number };

export type ShadowGeometry = {
  blur: number;
  spread: number;
  offsetY: number;
  color: string;
};

/** Resolved geometry, in composition units. The only thing renderers consume. */
export type Layout = {
  canvas: { width: number; height: number };
  image: Rect;
  radius: number;
  shadow: ShadowGeometry;
};

export const ASPECTS: readonly Aspect[] = ['auto', '1:1', '16:9', '4:3'] as const;

export const ASPECT_LABELS: Record<Aspect, string> = {
  auto: 'Auto',
  '1:1': '1:1',
  '16:9': '16:9',
  '4:3': '4:3',
};

const ASPECT_RATIOS: Record<Exclude<Aspect, 'auto'>, number> = {
  '1:1': 1,
  '16:9': 16 / 9,
  '4:3': 4 / 3,
};

/** Slider ceilings, as fractions of the image edge they scale against. */
const MAX_PADDING_FRACTION = 0.4;
const MAX_RADIUS_FRACTION = 0.15;
const MAX_SHADOW_BLUR_FRACTION = 0.14;
const MAX_SHADOW_SPREAD_FRACTION = 0.02;
const MAX_SHADOW_OFFSET_FRACTION = 0.05;
const MAX_SHADOW_ALPHA = 0.38;

/** Slate-900, the one neutral the whole UI is tuned against. */
const SHADOW_RGB = '15, 23, 42';

export const DEFAULT_COMPOSITION: Composition = {
  background: { kind: 'gradient', angle: 145, stops: [
    { color: '#e0e7ff', offset: 0 },
    { color: '#f5d0e0', offset: 1 },
  ] },
  padding: 0.34,
  radius: 0.16,
  shadow: 0.45,
  aspect: 'auto',
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Turn normalized parameters into concrete geometry.
 *
 * This is the only place composition maths happens. Pure, so it can be called
 * on every render of the preview and again at export time without any risk of
 * the two disagreeing.
 */
export function resolveLayout(
  composition: Composition,
  image: { width: number; height: number },
): Layout {
  const longEdge = Math.max(image.width, image.height);
  const shortEdge = Math.min(image.width, image.height);

  // Whole units, so that at 1x the image lands on exact pixel boundaries and
  // drawImage copies it rather than resampling it.
  const padding = Math.round(clamp01(composition.padding) * MAX_PADDING_FRACTION * longEdge);

  // Never let the radius round past a half-edge, whatever the slider says.
  const radius = Math.min(
    clamp01(composition.radius) * MAX_RADIUS_FRACTION * shortEdge,
    shortEdge / 2,
  );

  const shadowAmount = clamp01(composition.shadow);
  const shadow: ShadowGeometry = {
    blur: shadowAmount * MAX_SHADOW_BLUR_FRACTION * shortEdge,
    spread: shadowAmount * MAX_SHADOW_SPREAD_FRACTION * shortEdge,
    offsetY: shadowAmount * MAX_SHADOW_OFFSET_FRACTION * shortEdge,
    color: `rgba(${SHADOW_RGB}, ${(shadowAmount * MAX_SHADOW_ALPHA).toFixed(3)})`,
  };

  // The image plus its padding. In Auto this *is* the canvas.
  const contentWidth = image.width + padding * 2;
  const contentHeight = image.height + padding * 2;

  let canvasWidth = contentWidth;
  let canvasHeight = contentHeight;

  if (composition.aspect !== 'auto') {
    // Smallest box of the requested ratio that still contains the padded image.
    const ratio = ASPECT_RATIOS[composition.aspect];
    canvasWidth = Math.round(Math.max(contentWidth, contentHeight * ratio));
    canvasHeight = Math.round(canvasWidth / ratio);
  }

  return {
    // Integer units throughout, so multiplying by the export factor lands on
    // whole pixels: a 2x export is exactly twice a 1x export, never a pixel off.
    canvas: { width: canvasWidth, height: canvasHeight },
    image: {
      x: Math.round((canvasWidth - image.width) / 2),
      y: Math.round((canvasHeight - image.height) / 2),
      width: image.width,
      height: image.height,
    },
    radius,
    shadow,
  };
}

/** Multiply a resolved layout by a scale factor, staying in the same shape. */
export function scaleLayout(layout: Layout, scale: number): Layout {
  return {
    canvas: {
      width: layout.canvas.width * scale,
      height: layout.canvas.height * scale,
    },
    image: {
      x: layout.image.x * scale,
      y: layout.image.y * scale,
      width: layout.image.width * scale,
      height: layout.image.height * scale,
    },
    radius: layout.radius * scale,
    shadow: {
      blur: layout.shadow.blur * scale,
      spread: layout.shadow.spread * scale,
      offsetY: layout.shadow.offsetY * scale,
      color: layout.shadow.color,
    },
  };
}
