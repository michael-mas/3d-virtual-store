import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // The code is open source: shipping source maps lets anyone read readable stack traces and sources in DevTools.
  productionBrowserSourceMaps: true,
};

export default nextConfig;
