import { test, expect } from "@playwright/test";
async function solve(page: import("@playwright/test").Page) {
  for (const [index, name] of [
    "SOURCE",
    "BUILD",
    "TEST",
    "STAGE",
    "PROD",
  ].entries()) {
    while (
      (await page.locator(".stage").nth(index).getAttribute("aria-label")) !==
      `${name} stage`
    ) {
      await page
        .getByRole("button", { name: `Move ${name} left`, exact: true })
        .click();
    }
  }
}
test("investigate, recover from invalid order, deploy and replay", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Good code. Great delivery." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ask DOC" }).click();
  await expect(page.locator("#hint")).toBeVisible();
  await page.getByRole("button", { name: "Run pipeline" }).click();
  await expect(page.locator("#feedback")).toContainText("Not quite");
  await solve(page);
  await page.getByRole("button", { name: "Run pipeline" }).click();
  await expect(
    page.getByRole("button", { name: "Run pipeline" }),
  ).toBeDisabled();
  await expect(page.locator("#summary")).toBeVisible();
  await expect(page.locator("#health")).toContainText("Healthy");
  await page.getByRole("button", { name: "Play again" }).click();
  await expect(page.locator("#summary")).toBeHidden();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("reset cancels deployment and keyboard focus follows stage", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("article", { name: "PROD stage" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("article", { name: "PROD stage" })).toBeFocused();
  await expect(page.locator(".stage").nth(1)).toHaveAttribute(
    "aria-label",
    "PROD stage",
  );
  await solve(page);
  await page.getByRole("button", { name: "Run pipeline" }).click();
  await page.getByRole("button", { name: "Restart mission" }).click();
  await page.waitForTimeout(3700);
  await expect(page.locator("#summary")).toBeHidden();
  await expect(page.locator("#attempts")).toHaveText("00");
  await expect(
    page.getByRole("button", { name: "Run pipeline" }),
  ).toBeEnabled();
});
test("drag reorders cards", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "Touch users have labeled move buttons",
  );
  await page.goto("/");
  await page
    .getByRole("article", { name: "SOURCE stage" })
    .dragTo(page.getByRole("article", { name: "PROD stage" }));
  await expect(page.locator(".stage").first()).toHaveAttribute(
    "aria-label",
    "SOURCE stage",
  );
});
