import type { Metadata } from "next";
import SceneCanvas from "@/components/canvas/SceneCanvas";
import BackendBadge from "@/components/dom/BackendBadge";
import CalibrationPanel from "@/components/dom/CalibrationPanel";
import CartButton from "@/components/dom/CartButton";
import CartDrawer from "@/components/dom/CartDrawer";
import CustomizerPanel from "@/components/dom/CustomizerPanel";
import DevPanel from "@/components/dom/DevPanel";
import PhotoModal from "@/components/dom/PhotoModal";
import StatusOverlays from "@/components/dom/StatusOverlays";
import TryOnPanel from "@/components/dom/TryOnPanel";
import "./globals.css";

export const metadata: Metadata = {
  title: "3D Virtual Store",
  description: "3D virtual store & virtual try-on proof of concept",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
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
      </body>
    </html>
  );
}
