import { expect, test } from "@playwright/test";
import { openApp, openProduct, state, watchPage } from "./helpers";

/**
 * One product per attachment type, with a standing spot in front of its pedestal (showroom-layout.json) and the
 * try-on hint its tracker shows while nothing is in view.
 */
const PRODUCTS: [id: string, spot: [number, number], hint: string][] = [
  ["aviator", [0, 0.9], "Face the camera"], // rigid (glasses, face tracking)
  ["velvet-lip", [-3.4, 0.7], "Face the camera"], // surface (lipstick)
  ["glow-paint", [3.4, 0.7], "Face the camera"], // surface (face paint)
  ["chrono", [-1.1, -2.3], "Show the back of your hand"], // landmark (watch, hand tracking)
];

test("full loop for every attachment type without reloading the Canvas", async ({ page }) => {
  const { errors, external } = watchPage(page);
  await openApp(page);
  const canvas = await page.locator("canvas").elementHandle();

  for (const [id, spot, hint] of PRODUCTS) {
    await test.step(id, async () => {
      await openProduct(page, id, spot);
      await expect.poll(async () => (await state(page)).mode).toBe("CUSTOMIZE");
      expect((await state(page)).activeProductId).toBe(id);

      await page.getByRole("button", { name: /Add to cart/ }).click();
      await page.getByRole("button", { name: "Try on", exact: true }).click();
      // The synthetic camera stream has no face or hand: tracking runs live and asks for one, capture stays disabled.
      await expect(page.getByTestId("tryon-status")).toHaveText(hint, { timeout: 180_000 });
      await expect(page.getByRole("button", { name: "Capture", exact: true })).toBeDisabled();
      await page.getByRole("button", { name: "Exit", exact: true }).click();
      await expect.poll(async () => (await state(page)).mode).toBe("CUSTOMIZE");
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await expect.poll(async () => (await state(page)).mode).toBe("EXPLORE");
    });
  }

  // One cart item per product, each with its rendered thumbnail.
  await expect
    .poll(async () => (await state(page)).items.map((i) => [i.productId, Boolean(i.thumbnailUrl)]))
    .toEqual(PRODUCTS.map(([id]) => [id, true]));

  // The whole cart at once: one item per zone, switchable in try-on.
  await page.getByRole("button", { name: /^Cart,/ }).click();
  await page.getByRole("button", { name: /Try on the whole look/ }).click();
  const look = page.getByTestId("look-switcher");
  await expect(look.getByRole("group")).toHaveCount(4);
  await expect
    .poll(async () => Object.keys((await state(page)).look ?? {}).sort())
    .toEqual(["eyewear", "lips", "skin", "wrist"]);
  // Face and hand products together: both trackers run, and the hint asks for both.
  await expect(page.getByTestId("tryon-status")).toHaveText("Face the camera and show your hand", { timeout: 180_000 });
  await look.getByRole("button", { name: "No lips" }).click();
  await expect.poll(async () => Object.keys((await state(page)).look ?? {}).sort()).toEqual(["eyewear", "skin", "wrist"]);
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  await expect.poll(async () => (await state(page)).look).toBeNull();

  // Same Canvas element from start to finish, and nothing else.
  expect(await canvas!.evaluate((c) => c.isConnected && document.querySelectorAll("canvas").length === 1)).toBe(true);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
