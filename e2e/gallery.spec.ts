import { expect, test } from "@playwright/test";
import { openApp, watchPage } from "./helpers";

const GALLERY_Z = 4.9;

type Debug = { __player: { position: [number, number] }; __door: { amount: number }; __store: { getState(): { nearArtwork: string | null } } };

test("the concierge leads the visitor into the gallery, whose doors open, and presents its works", async ({ page }) => {
  test.setTimeout(240_000);
  const { errors, external } = watchPage(page);
  await openApp(page);
  await page.getByRole("button", { name: /^Talk/ }).first().click();
  const chat = page.getByTestId("concierge-chat");
  await chat.getByPlaceholder("Ask the concierge…").fill("Show me the gallery");
  await chat.getByRole("button", { name: "Send" }).click();
  await expect(chat).toContainText("Behind the entrance doors, our gallery");

  // The doors slide open on the way, and the visitor walks through them.
  await expect.poll(() => page.evaluate(() => (window as unknown as Debug).__player.position[1]), { timeout: 120_000 }).toBeGreaterThan(GALLERY_Z);
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

test("the visitor touches a work, then watches the automatons' performance and leaves it", async ({ page }) => {
  test.setTimeout(300_000);
  const { errors, external } = watchPage(page);
  await openApp(page);
  await page.getByRole("button", { name: /^Talk/ }).first().click();
  const chat = page.getByTestId("concierge-chat");
  const ask = async (q: string) => {
    await chat.getByPlaceholder("Ask the concierge…").fill(q);
    await chat.getByRole("button", { name: "Send" }).click();
  };

  // A work answers a touch: the cut opens.
  await ask("Take me to Fragment");
  await expect.poll(() => page.evaluate(() => (window as unknown as Debug).__store.getState().nearArtwork), { timeout: 150_000 }).toBe("fragment");
  await chat.getByRole("button", { name: "Close the conversation" }).click();
  const label = page.getByTestId("artwork-label");
  await label.getByRole("button", { name: "Open the cut" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __art: { fragmentOpen: { value: number } } }).__art.fragmentOpen.value)).toBeGreaterThan(0.3);

  // The performance: a seat facing the stage, the lights go down, the surtitles run; Escape-free exit by the button.
  await page.getByRole("button", { name: /^Talk/ }).first().click();
  await ask("Take me to the Three Automatons");
  await expect.poll(() => page.evaluate(() => (window as unknown as Debug).__store.getState().nearArtwork), { timeout: 150_000 }).toBe("automates");
  await chat.getByRole("button", { name: "Close the conversation" }).click();
  await label.getByRole("button", { name: "Begin the performance" }).click();
  const overlay = page.getByTestId("show-overlay");
  await expect(overlay).toContainText("Les Trois Automates");
  await expect(overlay).toContainText("Prélude");
  await expect(label).toBeHidden();
  await expect(overlay).toContainText("Éveil", { timeout: 30_000 });
  await overlay.getByRole("button", { name: "Leave the performance" }).click();
  await expect(overlay).toBeHidden();
  await expect(label).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
