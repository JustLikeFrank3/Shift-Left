import {
  scenarios,
  scenario,
  startScenario,
  inspectEvidence,
  evidenceText,
  blockedReason,
  act,
  runScenario,
  parseProgress,
  effortCost,
  type CampaignMission,
} from "./campaign";
import { correctOrder, type Stage } from "./mission";
import { sound, setMusicMood } from "./sound";
const key = "shift-left-campaign-v1";
const q = <T extends HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
let progress = (() => {
  try {
    return parseProgress(localStorage.getItem(key));
  } catch {
    return parseProgress(null);
  }
})();
let state: CampaignMission | null = null;
let evidenceId = "";
let placement: Stage = "PROD";
const playOrder = [1, 3, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12];
function save() {
  try {
    localStorage.setItem(key, JSON.stringify(progress));
    q("#save-status").textContent = "Progress saved on this device";
  } catch {
    q("#save-status").textContent =
      "Storage unavailable • progress lasts this session";
  }
}
let drawMenu = () => {};
function markComplete(id: number) {
  if (!progress.completed.includes(id)) progress.completed.push(id);
  save();
  drawMenu();
}
const names = ["Hello, Pipeline!", ...scenarios.map((s) => s.title)];
export function mountCampaign(onLeaveMissionOne: () => void) {
  const nav = document.createElement("section");
  nav.className = "campaign-panel";
  nav.setAttribute("aria-label", "Campaign missions");
  nav.innerHTML =
    '<div class="campaign-heading"><div><p class="eyebrow">YOUR CAMPAIGN / ALL THREE ACTS</p><h2>From first commit to secure delivery</h2></div><span id="save-status" role="status"></span></div><div class="hook-banner"><div><p class="eyebrow">EXPOSED CREDENTIAL / RELEASE HELD</p><h2>A secret just went public.</h2><p>Contain the leak. Follow the evidence. Ship the fix.</p></div><button id="start-secret">Respond to the leak →</button></div><details><summary>Campaign missions / 30-second tutorial + 11 incidents</summary><div id="mission-menu"></div></details><p class="campaign-note">Choose any mission for practice. Completion is saved locally; active experiments restart when you switch missions.</p>';
  q("main").insertBefore(nav, q("main").firstChild);
  const room = document.createElement("section");
  room.id = "campaign-room";
  room.hidden = true;
  room.innerHTML = `<section class="hero"><div><p class="eyebrow" id="scenario-number"></p><h1 id="scenario-title" tabindex="-1"></h1><p class="intro" id="scenario-brief"></p><div class="objective"><span>◎</span><div><strong>YOUR OBJECTIVE</strong><p id="scenario-objective"></p></div></div></div><div class="companion"><img src="./characters/patch.svg" alt="PATCH, robot engineer"/><div class="speech"><b id="scenario-voice"></b><p>Read the evidence. Change the system. Prove the fix.</p></div></div></section>
 <div class="status-grid"><div><small>RELEASE</small><strong>demo-shop / synthetic</strong></div><div><small>RELEASE GATE</small><strong id="scenario-gate"></strong></div><div><small>VALIDATION RUNS</small><strong id="scenario-attempts"></strong></div><div><small>MISSION STATUS</small><strong id="scenario-state"></strong></div></div>
 <section class="workspace spatial-workspace"><p class="eyebrow">SHIFT THE FIX LEFT</p><h2>Where will you prevent the next failure?</h2><p class="instructions">Choose a stage for configuration and code fixes. Earlier fixes cost less simulated effort. Investigation, emergency containment and recovery are free; never delay containment to save points.</p><div id="fix-map" role="group" aria-label="Fix placement on pipeline"></div><p id="effort-total" role="status"></p></section><div class="investigation-grid"><section class="workspace"><p class="eyebrow">01 / INVESTIGATE</p><h2>Evidence console</h2><p class="instructions">Inspect logs and source before applying a change. Evidence updates as your system changes.</p><div id="evidence-tabs" role="group" aria-label="Evidence sources"></div><h3 id="evidence-title"></h3><pre id="evidence-code" tabindex="0" aria-label="Evidence contents"></pre><p class="eyebrow">LIVE CONFIGURATION</p><dl id="system-flags"></dl></section><section class="workspace"><p class="eyebrow">02 / ACT</p><h2>Engineering workbench</h2><p class="instructions">Actions change the simulation. Required evidence and prerequisites are shown below each control.</p><div id="scenario-actions"></div></section></div>
 <section class="workspace campaign-telemetry"><p class="eyebrow">03 / VALIDATE</p><h2>Release telemetry</h2><ol id="scenario-pipeline" aria-label="Delivery stage results"></ol><pre id="scenario-log" aria-label="Validation log"></pre><p id="scenario-feedback" role="status" aria-live="polite"></p><div class="actions"><button id="scenario-run">▶ Validate release</button><button id="scenario-reset" class="secondary">↻ Restart experiment</button><button id="scenario-help" class="secondary" aria-expanded="false">Ask DOC ↗</button></div><div class="scenario-doc" id="scenario-hint" hidden><img src="./characters/doc.svg" alt="DOC, learning companion"/><p></p></div></section>
 <section id="scenario-summary" class="workspace" tabindex="-1" hidden><p class="eyebrow">✓ MISSION COMPLETE</p><h2>Fix verified. Lesson earned.</h2><p id="scenario-learning"></p><button id="scenario-next">Next mission →</button></section>`;
  q("main").insertBefore(room, q("footer"));
  const original = Array.from(q("main").children).filter(
    (el) =>
      el !== nav &&
      el !== room &&
      el.tagName !== "FOOTER" &&
      !el.classList.contains("music-credit"),
  ) as HTMLElement[];
  const tutorialRoom = document.createElement("div");
  tutorialRoom.id = "tutorial-room";
  q("main").insertBefore(tutorialRoom, original[0]);
  original.forEach((el) => tutorialRoom.append(el));
  function select(id: number, focus = true) {
    onLeaveMissionOne();
    progress.selected = id;
    q(".header-right span:last-child").textContent =
      id < 5
        ? "ACT I / APPRENTICE"
        : id < 9
          ? "ACT II / ENGINEER"
          : "ACT III / ARCHITECT";
    setMusicMood([3, 9, 10, 11].includes(id) ? "incident" : "investigate");
    tutorialRoom.hidden = id !== 1;
    room.hidden = id === 1;
    state = id === 1 ? null : startScenario(id);
    evidenceId = "";
    placement = "PROD";
    if (state) {
      const s = scenario(id);
      q("#scenario-number").textContent =
        `MISSION ${String(id).padStart(2, "0")} / ${id < 5 ? "APPRENTICE" : id < 9 ? "ENGINEER" : "ARCHITECT"}`;
      q("#scenario-title").textContent = s.title;
      q("#scenario-brief").textContent = s.brief;
      q("#scenario-objective").textContent = s.objective;
      q("#scenario-voice").textContent = s.voice;
      q("#scenario-hint p").textContent = s.hint;
      q("#scenario-hint").hidden = true;
      q("#scenario-help").setAttribute("aria-expanded", "false");
      render();
      if (focus) {
        q("#scenario-title").focus();
        sound("patch");
      }
    }
    save();
    drawMenu();
  }
  drawMenu = () => {
    const menu = q("#mission-menu");
    menu.replaceChildren();
    playOrder.forEach((id) => {
      const name = names[id - 1];
      const button = document.createElement("button");
      button.className = "mission-choice secondary";
      button.setAttribute("aria-pressed", String(progress.selected === id));
      button.textContent = `${String(id).padStart(2, "0")} ${name}${progress.completed.includes(id) ? " ✓" : ""}`;
      button.onclick = () => select(id);
      menu.append(button);
    });
  };
  function render() {
    if (!state) return;
    const m = state,
      s = scenario(m.id);
    const map = q("#fix-map");
    map.replaceChildren();
    for (const stage of correctOrder) {
      const cell = document.createElement("div");
      const button = document.createElement("button");
      button.className = "secondary";
      button.textContent = `${stage} · ${effortCost[stage]} effort`;
      button.setAttribute("aria-pressed", String(placement === stage));
      button.disabled = m.completed;
      button.onclick = () => {
        placement = stage;
        render();
        q<HTMLButtonElement>(`[data-placement="${stage}"]`).focus();
        sound("click");
      };
      button.dataset.placement = stage;
      const markers = document.createElement("ul");
      m.interventions
        .filter((i) => i.stage === stage)
        .forEach((i) => {
          const marker = document.createElement("li");
          marker.textContent = `${i.label} / ${i.cost ? i.cost + " effort" : "operation · free"}`;
          markers.append(marker);
        });
      cell.append(button, markers);
      map.append(cell);
    }
    q("#effort-total").textContent =
      `Repair effort: ${m.effort} • ${m.interventions.filter((i) => i.cost > 0).length} fixes placed • illustrative units, not real cost estimates`;
    q("#scenario-gate").textContent = m.completed
      ? "Passed"
      : m.failedStage
        ? `Held at ${m.failedStage}`
        : "Awaiting validation";
    q("#scenario-attempts").textContent = String(m.attempts).padStart(2, "0");
    q("#scenario-state").textContent = m.completed
      ? "Complete ✓"
      : m.flags.revoked || m.flags.contained || m.flags.quarantined
        ? "Contained · validate fix"
        : m.id === 3
          ? "Active credential exposure"
          : "Investigating";
    const tabs = q("#evidence-tabs");
    tabs.replaceChildren();
    s.evidence.forEach((e) => {
      const button = document.createElement("button");
      button.className = "secondary";
      button.textContent = `${e.title}${m.inspected.includes(e.id) ? " ✓" : ""}`;
      button.setAttribute("aria-pressed", String(evidenceId === e.id));
      button.onclick = () => {
        state = inspectEvidence(state!, e.id);
        evidenceId = e.id;
        sound("click");
        render();
        q("#evidence-code").focus();
      };
      tabs.append(button);
    });
    const evidence = s.evidence.find((e) => e.id === evidenceId);
    q("#evidence-title").textContent = evidence
      ? `${evidence.stage} / ${evidence.title}`
      : "Select an evidence source";
    q("#evidence-code").textContent = evidence
      ? evidenceText(m, evidence)
      : "No evidence inspected yet. Select a source above to investigate.";
    const flags = q("#system-flags");
    flags.replaceChildren();
    Object.entries(m.flags).forEach(([key, value]) => {
      const dt = document.createElement("dt");
      dt.textContent = key.replaceAll("-", " ");
      const dd = document.createElement("dd");
      dd.textContent = value ? "ON / recorded" : "OFF / invalidated";
      flags.append(dt, dd);
    });
    if (!flags.children.length)
      flags.textContent = "Baseline configuration. No changes applied.";
    const actions = q("#scenario-actions");
    actions.replaceChildren();
    s.actions.forEach((a) => {
      const row = document.createElement("div");
      row.className = "engineering-action" + (a.warning ? " risky" : "");
      row.dataset.action = a.id;
      row.tabIndex = -1;
      const button = document.createElement("button");
      button.textContent = a.label;
      button.className = a.warning ? "secondary" : "";
      const reason = blockedReason(m, a);
      button.disabled = !!reason;
      button.onclick = () => {
        state = act(state!, a.id, placement);
        if (["revoke", "contain", "rollback", "quarantine"].includes(a.id))
          setMusicMood("contained");
        sound(a.warning ? "warning" : "apply");
        render();
        q(`[data-action="${a.id}"]`).focus();
      };
      const detail = document.createElement("p");
      detail.textContent = a.detail;
      const requirement = document.createElement("small");
      requirement.textContent =
        reason ??
        (a.kind === "fix"
          ? `Apply at ${placement} / up to ${effortCost[placement]} effort (unchanged settings cost nothing)`
          : "Operational action / free");
      row.append(button, detail, requirement);
      actions.append(row);
    });
    q("#scenario-feedback").textContent = m.feedback;
    q("#scenario-feedback").tabIndex = -1;
    q("#scenario-log").textContent = m.log.join("\n");
    const pipeline = q("#scenario-pipeline");
    pipeline.replaceChildren();
    for (const stage of ["SOURCE", "BUILD", "TEST", "STAGE", "PROD"]) {
      const li = document.createElement("li");
      const line = m.log.find((l) => l.startsWith(stage + ":"));
      li.textContent = `${stage} / ${line?.includes("PASSED") ? "PASSED" : m.failedStage === stage ? "HELD" : "PENDING"}`;
      li.className = line?.includes("PASSED")
        ? "passed"
        : m.failedStage === stage
          ? "held"
          : "";
      pipeline.append(li);
    }
    q<HTMLButtonElement>("#scenario-run").disabled = m.completed;
    q("#scenario-summary").hidden = !m.completed;
    q("#scenario-learning").textContent =
      s.learning +
      ` Repair effort: ${m.effort}. Source-first comparison: ${m.interventions.filter((i) => i.cost > 0).length} illustrative units. Containment and recovery remain free.`;
    q("#scenario-next").textContent =
      m.id === 12 ? "Return to campaign →" : "Next mission →";
  }
  q("#scenario-run").onclick = () => {
    if (!state) return;
    state = runScenario(state);
    sound(state.completed ? "success" : "warning");
    render();
    if (state.completed) {
      setMusicMood("complete");
      markComplete(state.id);
      q("#scenario-summary").focus();
    }
  };
  q("#scenario-reset").onclick = () => {
    if (state) select(state.id);
  };
  q("#scenario-help").onclick = () => {
    const hint = q("#scenario-hint");
    hint.hidden = !hint.hidden;
    q("#scenario-help").setAttribute("aria-expanded", String(!hint.hidden));
  };
  q("#scenario-next").onclick = () => {
    if (state)
      select(playOrder[(playOrder.indexOf(state.id) + 1) % playOrder.length]);
  };
  const next = document.createElement("button");
  next.id = "mission-one-next";
  next.textContent = "Respond to The Leaked Secret →";
  next.onclick = () => select(3);
  q("#summary").append(next);
  // Mission 01 retains its existing engine and renderer; only completion is observed.
  new MutationObserver(() => {
    if (!q("#summary").hidden) markComplete(1);
  }).observe(q("#summary"), { attributes: true, attributeFilter: ["hidden"] });
  q("#start-secret").onclick = () => select(3);
  document.addEventListener("shift-left-secret", () => select(3));
  select(progress.selected, false);
}
