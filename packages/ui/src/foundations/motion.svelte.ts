/**
 * Whether the system asks to reduce motion: then all animation stops, and the backgrounds stand
 * still (Background and motion). Version 1 follows the system only (OP-UX-38).
 */
class Motion {
  reduced = $state(false);

  constructor() {
    if (typeof matchMedia === 'function') {
      const query = matchMedia('(prefers-reduced-motion: reduce)');
      this.reduced = query.matches;
      query.addEventListener('change', (event) => {
        this.reduced = event.matches;
      });
    }
  }
}

export const motion = new Motion();
