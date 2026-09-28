/** Debug tooling is on in `next dev`, or in production with `?debug` in the URL. Client-only. */
export function isDebugEnabled(): boolean {
  return process.env.NODE_ENV === "development" || new URLSearchParams(window.location.search).has("debug");
}
