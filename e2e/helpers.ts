import type { Page } from "@playwright/test";
import { crc32, deflateSync } from "node:zlib";

/** Debug-only handles exposed with `?debug` (see DevPanel, Player, useTryOnSession). */
type DebugWindow = Window & {
  __store: { getState(): Record<string, unknown> & { mode: string; activeProductId: string; nearPedestal: string | null; items: { productId: string; thumbnailUrl: string | null }[]; look: Record<string, string> | null } };
  __player: { position: [number, number] };
};

export const state = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as DebugWindow).__store.getState();
    return { mode: s.mode, activeProductId: s.activeProductId, items: s.items.map((i) => ({ ...i })), look: s.look };
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

/** A plain gradient PNG: a photo with no face or hand in it (no real faces are committed). */
export function gradientPng(width = 320, height = 400): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) rows.set([(x * 255) / width, (y * 255) / height, 160], y * (width * 3 + 1) + 1 + x * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
