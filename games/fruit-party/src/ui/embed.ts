/**
 * The standalone package must not query or depend on a host page. The only
 * integration signal it needs is whether it is currently rendered in a frame.
 */
export function isEmbedded(): boolean {
  return window.parent !== window;
}
