import { expect, test } from "@playwright/test";

async function chooseStartupOption(page: import("@playwright/test").Page, value: string): Promise<void> {
  const dialog = page.locator("dialog.game-choice-dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator(`[data-value="${value}"]`).click();
}

test("starts a local match and renders the playable board", async ({ page }) => {
  await page.goto("/");

  // One human player, with optional Mystery, Monster, and Dice tiles disabled.
  await chooseStartupOption(page, "1");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");

  await expect(page.locator("#game-message")).toContainText("เริ่มเกม");
  await expect(page.locator("#game-container canvas")).toBeVisible();
  await expect(page.locator("#hp")).toHaveText("20 / 20");
  await expect(page.locator("#hearts")).toHaveText("♥ ♥ ♥");
  await expect(page.locator("#hand-count")).toHaveText("4");
  await expect(page.locator("#roll-button")).toBeEnabled();
  await expect(page.locator("#draw-button")).toBeEnabled();
});

test("accepts a player turn action from the browser UI", async ({ page }) => {
  await page.goto("/");
  await chooseStartupOption(page, "1");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");

  await page.locator("#roll-button").click();
  await expect(page.locator("#game-message")).toContainText("ทอยเต๋า 2 ลูกได้");
  await expect(page.locator("#turn-label")).toContainText("เทิร์น");
});

test("resolves a targeted Attack card through the browser UI", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto("/");
  await chooseStartupOption(page, "1");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");

  await page.locator("#use-card-button").click();
  await page.locator('#hand-panel [data-card-id="blue_accurate_arrow"]').click();

  const targetDialog = page.locator("dialog.game-choice-dialog");
  await expect(targetDialog).toBeVisible();
  await targetDialog.locator('[data-value="bot-1"]').click();

  await expect(page.locator("#game-message")).toContainText("ใช้ไพ่ ธนูแม่นยำ สำเร็จ");
  await expect(page.locator("#player-list .player-row").nth(1)).toContainText("HP 18");
});
