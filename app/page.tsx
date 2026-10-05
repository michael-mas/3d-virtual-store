import SourceLink from "@/components/dom/SourceLink";
import { REPO_URL, SITE_DESCRIPTION } from "@/lib/site";

/**
 * The visible UI is the 3D canvas and its panels (see layout). This page carries the document outline and a
 * text description of the app for screen readers, search engines and AI crawlers, which do not run WebGPU.
 */
export default function Home() {
  return (
    <main className="flex justify-center p-5">
      <h1 className="flex flex-col items-center gap-1 text-ivory [text-shadow:0_1px_12px_rgb(0_0_0/0.6)]">
        <span className="wordmark text-lg sm:text-xl">Maison Miroir</span>
        <span className="eyebrow hidden text-[0.6rem] sm:block">Virtual boutique &amp; try-on</span>
      </h1>
      <div className="sr-only">
        <p>{SITE_DESCRIPTION}</p>
        <p>Maison Miroir is a fictional brand, built as a portfolio proof of concept.</p>
        <h2>What you can do</h2>
        <ul>
          <li>Explore: walk a 3D showroom with three pairs of glasses, a lipstick, a face paint, a watch, a ring, a hair color and headwear on pedestals.</li>
          <li>Customize: change frame finish and color, lens effect, lipstick finish and shade, face paint design and style, watch case, dial and strap, ring metal, stone and finger, hair color, finish and intensity, hat style and colors; the price updates live.</li>
          <li>Try on: see the product on your face, hair or hand through your webcam or on a photo, or the whole cart at once. Tracking runs in the page; no image leaves your device.</li>
          <li>Photo: capture and download a photo-booth picture.</li>
        </ul>
        <h2>How it is built</h2>
        <p>
          Next.js static export, React Three Fiber, three.js WebGPURenderer with a WebGL2 fallback, materials and
          post-processing written in TSL, MediaPipe Face and Hand Landmarkers and hair segmenter running locally in WebAssembly, Zustand. No
          server, no tracking, no third-party requests.
        </p>
        <p>
          Source code: <a href={REPO_URL}>{REPO_URL}</a>
        </p>
      </div>
      <noscript>
        <p className="pointer-events-auto mt-16 max-w-md text-center text-neutral-300">
          This 3D experience needs JavaScript and a WebGPU or WebGL2 browser. Source code:{" "}
          <a className="underline" href={REPO_URL}>
            {REPO_URL}
          </a>
        </p>
      </noscript>
      <SourceLink />
    </main>
  );
}
