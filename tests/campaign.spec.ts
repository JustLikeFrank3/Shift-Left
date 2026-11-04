import { test, expect } from "@playwright/test";
import data from "../src/scenarios.json" with { type: "json" };
const routes: Record<number, string[]> = {
  2: ["fix-module", "RUN", "fix-logic", "RUN"],
  3: ["revoke", "assess", "history", "rotate", "inject", "scan", "RUN"],
  4: ["hook", "ci", "enforce", "bad", "RUN", "clean", "RUN"],
  5: ["sast", "patch", "sast", "triage", "stage", "dast", "RUN"],
  6: ["sbom", "sca", "upgrade", "lock", "sbom", "sca", "regression", "RUN"],
  7: ["identity", "scope", "probe", "RUN"],
  8: ["coverage", "required", "protect", "skip", "RUN", "normal", "RUN"],
  9: ["quarantine", "pin", "rebuild", "verify", "RUN"],
  10: ["contain", "track", "patch", "test", "reopen", "RUN"],
  11: ["rollback", "capture", "verify", "restore", "fix", "health", "RUN"],
  12: [
    "revoke",
    "secrets",
    "tests",
    "dependencies",
    "recovery",
    "enforce",
    "bad",
    "RUN",
    "clean",
    "RUN",
  ],
};
for (const s of data)
  test(`mission ${s.id}: investigate, remediate, verify and persist completion`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?mode=workbench");
    await page
      .getByText("Campaign missions / 30-second tutorial + 11 incidents", {
        exact: true,
      })
      .click();
    await page
      .locator("#mission-menu")
      .getByRole("button", {
        name: new RegExp("^" + String(s.id).padStart(2, "0") + " "),
      })
      .click();
    await expect(page.locator("#scenario-title")).toHaveText(s.title);
    await page.getByRole("button", { name: "Validate release" }).click();
    await expect(page.locator("#scenario-summary")).toBeHidden();
    for (const e of s.evidence) {
      await page
        .locator("#evidence-tabs")
        .getByRole("button", { name: e.title, exact: false })
        .click();
      await expect(page.locator("#evidence-code")).not.toBeEmpty();
    }
    for (const id of routes[s.id]) {
      if (id === "RUN")
        await page.getByRole("button", { name: "Validate release" }).click();
      else
        await page
          .locator("#scenario-actions")
          .getByRole("button", {
            name: s.actions.find((a) => a.id === id)!.label,
            exact: true,
          })
          .click();
    }
    await expect(page.locator("#scenario-summary")).toBeVisible();
    await expect(page.locator("#scenario-pipeline")).toContainText(
      "PROD / PASSED",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.reload();
    await page
      .getByText("Campaign missions / 30-second tutorial + 11 incidents", {
        exact: true,
      })
      .click();
    await expect(
      page.locator("#mission-menu").getByRole("button", {
        name: new RegExp("^" + String(s.id).padStart(2, "0") + " "),
      }),
    ).toContainText("✓");
    expect(errors).toEqual([]);
  });
test("tutorial can be skipped directly into the secret incident, spatial effort and audio work", async ({
  page,
}) => {
  await page.goto("/?mode=workbench");
  await expect(page.locator(".tutorial-banner")).toBeVisible();
  await page
    .getByRole("button", { name: "Skip tutorial — respond to leak" })
    .click();
  await expect(page.locator("#scenario-title")).toHaveText("The Leaked Secret");
  for (const name of ["Repository finding", "Runtime configuration"])
    await page
      .locator("#evidence-tabs")
      .getByRole("button", { name, exact: false })
      .click();
  await page
    .getByRole("button", { name: "Revoke exposed credential", exact: true })
    .click();
  await expect(page.locator("#effort-total")).toContainText("Repair effort: 0");
  await page
    .getByRole("button", {
      name: "Provision replacement in vault",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "PROD · 16 effort", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Replace hardcoding with secret binding",
      exact: true,
    })
    .click();
  await expect(page.locator("#fix-map")).toContainText(
    "Replace hardcoding with secret binding / 16 effort",
  );
  await expect(page.locator("#effort-total")).toContainText(
    "Repair effort: 16",
  );
  await page.getByRole("button", { name: "Sound off", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sound on", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("slider", { name: "Sound effects volume" }).fill("0");
  await page.getByRole("button", { name: "Sound on", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sound off", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});
test("PATCH tutorial assembly reaches incident continuation and storage failure is nonfatal", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage unavailable");
      },
    }),
  );
  await page.goto("/?mode=workbench");
  await expect(page.locator("#summary")).toBeHidden();
  await page
    .getByRole("button", {
      name: "PATCH, assemble the practice pipeline",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Run pipeline", exact: false })
    .click();
  await expect(page.locator("#summary")).toBeVisible();
  await page
    .getByRole("button", { name: "Respond to The Leaked Secret" })
    .click();
  await expect(page.locator("#scenario-title")).toHaveText("The Leaked Secret");
  await expect(page.locator("#save-status")).toContainText(
    "Storage unavailable",
  );
});

test("score is opt-in, decodes locally, and music and effects have independent controls", async ({
  page,
}) => {
  let requests = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("signal-in-the-dark.mp3")) requests++;
  });
  await page.goto("/?mode=workbench");
  expect(requests).toBe(0);
  await page.locator("#start-secret").click();
  await page.getByRole("button", { name: "Sound off", exact: true }).click();
  await expect(page.locator("#music-status")).toHaveText(
    "Now playing: Signal in the Dark • original score",
  );
  await expect(page.locator("#music-status")).toBeVisible();
  expect(requests).toBe(1);
  await page
    .getByRole("slider", { name: "Music volume", exact: true })
    .fill("0");
  await expect(
    page.getByRole("slider", { name: "Sound effects volume", exact: true }),
  ).toHaveValue("22");
  await page.getByRole("button", { name: "Sound on", exact: true }).click();
  await page.getByRole("button", { name: "Sound off", exact: true }).click();
  expect(requests).toBe(1);
});
test("missing score leaves effects and mission controls usable", async ({
  page,
}) => {
  await page.route("**/signal-in-the-dark.mp3", (route) =>
    route.fulfill({ status: 404, body: "Missing" }),
  );
  await page.goto("/?mode=workbench");
  await page.getByRole("button", { name: "Sound off", exact: true }).click();
  await expect(page.locator("#music-status")).toContainText(
    "Music unavailable",
  );
  await expect(
    page.getByRole("button", { name: "Sound on", exact: true }),
  ).toBeEnabled();
  await page.locator("#start-secret").click();
  await expect(page.locator("#scenario-title")).toHaveText("The Leaked Secret");
});

test("music stays silent when volume is zeroed during a scheduled cue fade", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const observed = window as unknown as { musicGain: GainNode };
    const original = BiquadFilterNode.prototype.connect;
    BiquadFilterNode.prototype.connect = function (...args: unknown[]) {
      if (args[0] instanceof GainNode) observed.musicGain = args[0];
      return Reflect.apply(original, this, args);
    };
  });
  await page.goto("/?mode=workbench");
  await page.getByRole("button", { name: "Sound off", exact: true }).click();
  await expect(page.locator("#music-status")).toContainText("Now playing");
  // PATCH's cue schedules music gain recovery half a second into the future.
  await page
    .getByRole("button", {
      name: "PATCH, assemble the practice pipeline",
      exact: true,
    })
    .click();
  await page
    .getByRole("slider", { name: "Music volume", exact: true })
    .fill("0");
  await page.waitForTimeout(1100);
  const gain = await page.evaluate(
    () => (window as unknown as { musicGain: GainNode }).musicGain.gain.value,
  );
  expect(gain).toBeLessThan(0.0001);
  // Mission mood changes must respect the same user-selected silence.
  await page.locator("#start-secret").click();
  await page.waitForTimeout(600);
  expect(
    await page.evaluate(
      () => (window as unknown as { musicGain: GainNode }).musicGain.gain.value,
    ),
  ).toBeLessThan(0.0001);
});
