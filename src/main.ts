import Phaser from "phaser";
import {
  newMission,
  moveStage,
  validate,
  finish,
  type Mission,
  type Stage,
} from "./mission";
import "./style.css";
const labels: Record<
  Stage,
  { title: string; description: string; icon: string }
> = {
  SOURCE: {
    title: "Source code",
    description:
      "The starting point. Developers commit and review changes in version control.",
    icon: "⌘",
  },
  BUILD: {
    title: "Build artifact",
    description:
      "Turn the source into a runnable, versioned artifact. Building does not prove it is secure.",
    icon: "⬡",
  },
  TEST: {
    title: "Automated tests",
    description:
      "Check expected behavior before promoting the artifact. Tests can only check what they cover.",
    icon: "✓",
  },
  STAGE: {
    title: "Staging environment",
    description:
      "Rehearse the release in a production-like environment before real users receive it.",
    icon: "◈",
  },
  PROD: {
    title: "Production",
    description:
      "Deliver the validated artifact to users, then monitor its health.",
    icon: "◎",
  },
};
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<header><a class="brand" href="./">❯_ SHIFT LEFT<span>THE DELIVERY CONTROL ROOM</span></a><div class="header-right"><span class="live">● SIMULATION ONLINE</span><span>ACT I / APPRENTICE</span></div></header>
<main><nav aria-label="Mission progress"><span>CAMPAIGN / <b>MISSION 01</b></span><span>01 <i>━━━━</i> 02 ──── 03 ──── 04</span></nav>
<section class="hero"><div><p class="eyebrow">MISSION 01 <span>•</span> HELLO, PIPELINE!</p><h1>Good code.<br><em>Great delivery.</em></h1><p class="intro">One release. Five stages. A little out of order.<br>Build a path from the first commit to your users.</p><div class="objective"><span>◎</span><div><strong>YOUR OBJECTIVE</strong><p>Arrange the stages, then run a successful deployment.</p></div></div></div><div class="companion"><img src="./characters/patch.svg" alt="PATCH, a cheerful navy robot engineer with mint eyes"/><div class="speech"><b>PATCH <span> / ENGINEER</span></b><p id="patch-line">SHIP wants this release yesterday. Let’s give it a safe route to production.</p></div></div></section>
<div class="status-grid"><div><small>RELEASE</small><strong>hello-world <span>v1.0.0</span></strong></div><div><small>ENVIRONMENT</small><strong id="health">Awaiting validation</strong></div><div><small>PIPELINE RUNS</small><strong id="attempts">00</strong></div><div><small>MISSION STATUS</small><strong id="mission-status">In progress</strong></div></div>
<section class="workspace"><div class="section-heading"><div><p class="eyebrow">01 / CONFIGURE</p><h2>Your delivery pipeline</h2></div><span class="tag">SANDBOX • NO REAL DEPLOYMENTS</span></div><p class="instructions">Drag stages into order. Or focus a card and use ← / →. Select a stage to investigate.</p><div id="stages" class="stages"></div><div class="console"><div class="console-title"><span>❯_ RELEASE TELEMETRY</span><span id="telemetry-status">IDLE</span></div><div id="game" aria-hidden="true"></div><p id="feedback" role="status" aria-live="polite"></p></div><div class="actions"><button id="validate">▶ Run pipeline</button><span>Safe to experiment. Every run is simulated.</span><button id="reset" class="secondary">↻ Restart mission</button></div></section>
<div class="bottom-grid"><section class="evidence"><p class="eyebrow">02 / INVESTIGATE</p><h2 id="inspect-title">Production</h2><p id="inspect-description"></p><span class="tag">STAGE INTELLIGENCE</span></section><section class="doc"><img src="./characters/doc.svg" alt="DOC, your optional book-shaped learning companion"/><div><p class="eyebrow">DOC / ON YOUR TERMS</p><h2>A little guidance?</h2><p>Every stage has a job. I can help you connect the dots.</p><button id="help" class="secondary" aria-expanded="false">Ask DOC ↗</button><p id="hint" hidden>Start with SOURCE. BUILD creates an artifact; TEST checks it; STAGE is rehearsal; PROD is the live show.</p></div></section></div>
<section id="summary" hidden tabindex="-1"><p class="eyebrow">✓ MISSION COMPLETE</p><h2>Hello, production.</h2><p>You restored the delivery path: SOURCE → BUILD → TEST → STAGE → PROD.</p><p>Source changes become an artifact, pass automated tests, and rehearse in staging before reaching users. A green pipeline reduces risk; it does not guarantee security.</p><p><strong>Up next:</strong> The Red Build — investigate a failing check. More missions coming soon.</p><button id="replay">Play again ↻</button></section><footer><span>SHIFT LEFT / LEARN BY SHIPPING</span><span>Fictional systems. Real engineering habits.</span></footer></main>`;
let state: Mission = newMission();
let selected = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let activeStep = -1;
let dragFrom: number | null = null;
const query = <T extends HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
class PipelineScene extends Phaser.Scene {
  constructor() {
    super("Pipeline");
  }
  create() {
    this.cameras.main.setBackgroundColor("#081722");
    const dots = Array.from({ length: 5 }, (_, i) => {
      if (i < 4) this.add.rectangle(138 + i * 140, 25, 110, 2, 0x254454);
      return this.add.circle(68 + i * 140, 25, 8, 0x294654);
    });
    this.events.on("update", () =>
      dots.forEach((dot, i) =>
        dot.setFillStyle(
          state.completed || i < activeStep
            ? 0x65e5bd
            : i === activeStep
              ? 0x59cfea
              : 0x294654,
        ),
      ),
    );
  }
}
new Phaser.Game({
  type: Phaser.AUTO,
  width: 700,
  height: 50,
  parent: "game",
  scene: [PipelineScene],
  banner: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
});
function move(from: number, to: number, focus = false) {
  state = moveStage(state, from, to);
  selected = Math.max(0, Math.min(4, to));
  render();
  if (focus) query<HTMLElement>(`[data-index="${selected}"]`).focus();
}
function render() {
  const container = query<HTMLDivElement>("#stages");
  container.replaceChildren();
  state.order.forEach((stage, i) => {
    const card = document.createElement("article");
    card.className = "stage" + (selected === i ? " selected" : "");
    card.dataset.index = String(i);
    card.tabIndex = 0;
    card.draggable = !state.running && !state.completed;
    card.setAttribute("aria-label", stage + " stage");
    card.innerHTML = `<div class="card-top"><span>0${i + 1}</span><span>⠿</span></div><div class="stage-icon">${labels[stage].icon}</div><strong>${stage}</strong><small>${labels[stage].title}</small><div class="move"><button aria-label="Move ${stage} left" ${i === 0 || state.running || state.completed ? "disabled" : ""}>←</button><button aria-label="Move ${stage} right" ${i === 4 || state.running || state.completed ? "disabled" : ""}>→</button></div>`;
    const buttons = card.querySelectorAll("button");
    buttons[0].onclick = () => move(i, i - 1, true);
    buttons[1].onclick = () => move(i, i + 1, true);
    card.onclick = (e) => {
      if (!(e.target instanceof HTMLButtonElement)) {
        selected = i;
        render();
        query<HTMLElement>(`[data-index="${i}"]`).focus();
      }
    };
    card.onkeydown = (e) => {
      if (e.target !== card) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        move(i, i + (e.key === "ArrowLeft" ? -1 : 1), true);
      }
    };
    card.ondragstart = (e) => {
      dragFrom = i;
      e.dataTransfer?.setData("text/plain", String(i));
    };
    card.ondragover = (e) => {
      if (!state.running && !state.completed) e.preventDefault();
    };
    card.ondrop = (e) => {
      e.preventDefault();
      if (dragFrom !== null) move(dragFrom, i, true);
      dragFrom = null;
    };
    card.ondragend = () => {
      dragFrom = null;
    };
    container.append(card);
  });
  query("#feedback").textContent = state.feedback;
  query("#attempts").textContent = String(state.attempts).padStart(2, "0");
  query("#health").textContent = state.completed
    ? "Healthy • deployed"
    : state.running
      ? "Deployment in progress"
      : "Awaiting validation";
  query("#mission-status").textContent = state.completed
    ? "Complete ✓"
    : state.running
      ? "Running…"
      : "In progress";
  query("#telemetry-status").textContent = state.completed
    ? "SUCCESS"
    : state.running
      ? `RUNNING / ${state.order[activeStep]}`
      : "IDLE";
  query<HTMLButtonElement>("#validate").disabled =
    state.running || state.completed;
  query("#summary").hidden = !state.completed;
  query("#inspect-title").textContent = labels[state.order[selected]].title;
  query("#inspect-description").textContent =
    labels[state.order[selected]].description;
}
function reset() {
  clearTimeout(timer);
  activeStep = -1;
  state = newMission();
  selected = 0;
  query("#hint").hidden = true;
  query("#help").setAttribute("aria-expanded", "false");
  render();
}
function tick() {
  if (!state.running) return;
  activeStep++;
  if (activeStep >= 5) {
    state = finish(state);
    activeStep = -1;
    render();
    query("#summary").focus();
    return;
  }
  state = {
    ...state,
    feedback: `${state.order[activeStep]}: ${["Commit received.", "Artifact created.", "Behavior checks passed.", "Staging rehearsal passed.", "Releasing to users."][activeStep]}`,
  };
  render();
  timer = setTimeout(tick, 650);
}
query("#validate").onclick = () => {
  state = validate(state);
  if (state.running) {
    activeStep = -1;
    tick();
  } else render();
};
query("#reset").onclick = reset;
query("#replay").onclick = () => {
  reset();
  query<HTMLElement>('[data-index="0"]').focus();
};
query("#help").onclick = () => {
  const hint = query("#hint");
  hint.hidden = !hint.hidden;
  query("#help").setAttribute("aria-expanded", String(!hint.hidden));
};
render();
