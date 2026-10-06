import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import FrameErrorWatchdog from "@/components/canvas/FrameErrorWatchdog";
import SceneCanvas from "@/components/canvas/SceneCanvas";
import ArtworkLabel from "@/components/dom/ArtworkLabel";
import BackendBadge from "@/components/dom/BackendBadge";
import CalibrationPanel from "@/components/dom/CalibrationPanel";
import CartDrawer from "@/components/dom/CartDrawer";
import ConciergePanel from "@/components/dom/ConciergePanel";
import CustomizerPanel from "@/components/dom/CustomizerPanel";
import DevPanel from "@/components/dom/DevPanel";
import LoadingScreen from "@/components/dom/LoadingScreen";
import PhotoModal from "@/components/dom/PhotoModal";
import ShowOverlay from "@/components/dom/ShowOverlay";
import StatusOverlays from "@/components/dom/StatusOverlays";
import TopBar from "@/components/dom/TopBar";
import TryOnPanel from "@/components/dom/TryOnPanel";
import { DRACO_DECODER_PATH, SHOWROOM_MODEL_PATH } from "@/lib/assets";
import { PRODUCTS } from "@/lib/products";
import { AUTHOR, REPO_URL, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import { display, sans } from "./fonts";
import "./globals.css";

// The OG image comes from app/opengraph-image.jpg (a photo-booth capture) and the favicon from app/icon.svg.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [AUTHOR],
  creator: AUTHOR.name,
  keywords: ["WebGPU", "three.js", "React Three Fiber", "TSL", "MediaPipe", "virtual try-on", "augmented reality", "3D e-commerce", "Next.js"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: "/", title: SITE_TITLE, description: SITE_DESCRIPTION, siteName: SITE_NAME },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
};

/** Structured data (schema.org) for search engines and AI assistants. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any (WebGPU or WebGL2 browser)",
  browserRequirements: "Requires WebGPU or WebGL2. The try-on uses a webcam or a photo from the device.",
  offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
  author: { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url },
  isAccessibleForFree: true,
  sameAs: [REPO_URL],
};

export const viewport: Viewport = { themeColor: "#0b0a09" };

/**
 * Assets the first frame needs, fetched in parallel with the JS instead of after it (three's loaders use
 * fetch(), same-origin credentials → preload as "fetch" with crossorigin="anonymous" so the request is reused).
 */
const CRITICAL_ASSETS = [
  SHOWROOM_MODEL_PATH,
  ...new Set(PRODUCTS.flatMap((p) => (p.model ? [p.model] : []))),
  `${DRACO_DECODER_PATH}draco_wasm_wrapper.js`,
  `${DRACO_DECODER_PATH}draco_decoder.wasm`,
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  for (const href of CRITICAL_ASSETS) preload(href, { as: "fetch", crossOrigin: "anonymous" });
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden">
        <script
          type="application/ld+json"
          // Static, build-time JSON; "<" is escaped so the payload cannot close the script element.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
        />
        <SceneCanvas />
        <FrameErrorWatchdog />
        <div className="pointer-events-none relative h-full">{children}</div>
        <ConciergePanel />
        <ArtworkLabel />
        <ShowOverlay />
        <CustomizerPanel />
        <TryOnPanel />
        <PhotoModal />
        <CalibrationPanel />
        <TopBar />
        <CartDrawer />
        <BackendBadge />
        <DevPanel />
        <StatusOverlays />
        <LoadingScreen />
      </body>
    </html>
  );
}
