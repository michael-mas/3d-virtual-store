import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

test("the interface switches to French and remembers it", async ({ page }) => {
  await openApp(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Français" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByText("Boutique virtuelle & essayage")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Panier,/ })).toBeVisible();

  // Saved: the next visit opens in French.
  await page.reload();
  await page.getByRole("button", { name: "Entrer dans la Maison" }).click({ timeout: 120_000 });
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});
