import { test, expect, type Page } from "@playwright/test";

type WorldSnapshot = {
  missionId: number;
  x: number;
  y: number;
  cameraX: number;
  stage: string;
  flags: Record<string, boolean>;
  completed: boolean;
  effort: number;
  signals: number;
  panel: string;
  moving: boolean;
};

// Observe the scene without reaching into Phaser or changing game state.
async function world(page: Page): Promise<WorldSnapshot> {
  return page.evaluate(
    () =>
      (window as unknown as { __SHIFT_LEFT__: WorldSnapshot }).__SHIFT_LEFT__,
  );
}

async function enterGrid(page: Page) {
  await page.goto("/");
  await page
    .getByRole("checkbox", { name: "Play the original soundtrack" })
    .uncheck();
  await expect.poll(async () => (await world(page))?.x ?? 0).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Enter the grid" }).click();
  await expect(page.locator("#arrival")).toBeHidden();
  await expect(page.locator("#world canvas")).toBeVisible();
  await expect.poll(async () => (await world(page)).panel).toBe("world");
  await expect(page.locator("#mission-title")).toHaveText("The Leaked Secret");
  // Let the initial camera follow reach the production end of the map.
  await expect
    .poll(async () => (await world(page)).cameraX)
    .toBeGreaterThan(2500);
}

async function connect(page: Page, title: string) {
  await page.locator("#world").focus();
  await page.keyboard.press("e");
  await expect(page.locator("#terminal")).toBeVisible();
  await expect(page.locator("#terminal-title")).toHaveText(title);
  await expect.poll(async () => (await world(page)).panel).toBe("terminal");
}

async function disconnect(page: Page) {
  await page.getByRole("button", { name: "Disconnect terminal" }).click();
  await expect(page.locator("#terminal")).toBeHidden();
}

async function action(page: Page, label: string) {
  await page
    .locator("#terminal-actions")
    .getByRole("button", {
      name: new RegExp(`^${label}`),
    })
    .click();
}

const destinations = { SOURCE: 315, STAGE: 2885 } as const;

async function travel(page: Page, stage: keyof typeof destinations) {
  await page
    .getByRole("button", { name: `Travel to ${stage}`, exact: true })
    .click();
  await expect
    .poll(
      async () => {
        const state = await world(page);
        return Math.abs(state.x - destinations[stage]) < 25 && !state.moving;
      },
      {
        timeout: 15_000,
        message: `PATCH reaches the ${stage} terminal by walking`,
      },
    )
    .toBe(true);
  expect((await world(page)).stage).toBe(stage);
}

async function expectNoPageOverflow(page: Page) {
  expect(
    await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth > innerWidth,
      vertical: document.documentElement.scrollHeight > innerHeight,
    })),
  ).toEqual({ horizontal: false, vertical: false });
}

test("PATCH jumps with Space and keyboard movement scrolls the world", async ({
  page,
}) => {
  await enterGrid(page);
  await expect.poll(async () => (await world(page)).y).toBeGreaterThan(550);
  const grounded = await world(page);
  await page.keyboard.down("Space");
  try {
    await expect
      .poll(async () => (await world(page)).y)
      .toBeLessThan(grounded.y - 50);
  } finally {
    await page.keyboard.up("Space");
  }
  await expect.poll(async () => (await world(page)).y).toBeGreaterThan(550);

  const initial = await world(page);
  await page.keyboard.down("ArrowLeft");
  try {
    await expect
      .poll(async () => {
        const state = await world(page);
        return (
          state.x < initial.x - 450 && state.cameraX < initial.cameraX - 100
        );
      })
      .toBe(true);
  } finally {
    await page.keyboard.up("ArrowLeft");
  }
  await expect.poll(async () => (await world(page)).moving).toBe(false);
  await expectNoPageOverflow(page);
});

test("E exposes the leaked secret, revocation contains it, and SOURCE navigation walks left", async ({
  page,
}) => {
  await enterGrid(page);
  const initial = await world(page);
  await connect(page, "THE LIVE GRID");
  await expect(page.locator("#world-evidence")).toContainText(
    "SYNTHETIC_DEMO_ONLY",
  );
  await expect(page.locator("#world-evidence")).toContainText(
    "exposed / active",
  );
  await action(page, "Revoke exposed credential");
  await expect.poll(async () => (await world(page)).flags.revoked).toBe(true);
  await expect(page.locator("#live-state")).toHaveText(
    "CONTAINED / TRACE THE CAUSE",
  );
  await expect(page.locator("#world-evidence")).toContainText(
    "Old credential: REVOKED",
  );
  expect((await world(page)).effort).toBe(0);
  await disconnect(page);

  await page
    .getByRole("button", { name: "Travel to SOURCE", exact: true })
    .click();
  await expect
    .poll(async () => (await world(page)).x)
    .toBeLessThan(initial.x - 200);
  // An intermediate position proves the navigation did not teleport PATCH.
  expect((await world(page)).x).toBeGreaterThan(1000);
  await expect
    .poll(async () => (await world(page)).cameraX)
    .toBeLessThan(initial.cameraX - 100);
  await expect
    .poll(
      async () => {
        const state = await world(page);
        return Math.abs(state.x - destinations.SOURCE) < 25 && !state.moving;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  expect((await world(page)).stage).toBe("SOURCE");
  await expect(page.locator("#prompt-stage")).toHaveText("SOURCE");
  await connect(page, "THE SOURCE FOUNDRY");
  await expect(
    page.getByRole("button", { name: "Repository history", exact: true }),
  ).toBeVisible();
});

test("the real terminal route repairs the leak at SOURCE and validates the release", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enterGrid(page);

  await page.locator("#validate-world").click();
  await expect(page.locator("#radio-line")).toContainText(
    "revoke the old credential",
  );
  await expect(page.locator("#mission-clear")).toBeHidden();
  expect((await world(page)).completed).toBe(false);
  await connect(page, "THE LIVE GRID");
  await action(page, "Revoke exposed credential");
  await action(page, "Assess credential usage");
  await expect.poll(async () => (await world(page)).flags.assessed).toBe(true);
  await disconnect(page);

  await travel(page, "STAGE");
  await connect(page, "REHEARSAL DECK");
  await expect(page.locator("#world-evidence")).toContainText(
    "Vault: no replacement binding",
  );
  await action(page, "Provision replacement in vault");
  await expect.poll(async () => (await world(page)).flags.rotated).toBe(true);
  expect((await world(page)).effort).toBe(0);
  await disconnect(page);

  await travel(page, "SOURCE");
  await connect(page, "THE SOURCE FOUNDRY");
  await expect(page.locator("#terminal-sector")).toContainText(
    "SOURCE / 1× REPAIR EFFORT",
  );
  await action(page, "Assess repository history");
  await action(page, "Replace hardcoding with secret binding");
  await action(page, "Enable repository secrets check");
  await expect.poll(async () => (await world(page)).effort).toBe(2);
  const repaired = await world(page);
  expect(repaired.flags).toMatchObject({
    revoked: true,
    assessed: true,
    rotated: true,
    "history-reviewed": true,
    injected: true,
    "secret-check": true,
  });
  await expect(page.locator("#effort-count")).toHaveText("EFFORT 02");

  await page.locator("#terminal-run").click();
  await expect(page.locator("#mission-clear")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#clear-title")).toHaveText(
    "The leak is contained.",
  );
  await expect(page.locator("#clear-stats")).toContainText(
    "2 REPAIR EFFORT / 2 VALIDATION RUNS",
  );
  await expect(page.locator("#live-state")).toHaveText("RELEASE RESTORED");
  await expect.poll(async () => (await world(page)).panel).toBe("complete");
  expect((await world(page)).completed).toBe(true);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("shift-left-campaign-v1")!).completed,
    ),
  ).toContain(3);
  await expectNoPageOverflow(page);

  await page.getByRole("button", { name: "Explore this sector again" }).click();
  await expect(page.locator("#mission-clear")).toBeHidden();
  await expect
    .poll(async () => {
      const state = await world(page);
      return (
        state.missionId === 3 &&
        !state.completed &&
        state.effort === 0 &&
        state.x === 3710
      );
    })
    .toBe(true);
  expect((await world(page)).flags).toEqual({});
  await expect(page.locator("#terminal")).toBeHidden();
  await expect(page.locator("#live-state")).toHaveText(
    "CREDENTIAL EXPOSURE ACTIVE",
  );
  expect(errors).toEqual([]);
});

test("the sector menu switches missions and restarts with clean incident state", async ({
  page,
}) => {
  await enterGrid(page);
  await connect(page, "THE LIVE GRID");
  await action(page, "Revoke exposed credential");
  await disconnect(page);

  await page.getByRole("button", { name: "Sectors" }).click();
  await expect(
    page.getByRole("dialog", { name: "Campaign sectors" }),
  ).toBeVisible();
  await page
    .locator("#sector-list")
    .getByRole("button", { name: /02.*The Red Build/ })
    .click();
  await expect(page.locator("#sector-menu")).toBeHidden();
  await expect(page.locator("#mission-title")).toHaveText("The Red Build");
  await expect.poll(async () => (await world(page)).missionId).toBe(2);
  expect(await world(page)).toMatchObject({
    x: 1110,
    stage: "BUILD",
    flags: {},
    effort: 0,
    completed: false,
    moving: false,
  });
  await connect(page, "ARTIFACT WORKS");
  await expect(page.locator("#world-evidence")).toContainText(
    "Cannot resolve './Price'",
  );
  await action(page, "Repair module path");
  await expect
    .poll(async () => (await world(page)).flags["module-fixed"])
    .toBe(true);
  expect((await world(page)).effort).toBe(2);
  await disconnect(page);

  await page.getByRole("button", { name: "Sectors" }).click();
  await page
    .locator("#sector-list")
    .getByRole("button", { name: /03.*The Leaked Secret/ })
    .click();
  await expect(page.locator("#mission-title")).toHaveText("The Leaked Secret");
  await expect.poll(async () => (await world(page)).missionId).toBe(3);
  expect(await world(page)).toMatchObject({
    x: 3710,
    stage: "PROD",
    flags: {},
    effort: 0,
    completed: false,
    moving: false,
  });
  await expect(page.locator("#terminal")).toBeHidden();
  await expect(page.locator("#mission-clear")).toBeHidden();
  await expect(page.locator("#live-state")).toHaveText(
    "CREDENTIAL EXPOSURE ACTIVE",
  );
  await expectNoPageOverflow(page);
});

test("mobile touch controls move, jump and connect without page overflow", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "The desktop layout uses keyboard controls.",
  );
  await enterGrid(page);
  await expectNoPageOverflow(page);
  const touch = await page.context().newCDPSession(page);
  const initial = await world(page);

  for (const [label, direction] of [
    ["Move left", -1],
    ["Move right", 1],
  ] as const) {
    const control = page.getByRole("button", { name: label, exact: true });
    await expect(control).toBeVisible();
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: bounds!.x + bounds!.width / 2, y: bounds!.y + bounds!.height / 2 },
      ],
    });
    try {
      await expect
        .poll(async () => ((await world(page)).x - initial.x) * direction)
        .toBeGreaterThan(65);
    } finally {
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    await expect.poll(async () => (await world(page)).moving).toBe(false);
  }
  await touch.detach();

  await expect.poll(async () => (await world(page)).y).toBeGreaterThan(550);
  const grounded = await world(page);
  await page.getByRole("button", { name: "Jump", exact: true }).tap();
  await expect
    .poll(async () => (await world(page)).y)
    .toBeLessThan(grounded.y - 40);
  await expect.poll(async () => (await world(page)).y).toBeGreaterThan(550);
  await page
    .getByRole("button", { name: "Connect to nearby terminal", exact: true })
    .tap();
  await expect(page.locator("#terminal")).toBeVisible();
  await expect(page.locator("#terminal-title")).toHaveText("THE LIVE GRID");
  await expectNoPageOverflow(page);
  await page.getByRole("button", { name: "Disconnect terminal" }).tap();
  await page.getByRole("button", { name: "Sectors" }).tap();
  await expect(page.locator("#sector-menu")).toBeVisible();
  await expectNoPageOverflow(page);
});
