/**
 * Enforces the "zero external runtime requests" rule: any cross-origin http(s) fetch() is answered locally
 * with an empty 204 instead of leaving the device. The only offender found so far is MediaPipe tasks-vision,
 * which posts usage statistics to https://odml.pa.googleapis.com/v1/log every 60 s and on close (no opt-out
 * option); on a non-200 answer it stops logging, silently. Same-origin, blob: and data: requests are untouched.
 */
let installed = false;

export function installNetworkGuard() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, window.location.href);
    if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== window.location.origin) {
      return Promise.resolve(new Response(null, { status: 204, statusText: "Blocked: local-only app" }));
    }
    return originalFetch(input, init);
  };
  if (navigator.sendBeacon) {
    const originalBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) =>
      new URL(String(url), window.location.href).origin === window.location.origin ? originalBeacon(url, data) : true;
  }
}
