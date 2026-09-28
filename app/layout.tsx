import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import SceneCanvas from "@/components/canvas/SceneCanvas";
import BackendBadge from "@/components/dom/BackendBadge";
import CalibrationPanel from "@/components/dom/CalibrationPanel";
import CartButton from "@/components/dom/CartButton";
import CartDrawer from "@/components/dom/CartDrawer";
import CustomizerPanel from "@/components/dom/CustomizerPanel";
import DevPanel from "@/components/dom/DevPanel";
import LoadingScreen from "@/components/dom/LoadingScreen";
import PhotoModal from "@/components/dom/PhotoModal";
import StatusOverlays from "@/components/dom/StatusOverlays";
import TryOnPanel from "@/components/dom/TryOnPanel";
import { DRACO_DECODER_PATH, SHOWROOM_MODEL_PATH } from "@/lib/assets";
import { PRODUCTS } from "@/lib/products";
import "./globals.css";

const TITLE = "3D Virtual Store — WebGPU showroom & virtual try-on";
const DESCRIPTION =
  "Walk a 3D showroom, customize products and try them on with your webcam. WebGPU + MediaPipe, running 100% in your browser.";

/**
 * Absolute base for the Open Graph image URL: NEXT_PUBLIC_SITE_URL if set, else the Vercel production domain
 * (set by Vercel at build time), else localhost for local builds.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

// The OG image comes from app/opengraph-image.jpg (a photo-booth capture) and the favicon from app/icon.svg.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, siteName: "3D Virtual Store" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#0a0a0a" };

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
    <html lang="en" className="h-full antialiased">
      <body className="h-full overflow-hidden">
        <SceneCanvas />
        <div className="pointer-events-none relative h-full">{children}</div>
        <CustomizerPanel />
        <TryOnPanel />
        <PhotoModal />
        <CalibrationPanel />
        <CartButton />
        <CartDrawer />
        <BackendBadge />
        <DevPanel />
        <StatusOverlays />
        <LoadingScreen />
      </body>
    </html>
  );
}
