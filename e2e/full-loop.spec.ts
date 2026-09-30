import { expect, test } from "@playwright/test";
import { openApp, openProduct, state, watchPage } from "./helpers";

/** One product per attachment type, with a standing spot in front of its pedestal (showroom-layout.json). */
const PRODUCTS: [id: string, spot: [number, number]][] = [
  ["aviator", [0, 0.9]], // rigid (glasses)
  ["velvet-lip", [-3.4, 0.7]], // surface (lipstick)
  ["glow-paint", [3.4, 0.7]], // surface (face paint)
];

test("full loop for every attachment type without reloading the Canvas", async ({ page }) => {
  const { errors, external } = watchPage(page);
  await openApp(page);
  const canvas = await page.locator("canvas").elementHandle();

  for (const [id, spot] of PRODUCTS) {
    await test.step(id, async () => {
      await openProduct(page, id, spot);
      await expect.poll(async () => (await state(page)).mode).toBe("CUSTOMIZE");
      expect((await state(page)).activeProductId).toBe(id);

      await page.getByRole("button", { name: /Add to cart/ }).click();
      await page.getByRole("button", { name: "Try on", exact: true }).click();
      // The synthetic camera stream has no face: tracking runs live and asks for one, capture stays disabled.
      await expect(page.getByTestId("tryon-status")).toHaveText("Face the camera", { timeout: 180_000 });
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

  // Same Canvas element from start to finish, and nothing else.
  expect(await canvas!.evaluate((c) => c.isConnected && document.querySelectorAll("canvas").length === 1)).toBe(true);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
