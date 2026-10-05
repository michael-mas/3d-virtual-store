import localFont from "next/font/local";

/** Display serif: the MAISON MIROIR wordmark, product names and prices. */
export const display = localFont({
  src: [
    { path: "./fonts/BodoniModa.woff2", style: "normal", weight: "400 900" },
    { path: "./fonts/BodoniModa-Italic.woff2", style: "italic", weight: "400 900" },
  ],
  variable: "--font-bodoni",
  display: "swap",
  fallback: ["Didot", "Bodoni 72", "Georgia", "serif"],
});

/** Interface sans: a geometric grotesk, light and widely spaced in labels. */
export const sans = localFont({
  src: [{ path: "./fonts/Jost.woff2", style: "normal", weight: "100 900" }],
  variable: "--font-jost",
  display: "swap",
  fallback: ["Futura", "ui-sans-serif", "system-ui", "sans-serif"],
});
