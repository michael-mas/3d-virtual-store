import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "3D Virtual Store",
  description: "3D virtual store & virtual try-on proof of concept",
};

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
