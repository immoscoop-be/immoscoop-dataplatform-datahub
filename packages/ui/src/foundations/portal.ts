/**
 * Hangs an element on the page itself, at the end of its body, as an attachment: a sheet, a floating
 * window or a pop-out. Written inside a frame with a backdrop filter, as the main area has over a
 * picture or a flowing background, anything fixed would be placed from that frame, scroll with it and
 * stay within it (DEC-UX-174). Svelte also listens for events on the document, so they still arrive.
 */
export function portal(node: HTMLElement): () => void {
  document.body.appendChild(node);
  return () => node.remove();
}
