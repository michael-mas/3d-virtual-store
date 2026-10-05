import { expect, test } from "@playwright/test";
import { denyCamera, gradientPng, openApp, state, watchPage } from "./helpers";

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

test("without a camera, the try-on runs on a photo from the device", async ({ page }) => {
  const { errors, external } = watchPage(page);
  await denyCamera(page);
  await openApp(page);
  await page.getByRole("button", { name: "INTERACT", exact: true }).click();
  await page.getByRole("button", { name: "Try on", exact: true }).click();
  await expect(page.getByTestId("tryon-error")).toHaveAttribute("data-kind", "denied", { timeout: 180_000 });
  await expect(page.getByRole("button", { name: "Use a photo instead" })).toBeVisible();

  // The photo goes through the live pipeline: tracking runs on it and reports that it has no face.
  await page.getByTestId("photo-input").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: gradientPng() });
  await expect(page.getByTestId("tryon-status")).toHaveText("No face found in this photo", { timeout: 180_000 });
  await expect(page.getByText("Your photo · stays on this device")).toBeVisible();
  await expect(page.getByRole("button", { name: "Capture", exact: true })).toBeDisabled();
  // Shown as taken, not mirrored like a selfie.
  await expect(page.getByTestId("stage")).not.toHaveCSS("transform", /matrix\(-1/);

  // A file the browser can't decode ends in its own error, with a way back to the camera.
  await page.getByTestId("photo-input").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from("not a png") });
  await expect(page.getByTestId("tryon-error")).toHaveAttribute("data-kind", "photo");
  await expect(page.getByRole("button", { name: "Choose another photo" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Use the camera" })).toBeVisible();

  await page.getByRole("button", { name: "Back to customize" }).click();
  await expect.poll(async () => (await state(page)).mode).toBe("CUSTOMIZE");
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
