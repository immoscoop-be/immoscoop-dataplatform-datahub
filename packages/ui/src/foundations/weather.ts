// The weather of a background with wind (DEC-UX-153): how hard the wind blows and when its gusts
// come, at random speeds of their own from a random start, so that nothing repeats. Plain numbers,
// for the canvas of wind.ts to draw with.

/**
 * A breath of wind: slow waves added up, each at a random speed between `slowest` and `fastest`
 * turns a second and from a random start, so that it never comes back to where it was. Between -1 and 1.
 */
export function breath(random: () => number, waves: number, slowest: number, fastest: number): (seconds: number) => number {
  const speeds = Array.from({ length: waves }, () => slowest + random() * (fastest - slowest));
  const starts = Array.from({ length: waves }, () => random() * Math.PI * 2);
  return (seconds) => speeds.reduce((sum, speed, i) => sum + Math.sin(starts[i]! + seconds * speed * Math.PI * 2), 0) / waves;
}

/** The gusts: mostly calm, now and then the wind picks up, between 0 and 1. */
export function gusts(random: () => number): (seconds: number) => number {
  const wave = breath(random, 3, 1 / 19, 1 / 6);
  return (seconds) => Math.max(0, (wave(seconds) - 0.2) / 0.8) ** 1.5;
}
