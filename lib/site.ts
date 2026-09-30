/** Site identity, shared by the page metadata, robots.txt, sitemap.xml and the structured data. */
export const SITE_NAME = "3D Virtual Store";
export const SITE_TITLE = "3D Virtual Store — WebGPU showroom & virtual try-on";
export const SITE_DESCRIPTION =
  "Walk a 3D showroom, customize products and try them on with your webcam. WebGPU + MediaPipe, running 100% in your browser.";
export const REPO_URL = "https://github.com/michael-mas/3d-virtual-store";
export const AUTHOR = { name: "Michael Mas", url: "https://github.com/michael-mas" };

/**
 * Absolute site URL (canonical, Open Graph, sitemap): NEXT_PUBLIC_SITE_URL if set, else the Vercel production
 * domain (set by Vercel at build time), else localhost for local builds.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");
