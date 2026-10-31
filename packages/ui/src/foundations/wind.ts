// The wind in a photo (DEC-UX-153), drawn live on a canvas over it, as the flowing lights are: veils
// of mist drift over its sky, and fine snow and low veils of blown snow cross its ground in gusts.
// Nothing repeats: the wind rises and falls and its gusts come at random speeds of their own, from a
// random start, and every flake goes its own way.
//
// Kept light for the computer: 30 frames a second, at three quarters of the pixels of the window,
// paused while the tab is hidden (the browser pauses its frames). With reduced motion it is one still
// frame of mist, without snow.

import { breath, gusts } from './weather.js';

const FPS = 30;
const RESOLUTION = 0.75;
/** The longest step between two frames, so that the wind does not leap after a pause. */
const LONGEST = 0.1;

/** How fast each layer crosses the photo, in widths a second, in a calm wind. */
const SPEED = { mistFar: 1 / 150, mistNear: 1 / 95, drift: 1 / 28, flakes: 1 / 11 } as const;

/** The pictures of the wind: two veils of mist and the low veils of blown snow, each tiling sideways. */
export interface WindPictures {
  readonly mistFar: string;
  readonly mistNear: string;
  readonly drift: string;
}

/** Where the wind plays, as fractions of the height of the photo: mist down to `sky`, snow from `ground`. */
export interface WindView {
  readonly sky: number;
  readonly ground: number;
}

export interface Wind {
  /** Draws again at once, after reduced motion changed. */
  redraw(): void;
  stop(): void;
}

interface Flake {
  x: number;
  y: number;
  /** Near flakes are larger and faster than far ones: between 0.35 and 1. */
  depth: number;
  alpha: number;
  start: number;
  wobble: number;
}

/**
 * Starts drawing the wind on the canvas, which lies over the photo in its own measures; `view` says
 * where its sky ends and its ground begins, and `still` whether motion is reduced. Gives nothing when
 * the browser cannot draw on a canvas: the photo stays, still.
 */
export function startWind(
  canvas: HTMLCanvasElement,
  pictures: WindPictures,
  view: () => WindView,
  still: () => boolean,
  random: () => number = Math.random,
): Wind | undefined {
  const context = canvas.getContext('2d');
  if (!context) {
    return undefined;
  }
  const load = (source: string) => Object.assign(new Image(), { src: source, decoding: 'async' as const });
  const mistFar = load(pictures.mistFar);
  const mistNear = load(pictures.mistNear);
  const drift = load(pictures.drift);

  const calm = breath(random, 3, 1 / 90, 1 / 35);
  const glow = breath(random, 2, 1 / 70, 1 / 30);
  const gust = gusts(random);
  // Each layer starts somewhere else along the wind.
  const along = { mistFar: random(), mistNear: random(), drift: random() };

  let flakes: Flake[] = [];
  const band = () => {
    const { ground } = view();
    const top = (ground - 0.08) * canvas.height;
    return { top, height: canvas.height - top };
  };
  const flake = (x: number): Flake => {
    const { top, height } = band();
    return { x, y: top + random() * height, depth: 0.35 + random() * 0.65, alpha: 0.5 + random() * 0.5, start: random() * Math.PI * 2, wobble: 0.3 + random() * 0.6 };
  };
  const scatter = () => {
    const count = Math.round(canvas.width / 3);
    flakes = Array.from({ length: count }, () => flake(random() * canvas.width));
  };

  const ready = (image: HTMLImageElement) => image.complete && image.naturalWidth > 0;
  /** A picture that tiles sideways, across the whole width, at its place along the wind. */
  const veil = (image: HTMLImageElement, at: number, top: number, height: number, alpha: number) => {
    if (!ready(image) || alpha <= 0) {
      return;
    }
    const width = canvas.width;
    const x = (at % 1) * width;
    context.globalAlpha = alpha;
    context.drawImage(image, x, top, width, height);
    context.drawImage(image, x - width, top, width, height);
  };

  let seconds = 0;
  const draw = (step: number) => {
    const { width, height } = canvas;
    const { sky } = view();
    const moving = !still();
    const wind = 1 + 0.3 * calm(seconds);
    const now = moving ? gust(seconds) : 0;
    if (moving) {
      along.mistFar += SPEED.mistFar * wind * step;
      along.mistNear += SPEED.mistNear * wind * step;
      along.drift += SPEED.drift * (wind + 1.5 * now) * step;
    }
    context.clearRect(0, 0, width, height);
    // The mist over the sky, softly brighter and thinner as it goes.
    const skyHeight = (sky + 0.06) * height;
    veil(mistFar, along.mistFar, skyHeight * 0.06, skyHeight * 0.7, 0.5 * (0.85 + 0.15 * glow(seconds)));
    veil(mistNear, along.mistNear, skyHeight * 0.38, skyHeight * 0.58, 0.42 * (0.85 - 0.15 * glow(seconds)));
    if (!moving) {
      context.globalAlpha = 1;
      return;
    }
    // The snow over the ground: low veils and fine flakes, more of them in a gust.
    const { top, height: low } = band();
    veil(drift, along.drift, top + low * 0.25, low * 0.75, 0.12 + 0.56 * now);
    const ratio = width / Math.max(1, canvas.clientWidth);
    const pace = SPEED.flakes * width * (wind + 1.6 * now) * step;
    context.fillStyle = 'white';
    for (const one of flakes) {
      one.x += pace * one.depth;
      if (one.x > width + 4) {
        Object.assign(one, flake(-4 - random() * 40));
      }
      // Each flake sways on its own; a gust lifts it a little.
      const y = one.y + (Math.sin(one.start + seconds * one.wobble * Math.PI * 2) * 10 - now * 16) * one.depth * ratio;
      const fade = Math.min(1, (y - top) / (low * 0.12));
      const alpha = one.alpha * fade * (0.4 + 0.6 * now);
      if (alpha <= 0.01) {
        continue;
      }
      context.globalAlpha = alpha;
      context.beginPath();
      context.arc(one.x, y, (0.8 + 1.5 * one.depth) * ratio, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  };

  const resize = () => {
    const ratio = Math.min(devicePixelRatio || 1, 2) * RESOLUTION;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    scatter();
    draw(0);
  };
  addEventListener('resize', resize);
  resize();
  // The pictures come after the first frame: a still frame draws again once they are there.
  for (const image of [mistFar, mistNear, drift]) {
    image.addEventListener('load', () => still() && draw(0), { once: true });
  }

  let running = true;
  let last = -Infinity;
  let request = 0;
  const frame = (t: number) => {
    if (!running || still()) {
      return;
    }
    request = requestAnimationFrame(frame);
    if (t - last < 1000 / FPS) {
      return;
    }
    const step = last === -Infinity ? 0 : Math.min(LONGEST, (t - last) / 1000);
    last = t;
    seconds += step;
    draw(step);
  };
  request = requestAnimationFrame(frame);

  return {
    redraw() {
      draw(0);
      if (running && !still()) {
        cancelAnimationFrame(request);
        last = -Infinity;
        request = requestAnimationFrame(frame);
      }
    },
    stop() {
      running = false;
      cancelAnimationFrame(request);
      removeEventListener('resize', resize);
    },
  };
}
