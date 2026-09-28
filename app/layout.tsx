import type { Metadata } from "next";
import SceneCanvas from "@/components/canvas/SceneCanvas";
import BackendBadge from "@/components/dom/BackendBadge";
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
        <BackendBadge />
      </body>
    </html>
  );
}
