import { expect, test } from "@playwright/test";
import { openApp, state, watchPage } from "./helpers";

test("the concierge welcomes the visitor and guides them to the first piece", async ({ page }) => {
  const { errors, external } = watchPage(page);
  await openApp(page);
  const card = page.getByTestId("concierge");
  await expect(card).toContainText("Welcome to Maison Miroir", { timeout: 60_000 });

  // The tour walks the visitor to the first pedestal, where the concierge gives that piece's advice.
  await card.getByRole("button", { name: /Begin the tour/ }).click();
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __store: { getState(): { nearPedestal: string | null } } }).__store.getState().nearPedestal), { timeout: 120_000 }).toBe("aviator");
  await expect(card).toContainText("L'Aviateur suits nearly every face");
  await expect(card.getByRole("button", { name: /Next piece: Atelier 03/ })).toBeVisible();
  expect((await state(page)).mode).toBe("EXPLORE");
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
