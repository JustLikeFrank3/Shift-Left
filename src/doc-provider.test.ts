import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDocProvider,
  docSnapshot,
  liveDocConfigured,
  type DocAgentConfig,
  type DocTurn,
} from "./doc-provider";
import type { DocKnowledgeContext } from "./doc-knowledge";

const configured: DocAgentConfig = {
  agentId: "agent_DOC123",
  available: true,
  textOnlyConfirmed: true,
  publicAgent: true,
};
const context: DocKnowledgeContext = {
  missionId: 3,
  missionTitle: "The Leaked Secret",
  objective: "Revoke the exposed credential.",
  flags: { revoked: true },
  feedback: "Assess the old credential's usage.",
};

class FakeSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: Record<string, any>[] = [];
  close = vi.fn(() => {
    this.readyState = 3;
    this.onclose?.();
  });
  send = vi.fn((text: string) => {
    if (this.readyState !== 1) throw new Error("Socket is not open");
    this.sent.push(JSON.parse(text));
  });
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  message(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
  metadata() {
    this.message({ type: "conversation_initiation_metadata" });
  }
  response(text: string) {
    this.message({
      type: "agent_response",
      agent_response_event: { agent_response: text },
    });
  }
}

function setup(config: Partial<DocAgentConfig> = {}) {
  const socket = new FakeSocket();
  const factory = vi.fn((_url: string) => socket as unknown as WebSocket);
  const onStatus = vi.fn();
  const provider = createDocProvider(
    { ...configured, ...config },
    { socket: factory, onStatus },
  );
  return { socket, factory, onStatus, provider };
}

async function ready(socket: FakeSocket) {
  socket.open();
  socket.metadata();
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("DOC public text provider", () => {
  it("requires confirmed availability, public access, text mode and a valid agent id", async () => {
    expect(liveDocConfigured(configured)).toBe(true);
    const invalid: unknown[] = [
      null,
      {},
      { ...configured, available: false },
      { ...configured, publicAgent: false },
      { ...configured, textOnlyConfirmed: false },
      { ...configured, agentId: "agent_../../secret" },
      { ...configured, agentId: 123 },
    ];
    for (const value of invalid) expect(liveDocConfigured(value)).toBe(false);
    const { provider, factory } = setup({ textOnlyConfirmed: false });
    await expect(
      provider.ask("hello", context, [], new AbortController().signal),
    ).rejects.toThrow("unavailable");
    expect(factory).not.toHaveBeenCalled();
  });

  it("sends the permitted text-only override and waits for metadata before the question", async () => {
    const { provider, socket, factory } = setup({
      textOnlyOverrideAllowed: true,
      responseCompleteEvent: true,
    });
    const history: DocTurn[] = Array.from({ length: 10 }, (_, index) => ({
      role: "player",
      text: `${index}: ${"x".repeat(1400)}`,
    }));
    const answer = provider.ask(
      "Q".repeat(650),
      context,
      history,
      new AbortController().signal,
    );
    expect(factory).toHaveBeenCalledWith(
      "wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent_DOC123",
    );
    expect(socket.sent).toEqual([]);
    socket.open();
    expect(socket.sent).toEqual([
      {
        type: "conversation_initiation_client_data",
        conversation_config_override: { conversation: { text_only: true } },
      },
    ]);
    await Promise.resolve();
    expect(socket.sent).toHaveLength(1);
    socket.metadata();
    await vi.advanceTimersByTimeAsync(0);
    expect(socket.sent.map((item) => item.type)).toEqual([
      "conversation_initiation_client_data",
      "contextual_update",
      "user_message",
    ]);
    const snapshot = JSON.parse(socket.sent[1].text);
    expect(snapshot).toMatchObject({
      kind: "SHIFT LEFT descriptive game snapshot",
      ...context,
    });
    expect(snapshot.previousDiscussion).toHaveLength(8);
    expect(snapshot.previousDiscussion[0].text).toMatch(/^2:/);
    expect(
      snapshot.previousDiscussion.every(
        (turn: DocTurn) => turn.text.length === 1200,
      ),
    ).toBe(true);
    expect(socket.sent[2].text).toHaveLength(600);
    socket.response("A bounded answer.");
    socket.message({ type: "agent_response_complete" });
    await expect(answer).resolves.toBe("A bounded answer.");
    provider.close();
  });

  it("does not send a runtime override when it has not been allowed", async () => {
    const { provider, socket } = setup({ responseCompleteEvent: true });
    const answer = provider.ask(
      "What is SAST?",
      context,
      [],
      new AbortController().signal,
    );
    await ready(socket);
    expect(socket.sent[0]).toEqual({
      type: "conversation_initiation_client_data",
    });
    socket.response("A source scan.");
    socket.message({ type: "agent_response_complete" });
    await expect(answer).resolves.toBe("A source scan.");
    provider.close();
  });

  it("rejects a second question while the first is still connecting", async () => {
    const { provider, socket, factory } = setup();
    const first = provider.ask(
      "First question",
      context,
      [],
      new AbortController().signal,
    );
    await expect(
      provider.ask(
        "Second question",
        context,
        [],
        new AbortController().signal,
      ),
    ).rejects.toThrow("Wait for DOC");
    expect(factory).toHaveBeenCalledOnce();
    const rejected = expect(first).rejects.toThrow("Live session closed");
    provider.close();
    await rejected;
    expect(socket.close).toHaveBeenCalledOnce();
  });

  it("answers pings, applies corrections and waits for the configured completion event", async () => {
    const { provider, socket } = setup({ responseCompleteEvent: true });
    const answer = provider.ask(
      "Can green prove security?",
      context,
      [],
      new AbortController().signal,
    );
    const resolved = vi.fn();
    void answer.then(resolved);
    await ready(socket);
    socket.message({ type: "ping", ping_event: { event_id: 23 } });
    expect(socket.sent.at(-1)).toEqual({ type: "pong", event_id: 23 });
    socket.response("A green build proves security.");
    socket.message({
      type: "agent_response_correction",
      agent_response_correction_event: {
        original_agent_response: "A green build proves security.",
        corrected_agent_response: "A green build is not proof of security.",
      },
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(resolved).not.toHaveBeenCalled();
    socket.message({ type: "agent_response_complete" });
    await expect(answer).resolves.toBe(
      "A green build is not proof of security.",
    );
    provider.close();
  });

  it.each([false, undefined])(
    "settles after 700 ms of quiet when completion support is %s",
    async (responseCompleteEvent) => {
      const { provider, socket } = setup(
        responseCompleteEvent === undefined ? {} : { responseCompleteEvent },
      );
      const answer = provider.ask(
        "What is SAST?",
        context,
        [],
        new AbortController().signal,
      );
      const resolved = vi.fn();
      void answer.then(resolved);
      await ready(socket);
      socket.response("First wording.");
      await vi.advanceTimersByTimeAsync(699);
      expect(resolved).not.toHaveBeenCalled();
      socket.message({
        type: "agent_response_correction",
        agent_response_correction_event: {
          original_agent_response: "First wording.",
          corrected_agent_response: "Corrected wording.",
        },
      });
      await vi.advanceTimersByTimeAsync(699);
      expect(resolved).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await expect(answer).resolves.toBe("Corrected wording.");
      provider.close();
    },
  );

  it("rejects and cleans up an aborted connection before metadata", async () => {
    const { provider, socket } = setup();
    const controller = new AbortController();
    const answer = provider.ask("hello", context, [], controller.signal);
    const rejected = expect(answer).rejects.toThrow("Live session closed");
    controller.abort();
    await rejected;
    expect(socket.close).toHaveBeenCalledOnce();
    expect([
      socket.onopen,
      socket.onmessage,
      socket.onerror,
      socket.onclose,
    ]).toEqual([null, null, null, null]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects a pending answer on abort and prevents late socket events", async () => {
    const { provider, socket } = setup();
    const controller = new AbortController();
    const answer = provider.ask("hello", context, [], controller.signal);
    await ready(socket);
    socket.response("Incomplete");
    const rejected = expect(answer).rejects.toThrow("Live session closed");
    controller.abort();
    await rejected;
    expect(socket.close).toHaveBeenCalledOnce();
    expect(socket.onmessage).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects a pending answer when the provider is closed", async () => {
    const { provider, socket } = setup({ responseCompleteEvent: true });
    const answer = provider.ask(
      "hello",
      context,
      [],
      new AbortController().signal,
    );
    await ready(socket);
    const rejected = expect(answer).rejects.toThrow("Live session closed");
    provider.close();
    await rejected;
    expect(socket.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects unexpected audio and never executes client tools", async () => {
    const { provider, socket } = setup();
    const answer = provider.ask(
      "hello",
      context,
      [],
      new AbortController().signal,
    );
    await ready(socket);
    const rejected = expect(answer).rejects.toThrow("text mode");
    socket.message({ type: "audio", audio_event: { audio_base_64: "unused" } });
    await rejected;
    expect(socket.close).toHaveBeenCalledOnce();
    expect(socket.sent.some((item) => item.type === "client_tool_result")).toBe(
      false,
    );
  });

  it("bounds the descriptive snapshot without mutating source flags", () => {
    const flags = {
      invalid: "not a boolean",
      ...Object.fromEntries(
        Array.from({ length: 85 }, (_, index) => [
          `flag${index}`,
          index % 2 === 0,
        ]),
      ),
    } as unknown as Record<string, boolean>;
    const original = { ...flags };
    const snapshot = docSnapshot({
      ...context,
      missionTitle: "T".repeat(180),
      objective: "O".repeat(900),
      feedback: "F".repeat(1200),
      flags,
    });
    expect(snapshot.missionTitle).toHaveLength(160);
    expect(snapshot.objective).toHaveLength(800);
    expect(snapshot.feedback).toHaveLength(1000);
    expect(Object.keys(snapshot.flags)).toHaveLength(80);
    expect(snapshot.flags).not.toHaveProperty("invalid");
    expect(snapshot.flags).not.toHaveProperty("flag80");
    expect(flags).toEqual(original);
  });
});
