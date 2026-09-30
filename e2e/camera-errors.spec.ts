import { expect, test } from "@playwright/test";
import { denyCamera, openApp, state } from "./helpers";

test("a refused camera explains itself and offers a way out", async ({ page }) => {
  await denyCamera(page);
  await openApp(page);
  await page.getByRole("button", { name: "INTERACT", exact: true }).click();
  await page.getByRole("button", { name: "Try on", exact: true }).click();

  const card = page.getByTestId("tryon-error");
  await expect(card).toHaveAttribute("data-kind", "denied", { timeout: 180_000 });
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use demo video" })).toHaveCount(0);

  await page.getByRole("button", { name: "Back to customize" }).click();
  await expect.poll(async () => (await state(page)).mode).toBe("CUSTOMIZE");
});
