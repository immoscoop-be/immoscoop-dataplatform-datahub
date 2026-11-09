// The flowing gradient, the flowing lights and the painted shapes (DEC-UX-80, DEC-UX-109, DEC-UX-198),
// drawn live with WebGL on a
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

// Painted shapes (DEC-UX-198, DEC-UX-199): many kinds of shapes and many colours painted over each other, each
// drifting, turning, swaying or breathing at a speed of its own, in periods of 20 to 60 seconds. Iris, by
// day, after a picture Max shared on 2026-11-09: a ground of lilac to sky blue and blush to peach, a
// tilted eye of violet and periwinkle, a field of pink whose edge is an S that cuts into the eye, a ribbon
// of rose behind it, sky blue on the right, butter, peach and coral low down, and arcs of mint and mauve.
const IRIS = `
  precision highp float;
  uniform vec2 uRes;
  uniform float uT;        // seconds, three times as fast as the clock, from a random start
  uniform vec2 uPointer;   // the eased pointer, 0 to 1 from the bottom left
  uniform float uPull;     // how present the pointer is, 0 to 1
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { return 0.55 * noise(p) + 0.30 * noise(p * 2.1 + 3.7) + 0.15 * noise(p * 4.3 + 9.1); }
  vec3 hex(float r, float g, float b) { return vec3(r, g, b) / 255.0; }
  mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  // a soft ellipse: 1 inside, 0 outside, its edge as soft as e
  float ellipse(vec2 p, vec2 c, vec2 r, float a, float e) { float d = length(rot(a) * (p - c) / r); return 1.0 - smoothstep(1.0 - e, 1.0 + e, d); }
  float glow(vec2 p, vec2 c, float r) { vec2 d = p - c; return exp(-dot(d, d) / (r * r)); }
  void main() {
    float asp = uRes.x / uRes.y, t = uT;
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 p = vec2(uv.x * asp, uv.y);
    // the whole field breathes: a slow warp, so that no edge is ever quite straight
    vec2 w = vec2(fbm(p * 1.3 + vec2(0.0, t * 0.021)), fbm(p * 1.3 + vec2(5.2, -t * 0.017))) - 0.5;
    vec2 q = p + 0.16 * w - 0.04 * vec2(asp, 1.0) * (uPointer - 0.5) * uPull;
    float X = q.x / asp;                                  // 0 to 1 across, whatever the window

    vec3 LILAC = hex(206.,169.,226.), MAUVE = hex(192.,169.,229.), SKY = hex(140.,197.,245.), PINK = hex(242.,176.,214.),
         ROSE = hex(240.,150.,205.), VIOLET = hex(182.,138.,245.), PERI = hex(136.,146.,247.), BUTTER = hex(248.,222.,172.),
         PEACH = hex(247.,198.,168.), CORAL = hex(242.,170.,168.), BLUSH = hex(251.,229.,238.), MINT = hex(176.,226.,222.);

    // 1 · the ground: lilac turning to mauve and sky blue along the top, blush turning to peach along the bottom
    vec3 top = mix(mix(LILAC, MAUVE, smoothstep(0.05, 0.55, X)), SKY, smoothstep(0.55, 1.0, X));
    vec3 low = mix(BLUSH, PEACH, smoothstep(0.2, 1.0, X));
    vec3 col = mix(low, top, smoothstep(0.10, 0.62, q.y));
    // 2 · the eye: a tilted ellipse with a soft halo, violet at its rim, periwinkle deep inside, drifting and turning
    vec2 cc = vec2((0.73 + 0.025 * sin(t * 0.061)) * asp, 0.52 + 0.035 * cos(t * 0.047));
    float ang = -0.45 + 0.10 * sin(t * 0.033);
    vec2 er = vec2(0.32, 0.25) * (1.0 + 0.05 * sin(t * 0.09));
    col = mix(col, mix(MAUVE, SKY, 0.4), ellipse(q, cc, er * 1.35, ang, 0.5) * 0.35);
    float eye = ellipse(q, cc, er, ang, 0.16);
    col = mix(col, mix(VIOLET, PERI, smoothstep(-0.25, 0.25, q.x - cc.x)), eye * 0.95);
    col = mix(col, PERI, ellipse(q, cc + vec2(0.06, -0.01), vec2(0.17, 0.12), ang, 0.7) * 0.9);
    // 3 · a field of pink from the left, laid over the eye: its edge an S that sways, cuts into the eye and sweeps
    //     round under it
    float edge = 0.60 + 0.06 * sin(q.y * 3.1 + 0.8 + t * 0.071) + 0.025 * sin(q.y * 7.3 - t * 0.043) + 0.32 * smoothstep(0.40, 0.05, q.y);
    float field = (1.0 - smoothstep(-0.010, 0.030, X - edge)) * smoothstep(0.98, 0.66, q.y + 0.12 * X);
    col = mix(col, PINK, field);
    // 4 · a ribbon of rose that wraps under the eye, from the pink field to the right edge
    float ry = 0.24 + 0.10 * sin(X * 4.2 + 0.9 + t * 0.052) + 0.05 * sin(X * 9.0 - t * 0.031);
    float ribbon = (1.0 - smoothstep(0.035, 0.075, abs(q.y - ry))) * smoothstep(0.30, 0.55, X);
    col = mix(col, ROSE, ribbon * 0.7 * (1.0 - 0.65 * eye * (1.0 - field)));   // it seems to pass behind the eye
    // 5 · sky blue standing along the right edge, a tall soft ellipse
    col = mix(col, SKY, ellipse(q, vec2(1.04 * asp, 0.78), vec2(0.22, 0.42), 0.15, 0.5) * 0.9);
    // 6 · warm light low down: butter in the middle, peach around it, coral in the corner
    col = mix(col, PEACH, glow(q, vec2((0.62 + 0.04 * sin(t * 0.039)) * asp, -0.04), 0.34) * 0.85);
    col = mix(col, BUTTER, glow(q, vec2((0.58 + 0.05 * sin(t * 0.044)) * asp, -0.10), 0.26) * 0.9);
    col = mix(col, CORAL, glow(q, vec2(0.97 * asp, 0.06 + 0.04 * sin(t * 0.057)), 0.26) * 0.9);
    // 7 · blush, almost white, in the bottom left corner
    col = mix(col, BLUSH, glow(q, vec2(0.10 * asp, -0.06), 0.42) * 0.9);
    // 8 · a thin arc of mint high on the right, and a lilac one crossing the top left: a different shape, a fresh colour
    float arc1 = exp(-pow((length(q - vec2(1.05 * asp, 1.25)) - (0.48 + 0.02 * sin(t * 0.05))) / 0.05, 2.0));
    col = mix(col, MINT, arc1 * 0.55);
    float arc2 = exp(-pow((length(q - vec2(-0.10 * asp, 1.30)) - (0.62 + 0.03 * sin(t * 0.041))) / 0.07, 2.0));
    col = mix(col, MAUVE, arc2 * 0.45);
    col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(col, 1.0);
  }`;

// What every painted scene shares: its uniforms, noise, and the shapes it paints with.
const HEAD = `
  precision highp float;
  uniform vec2 uRes;
  uniform float uT;        // seconds, three times as fast as the clock, from a random start
  uniform vec2 uPointer;   // the eased pointer, 0 to 1 from the bottom left
  uniform float uPull;     // how present the pointer is, 0 to 1
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { return 0.55 * noise(p) + 0.30 * noise(p * 2.1 + 3.7) + 0.15 * noise(p * 4.3 + 9.1); }
  vec3 hex(float r, float g, float b) { return vec3(r, g, b) / 255.0; }
  mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  float ellipse(vec2 p, vec2 c, vec2 r, float a, float e) { float d = length(rot(a) * (p - c) / r); return 1.0 - smoothstep(1.0 - e, 1.0 + e, d); }
  float glow(vec2 p, vec2 c, float r) { vec2 d = p - c; return exp(-dot(d, d) / (r * r)); }
`;

// Afterglow, by night: black above, a great hill of red and orange rising from the bottom left, its edge a
// red line; teal peeping in between on the right, pale peach in the bottom right
const AFTERGLOW = HEAD + `
  void main() {
    float asp = uRes.x / uRes.y, t = uT;
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 p = vec2(uv.x * asp, uv.y);
    vec2 w = vec2(fbm(p * 1.1 + vec2(0.0, t * 0.02)), fbm(p * 1.1 + vec2(5.2, -t * 0.016))) - 0.5;
    vec2 q = p + 0.10 * w - 0.04 * vec2(asp, 1.0) * (uPointer - 0.5) * uPull;
    float X = q.x / asp;
    vec3 BLACK = hex(6.,6.,8.), RED = hex(232.,30.,12.), RIM = hex(255.,46.,18.), ORANGE = hex(250.,104.,22.), AMBER = hex(255.,150.,52.),
         PEACH = hex(236.,184.,166.), TEAL = hex(30.,160.,156.), DEEP = hex(8.,58.,66.);
    // 1 · the night: black, deep teal low on the right
    vec3 col = BLACK;
    col = mix(col, DEEP, glow(q, vec2(1.05 * asp, 0.30), 0.55) * 0.9);
    // 2 · green-teal peeping in between the night and the hill, on the right
    col = mix(col, TEAL, glow(q, vec2((0.93 + 0.03 * sin(t * 0.05)) * asp, 0.36 + 0.04 * sin(t * 0.043)), 0.24) * 0.95);
    // 3 · the hill: a great curve of red and orange rising from the bottom left; its edge is the red line
    vec2 hc = vec2((0.26 + 0.02 * sin(t * 0.037)) * asp, -0.78 + 0.03 * sin(t * 0.051));
    float hr = length((q - hc) / vec2(1.02, 1.30)) ;                  // 1 on the edge
    float hill = 1.0 - smoothstep(0.985, 1.035, hr);
    vec3 inside = mix(RED, ORANGE, smoothstep(0.15, 0.75, X + 0.4 * (0.5 - q.y)));
    inside = mix(inside, AMBER, smoothstep(0.35, 0.85, X) * smoothstep(0.45, 0.0, q.y));
    col = mix(col, inside, hill);
    // the red line: brightest along the edge, glowing a little into the night
    float rim = exp(-pow((hr - 1.0) / 0.018, 2.0));
    col = mix(col, RIM, rim * 0.9);
    col += RED * exp(-pow(max(hr - 1.0, 0.0) / 0.06, 2.0)) * (1.0 - hill) * 0.25;
    // 4 · pale peach in the bottom right, where the hill meets the teal
    col = mix(col, PEACH, glow(q, vec2((0.96 + 0.02 * sin(t * 0.06)) * asp, 0.02), 0.30) * 0.92);
    col += (hash(gl_FragCoord.xy) - 0.5) / 100.0;
    gl_FragColor = vec4(col, 1.0);
  }`;

// Nova, by night: a very light yellow streak in the middle in orange, waving out to the left in magenta
// and purple, blue towards the bottom, the dark in the bottom right, dark orange in the top right
const NOVA = HEAD + `
  void main() {
    float asp = uRes.x / uRes.y, t = uT;
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 p = vec2(uv.x * asp, uv.y);
    vec2 w = vec2(fbm(p * 1.2 + vec2(0.0, t * 0.02)), fbm(p * 1.2 + vec2(5.2, -t * 0.016))) - 0.5;
    vec2 q = p + 0.14 * w - 0.04 * vec2(asp, 1.0) * (uPointer - 0.5) * uPull;
    float X = q.x / asp;
    vec3 NIGHT = hex(34.,14.,70.), PURPLE = hex(106.,46.,176.), VIOLET = hex(150.,82.,214.), MAGENTA = hex(206.,72.,128.),
         ORANGE = hex(236.,112.,40.), DARKORANGE = hex(196.,74.,26.), YELLOW = hex(252.,214.,122.), PALE = hex(255.,236.,176.),
         BLUE = hex(98.,120.,190.);
    // 1 · the dark: deep purple, darkest in the bottom right
    vec3 col = mix(PURPLE, NIGHT, smoothstep(0.2, 1.0, X * 0.6 + (1.0 - q.y) * 0.5));
    // 2 · dark orange to the top right
    col = mix(col, DARKORANGE, glow(q, vec2((0.86 + 0.03 * sin(t * 0.04)) * asp, 1.08), 0.55) * 0.95);
    // 3 · waving out to the left: magenta into purple, in a band that sways
    float wy = 0.55 + 0.10 * sin(X * 5.0 + t * 0.05) + 0.05 * sin(X * 11.0 - t * 0.037);
    col = mix(col, MAGENTA, exp(-pow((q.y - wy) / 0.20, 2.0)) * smoothstep(0.65, 0.15, X) * 0.75);
    col = mix(col, VIOLET, glow(q, vec2(0.22 * asp, 0.12 + 0.04 * sin(t * 0.045)), 0.30) * 0.7);
    // 4 · blue towards the bottom, under the light
    col = mix(col, BLUE, ellipse(q, vec2((0.66 + 0.03 * sin(t * 0.05)) * asp, 0.22), vec2(0.42, 0.16), -0.55, 0.9) * 0.85);
    // 5 · the light: orange around a very light yellow streak in the middle, tilted, breathing
    vec2 lc = vec2((0.55 + 0.03 * sin(t * 0.041)) * asp, 0.60 + 0.04 * cos(t * 0.035));
    float la = 0.95 + 0.08 * sin(t * 0.03);
    col = mix(col, ORANGE, ellipse(q, lc, vec2(0.62, 0.30), la, 0.9) * 0.9);
    col = mix(col, YELLOW, ellipse(q, lc, vec2(0.40, 0.14) * (1.0 + 0.06 * sin(t * 0.07)), la, 0.9) * 0.95);
    col = mix(col, PALE, ellipse(q, lc + vec2(-0.03, -0.02), vec2(0.22, 0.06), la, 0.9) * 0.8);
    col += (hash(gl_FragCoord.xy) - 0.5) / 70.0;       // the grain of the picture
    gl_FragColor = vec4(col, 1.0);
  }`;

// Cobalt, by night: the night above, and below it tints of blue, royal, azure, cyan and aqua, mixing into
// one form; indigo and violet low on the left, magenta in the bottom right
const COBALT = HEAD + `
  void main() {
    float asp = uRes.x / uRes.y, t = uT;
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 p = vec2(uv.x * asp, uv.y);
    vec2 w = vec2(fbm(p * 1.4 + vec2(0.0, t * 0.022)), fbm(p * 1.4 + vec2(5.2, -t * 0.018))) - 0.5;
    vec2 q = p + 0.18 * w - 0.04 * vec2(asp, 1.0) * (uPointer - 0.5) * uPull;
    float X = q.x / asp;
    vec3 BLACK = hex(4.,4.,10.), NAVY = hex(4.,30.,96.), ROYAL = hex(10.,64.,214.), AZURE = hex(10.,120.,230.), CYAN = hex(30.,214.,248.),
         AQUA = hex(140.,240.,255.), INDIGO = hex(52.,32.,236.), VIOLET = hex(130.,40.,220.), MAGENTA = hex(228.,40.,214.),
         WINE = hex(130.,10.,96.), LILAC = hex(196.,150.,240.);
    // 1 · the night above, and a deep navy rising into it from below, its edge a slow wave
    float rise = 0.52 + 0.06 * sin(X * 3.2 + t * 0.045) + 0.04 * sin(X * 7.0 - t * 0.031) - 0.12 * X;
    vec3 col = mix(BLACK, NAVY, smoothstep(rise + 0.12, rise - 0.10, q.y));
    // 2 · tints of blue that mix into one form: royal, azure, cyan and aqua, each drifting on its own
    col = mix(col, ROYAL, glow(q, vec2((0.40 + 0.04 * sin(t * 0.05)) * asp, 0.36 + 0.03 * sin(t * 0.043)), 0.30) * 0.95);
    col = mix(col, AZURE, glow(q, vec2((0.62 + 0.04 * sin(t * 0.039)) * asp, 0.34 + 0.04 * cos(t * 0.047)), 0.26) * 0.9);
    col = mix(col, CYAN, glow(q, vec2((0.86 + 0.03 * sin(t * 0.052)) * asp, 0.42 + 0.04 * sin(t * 0.036)), 0.24) * 0.95);
    col = mix(col, AQUA, glow(q, vec2((0.93 + 0.03 * sin(t * 0.044)) * asp, 0.30 + 0.03 * cos(t * 0.05)), 0.16) * 0.85);
    // 3 · low down: indigo and violet on the left, lilac turning to magenta on the right, wine at the far left
    col = mix(col, INDIGO, glow(q, vec2((0.06 + 0.03 * sin(t * 0.041)) * asp, 0.12), 0.26) * 0.9);
    col = mix(col, VIOLET, glow(q, vec2((0.40 + 0.04 * sin(t * 0.035)) * asp, -0.02), 0.26) * 0.85);
    col = mix(col, LILAC, glow(q, vec2(0.80 * asp, 0.12 + 0.03 * sin(t * 0.048)), 0.18) * 0.6);
    col = mix(col, MAGENTA, glow(q, vec2((0.98 + 0.02 * sin(t * 0.046)) * asp, -0.04), 0.26) * 0.95);
    col = mix(col, WINE, glow(q, vec2(-0.02 * asp, 0.40 + 0.04 * sin(t * 0.04)), 0.14) * 0.8);
    col += (hash(gl_FragCoord.xy) - 0.5) / 110.0;
    gl_FragColor = vec4(col, 1.0);
  }`;

// Midnight, by night: subtle colours of one family, night blue, indigo, violet, a purple that leans to
// magenta, periwinkle and royal blue
const MIDNIGHT = HEAD + `
  void main() {
    float asp = uRes.x / uRes.y, t = uT;
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 p = vec2(uv.x * asp, uv.y);
    vec2 w = vec2(fbm(p * 1.2 + vec2(0.0, t * 0.02)), fbm(p * 1.2 + vec2(5.2, -t * 0.016))) - 0.5;
    vec2 q = p + 0.16 * w - 0.04 * vec2(asp, 1.0) * (uPointer - 0.5) * uPull;
    float X = q.x / asp;
    // one family: night blue, indigo, violet, a purple that leans to magenta, periwinkle, royal blue
    vec3 NIGHT = hex(10.,10.,22.), INK = hex(18.,18.,72.), INDIGO = hex(36.,22.,140.), VIOLET = hex(92.,40.,186.),
         PLUM = hex(132.,34.,170.), PERI = hex(74.,104.,214.), ROYAL = hex(24.,40.,190.);
    vec3 col = mix(NIGHT, INK, smoothstep(0.0, 0.9, X * 0.7 + (1.0 - q.y) * 0.5));
    col = mix(col, INDIGO, glow(q, vec2((0.62 + 0.04 * sin(t * 0.04)) * asp, 0.62 + 0.04 * cos(t * 0.036)), 0.42) * 0.85);
    col = mix(col, VIOLET, glow(q, vec2((0.78 + 0.03 * sin(t * 0.047)) * asp, 0.50 + 0.04 * sin(t * 0.042)), 0.30) * 0.8);
    col = mix(col, PLUM, glow(q, vec2((0.97 + 0.02 * sin(t * 0.05)) * asp, 0.46 + 0.04 * cos(t * 0.045)), 0.20) * 0.75);
    col = mix(col, PERI, glow(q, vec2((0.42 + 0.04 * sin(t * 0.038)) * asp, 0.24 + 0.03 * sin(t * 0.05)), 0.24) * 0.75);
    col = mix(col, ROYAL, glow(q, vec2((0.50 + 0.03 * sin(t * 0.044)) * asp, -0.08), 0.32) * 0.85);
    col = mix(col, VIOLET, glow(q, vec2(0.02 * asp, 0.30 + 0.03 * sin(t * 0.04)), 0.18) * 0.45);
    col += (hash(gl_FragCoord.xy) - 0.5) / 90.0;
    gl_FragColor = vec4(col, 1.0);
  }`;

// Two sides (DEC-UX-199): broad, soft sides of colour, often the dark one on top, a light band between them
// and soft spheres, each drifting and breathing. A scene is only its colours and shapes; this writes its shader.
type Band = readonly [number, number, number, number, string, number];   // angle, offset, width, sway, colour, strength
type Sphere = readonly [number, number, number, number, string, number]; // x, y, radius, rim (0 soft, 1 a visible edge), colour, strength
interface Sides {
  /** The colours of the corners: top left, top right, bottom left, bottom right. */
  readonly corners?: readonly [string, string, string, string];
  /** Or colours along an angle, from its first place to its last. */
  readonly stops?: readonly string[];
  readonly angle?: readonly [number, number, number];
  readonly bands?: readonly Band[];
  readonly spheres?: readonly Sphere[];
}
const glf = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : String(n));
const rgb = (h: string): string => `vec3(${[1, 3, 5].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(', ')})`;
const sides = ({ corners, stops = [], angle = [0, 0, 1], bands = [], spheres = [] }: Sides): string => {
  const ground = corners
    ? `vec2 e = smoothstep(vec2(0.0), vec2(1.0), q);
  col = mix(mix(${rgb(corners[2])}, ${rgb(corners[3])}, e.x), mix(${rgb(corners[0])}, ${rgb(corners[1])}, e.x), e.y);`
    : `float s = clamp((dot(q - 0.5, vec2(${glf(+Math.cos(angle[0]).toFixed(4))}, ${glf(+Math.sin(angle[0]).toFixed(4))})) + 0.5 - ${glf(angle[1])}) / ${glf(+(angle[2] - angle[1]).toFixed(4))} + 0.03 * sin(t * 0.05 + q.x * 3.0), 0.0, 1.0) * ${glf(stops.length - 1)};
  col = ${rgb(stops[0] ?? '#000000')};` + stops.slice(1).map((c, i) => `
  col = mix(col, ${rgb(c)}, smoothstep(${glf(i)}, ${glf(i + 1)}, s));`).join('');
  const band = bands.map(([a, off, width, sway, c, k], i) => `
  { vec2 d = vec2(${glf(+Math.cos(a).toFixed(4))}, ${glf(+Math.sin(a).toFixed(4))});
    float o = dot(vec2((q.x - 0.5) * asp, q.y - 0.5), vec2(-d.y, d.x)) - (${glf(off)}) - ${glf(sway)} * sin(t * 0.045 + ${glf(2 * i)} + dot(q, d) * 2.5);
    col = mix(col, ${rgb(c)}, exp(-o * o / ${glf(+(width * width).toFixed(4))}) * ${glf(k)}); }`).join('');
  const sphere = spheres.map(([x, y, r, rim, c, k], i) => `
  { vec2 c = vec2(${glf(x)} + 0.03 * sin(t * 0.04 + ${glf(i)}), ${glf(y)} + 0.03 * cos(t * 0.035 + ${glf(+(1.7 * i).toFixed(2))}));
    float r = length(vec2((q.x - c.x) * asp, q.y - c.y)) / (${glf(r)} * (1.0 + 0.05 * sin(t * 0.06 + ${glf(i)})));
    col = mix(col, ${rgb(c)}, mix(exp(-r * r * 1.6), 1.0 - smoothstep(0.82, 1.12, r), ${glf(rim)}) * ${glf(k)}); }`).join('');
  return `${HEAD}void main() {
  float asp = uRes.x / uRes.y, t = uT;
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 w = vec2(noise(uv * 1.6 + vec2(t * 0.018, 0.0)), noise(uv * 1.6 + vec2(4.1, -t * 0.015))) - 0.5;
  vec2 q = uv + 0.12 * w - 0.03 * (uPointer - 0.5) * uPull;
  vec3 col;
  ${ground}${band}${sphere}
  col += (hash(gl_FragCoord.xy) - 0.5) / 90.0;
  gl_FragColor = vec4(col, 1.0);
}`;
};

// The scenes of two sides, after pictures Max shared on 2026-11-09.
// Cinnamon, by day: two opposite sides, the dark one on top: terracotta in the top left, dark brown in the
// top right, cream in the bottom left, tan in the bottom right, a golden glow between them
const CINNAMON = sides({ corners: ['#C8662E', '#4A160C', '#F3DCB2', '#9E6842'], bands: [[0.75, -0.05, 0.28, 0.05, '#E8AE66', 0.45]],
      spheres: [[0.12, 0.52, 0.42, 0, '#E9A962', 0.55], [0.96, 1.02, 0.40, 0, '#3A1208', 0.7], [0.30, -0.05, 0.40, 0, '#F6E3C0', 0.6]] });
// Evening, by day: a dusk sky, the dark on top: deep indigo, blue, lilac, blush, sand and orange from top
// to bottom
const EVENING = sides({ stops: ['#E48650', '#ECC79C', '#E7D0D8', '#BDB3EA', '#7086C8', '#3A4A84'], angle: [1.75, 0.04, 0.98],
      spheres: [[0.05, 1.05, 0.45, 0, '#2A3466', 0.45], [0.95, 0.85, 0.40, 0, '#3E62A8', 0.4]] });
// Citrus, by day: blue on the left, a band of cream, gold in the top right and coral red in the bottom right
const CITRUS = sides({ corners: ['#4C82C4', '#F0B250', '#8FB4DC', '#E2583E'], bands: [[1.25, -0.22, 0.34, 0.06, '#EEE6E2', 0.8]],
      spheres: [[0.92, 0.10, 0.45, 0, '#E5553C', 0.6], [0.78, 0.95, 0.35, 0, '#F2B84C', 0.5]] });
// Orchid, by day: almost white with blush in the top left, orchid on the right, ice blue in the bottom left
const ORCHID = sides({ corners: ['#F7EFF8', '#DDB0E4', '#CFE2F2', '#BC80CE'], bands: [[2.2, 0.05, 0.30, 0.05, '#F3E6F4', 0.55]],
      spheres: [[0.95, 0.30, 0.45, 0, '#B97ACB', 0.5], [0.05, 0.05, 0.40, 0, '#C6DCF1', 0.55]] });
// Tide, by day: deep blue in the top left, a band of cream on the diagonal, an orange sphere in the bottom
// right
const TIDE = sides({ corners: ['#2558A8', '#A6C6EA', '#3E74C0', '#F6782C'], bands: [[0.62, 0.02, 0.34, 0.05, '#EDE4DA', 0.72]],
      spheres: [[0.88, 0.12, 0.42, 1, '#F7934E', 0.55], [0.40, 0.88, 0.40, 0, '#CADFF4', 0.55], [0.0, 1.05, 0.30, 0, '#1A4A9A', 0.6]] });

/** The painted scenes, each its own shader, built the first time it is shown. */
export const PAINTED: Readonly<Record<string, string>> = { iris: IRIS, cinnamon: CINNAMON, evening: EVENING, citrus: CITRUS, orchid: ORCHID, tide: TIDE, afterglow: AFTERGLOW, nova: NOVA, cobalt: COBALT, midnight: MIDNIGHT };

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
  /** The background drawn: `flow`, or the name of a scene of lights or of a painted scene. */
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
  // A painted scene is built the first time it is shown; its clock runs three times as fast as the
  // seconds, from a random start, so that it starts at a random moment.
  const painted = new Map<string, Program | undefined>();
  const paint = (id: string): Program | undefined => {
    const source = PAINTED[id];
    if (!source) {
      return undefined;
    }
    if (!painted.has(id)) {
      painted.set(id, build(source));
    }
    return painted.get(id);
  };
  const paintStart = rnd(0, 1000);
  const positions = new Float32Array(28);
  const colours = new Float32Array(28);
  let seconds = 0;

  const draw = (s: number) => {
    const { id, theme } = view();
    const art = paint(id);
    if (art) {
      gl.useProgram(art.program);
      gl.uniform2f(art.uniforms('uRes'), canvas.width, canvas.height);
      gl.uniform1f(art.uniforms('uT'), paintStart + 3 * s);
      gl.uniform2f(art.uniforms('uPointer'), pointer.x, pointer.y);
      gl.uniform1f(art.uniforms('uPull'), pointer.pull);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }
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
