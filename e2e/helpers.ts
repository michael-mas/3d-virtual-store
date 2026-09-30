import type { Page } from "@playwright/test";

/** Debug-only handles exposed with `?debug` (see DevPanel, Player, useTryOnSession). */
type DebugWindow = Window & {
  __store: { getState(): Record<string, unknown> & { mode: string; activeProductId: string; nearPedestal: string | null; items: { productId: string; thumbnailUrl: string | null }[] } };
  __player: { position: [number, number] };
};

export const state = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as DebugWindow).__store.getState();
    return { mode: s.mode, activeProductId: s.activeProductId, items: s.items.map((i) => ({ ...i })) };
  });

/** Makes getUserMedia fail as if the user refused camera access. */
export async function denyCamera(page: Page) {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("denied by test", "NotAllowedError");
    };
  });
}

export async function openApp(page: Page) {
  await page.goto("/?debug");
  await page.getByTestId("loading-screen").waitFor({ state: "detached", timeout: 120_000 });
}

/** Teleports next to a pedestal and opens the product with the E key. */
export async function openProduct(page: Page, productId: string, spot: [number, number]) {
  await page.evaluate(([x, z]) => {
    (window as unknown as DebugWindow).__player.position = [x, z];
  }, spot);
  await page.waitForFunction(
    (id) => (window as unknown as DebugWindow).__store.getState().nearPedestal === id,
    productId,
    { timeout: 60_000 },
  );
  await page.keyboard.press("KeyE");
}

/** Collects uncaught errors, Content Security Policy violations and requests leaving the site's origin. */
export function watchPage(page: Page) {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy/.test(m.text())) errors.push(m.text());
  });
  page.on("request", (r) => {
    const url = new URL(r.url());
    // The e2e server is local; anything else would break the "zero external requests" rule.
    if (/^https?:$/.test(url.protocol) && url.hostname !== "localhost") external.push(r.url());
  });
  return { errors, external };
}
