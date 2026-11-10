import { expect, test } from "@playwright/test";

test("a aplicação sobe", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Sistema PMOC")).toBeVisible();
});
