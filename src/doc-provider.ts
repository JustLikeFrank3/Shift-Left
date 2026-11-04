/** Public text-only protocol: https://elevenlabs.io/docs/eleven-agents/libraries/web-sockets */
import type { DocKnowledgeContext } from "./doc-knowledge";

export type DocAgentConfig = {
  agentId: string;
  available: boolean;
  textOnlyConfirmed: boolean;
  publicAgent: boolean;
  textOnlyOverrideAllowed?: boolean;
  responseCompleteEvent?: boolean;
};
export type DocTurn = { role: "player" | "doc"; text: string; source?: string };

export function docSnapshot(context: DocKnowledgeContext) {
  return {
    missionId: context.missionId,
    missionTitle: context.missionTitle.slice(0, 160),
    objective: context.objective.slice(0, 800),
    flags: Object.fromEntries(
      Object.entries(context.flags)
        .filter(([, value]) => typeof value === "boolean")
        .slice(0, 80),
    ),
    feedback: context.feedback.slice(0, 1000),
  };
}

export function liveDocConfigured(value: unknown): value is DocAgentConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<DocAgentConfig>;
  return (
    config.available === true &&
    config.textOnlyConfirmed === true &&
    config.publicAgent === true &&
    typeof config.agentId === "string" &&
    /^agent_[a-zA-Z0-9]+$/.test(config.agentId)
  );
}

type ProviderOptions = {
  socket?: (url: string) => WebSocket;
  onStatus?: (message: string) => void;
};

/** Never sends audio, asks for a microphone, executes a tool, or writes game state. */
export function createDocProvider(
  config: DocAgentConfig,
  options: ProviderOptions = {},
) {
  let socket: WebSocket | undefined;
  let asking = false;
  let connecting: Promise<void> | undefined;
  let cancelConnect: ((reason: Error) => void) | undefined;
  let pending:
    | {
        resolve: (text: string) => void;
        reject: (error: Error) => void;
        parts: string[];
        timeout: ReturnType<typeof setTimeout>;
      }
    | undefined;
  let idle: ReturnType<typeof setTimeout> | undefined;
  let quiet: ReturnType<typeof setTimeout> | undefined;

  const clearIdle = () => {
    if (idle) clearTimeout(idle);
    idle = undefined;
  };
  const settle = (error?: Error) => {
    if (quiet) clearTimeout(quiet);
    quiet = undefined;
    if (!pending) return;
    const current = pending;
    pending = undefined;
    clearTimeout(current.timeout);
    const answer = current.parts.join("\n").trim();
    if (error) current.reject(error);
    else if (answer) current.resolve(answer);
    else
      current.reject(new Error("DOC returned no text. Try the local guide."));
  };
  const close = () => {
    clearIdle();
    cancelConnect?.(new Error("Live session closed."));
    cancelConnect = undefined;
    connecting = undefined;
    settle(new Error("Live session closed."));
    const current = socket;
    socket = undefined;
    if (current) {
      current.onopen = null;
      current.onmessage = null;
      current.onerror = null;
      current.onclose = null;
      current.close();
    }
  };
  const armIdle = () => {
    clearIdle();
    idle = setTimeout(() => {
      close();
      options.onStatus?.("Live session ended. Send again to reconnect.");
    }, 60_000);
  };
  // agent_response carries the full text, including in the default event set.
  // When completion events are unavailable, allow a short correction window.
  const finishAfterQuiet = () => {
    if (config.responseCompleteEvent) return;
    if (quiet) clearTimeout(quiet);
    quiet = setTimeout(() => {
      settle();
      armIdle();
    }, 700);
  };
  const connect = (): Promise<void> => {
    if (socket?.readyState === 1 && !connecting) return Promise.resolve();
    if (connecting) return connecting;
    if (!liveDocConfigured(config))
      return Promise.reject(
        new Error("Live DOC is unavailable. Use the local reference guide."),
      );
    const request = new Promise<void>((resolve, reject) => {
      let ready = false;
      let finished = false;
      const timer = setTimeout(() => {
        fail(new Error("Live DOC connection timed out."));
        close();
      }, 12_000);
      const fail = (error: Error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        connecting = undefined;
        cancelConnect = undefined;
        reject(error);
      };
      cancelConnect = fail;
      try {
        const current = (options.socket ?? ((url) => new WebSocket(url)))(
          `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${encodeURIComponent(config.agentId)}`,
        );
        socket = current;
        current.onopen = () => {
          if (socket !== current) return;
          current.send(
            JSON.stringify({
              type: "conversation_initiation_client_data",
              ...(config.textOnlyOverrideAllowed
                ? {
                    conversation_config_override: {
                      conversation: { text_only: true },
                    },
                  }
                : {}),
            }),
          );
        };
        current.onmessage = (event: MessageEvent) => {
          if (
            socket !== current ||
            typeof event.data !== "string" ||
            event.data.length > 100_000
          )
            return;
          let data: Record<string, any>;
          try {
            data = JSON.parse(event.data);
          } catch {
            return;
          }
          if (!data || typeof data !== "object") return;
          if (
            data.type === "ping" &&
            typeof data.ping_event?.event_id === "number"
          ) {
            current.send(
              JSON.stringify({
                type: "pong",
                event_id: data.ping_event.event_id,
              }),
            );
          } else if (data.type === "conversation_initiation_metadata") {
            if (!finished) {
              ready = true;
              finished = true;
              clearTimeout(timer);
              cancelConnect = undefined;
              connecting = undefined;
              resolve();
            }
          } else if (
            data.type === "agent_response" &&
            typeof data.agent_response_event?.agent_response === "string"
          ) {
            if (pending) {
              pending.parts.push(
                data.agent_response_event.agent_response.slice(0, 8000),
              );
              finishAfterQuiet();
            }
          } else if (data.type === "agent_response_correction" && pending) {
            const correction = data.agent_response_correction_event;
            if (typeof correction?.corrected_agent_response === "string") {
              const index = pending.parts.lastIndexOf(
                correction.original_agent_response,
              );
              if (index >= 0) {
                pending.parts[index] =
                  correction.corrected_agent_response.slice(0, 8000);
                finishAfterQuiet();
              }
            }
          } else if (data.type === "agent_response_complete" && pending) {
            settle();
            armIdle();
          } else if (
            [
              "client_error",
              "guardrail_triggered",
              "audio",
              "client_tool_call",
            ].includes(data.type)
          ) {
            const error = new Error(
              data.type === "guardrail_triggered"
                ? "DOC could not answer that question. Try a game-related question."
                : "Live DOC could not continue in text mode.",
            );
            fail(error);
            settle(error);
            close();
          }
        };
        current.onerror = () => {
          fail(new Error("Live DOC could not connect."));
          settle(new Error("Live DOC connection failed."));
          close();
        };
        current.onclose = () => {
          if (socket !== current) return;
          socket = undefined;
          clearIdle();
          if (!ready) fail(new Error("Live DOC connection was declined."));
          settle(
            new Error("Live DOC disconnected before completing its answer."),
          );
          options.onStatus?.("Live session ended. Send again to reconnect.");
        };
      } catch {
        fail(new Error("This browser could not start live DOC."));
      }
    });
    connecting = request;
    return request.finally(() => {
      if (connecting === request) connecting = undefined;
    });
  };

  return {
    async ask(
      question: string,
      context: DocKnowledgeContext,
      history: DocTurn[],
      signal: AbortSignal,
    ): Promise<string> {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      if (asking) throw new Error("Wait for DOC's current answer.");
      asking = true;
      clearIdle();
      const abort = () => close();
      signal.addEventListener("abort", abort, { once: true });
      try {
        const fresh = !socket || socket.readyState !== 1;
        options.onStatus?.(
          fresh ? "Connecting to live DOC…" : "DOC is thinking…",
        );
        await connect();
        if (signal.aborted || !socket || socket.readyState !== 1)
          throw new DOMException("Cancelled", "AbortError");
        return await new Promise<string>((resolve, reject) => {
          pending = {
            resolve,
            reject,
            parts: [],
            timeout: setTimeout(() => {
              settle(new Error("DOC took too long. Try the local guide."));
              close();
            }, 30_000),
          };
          try {
            socket!.send(
              JSON.stringify({
                type: "contextual_update",
                text: JSON.stringify({
                  kind: "SHIFT LEFT descriptive game snapshot",
                  ...docSnapshot(context),
                  ...(fresh && history.length
                    ? {
                        previousDiscussion: history
                          .slice(-8)
                          .map((turn) => ({
                            ...turn,
                            text: turn.text.slice(0, 1200),
                          })),
                      }
                    : {}),
                }),
              }),
            );
            socket!.send(
              JSON.stringify({
                type: "user_message",
                text: question.slice(0, 600),
              }),
            );
            options.onStatus?.("DOC is thinking…");
          } catch {
            settle(new Error("The live question could not be sent."));
            close();
          }
        });
      } finally {
        asking = false;
        signal.removeEventListener("abort", abort);
      }
    },
    close,
  };
}
