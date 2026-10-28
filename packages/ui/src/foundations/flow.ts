// The flowing gradient and the flowing lights (DEC-UX-80, DEC-UX-109), drawn live with WebGL on a
// canvas fixed behind the app, as the prototype draws them. By day sky blue, a warm orange band and
// cream; by night a dark sky with a band of teal, violet and magenta and a warm coral glow. Their
// colours live in their shaders, as the colours of a picture live in the picture.
//
// Kept light for the computer: half resolution, 30 frames a second, paused while the tab is hidden
// (the browser pauses its frames). With reduced motion it is one still frame, and the mouse does
// nothing. No loop: every movement turns at a random speed of its own from a random start.

import type { Theme } from './backgrounds.js';

const PERIOD = 15;
const RESOLUTION = 0.5;
const FPS = 30;

const VERTEX = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const DAY = `
  precision highp float;
  uniform vec4 uA;         // four angles, each turning at a random speed from a random start, so it never repeats
  uniform vec2 uRes;
  uniform vec2 uPointer;   // the eased pointer, 0 to 1 from the bottom left
  uniform float uPull;     // how present the pointer is, 0 to 1
  varying vec2 vUv;
  vec3 rgb(float r, float g, float b) { return vec3(r, g, b) / 255.0; }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec2 uv = vUv;
    vec2 p = uv;
    p.x += 0.090 * sin(uv.y * 3.1 + uA.x) + 0.036 * sin(uv.y * 5.3 - uA.y);
    p.y += 0.066 * sin(uv.x * 2.7 - uA.z) + 0.030 * cos(uv.x * 6.1 + uA.w);
    p -= 0.035 * (uPointer - 0.5) * uPull;
    float c = 0.30 + 0.56 * smoothstep(0.02, 1.05, p.x) + 0.10 * sin(p.x * 3.0 + uA.x) + 0.06 * sin(uA.y);
    c += 0.14 * (uPointer.y - c) * exp(-pow((p.x - uPointer.x) / 0.30, 2.0)) * uPull;
    float d = p.y - c;
    vec3 base = mix(rgb(243.0, 226.0, 212.0), rgb(238.0, 196.0, 164.0), smoothstep(0.0, 0.6, p.y + 0.18 * p.x));
    float tl = clamp((1.0 - p.x) * 0.9 + p.y * 0.7 - 0.45, 0.0, 1.0);
    vec3 sky = mix(rgb(188.0, 204.0, 226.0), rgb(108.0, 165.0, 234.0), tl);
    vec3 col = mix(base, sky, smoothstep(0.0, 0.36, d));
    float w = 0.085 + 0.085 * p.x + 0.04 * sin(uA.w + 1.3);
    float band = exp(-(d * d) / (w * w));
    vec3 orange = mix(rgb(240.0, 166.0, 112.0), rgb(232.0, 132.0, 60.0), smoothstep(0.15, 0.85, p.x + 0.25 * band));
    col = mix(col, orange, band * (0.72 + 0.24 * p.x));
    col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(col, 1.0);
  }`;

const NIGHT = `
  precision highp float;
  uniform vec4 uA;
  uniform vec2 uRes;
  uniform vec2 uPointer;
  uniform float uPull;
  varying vec2 vUv;
  vec3 rgb(float r, float g, float b) { return vec3(r, g, b) / 255.0; }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 screen(vec3 base, vec3 light, float amount) { return 1.0 - (1.0 - base) * (1.0 - light * amount); }
  void main() {
    vec2 uv = vUv;
    vec2 p = uv;
    p.x += 0.090 * sin(uv.y * 3.1 + uA.x) + 0.036 * sin(uv.y * 5.3 - uA.y);
    p.y += 0.066 * sin(uv.x * 2.7 - uA.z) + 0.030 * cos(uv.x * 6.1 + uA.w);
    p -= 0.035 * (uPointer - 0.5) * uPull;
    float c = 0.40 + 0.42 * smoothstep(0.0, 1.05, p.x) + 0.10 * sin(p.x * 3.0 + uA.x) + 0.06 * sin(uA.y);
    c += 0.14 * (uPointer.y - c) * exp(-pow((p.x - uPointer.x) / 0.30, 2.0)) * uPull;
    float d = p.y - c;
    vec3 col = mix(rgb(5.0, 5.0, 9.0), rgb(16.0, 22.0, 44.0), smoothstep(0.32, 0.0, d) * (0.4 + 0.6 * p.x));
    col = mix(col, rgb(52.0, 16.0, 64.0), smoothstep(0.0, -0.35, d));
    float lift = 0.04 * sin(uA.w + 1.3);
    float teal = exp(-pow((d - 0.01 - lift) / (0.10 + 0.05 * p.x), 2.0)) * (0.28 + 0.52 * p.x);
    float violet = exp(-pow((d + 0.15) / 0.13, 2.0)) * (0.55 + 0.35 * (1.0 - abs(p.x - 0.45)));
    float magenta = exp(-pow((d + 0.36) / 0.15, 2.0)) * (0.55 + 0.4 * smoothstep(0.9, 0.3, p.x)) * smoothstep(-0.1, 0.35, p.x);
    col = screen(col, rgb(46.0, 122.0, 178.0), teal);
    col = screen(col, rgb(100.0, 82.0, 168.0), violet * 0.8);
    col = screen(col, rgb(150.0, 34.0, 118.0), magenta * 0.9);
    vec2 q = (p - vec2(-0.06, -0.02)) / vec2(0.34 + 0.06 * sin(uA.z), 0.44);
    col = mix(col, rgb(206.0, 124.0, 92.0), exp(-dot(q, q)) * 0.82);
    col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(col, 1.0);
  }`;

// Soft spots and arcs of colour: by night their light adds up on black, with a soft curve that keeps
// it from clipping; by day each is painted over a pale ground, as watercolour is.
const LIGHTS = `
  precision highp float;
  uniform vec2 uRes;
  uniform vec3 uBase;
  uniform float uPaint;    // 0: light on black, by night; 1: paint on a pale ground, by day
  uniform vec4 uL[7];      // per light: x and y (0 to 1, from the bottom left), its softness, and the radius of its arc (0: a spot)
  uniform vec4 uC[7];      // per light: its colour, and its strength
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    float asp = uRes.x / uRes.y;
    vec2 p = vec2(vUv.x * asp, vUv.y);
    vec3 light = uBase, paint = uBase;
    for (int i = 0; i < 7; i++) {
      float dist = length(p - vec2(uL[i].x * asp, uL[i].y));
      float d = uL[i].w > 0.0 ? dist - uL[i].w : dist;
      float w = exp(-(d * d) / (uL[i].z * uL[i].z)) * uC[i].w;
      light += uC[i].rgb * w;
      paint = mix(paint, uC[i].rgb, clamp(w, 0.0, 1.0));
    }
    vec3 col = mix(1.0 - exp(-light), paint, uPaint);
    col += (hash(gl_FragCoord.xy) - 0.5) / 128.0;
    gl_FragColor = vec4(col, 1.0);
  }`;

/** A light: x, y, softness, arc, r, g, b, strength. */
type Light = readonly [number, number, number, number, number, number, number, number];

interface Scene {
  readonly paint: 0 | 1;
  readonly base: readonly [number, number, number];
  readonly lights: readonly Light[];
}

const NONE: Light = [0, 0, 0.1, 0, 0, 0, 0, 0];

// The scenes, after the pictures Max chose on 2026-10-28.
export const SCENES: Readonly<Record<string, Scene>> = {
  aurora: { paint: 0, base: [0.0, 0.0, 0.01], lights: [
    [1.15, 1.05, 0.07, 0.90, 0.04, 0.08, 1.00, 2.6], [0.95, 0.40, 0.32, 0, 1.00, 0.41, 0.86, 2.2], [1.05, 0.30, 0.18, 0, 1.00, 0.88, 1.00, 1.6],
    [0.95, 0.80, 0.22, 0, 1.00, 0.15, 0.21, 2.4], [0.90, 1.05, 0.18, 0, 1.00, 0.17, 0.00, 0.9], [0.62, 0.55, 0.28, 0, 0.50, 0.25, 1.00, 1.0], NONE] },
  ember: { paint: 0, base: [0.0, 0.0, 0.0], lights: [
    [0.15, 1.02, 0.16, 0, 0.00, 0.82, 1.00, 1.1], [0.42, 1.00, 0.14, 0, 1.00, 0.11, 0.50, 1.4], [0.62, 1.02, 0.17, 0, 1.00, 0.08, 0.03, 1.8],
    [0.20, -0.02, 0.24, 0, 1.00, 0.38, 0.00, 2.4], [0.50, 0.00, 0.20, 0, 1.00, 0.05, 0.18, 1.9], [0.82, 0.05, 0.22, 0, 0.00, 0.44, 1.00, 1.6], [0.70, 0.30, 0.15, 0, 0.20, 0.28, 1.00, 0.25]] },
  dusk: { paint: 0, base: [0.0, 0.0, 0.0], lights: [
    [0.08, 0.38, 0.24, 0, 1.00, 0.65, 0.00, 2.6], [0.28, 0.33, 0.20, 0, 1.00, 0.32, 0.02, 2.2], [0.50, 0.45, 0.18, 0, 1.00, 0.39, 0.56, 1.8],
    [0.66, 0.55, 0.20, 0, 0.93, 0.18, 1.00, 1.4], [0.60, 0.75, 0.20, 0, 0.32, 0.07, 1.00, 1.1], [0.85, 0.32, 0.20, 0, 1.00, 0.06, 0.16, 1.6], [0.00, 0.60, 0.15, 0, 1.00, 0.17, 0.00, 0.6]] },
  horizon: { paint: 0, base: [0.0, 0.13, 0.22], lights: [
    [0.85, 1.00, 0.38, 0, 1.00, 1.00, 1.00, 3.0], [0.30, 1.00, 0.30, 0, 0.21, 0.86, 1.00, 1.4], [0.90, 1.15, 0.10, 0.62, 1.00, 0.50, 0.20, 2.0],
    [0.12, 0.12, 0.32, 0, 1.00, 0.21, 0.02, 2.8], [0.48, 0.05, 0.24, 0, 1.00, 0.50, 0.09, 2.2], [0.95, 0.00, 0.20, 0, 1.00, 0.50, 0.30, 0.5], NONE] },
  periwinkle: { paint: 1, base: [0.69, 0.79, 1.00], lights: [
    [0.38, 0.82, 0.16, 0, 1.00, 1.00, 1.00, 0.95], [0.50, 0.70, 0.12, 0, 0.36, 0.55, 0.98, 0.80], [0.36, 0.40, 0.18, 0, 1.00, 1.00, 1.00, 0.90],
    [0.56, 0.32, 0.20, 0, 0.30, 0.50, 0.97, 0.85], [0.30, 0.68, 0.14, 0, 0.55, 0.70, 0.99, 0.5], [0.70, 0.55, 0.18, 0, 0.82, 0.88, 1.00, 0.5], NONE] },
  sunrise: { paint: 1, base: [1.00, 0.98, 0.90], lights: [
    [0.00, 0.40, 0.22, 0, 1.00, 0.42, 0.22, 1.0], [0.20, 0.45, 0.24, 0, 1.00, 0.62, 0.20, 0.9], [0.42, 0.52, 0.26, 0, 1.00, 0.82, 0.38, 0.9],
    [0.95, 0.05, 0.28, 0, 0.82, 0.97, 1.00, 0.9], [0.05, 0.15, 0.16, 0, 1.00, 0.70, 0.62, 0.6], [0.75, 0.80, 0.30, 0, 1.00, 0.95, 0.78, 0.6], NONE] },
  apricot: { paint: 1, base: [1.00, 0.80, 0.45], lights: [
    [0.85, 0.95, 0.30, 0, 1.00, 0.55, 0.15, 0.9], [0.00, 0.55, 0.20, 0, 1.00, 0.55, 0.30, 0.8], [0.55, 0.40, 0.08, 0.30, 1.00, 0.98, 0.78, 0.95],
    [0.60, 0.35, 0.22, 0, 0.98, 0.98, 0.72, 0.8], [0.95, 0.10, 0.24, 0, 1.00, 0.88, 0.25, 0.8], [0.20, 0.90, 0.20, 0, 1.00, 0.85, 0.55, 0.6], NONE] },
  blush: { paint: 1, base: [1.00, 0.86, 0.86], lights: [
    [0.92, 0.95, 0.12, 0, 1.00, 0.47, 0.36, 0.95], [0.85, 0.35, 0.24, 0, 1.00, 0.40, 0.55, 0.95], [0.50, 0.60, 0.22, 0, 1.00, 0.52, 0.56, 0.75],
    [0.15, 0.25, 0.22, 0, 1.00, 0.70, 0.55, 0.85], [0.05, 0.80, 0.20, 0, 1.00, 0.88, 0.88, 0.7], [0.60, 0.05, 0.20, 0, 1.00, 0.70, 0.78, 0.6], NONE] },
  sky: { paint: 1, base: [0.86, 0.93, 0.99], lights: [
    [0.25, 0.80, 0.12, 0.55, 1.00, 1.00, 1.00, 0.9], [0.95, 0.20, 0.20, 0, 0.18, 0.47, 0.93, 0.95], [0.80, 0.35, 0.22, 0, 0.55, 0.75, 0.98, 0.8],
    [0.50, 0.05, 0.20, 0, 0.94, 0.97, 1.00, 0.8], [0.10, 0.40, 0.25, 0, 0.92, 0.96, 1.00, 0.7], [0.70, 0.90, 0.25, 0, 0.75, 0.86, 0.98, 0.6], NONE] },
};

export interface FlowView {
  /** The background drawn: `flow`, or the name of a scene of lights. */
  readonly id: string;
  readonly theme: Theme;
}

export interface Flow {
  /** Draws again at once, after the background or the theme changed. */
  redraw(): void;
  stop(): void;
}

interface Program {
  readonly program: WebGLProgram;
  readonly uniforms: (name: string) => WebGLUniformLocation | null;
}

/**
 * Starts drawing on the canvas; `view` says what to draw at every frame and `still` whether motion
 * is reduced. Gives nothing when the browser has no WebGL: the usual background stays.
 */
export function startFlow(canvas: HTMLCanvasElement, view: () => FlowView, still: () => boolean): Flow | undefined {
  const gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) {
    return undefined;
  }
  const shader = (type: number, source: string): WebGLShader => {
    const compiled = gl.createShader(type) as WebGLShader;
    gl.shaderSource(compiled, source);
    gl.compileShader(compiled);
    return compiled;
  };
  const build = (fragment: string): Program | undefined => {
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('WebGL could not build the flowing background.', gl.getProgramInfoLog(program));
      return undefined;
    }
    const found = new Map<string, WebGLUniformLocation | null>();
    const uniforms = (name: string) => {
      if (!found.has(name)) {
        found.set(name, gl.getUniformLocation(program, name));
      }
      return found.get(name) ?? null;
    };
    return { program, uniforms };
  };
  const day = build(DAY);
  const night = build(NIGHT);
  const lights = build(LIGHTS);
  if (!day || !night || !lights) {
    return undefined;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // The pointer, when it is a mouse: the field leans towards it and the band bends towards it, eased
  // over seconds, so a passing mouse barely stirs it; it settles back when the mouse leaves.
  const pointer = { x: 0.5, y: 0.5, pull: 0, tx: 0.5, ty: 0.5, tpull: 0, t: 0 };
  const onMove = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && !still()) {
      Object.assign(pointer, { tx: event.clientX / innerWidth, ty: 1 - event.clientY / innerHeight, tpull: 1 });
    }
  };
  const onLeave = () => {
    pointer.tpull = 0;
  };
  addEventListener('pointermove', onMove);
  document.documentElement.addEventListener('mouseleave', onLeave);
  addEventListener('blur', onLeave);
  const ease = (t: number) => {
    const dt = Math.min(0.1, Math.max(0, (t - pointer.t) / 1000));
    pointer.t = t;
    const k = 1 - Math.exp(-dt / 1.8);
    const kPull = 1 - Math.exp(-dt / 3);
    pointer.x += (pointer.tx - pointer.x) * k;
    pointer.y += (pointer.ty - pointer.y) * k;
    pointer.pull += (pointer.tpull - pointer.pull) * kPull;
  };

  // No loop (DEC-UX-109): each movement turns at a speed of its own, between three quarters and one
  // and a third of its usual one, from a random start, so the field never repeats.
  const TURN = Math.PI * 2;
  const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
  const base = [1, 2, 1, 3].map((k) => (k * TURN) / PERIOD);
  const speed = base.map((w) => w * rnd(0.75, 1.33));
  const start = base.map(() => rnd(0, TURN));
  // Each light drifts on two axes, breathes, and its arc swells, each in a period of 8 to 18 seconds.
  const wobble = () => ({ w: Array.from({ length: 4 }, () => TURN / rnd(8, 18)), o: Array.from({ length: 4 }, () => rnd(0, TURN)) });
  const motion = Object.fromEntries(Object.entries(SCENES).map(([id, scene]) => [id, scene.lights.map(wobble)]));
  const positions = new Float32Array(28);
  const colours = new Float32Array(28);
  let seconds = 0;

  const draw = (s: number) => {
    const { id, theme } = view();
    const scene = SCENES[id];
    if (scene) {
      gl.useProgram(lights.program);
      gl.uniform2f(lights.uniforms('uRes'), canvas.width, canvas.height);
      gl.uniform3f(lights.uniforms('uBase'), ...scene.base);
      gl.uniform1f(lights.uniforms('uPaint'), scene.paint);
      scene.lights.forEach(([x, y, r, arc, cr, cg, cb, k], i) => {
        const m = motion[id]?.[i] ?? wobble();
        const f = (j: number) => Math.sin((m.o[j] ?? 0) + (m.w[j] ?? 0) * s);
        // The pointer draws every light a little towards it.
        const lx = x + 0.1 * f(0) + 0.05 * (pointer.x - x) * pointer.pull;
        const ly = y + 0.08 * f(1) + 0.05 * (pointer.y - y) * pointer.pull;
        positions.set([lx, ly, r * (1 + 0.18 * f(2)), arc ? arc * (1 + 0.08 * f(3)) : 0], i * 4);
        colours.set([cr, cg, cb, k], i * 4);
      });
      gl.uniform4fv(lights.uniforms('uL'), positions);
      gl.uniform4fv(lights.uniforms('uC'), colours);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }
    const gradient = theme === 'dark' ? night : day;
    gl.useProgram(gradient.program);
    gl.uniform2f(gradient.uniforms('uRes'), canvas.width, canvas.height);
    const a = speed.map((w, i) => ((start[i] ?? 0) + w * s) % TURN);
    gl.uniform4f(gradient.uniforms('uA'), a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, a[3] ?? 0);
    gl.uniform2f(gradient.uniforms('uPointer'), pointer.x, pointer.y);
    gl.uniform1f(gradient.uniforms('uPull'), pointer.pull);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const resize = () => {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(innerWidth * ratio * RESOLUTION));
    canvas.height = Math.max(1, Math.round(innerHeight * ratio * RESOLUTION));
    gl.viewport(0, 0, canvas.width, canvas.height);
    draw(seconds);
  };
  addEventListener('resize', resize);
  resize();

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
    ease(t);
    last = t;
    seconds = t / 1000;
    draw(seconds);
  };
  request = requestAnimationFrame(frame);

  return {
    redraw() {
      draw(seconds);
      if (running && !still()) {
        cancelAnimationFrame(request);
        request = requestAnimationFrame(frame);
      }
    },
    stop() {
      running = false;
      cancelAnimationFrame(request);
      removeEventListener('pointermove', onMove);
      removeEventListener('resize', resize);
      removeEventListener('blur', onLeave);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    },
  };
}
