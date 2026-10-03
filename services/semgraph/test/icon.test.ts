import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readIcon } from '../src/core/icon.ts';

const svg = (inside: string, viewBox = '0 0 44 44') => `<svg width="44" height="44" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">\n${inside}\n</svg>\n`;

describe('semgraph icons (REQ-061)', () => {
  it('takes the paths and circles of an icon from Figma', () => {
    const icon = readIcon(svg('<path d="M6.6 26.4L37.4 17.6" stroke="currentColor" stroke-width="0.75"/>\n<circle cx="22" cy="22" r="1.87" fill="currentColor"/>'));
    assert.deepEqual(icon.problems, []);
    assert.match(icon.markup, /^<path [^>]*\/>\n<circle [^>]*\/>$/);
  });

  it('refuses another colour, another stroke weight, another dot size, other elements or another size', () => {
    const problems = (inside: string, viewBox?: string) => readIcon(svg(inside, viewBox)).problems;
    assert.match(problems('<path d="M0 0L1 1" stroke="#6B7480" stroke-width="0.75"/>').join(), /one colour/);
    assert.match(problems('<path d="M0 0L1 1" stroke="currentColor" stroke-width="1"/>').join(), /one stroke weight/);
    assert.match(problems('<circle cx="1" cy="1" r="3" fill="currentColor"/>').join(), /dots of r 1\.87/);
    assert.match(problems('<rect width="4" height="4" fill="currentColor"/>').join(), /only hold paths and circles/);
    assert.match(problems('<path d="M0 0L1 1" stroke="currentColor" stroke-width="0.75" opacity="0.5"/>').join(), /may not use opacity/);
    assert.match(problems('', '0 0 24 24').join(), /viewBox="0 0 44 44"/);
  });
});
