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

test("the visitor talks with the concierge, who answers and acts", async ({ page }) => {
  const { errors, external } = watchPage(page);
  await openApp(page);
  await page.getByRole("button", { name: /^Talk/ }).first().click();
  const chat = page.getByTestId("concierge-chat");
  await expect(chat).toContainText("welcome to Maison Miroir");

  const ask = async (q: string) => {
    await chat.getByPlaceholder("Ask the concierge…").fill(q);
    await chat.getByRole("button", { name: "Send" }).click();
  };
  await ask("How much is the watch?");
  await expect(chat).toContainText("Chrono Nuit starts at $249.00");
  await ask("Which glasses suit my face?");
  await chat.getByRole("button", { name: "Round" }).click();
  await expect(chat).toContainText("I would choose Atelier 03");

  // Acting on the boutique: the walk to the piece is planned.
  await chat.getByRole("button", { name: "Take me there" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __player: { path: unknown[] } }).__player.path.length))
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
