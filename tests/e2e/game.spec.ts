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
  await chooseStartupOption(page, "0");

  await page.locator("#roll-button").click();
  await expect(page.locator("#game-message")).toContainText("ทอยเต๋า 2 ลูกได้");
  await expect(page.locator("#turn-label")).toContainText("เทิร์น");
});

test("resolves a targeted Attack card through the browser UI", async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 1;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });
  await page.goto("/");
  await chooseStartupOption(page, "1");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");

  await page.locator("#use-card-button").click();
  const handCardIds = await page.locator("#hand-panel [data-card-id]").evaluateAll(elements =>
    elements.map(element => (element as HTMLButtonElement).dataset.cardId ?? "")
  );
  console.log("Deterministic starting hand:", handCardIds);
  const attackDamage: Record<string, number> = {
    blue_common_sword: 3,
    blue_accurate_arrow: 2,
    blue_armor_breaking_axe: 3,
    blue_double_edged_sword: 6,
    blue_counter_punch: 2
  };
  const cardId = handCardIds.find(id => id in attackDamage);
  expect(cardId, `Starting hand has no targeted Attack card: ${handCardIds.join(", ")}`).toBeTruthy();
  await page.locator(`#hand-panel [data-card-id="${cardId}"]`).click();

  const targetDialog = page.locator("dialog.game-choice-dialog");
  await expect(targetDialog).toBeVisible({ timeout: 5_000 });
  const targetIds = await targetDialog.locator("[data-value]").evaluateAll(elements =>
    elements.map(element => (element as HTMLButtonElement).dataset.value ?? "")
  );
  console.log("Available player targets:", targetIds);
  const targetId = targetIds[0];
  await targetDialog.locator(`[data-value="${targetId}"]`).click();

  await expect(page.locator("#game-message")).toContainText("ใช้ไพ่");
  await expect(page.locator("#player-list .player-row").nth(1)).toContainText(`HP ${20 - attackDamage[cardId!]}`);
  await expect(page.locator("#player-list .player-row").nth(0)).toContainText(`HP ${20 - (cardId === "blue_double_edged_sword" ? 2 : 0)}`);
});

test("summons a monster and damages it through the browser UI", async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 471;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });
  await page.goto("/");
  await chooseStartupOption(page, "1");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");

  await page.locator("#use-card-button").click();
  await page.locator('#hand-panel [data-card-id="red_summon_rare"]').click();
  await expect(page.locator("#monster-panel .monster-row")).toBeVisible();

  const monsterRow = page.locator("#monster-panel .monster-row").first();
  const hpText = await monsterRow.locator("small").first().innerText();
  const hpBefore = Number(hpText.match(/HP:\s*(\d+)/)?.[1]);
  expect(Number.isFinite(hpBefore)).toBe(true);

  await page.locator('#hand-panel [data-card-id="blue_monster_hunter"]').click();
  const targetDialog = page.locator("dialog.game-choice-dialog");
  await expect(targetDialog).toBeVisible();
  await targetDialog.locator("[data-value]").first().click();

  await expect(monsterRow).toContainText(`HP: ${hpBefore - 5}`);
});

test("plays a turn and completes a timed match through the results screen", async ({ page }) => {
  await page.goto("/");
  await chooseStartupOption(page, "1");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "300");

  await expect(page.locator("#match-timer")).toHaveText("05:00");
  await expect(page.locator("#roll-button")).toBeEnabled();
  await page.locator("#roll-button").click();
  await expect(page.locator("#game-message")).toContainText("ทอยเต๋า 2 ลูกได้");
  const startedAt = await page.evaluate(() => Date.now());
  await page.evaluate((now) => {
    Date.now = () => now + 301_000;
  }, startedAt);

  await expect(page.locator("#match-timer")).toHaveText("หมดเวลา");
  await expect(page.locator("#match-summary")).toBeVisible();
  await expect(page.locator("#match-summary")).toContainText("สรุปผลการแข่งขัน");
  await expect(page.locator("#game-message")).toContainText("หมดเวลา");
  await expect(page.locator("#roll-button")).toBeDisabled();
});


test("keeps the playable layout usable on a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await chooseStartupOption(page, "1");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");

  await expect(page.locator("#game-container canvas")).toBeVisible();
  await expect(page.locator("#roll-button")).toBeVisible();
  await expect(page.locator("#draw-button")).toBeVisible();
  await expect(page.locator("#use-card-button")).toBeVisible();

  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    canvasRight: document.querySelector("#game-container canvas")?.getBoundingClientRect().right ?? 0,
    buttonHeights: Array.from(document.querySelectorAll(".actions button")).map(button =>
      Math.round(button.getBoundingClientRect().height)
    )
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.canvasRight).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.buttonHeights.every(height => height >= 44)).toBe(true);
});


test("keeps the game layout balanced on tablet and desktop viewports", async ({ page }) => {
  await page.goto("/");
  await chooseStartupOption(page, "1");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");
  await chooseStartupOption(page, "0");

  for (const viewport of [
    { width: 768, height: 1024, layout: "stacked" },
    { width: 1280, height: 900, layout: "columns" }
  ] as const) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate(() => new Promise<void>(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    ));

    const geometry = await page.evaluate(() => {
      const game = document.querySelector(".game-panel")!.getBoundingClientRect();
      const sidebar = document.querySelector(".side-panel")!.getBoundingClientRect();
      const canvas = document.querySelector("#game-container canvas")!.getBoundingClientRect();
      return {
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        gameRight: game.right,
        gameBottom: game.bottom,
        sidebarLeft: sidebar.left,
        sidebarTop: sidebar.top,
        canvasRight: canvas.right,
        gameLeft: game.left
      };
    });

    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.canvasRight).toBeLessThanOrEqual(geometry.gameRight);
    if (viewport.layout === "stacked") {
      expect(geometry.sidebarTop).toBeGreaterThanOrEqual(geometry.gameBottom - 1);
    } else {
      expect(geometry.sidebarLeft).toBeGreaterThanOrEqual(geometry.gameRight);
    }
    expect(geometry.gameLeft).toBeGreaterThanOrEqual(0);
  }
});
