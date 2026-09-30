import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

/**
 * End-to-end tests against the static export (`npm run build` first). They run on the WebGL 2 fallback: CI runners
 * have no GPU, so Chromium renders with SwiftShader (slow, hence the long timeouts) and WebGPU is disabled for
 * determinism. The camera is Chromium's synthetic test stream (no face in it): try-on is checked up to live
 * tracking of that stream ("Face the camera"), without a real face.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 15 * 60_000,
  expect: { timeout: 90_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    permissions: ["camera"],
    launchOptions: {
      args: [
        "--disable-features=WebGPU",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `node scripts/serve-static.mjs out ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
