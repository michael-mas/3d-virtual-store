import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3D Virtual Store",
  description: "3D virtual store & virtual try-on proof of concept",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
