import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";

type ClientMessage = {
  type: string;
  text?: string;
  event_id?: number;
  conversation_config_override?: unknown;
};
type MockConnection = {
  socket: WebSocketRoute;
  messages: ClientMessage[];
  closed: boolean;
};
type WorldState = {
  missionId: number;
  x: number;
  y: number;
  flags: Record<string, boolean>;
  effort: number;
  completed: boolean;
  panel: string;
  moving: boolean;
};

async function world(page: Page): Promise<WorldState> {
  return page.evaluate(
    () => (window as unknown as { __SHIFT_LEFT__: WorldState }).__SHIFT_LEFT__,
  );
}

async function mockDoc(
  page: Page,
  live: boolean,
  onMessage?: (
    connection: MockConnection,
    message: ClientMessage,
  ) => void | Promise<void>,
) {
  const connections: MockConnection[] = [];
  let configRequests = 0;
  await page.route("**/doc-agent.json*", async (route) => {
    configRequests++;
    await route.fulfill({
      json: {
        agentId: "agent_browserTest123",
        available: live,
        textOnlyConfirmed: live,
        publicAgent: true,
        textOnlyOverrideAllowed: true,
        responseCompleteEvent: true,
      },
    });
  });
  // Every socket is intercepted. No test connects to an external provider.
  await page.routeWebSocket(/.*/, (socket) => {
    const connection: MockConnection = { socket, messages: [], closed: false };
    connections.push(connection);
    socket.onClose(() => {
      connection.closed = true;
    });
    socket.onMessage(async (raw) => {
      const message = JSON.parse(String(raw)) as ClientMessage;
      connection.messages.push(message);
      if (message.type === "conversation_initiation_client_data") {
        socket.send(
          JSON.stringify({
            type: "conversation_initiation_metadata",
            conversation_initiation_metadata_event: {
              conversation_id: "browser-test",
            },
          }),
        );
      }
      await onMessage?.(connection, message);
    });
  });
  return { connections, configRequests: () => configRequests };
}

async function enterGrid(page: Page) {
  await page.goto("/");
  await page
    .getByRole("checkbox", { name: "Play the original soundtrack" })
    .uncheck();
  await expect.poll(async () => (await world(page))?.x ?? 0).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Enter the grid" }).click();
  await expect.poll(async () => (await world(page)).panel).toBe("world");
  await expect.poll(async () => (await world(page)).y).toBeGreaterThan(550);
}

async function openDoc(page: Page) {
  await page.getByRole("button", { name: "Ask DOC", exact: true }).click();
  await expect(page.locator("#doc-panel")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Ask about the mission or DevSecOps" }),
  ).toBeFocused();
  await expect(page.locator("#doc-status")).not.toContainText("Checking");
  await expect.poll(async () => (await world(page)).panel).toBe("doc");
}

async function sendQuestion(page: Page, question: string) {
  await page
    .getByRole("textbox", { name: "Ask about the mission or DevSecOps" })
    .fill(question);
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
}

async function revokeCredential(page: Page) {
  await page.locator("#world").focus();
  await page.keyboard.press("e");
  await expect(page.locator("#terminal")).toBeVisible();
  await page
    .locator("#terminal-actions")
    .getByRole("button", { name: /^Revoke exposed credential/ })
    .click();
  await expect.poll(async () => (await world(page)).flags.revoked).toBe(true);
  await page.getByRole("button", { name: "Disconnect terminal" }).click();
}

async function expectNoPageOverflow(page: Page) {
  expect(
    await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth > innerWidth,
      vertical: document.documentElement.scrollHeight > innerHeight,
    })),
  ).toEqual({ horizontal: false, vertical: false });
}

test("DOC answers typed natural questions as an explicitly local reference and escapes player text", async ({
  page,
}) => {
  const mock = await mockDoc(page, true);
  await enterGrid(page);
  expect(mock.configRequests()).toBe(0);
  await openDoc(page);
  await expect(page.locator("#doc-status")).toContainText("Live DOC ready");
  expect(mock.configRequests()).toBe(1);
  expect(mock.connections).toHaveLength(0);

  await page
    .getByRole("combobox", { name: "Answer source" })
    .selectOption("local");
  const question =
    'How does SAST find problems? <strong data-doc-probe="question">just text</strong>';
  await page
    .getByRole("textbox", { name: "Ask about the mission or DevSecOps" })
    .pressSequentially(question);
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect(page.locator("#doc-history .doc-player-message")).toContainText(
    question,
  );
  await expect(page.locator("#doc-history .doc-answer")).toContainText(
    "Local reference · glossary",
  );
  await expect(page.locator("#doc-history .doc-answer")).toContainText(
    "without running the application",
  );
  await expect(page.locator("#doc-status")).toHaveText(
    "Local reference guide · no AI request.",
  );
  await expect(page.locator("#doc-history [data-doc-probe]")).toHaveCount(0);
  expect(mock.connections).toHaveLength(0);
  expect((await world(page)).flags).toEqual({});
  await expectNoPageOverflow(page);
});

test("local hints read current flags and follow the selected mission without changing it", async ({
  page,
}) => {
  const mock = await mockDoc(page, false);
  await enterGrid(page);
  await openDoc(page);
  await sendQuestion(page, "What should I do next?");
  await expect(page.locator("#doc-history .doc-answer")).toContainText(
    "Contain the exposure: revoke the old credential",
  );
  expect((await world(page)).flags).toEqual({});
  await page.getByRole("button", { name: "Close DOC", exact: true }).click();

  await revokeCredential(page);
  await openDoc(page);
  await page.getByRole("button", { name: "Clear chat", exact: true }).click();
  await expect(page.locator("#doc-history")).toBeEmpty();
  await sendQuestion(page, "What should I do next?");
  await expect(page.locator("#doc-history .doc-answer")).toContainText(
    "Review the credential usage audit",
  );
  expect((await world(page)).flags).toEqual({ revoked: true });
  expect((await world(page)).effort).toBe(0);
  await page.getByRole("button", { name: "Close DOC", exact: true }).click();

  await page.getByRole("button", { name: "Sectors" }).click();
  await page
    .locator("#sector-list")
    .getByRole("button", { name: /02.*The Red Build/ })
    .click();
  await expect.poll(async () => (await world(page)).missionId).toBe(2);
  await openDoc(page);
  await page.getByRole("button", { name: "Clear chat", exact: true }).click();
  await sendQuestion(page, "What is my current mission?");
  await expect(page.locator("#doc-history .doc-answer")).toContainText(
    "The Red Build:",
  );
  expect(await world(page)).toMatchObject({
    missionId: 2,
    flags: {},
    effort: 0,
    completed: false,
  });
  expect(mock.connections).toHaveLength(0);
});

test("typing movement keys and spaces stays in DOC, and Escape restores PATCH controls", async ({
  page,
}) => {
  await mockDoc(page, false);
  await enterGrid(page);
  const initial = await world(page);
  await page
    .getByRole("button", { name: "Travel to SOURCE", exact: true })
    .click();
  await expect
    .poll(async () => (await world(page)).x)
    .toBeLessThan(initial.x - 65);
  await openDoc(page);
  await expect.poll(async () => (await world(page)).moving).toBe(false);
  const paused = await world(page);
  const input = page.getByRole("textbox", {
    name: "Ask about the mission or DevSecOps",
  });
  const text = "a d w e r f q spaces belong to this question";
  await input.pressSequentially(text, { delay: 45 });
  await expect(input).toHaveValue(text);
  expect(await world(page)).toMatchObject({
    x: paused.x,
    y: paused.y,
    flags: {},
    effort: 0,
    panel: "doc",
    moving: false,
  });
  await expect(page.locator("#terminal")).toBeHidden();
  await expect(page.locator("#mission-clear")).toBeHidden();
  await expectNoPageOverflow(page);

  await input.press("Escape");
  await expect(page.locator("#doc-panel")).toBeHidden();
  await expect(page.locator("#world")).toBeFocused();
  await expect.poll(async () => (await world(page)).y).toBeGreaterThan(550);
  await page.keyboard.down("Space");
  try {
    await expect.poll(async () => (await world(page)).y).toBeLessThan(510);
  } finally {
    await page.keyboard.up("Space");
  }
  await expect.poll(async () => (await world(page)).y).toBeGreaterThan(550);
  await expect(page.locator("#doc-panel")).toBeHidden();
  await page.keyboard.down("ArrowLeft");
  try {
    await expect
      .poll(async () => (await world(page)).x)
      .toBeLessThan(paused.x - 65);
  } finally {
    await page.keyboard.up("ArrowLeft");
  }
  await expect.poll(async () => (await world(page)).moving).toBe(false);
});

test("unavailable live configuration uses an honest local fallback without opening a socket", async ({
  page,
}) => {
  const mock = await mockDoc(page, false);
  await enterGrid(page);
  await openDoc(page);
  await expect(
    page.getByRole("combobox", { name: "Answer source" }),
  ).toHaveValue("local");
  await expect(page.locator("#doc-status")).toContainText("no AI request");
  await page
    .getByRole("combobox", { name: "Answer source" })
    .selectOption("live");
  await expect(page.locator("#doc-status")).toContainText(
    "Live DOC unavailable",
  );
  await sendQuestion(page, "Why should I revoke a leaked token first?");
  await expect(page.locator("#doc-history .doc-answer")).toContainText(
    "Local reference · glossary",
  );
  await expect(page.locator("#doc-history .doc-answer")).toContainText(
    "revoke the exposed credential first",
  );
  await expect(page.locator("#doc-history .doc-answer")).not.toContainText(
    "Live DOC · AI",
  );
  expect(mock.connections).toHaveLength(0);
  expect((await world(page)).flags).toEqual({});
});

test("live DOC exchanges text and current context, applies corrections, and renders replies safely", async ({
  page,
}) => {
  const mock = await mockDoc(page, true);
  await enterGrid(page);
  await revokeCredential(page);
  const before = await world(page);
  await openDoc(page);
  const question = "Why did we revoke the leaked token before rotating it?";
  await sendQuestion(page, question);
  await expect
    .poll(
      () =>
        mock.connections[0]?.messages.some(
          (message) => message.type === "user_message",
        ) ?? false,
    )
    .toBe(true);
  expect(mock.connections).toHaveLength(1);
  const connection = mock.connections[0];
  expect(connection.socket.url()).toContain("agent_id=agent_browserTest123");
  expect(connection.messages[0]).toMatchObject({
    type: "conversation_initiation_client_data",
    conversation_config_override: { conversation: { text_only: true } },
  });
  expect(
    connection.messages.find((message) => message.type === "user_message")
      ?.text,
  ).toBe(question);
  const snapshot = JSON.parse(
    connection.messages.find((message) => message.type === "contextual_update")!
      .text!,
  );
  expect(snapshot).toMatchObject({
    kind: "SHIFT LEFT descriptive game snapshot",
    missionId: 3,
    missionTitle: "The Leaked Secret",
    flags: { revoked: true },
  });
  expect(snapshot.objective).toContain("Revoke the exposed credential");

  const original = "Rotate first.";
  const corrected = "Revoke before rotation.";
  const literalHtml =
    '<img data-doc-probe="reply" src="invalid" onerror="document.body.dataset.docInjected = \'yes\'">';
  connection.socket.send(
    JSON.stringify({
      type: "agent_response",
      agent_response_event: { agent_response: original },
    }),
  );
  connection.socket.send(
    JSON.stringify({
      type: "agent_response_correction",
      agent_response_correction_event: {
        original_agent_response: original,
        corrected_agent_response: corrected,
      },
    }),
  );
  connection.socket.send(
    JSON.stringify({
      type: "agent_response",
      agent_response_event: { agent_response: literalHtml },
    }),
  );
  connection.socket.send(
    JSON.stringify({ type: "ping", ping_event: { event_id: 73 } }),
  );
  await expect
    .poll(() => connection.messages.find((message) => message.type === "pong"))
    .toEqual({ type: "pong", event_id: 73 });
  await expect(
    page.getByRole("button", { name: "Send question", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Stop", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#doc-history .doc-answer")).toHaveCount(0);

  connection.socket.send(JSON.stringify({ type: "agent_response_complete" }));
  await expect(page.locator("#doc-history .doc-answer")).toContainText(
    "Live DOC · AI",
  );
  await expect(page.locator("#doc-history .doc-answer")).toContainText(
    corrected,
  );
  await expect(page.locator("#doc-history .doc-answer")).toContainText(
    literalHtml,
  );
  await expect(page.locator("#doc-history .doc-answer")).not.toContainText(
    original,
  );
  await expect(page.locator("#doc-history [data-doc-probe]")).toHaveCount(0);
  expect(
    await page.evaluate(() => document.body.dataset.docInjected),
  ).toBeUndefined();
  await expect(
    page.getByRole("button", { name: "Send question", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Stop", exact: true }),
  ).toBeHidden();
  expect(connection.messages.map((message) => message.type)).toEqual([
    "conversation_initiation_client_data",
    "contextual_update",
    "user_message",
    "pong",
  ]);
  expect(await world(page)).toMatchObject({
    missionId: before.missionId,
    flags: before.flags,
    effort: before.effort,
    completed: false,
  });
  await expectNoPageOverflow(page);
});

test("a failed live response is labeled local and can be retried in a fresh text session", async ({
  page,
}) => {
  let questions = 0;
  const mock = await mockDoc(page, true, async (connection, message) => {
    if (message.type !== "user_message") return;
    questions++;
    if (questions === 1) {
      await connection.socket.close({
        code: 1011,
        reason: "Simulated provider outage",
      });
    } else {
      connection.socket.send(
        JSON.stringify({
          type: "agent_response",
          agent_response_event: {
            agent_response: "The old token is invalidated by revocation.",
          },
        }),
      );
      connection.socket.send(
        JSON.stringify({ type: "agent_response_complete" }),
      );
    }
  });
  await enterGrid(page);
  await openDoc(page);
  const question = "Why does revocation contain a leaked token?";
  await sendQuestion(page, question);
  await expect(page.locator("#doc-history .doc-answer")).toContainText(
    "Local reference · live unavailable",
  );
  await expect(page.locator("#doc-status")).toContainText(
    "answer above comes from the local reference guide",
  );
  await expect(
    page.getByRole("combobox", { name: "Answer source" }),
  ).toHaveValue("local");
  await expect(
    page.getByRole("button", { name: "Send question", exact: true }),
  ).toBeEnabled();

  await page.getByRole("button", { name: "Clear chat", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Answer source" })
    .selectOption("live");
  await sendQuestion(page, question);
  await expect(page.locator("#doc-history .doc-answer")).toContainText(
    "Live DOC · AI",
  );
  await expect(page.locator("#doc-history .doc-answer")).toContainText(
    "old token is invalidated",
  );
  expect(mock.connections).toHaveLength(2);
  expect(
    mock.connections.map(
      (connection) =>
        connection.messages.find((message) => message.type === "user_message")
          ?.text,
    ),
  ).toEqual([question, question]);
  expect(await world(page)).toMatchObject({
    flags: {},
    effort: 0,
    completed: false,
  });
});

test("Stop and closing DOC cancel in-flight text sessions and release the controls", async ({
  page,
}) => {
  const mock = await mockDoc(page, true);
  await enterGrid(page);
  await openDoc(page);
  await sendQuestion(page, "Explain the current mission.");
  await expect
    .poll(
      () =>
        mock.connections[0]?.messages.some(
          (message) => message.type === "user_message",
        ) ?? false,
    )
    .toBe(true);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.locator("#doc-status")).toContainText("Answer stopped");
  await expect.poll(() => mock.connections[0].closed).toBe(true);
  await expect(
    page.getByRole("button", { name: "Send question", exact: true }),
  ).toBeEnabled();
  await expect(page.locator("#doc-history .doc-answer")).toHaveCount(0);

  await page.getByRole("button", { name: "Clear chat", exact: true }).click();
  await sendQuestion(page, "What is the next checkpoint?");
  await expect
    .poll(
      () =>
        mock.connections[1]?.messages.some(
          (message) => message.type === "user_message",
        ) ?? false,
    )
    .toBe(true);
  await page.getByRole("button", { name: "Close DOC", exact: true }).click();
  await expect(page.locator("#doc-panel")).toBeHidden();
  await expect.poll(() => mock.connections[1].closed).toBe(true);
  await expect.poll(async () => (await world(page)).panel).toBe("world");
  await openDoc(page);
  await expect(
    page.getByRole("button", { name: "Send question", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Stop", exact: true }),
  ).toBeHidden();
  await expect(page.locator("#doc-history .doc-answer")).toHaveCount(0);
});
