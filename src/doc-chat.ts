import { localDocAnswer, type DocKnowledgeContext } from "./doc-knowledge";
import {
  createDocProvider,
  liveDocConfigured,
  type DocAgentConfig,
  type DocTurn,
} from "./doc-provider";

export type DocContext = DocKnowledgeContext;

/** Optional, read-only question panel. Provider connections start only on Send. */
export function mountDocChat(
  context: () => DocContext,
  onOpenChange?: (open: boolean) => void,
) {
  const button = document.createElement("button");
  button.id = "doc-toggle";
  button.className = "doc-toggle";
  button.textContent = "Ask DOC";
  button.setAttribute("aria-controls", "doc-panel");
  button.setAttribute("aria-expanded", "false");
  const panel = document.createElement("section");
  panel.id = "doc-panel";
  panel.className = "doc-chat-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Ask DOC, optional teaching companion");
  panel.innerHTML = `<div><strong>DOC / LEARNING COMPANION</strong><button id="doc-close" type="button" aria-label="Close DOC">Close</button></div>
    <p id="doc-disclosure">Live questions and a mission snapshot go to ElevenLabs and may be retained there. Use fictional examples; never enter secrets. Local reference mode stays in this browser. No microphone.</p>
    <label for="doc-mode">Answer source</label><select id="doc-mode"><option value="live">Live DOC · AI</option><option value="local">Local reference · glossary</option></select>
    <p id="doc-status" role="status" aria-live="polite">Checking live availability…</p>
    <div id="doc-history" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions"></div>
    <form><label for="doc-question">Ask about the mission or DevSecOps</label><textarea id="doc-question" maxlength="600" rows="3" placeholder="Why do I revoke the secret first?" aria-describedby="doc-disclosure"></textarea>
    <div class="doc-chat-actions"><button id="doc-send" type="submit">Send question</button><button id="doc-stop" type="button" hidden>Stop</button><button id="doc-clear" type="button">Clear chat</button></div></form>`;
  document.body.append(button, panel);
  const question = panel.querySelector<HTMLTextAreaElement>("#doc-question")!;
  const mode = panel.querySelector<HTMLSelectElement>("#doc-mode")!;
  const status = panel.querySelector<HTMLParagraphElement>("#doc-status")!;
  const historyElement = panel.querySelector<HTMLDivElement>("#doc-history")!;
  const send = panel.querySelector<HTMLButtonElement>("#doc-send")!;
  const stop = panel.querySelector<HTMLButtonElement>("#doc-stop")!;
  const clear = panel.querySelector<HTMLButtonElement>("#doc-clear")!;
  const form = panel.querySelector<HTMLFormElement>("form")!;
  let config: DocAgentConfig | undefined;
  let configRequest: Promise<void> | undefined;
  let provider: ReturnType<typeof createDocProvider> | undefined;
  let controller: AbortController | undefined;
  let open = false;
  let destroyed = false;
  let lastSent = 0;
  let turns = 0;
  let generation = 0;
  const history: DocTurn[] = [];
  const configController = new AbortController();
  const setStatus = (message: string) => {
    if (!destroyed) status.textContent = message;
  };
  const idleStatus = () =>
    !liveDocConfigured(config)
      ? "Live DOC unavailable · local reference guide (no AI request)."
      : mode.value === "local"
        ? "Local reference guide · no AI request."
        : "Live DOC ready · questions are sent when you press Send.";
  const loadConfig = () => {
    configRequest ??= fetch(`${import.meta.env.BASE_URL}doc-agent.json`, {
      signal: configController.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: unknown) => {
        if (destroyed) return;
        if (liveDocConfigured(value)) config = value;
        else mode.value = "local";
        setStatus(idleStatus());
      })
      .catch(() => {
        if (!destroyed) {
          mode.value = "local";
          setStatus(idleStatus());
        }
      });
    return configRequest;
  };
  const append = (turn: DocTurn) => {
    history.push(turn);
    if (history.length > 30) history.shift();
    const row = document.createElement("p");
    row.className =
      turn.role === "player" ? "doc-player-message" : "doc-answer";
    const label = document.createElement("strong");
    label.textContent =
      turn.role === "player" ? "You: " : `${turn.source ?? "DOC"}: `;
    const body = document.createElement("span");
    body.style.whiteSpace = "pre-wrap";
    body.textContent = turn.text;
    row.append(label, body);
    historyElement.append(row);
    while (historyElement.children.length > 30)
      historyElement.firstElementChild?.remove();
    historyElement.scrollTop = historyElement.scrollHeight;
  };
  const setBusy = (busy: boolean) => {
    send.disabled = busy;
    mode.disabled = busy;
    clear.disabled = busy;
    stop.hidden = !busy;
    question.setAttribute("aria-busy", String(busy));
  };
  const cancel = () => {
    generation++;
    controller?.abort();
    controller = undefined;
    provider?.close();
    setBusy(false);
  };
  const setOpen = (next: boolean) => {
    if (destroyed || next === open) return;
    open = next;
    panel.hidden = !next;
    button.setAttribute("aria-expanded", String(next));
    if (!next) {
      cancel();
      setStatus(idleStatus());
    }
    onOpenChange?.(next);
    if (next) {
      void loadConfig();
      question.focus();
    } else button.focus();
  };
  button.onclick = () => setOpen(!open);
  panel.querySelector<HTMLButtonElement>("#doc-close")!.onclick = () =>
    setOpen(false);
  mode.onchange = () => {
    provider?.close();
    setStatus(idleStatus());
  };
  stop.onclick = () => {
    cancel();
    setStatus("Answer stopped. You can send another question.");
  };
  clear.onclick = () => {
    cancel();
    history.length = 0;
    historyElement.replaceChildren();
    turns = 0;
    lastSent = 0;
    setStatus(idleStatus());
    question.focus();
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const text = question.value.trim();
    if (!text || controller || destroyed) return;
    if (text.length > 600) {
      setStatus("Keep your question to 600 characters.");
      return;
    }
    if (Date.now() - lastSent < 1500) {
      setStatus("Wait a moment before sending another question.");
      return;
    }
    if (turns >= 20) {
      setStatus(
        "This chat has reached 20 questions. Clear chat to start again.",
      );
      return;
    }
    lastSent = Date.now();
    turns++;
    const previous = history.slice();
    const currentContext = context();
    append({ role: "player", text });
    question.value = "";
    controller = new AbortController();
    const signal = controller.signal;
    const requestGeneration = ++generation;
    setBusy(true);
    try {
      await loadConfig();
      if (signal.aborted || destroyed) return;
      if (mode.value === "live" && liveDocConfigured(config)) {
        provider ??= createDocProvider(config, { onStatus: setStatus });
        const answer = await provider.ask(
          text,
          currentContext,
          previous,
          signal,
        );
        if (!signal.aborted && !destroyed) {
          append({ role: "doc", text: answer, source: "Live DOC · AI" });
          setStatus(
            "Live DOC answered. Check the game's evidence when choosing an action.",
          );
        }
      } else {
        append({
          role: "doc",
          text: localDocAnswer(text, currentContext),
          source: "Local reference · glossary",
        });
        setStatus(idleStatus());
      }
    } catch {
      if (!signal.aborted && !destroyed) {
        provider?.close();
        mode.value = "local";
        append({
          role: "doc",
          text: localDocAnswer(text, currentContext),
          source: "Local reference · live unavailable",
        });
        setStatus(
          "Live DOC unavailable. The answer above comes from the local reference guide.",
        );
      }
    } finally {
      if (!destroyed && generation === requestGeneration) {
        controller = undefined;
        setBusy(false);
        question.focus();
      }
    }
  };
  const stopKeys = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.type === "keydown" && event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
    if (
      event.type === "keydown" &&
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey)
    ) {
      event.preventDefault();
      form.requestSubmit();
    }
    if (event.type === "keydown" && event.key === "Tab") {
      const focusable = [
        ...panel.querySelectorAll<HTMLElement>(
          "button:not([disabled]):not([hidden]),select:not([disabled]),textarea",
        ),
      ];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };
  panel.addEventListener("keydown", stopKeys);
  panel.addEventListener("keyup", stopKeys);
  panel.addEventListener("keypress", stopKeys);
  const onPageHide = () => cancel();
  window.addEventListener("pagehide", onPageHide);
  return {
    setOpen,
    destroy() {
      if (destroyed) return;
      cancel();
      destroyed = true;
      configController.abort();
      window.removeEventListener("pagehide", onPageHide);
      button.remove();
      panel.remove();
      if (open) onOpenChange?.(false);
    },
  };
}
