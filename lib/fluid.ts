/**
 * Closed-form, retargetable springs and the motion primitives built on them.
 *
 * A TypeScript port of the fluid-mono-ui motion core. Every spring is an exact
 * solution from its last (position, velocity) snapshot rather than a numeric
 * integration, so retargeting mid-flight continues from precisely where the
 * value is and how fast it is moving — no jumps, no drift.
 *
 * One requestAnimationFrame loop drives the whole page and stops once every
 * spring has settled, so an idle page costs nothing.
 *
 * Three changes from the reference: springs and frame callbacks can be
 * disposed, because React mounts and unmounts these controls (the reference
 * registry only grows); layers can start visible without animating in; and a
 * layer's exit holds the frame loop open, which the reference does not — see
 * layer().hide().
 */

/** [response in seconds, damping ratio]. Overshoot stays at or under ~2 %. */
export type SpringConfig = readonly [response: number, damping: number];

export const SPRING = {
  shape: [0.46, 0.82],
  lead: [0.26, 0.86],
  trail: [0.52, 0.92],
  press: [0.15, 1],
  enter: [0.3, 1],
  color: [0.2, 1],
  page: [0.8, 1],
  snap: [0.42, 0.78],
  draw: [1.0, 1],
  roll: [0.9, 1],
} as const satisfies Record<string, SpringConfig>;

/** The check mark draws itself on a critically damped 0.34 s spring. */
export const CHECK_SPRING: SpringConfig = [0.34, 1];

const now = () => (typeof performance === 'undefined' ? 0 : performance.now() / 1000);

export const REDUCED_MOTION =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export type Spring = {
  get(t?: number): number;
  velocity(t?: number): number;
  target(): number;
  /** Retarget from the exact current position and velocity. */
  set(target: number, options?: { velocity?: number; cfg?: SpringConfig }): Spring;
  /** Place the value with no animation — used while a pointer is dragging. */
  jump(value: number): Spring;
  /**
   * Translate the whole trajectory — position and target — by delta. Any
   * motion in flight carries on unchanged, just relative to the new endpoint.
   * For a change that should land instantly without cancelling an animation
   * already running on the same value.
   */
  shift(delta: number): Spring;
  done(t?: number, eps?: number): boolean;
  dispose(): void;
};

const springs = new Set<Spring>();
const renderers = new Set<(t: number) => void>();
let running = false;
let holds = 0;

function wake() {
  if (!running && typeof requestAnimationFrame !== 'undefined') {
    running = true;
    requestAnimationFrame(frame);
  }
}

function frame() {
  const t = now();
  renderers.forEach((render) => render(t));
  let busy = false;
  for (const s of springs) {
    if (!s.done(t)) {
      busy = true;
      break;
    }
  }
  if (busy || holds > 0) requestAnimationFrame(frame);
  else running = false;
}

export function spring(value: number, cfg: SpringConfig = SPRING.shape): Spring {
  let w = 0;
  let wd = 0;
  let z = 1;
  const configure = ([response, zeta]: SpringConfig) => {
    const r = REDUCED_MOTION ? Math.min(response, 0.08) : response;
    z = zeta;
    w = (2 * Math.PI) / r;
    wd = z < 1 ? w * Math.sqrt(1 - z * z) : 0;
  };
  configure(cfg);

  let x0 = value;
  let v0 = 0;
  let to = value;
  let t0 = now();

  /** Exact state at time t, as [position, velocity]. */
  const at = (t: number): [number, number] => {
    const T = Math.max(0, t - t0);
    const A = x0 - to;
    if (z < 1) {
      const e = Math.exp(-z * w * T);
      const B = (v0 + z * w * A) / wd;
      const c = Math.cos(wd * T);
      const s = Math.sin(wd * T);
      return [
        to + e * (A * c + B * s),
        e * ((B * wd - z * w * A) * c - (A * wd + z * w * B) * s),
      ];
    }
    const e = Math.exp(-w * T);
    const B = v0 + w * A;
    return [to + e * (A + B * T), e * (B - w * (A + B * T))];
  };

  const s: Spring = {
    get: (t = now()) => at(t)[0],
    velocity: (t = now()) => at(t)[1],
    target: () => to,
    set(target, { velocity, cfg: next } = {}) {
      const t = now();
      const [x, v] = at(t);
      x0 = x;
      v0 = velocity ?? v;
      to = target;
      t0 = t;
      if (next) configure(next);
      wake();
      return s;
    },
    jump(v) {
      x0 = to = v;
      v0 = 0;
      t0 = now();
      wake();
      return s;
    },
    shift(delta) {
      // The displacement x0 − to, and so the whole closed-form path, is untouched.
      x0 += delta;
      to += delta;
      wake();
      return s;
    },
    done(t = now(), eps = 1e-3) {
      const [x, v] = at(t);
      return Math.abs(x - to) < eps && Math.abs(v) < eps * 10;
    },
    dispose() {
      springs.delete(s);
    },
  };

  springs.add(s);
  return s;
}

/** Run a callback on every frame while anything is moving. Returns an unsubscribe. */
export function onFrame(render: (t: number) => void): () => void {
  renderers.add(render);
  wake();
  return () => {
    renderers.delete(render);
  };
}

/** Keep the loop ticking — during a drag the springs are still, but the pointer is not. */
export function hold(): () => void {
  holds++;
  wake();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
  };
}

export type Layer = { show(): void; hide(): void; dispose(): void };

/**
 * Content that swaps through a short blur, with its own enter and exit timing.
 *
 * Exit runs from −30 ms to +100 ms (opacity to 0, blur to 15 px, scale to
 * 0.95); entry starts at +90 ms on the `enter` spring. The two never overlap,
 * so text never double-exposes. A hidden layer is visibility:hidden, so
 * assistive technology skips it.
 */
export function layer(el: HTMLElement, { visible = false } = {}): Layer {
  let tin = -1e9;
  let tout = 1e9;
  const smooth = (x: number) => {
    const c = Math.min(1, Math.max(0, x));
    return c * c * (3 - 2 * c);
  };
  const enter = spring(visible ? 1 : 0, SPRING.enter);
  let pending: ReturnType<typeof setTimeout> | undefined;
  let exiting: ReturnType<typeof setTimeout> | undefined;
  let releaseExit: (() => void) | undefined;

  const stop = onFrame((t) => {
    const e = t < tin + 0.09 ? 0 : enter.get(t);
    const x = smooth((t - (tout - 0.03)) / 0.13);
    const o = e * (1 - x);
    if (o < 0.004) {
      el.style.visibility = 'hidden';
      return;
    }
    el.style.visibility = 'visible';
    el.style.opacity = String(o);
    const blur = REDUCED_MOTION ? 0 : 15 * (1 - e) + 15 * x;
    // Below ~0.06 px a blur is invisible but still rasterises the text soft.
    el.style.filter = blur > 0.06 ? `blur(${blur}px)` : 'none';
    el.style.transform = REDUCED_MOTION ? 'none' : `scale(${(0.94 + 0.06 * e) * (1 - 0.05 * x)})`;
  });

  return {
    show() {
      clearTimeout(pending);
      tin = now();
      tout = 1e9;
      enter.jump(0);
      pending = setTimeout(() => enter.set(1), 90);
    },
    hide() {
      clearTimeout(pending);
      tout = now() + 0.03;
      // The exit is timed, not sprung, so no spring keeps the loop awake for
      // it. Without this hold the loop sleeps after one frame and the content
      // freezes, then cuts, whenever nothing else happens to be moving — e.g.
      // a content swap inside a container that does not change size.
      clearTimeout(exiting);
      releaseExit?.();
      releaseExit = hold();
      exiting = setTimeout(() => releaseExit?.(), 160);
    },
    dispose() {
      clearTimeout(pending);
      clearTimeout(exiting);
      releaseExit?.();
      stop();
      enter.dispose();
    },
  };
}

/**
 * Rubber-band past the ends: resistance that grows with distance and never
 * quite reaches R, so the control gives but cannot be pulled away.
 */
export const rubber = (over: number, R = 70) =>
  R * (1 - 1 / (1 + Math.abs(over) / R)) * Math.sign(over);
