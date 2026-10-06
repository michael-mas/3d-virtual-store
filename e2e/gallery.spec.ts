import { expect, test } from "@playwright/test";
import { openApp, watchPage } from "./helpers";

type Debug = { __player: { position: [number, number] }; __door: { amount: number }; __store: { getState(): { nearArtwork: string | null } } };

test("the concierge leads the visitor into the gallery, whose doors open, and presents its works", async ({ page }) => {
  test.setTimeout(240_000);
  const { errors, external } = watchPage(page);
  await openApp(page);
  await page.getByRole("button", { name: /^Talk/ }).first().click();
  const chat = page.getByTestId("concierge-chat");
  await chat.getByPlaceholder("Ask the concierge…").fill("Show me the gallery");
  await chat.getByRole("button", { name: "Send" }).click();
  await expect(chat).toContainText("Behind the entrance doors, our gallery shows ten works");

  // The doors slide open on the way, and the visitor walks through them.
  await expect.poll(() => page.evaluate(() => (window as unknown as Debug).__player.position[1]), { timeout: 120_000 }).toBeGreaterThan(5);
  expect(await page.evaluate(() => (window as unknown as Debug).__door.amount)).toBeGreaterThan(0.7);
  const label = page.getByTestId("artwork-label");
  await expect(label).toContainText("Matière & Lumière");

  // The gallery tour: the next work, its label (cartel) and the concierge's story.
  await chat.getByRole("button", { name: "Close the conversation" }).click();
  const card = page.getByTestId("concierge");
  await card.getByRole("button", { name: /Next work: Champ d'or/ }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as Debug).__store.getState().nearArtwork), { timeout: 120_000 }).toBe("champ-d-or");
  await expect(label).toContainText("Champ d'or");
  await expect(label).toContainText("Aurèle Vasseur, 2021");
  await expect(card).toContainText("Twelve hundred squares of gold leaf");
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
