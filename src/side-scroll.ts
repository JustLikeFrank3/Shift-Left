import Phaser from "phaser";
import {
  scenario,
  scenarios,
  startScenario,
  inspectEvidence,
  evidenceText,
  blockedReason,
  act,
  runScenario,
  parseProgress,
  type CampaignMission,
  type Action,
  effortCost,
} from "./campaign";
import { type Stage } from "./mission";
import {
  stations,
  nearestStation,
  stationActions,
  stationEvidence,
  isContained,
  nextDestination,
  nextMission,
} from "./world-model";
import { createPatchActor } from "./patch-actor";
import { buildWorldArt } from "./world-art";
import { mountAudio, sound, setMusicMood } from "./sound";
import { mountDocChat } from "./doc-chat";
import "./side-scroll.css";

document.body.classList.add("play-mode");
const q = <T extends HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const app = q("#app");
app.innerHTML = `<div class="play-shell"><div id="world" aria-label="Side-scrolling delivery grid"></div>
<header class="play-top"><a class="brand" href="./">❯_ SHIFT LEFT<span>FIX TOMORROW’S BUGS YESTERDAY</span></a><div class="sector-heading"><span id="mission-number">INCIDENT 03</span><strong id="mission-title">The Leaked Secret</strong></div><button id="campaign-toggle" class="glass-button">Sectors ☰</button></header>
<div class="flight-hud"><div class="flight-objective"><span class="alert-dot"></span><div><span id="live-state">EXPOSURE ACTIVE</span><p id="objective-line"></p></div></div><div class="flight-stats"><span id="shield">◈ ◈ ◈</span><span id="signal-count">SIGNALS 00</span><span id="effort-count">EFFORT 00</span></div></div>
<nav class="world-minimap" aria-label="Pipeline navigation">${stations.map((s) => `<button data-travel="${s.stage}" aria-label="Travel to ${s.stage}"><span>${s.stage}</span><small>${effortCost[s.stage]}×</small><i></i></button>`).join("")}<span id="map-patch" aria-hidden="true">◆</span></nav>
<div id="station-prompt" class="station-prompt" hidden><span id="prompt-stage"></span><button id="interact-prompt"><kbd>E</kbd> <span id="prompt-label">Connect to terminal</span></button></div>
<div id="radio" class="radio" role="status" aria-live="polite"><img src="./characters/patch.svg" alt=""/><p id="radio-line">A credential is escaping the grid. Contain it, then trace the problem left.</p></div>
<div class="world-help"><span>← → / A D <b>MOVE</b></span><span>SPACE <b>JUMP</b></span><span>SHIFT <b>BOOST</b></span><span>E <b>CONNECT</b></span><span>F <b>PULSE</b></span><span>R <b>VALIDATE</b></span></div>
<div class="touch-controls" aria-label="Movement controls"><div><button data-hold="left" aria-label="Move left">←</button><button data-hold="right" aria-label="Move right">→</button></div><div><button id="touch-pulse" aria-label="Pulse">◎</button><button id="touch-jump" aria-label="Jump">↥</button><button id="touch-interact" aria-label="Connect to nearby terminal">E</button></div></div>
<section id="terminal" class="world-terminal" role="dialog" aria-modal="true" aria-labelledby="terminal-title" hidden><div class="terminal-head"><div><span id="terminal-sector"></span><h2 id="terminal-title"></h2></div><button id="terminal-close" aria-label="Disconnect terminal">✕</button></div><div class="terminal-content"><div id="terminal-evidence" class="terminal-evidence"></div><h3 id="evidence-heading"></h3><pre id="world-evidence"></pre><p id="terminal-cost"></p><div id="terminal-actions"></div><p id="terminal-feedback" role="status" aria-live="polite"></p></div><button id="terminal-run" class="terminal-run">▶ Validate repaired pipeline <kbd>R</kbd></button></section>
<section id="sector-menu" class="sector-menu" role="dialog" aria-modal="true" aria-label="Campaign sectors" hidden><div><p class="eyebrow">THE DELIVERY GRID</p><h2>Choose your next incident</h2><button id="menu-close" aria-label="Close sector menu">✕</button></div><p>Explore, contain, repair. Every sector is open for practice.</p><div id="sector-list">${scenarios.map((s) => `<button data-sector="${s.id}"><span>${String(s.id).padStart(2, "0")}</span>${s.title}<small>${s.id < 5 ? "APPRENTICE" : s.id < 9 ? "ENGINEER" : "ARCHITECT"}</small></button>`).join("")}</div><button id="controls-help" class="glass-button">30-second controls tutorial</button><small id="save-note"></small></section>
<section id="arrival" class="arrival"><p class="eyebrow">A SIGNAL IN THE DARK</p><h1>The live grid<br>is <em>bleeding.</em></h1><p>A secret just went public. You’re PATCH.<br>Contain the leak. Trace it left. Repair the system.</p><button id="enter-grid">Enter the grid <span>→</span></button><label><input id="start-music" type="checkbox" checked/> Play the original soundtrack</label><small>Move with A / D or arrows. Jump with Space. Connect with E.<br>Touch controls and click-to-travel navigation are available.</small></section>
<section id="mission-clear" class="mission-clear" role="dialog" aria-modal="true" aria-labelledby="clear-title" hidden><p class="eyebrow">✓ RELEASE RESTORED</p><h2 id="clear-title">The leak is contained.</h2><p id="clear-learning"></p><div id="clear-stats"></div><button id="next-sector">Next sector →</button><button id="replay-sector" class="glass-button">Explore this sector again</button></section>
<footer class="play-footer"><span>FICTIONAL SYSTEMS / REAL ENGINEERING HABITS</span><button id="validate-world" class="glass-button">Run pipeline <kbd>R</kbd></button></footer></div>`;
mountAudio();
let currentScene: DeliveryScene | undefined;
let docOpen = false;
const doc = mountDocChat(
  () => ({
    missionId: currentScene?.mission.id ?? 3,
    missionTitle: scenario(currentScene?.mission.id ?? 3).title,
    objective: scenario(currentScene?.mission.id ?? 3).objective,
    flags: { ...currentScene?.mission.flags },
    feedback: currentScene?.mission.feedback ?? "",
  }),
  (open: boolean) => {
    docOpen = open;
    if (open) {
      currentScene?.closeTerminal();
      q("#sector-menu").hidden = true;
    }
    currentScene?.stopMoving();
    if (currentScene?.input.keyboard) {
      currentScene.input.keyboard.resetKeys();
      currentScene.input.keyboard.enabled = !open;
    }
    if (!open && started)
      queueMicrotask(() => {
        if (docOpen) return;
        const focusTarget = !q("#sector-menu").hidden
          ? q("#menu-close")
          : !q("#mission-clear").hidden
            ? q("#next-sector")
            : !q("#terminal").hidden
              ? q("#terminal-close")
              : q("#world");
        focusTarget.focus();
      });
  },
);
let started = false;
const held = { left: false, right: false };
const progressKey = "shift-left-campaign-v1";
let progress = (() => {
  try {
    return parseProgress(localStorage.getItem(progressKey));
  } catch {
    return parseProgress(null);
  }
})();
function save() {
  try {
    localStorage.setItem(progressKey, JSON.stringify(progress));
    q("#save-note").textContent = "Progress saved on this device.";
  } catch {
    q("#save-note").textContent =
      "Storage unavailable. Your current session still works.";
  }
}
let startId = progress.selected >= 2 ? progress.selected : 3;
const snapshot = {
  missionId: startId,
  x: 0,
  y: 0,
  cameraX: 0,
  stage: "PROD",
  flags: {} as Record<string, boolean>,
  completed: false,
  effort: 0,
  signals: 0,
  panel: "arrival",
  moving: false,
  fps: 0,
};
Object.defineProperty(window, "__SHIFT_LEFT__", {
  get: () =>
    Object.freeze({ ...snapshot, flags: Object.freeze({ ...snapshot.flags }) }),
  configurable: true,
});
function announce(message: string) {
  q("#radio-line").textContent = message;
}
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

class DeliveryScene extends Phaser.Scene {
  mission: CampaignMission = startScenario(startId);
  player!: Phaser.Physics.Arcade.Image;
  actor!: ReturnType<typeof createPatchActor>;
  art!: ReturnType<typeof buildWorldArt>;
  kiosks: {
    station: (typeof stations)[number];
    visual: Phaser.GameObjects.Container;
    screen: Phaser.GameObjects.Rectangle;
    halo: Phaser.GameObjects.Arc;
    label: Phaser.GameObjects.Text;
  }[] = [];
  shards: Phaser.Physics.Arcade.Group | undefined;
  mites: {
    object: Phaser.Physics.Arcade.Image;
    origin: number;
    phase: number;
    activeAt: number;
  }[] = [];
  signalCount = 0;
  health = 3;
  hurtUntil = 0;
  lastPulse = 0;
  target: number | null = null;
  terminalStage: Stage | null = null;
  evidenceId = "";
  cinematic = false;
  spaceWasDown = false;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  lastHud = 0;
  deployment = 0;
  debtCore: Phaser.GameObjects.Container | undefined;
  constructor() {
    super("DeliveryGrid");
  }
  create() {
    currentScene = this;
    this.kiosks = [];
    this.mites = [];
    this.signalCount = 0;
    this.health = 3;
    this.hurtUntil = 0;
    this.lastPulse = 0;
    this.target = null;
    this.terminalStage = null;
    this.cinematic = false;
    this.spaceWasDown = false;
    this.lastHud = 0;
    this.debtCore = undefined;
    this.physics.resume();
    this.physics.world.setBounds(40, 0, 4120, 720);
    this.cameras.main.setBounds(0, 0, 4200, 720);
    this.cameras.main.setBackgroundColor("#06111c");
    this.art = buildWorldArt(this, 4200, 720);
    if (!this.textures.exists("body-pixel")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffffff).fillRect(0, 0, 1, 1);
      g.generateTexture("body-pixel", 1, 1);
      g.destroy();
    }
    for (const [key, w, h] of [
      ["patch-body", 38, 62],
      ["shard-body", 12, 12],
      ["mite-body", 28, 18],
    ] as const) {
      if (!this.textures.exists(key)) {
        const texture = this.make.graphics({ x: 0, y: 0 });
        texture
          .fillStyle(
            key === "shard-body"
              ? 0x85f2d0
              : key === "mite-body"
                ? 0xe78382
                : 0xffffff,
          )
          .fillRect(0, 0, w, h);
        texture.generateTexture(key, w, h);
        texture.destroy();
      }
    }
    const floor = this.physics.add.staticGroup();
    floor
      .create(2100, 610, "body-pixel")
      .setDisplaySize(4200, 40)
      .setVisible(false)
      .refreshBody();
    for (const [x, y, w] of [
      [720, 505, 140],
      [1570, 480, 150],
      [2450, 510, 160],
      [3320, 470, 150],
    ] as const) {
      const p = floor
        .create(x, y, "body-pixel")
        .setDisplaySize(w, 16)
        .refreshBody();
      p.setVisible(false);
      this.add.rectangle(x, y, w, 16, 0x1e5364).setDepth(3);
      this.add.rectangle(x, y - 7, w, 2, 0x75e9c8).setDepth(4);
      for (let i = -1; i <= 1; i++)
        this.add.rectangle(x + i * 42, y + 12, 4, 18, 0x183741).setDepth(2);
    }
    const spawn =
      this.mission.id === 3 || this.mission.id >= 9
        ? 3710
        : this.mission.id === 2
          ? 1110
          : 510;
    this.player = this.physics.add
      .image(spawn, 550, "patch-body")
      .setVisible(false);
    this.player.body!.setSize(38, 62);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, floor);
    this.actor = createPatchActor(this, spawn, 550);
    this.actor.visual.setDepth(15);
    this.cameras.main.startFollow(this.actor.visual, true, 0.1, 0.1, 0, 70);
    this.resize();
    this.scale.on("resize", this.resize, this);
    for (const station of stations) {
      const c = this.add.container(station.x, 590).setDepth(6);
      const halo = this.add
        .circle(0, -62, 45, 0x55e8c3, 0.04)
        .setStrokeStyle(1, 0x55e8c3, 0.2);
      const mast = this.add
        .rectangle(0, -42, 54, 84, 0x142e3d)
        .setStrokeStyle(2, 0x346574);
      const screen = this.add.rectangle(0, -63, 38, 25, 0x51d8bd, 0.8);
      const label = this.add
        .text(0, -130, station.stage, {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#8dedce",
          fontStyle: "bold",
          letterSpacing: 2,
        })
        .setOrigin(0.5);
      const name = this.add
        .text(0, -107, station.name, {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#92aebd",
        })
        .setOrigin(0.5);
      const base = this.add.rectangle(0, -4, 90, 8, 0x3a8c90);
      const lines = this.add
        .text(0, -65, ">_", {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#082b35",
        })
        .setOrigin(0.5);
      c.add([halo, mast, screen, label, name, base, lines]);
      this.kiosks.push({ station, visual: c, screen, halo, label });
      if (!reduced)
        this.tweens.add({
          targets: halo,
          alpha: 0.5,
          scale: 1.15,
          yoyo: true,
          repeat: -1,
          duration: 1700 + (station.x % 400),
        });
    }
    this.shards = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    });
    let n = 0;
    for (const x of [
      650, 720, 790, 1490, 1570, 1650, 2370, 2450, 2530, 3240, 3320, 3400,
    ]) {
      const y = n % 3 === 1 ? 380 : 465;
      const shard = this.shards.create(
        x,
        y,
        "shard-body",
      ) as Phaser.Physics.Arcade.Image;
      shard.setDisplaySize(12, 12).setTint(0x85f2d0).setAngle(45).setDepth(8);
      shard.body!.setSize(18, 18);
      if (!reduced)
        this.tweens.add({
          targets: shard,
          y: y - 12,
          angle: 225,
          yoyo: true,
          repeat: -1,
          duration: 1400,
        });
      n++;
    }
    this.physics.add.overlap(this.player, this.shards, (_p, obj) => {
      const s = obj as Phaser.Physics.Arcade.Image;
      if (!s.active) return;
      s.disableBody(true, true);
      this.signalCount++;
      this.ripple(s.x, s.y, 0x82e6c6);
      sound("click");
      this.updateHud();
    });
    for (let i = 0; i < 7; i++) {
      const x = 750 + i * 430;
      const object = this.physics.add
        .image(x, 575, "mite-body")
        .setTint(0xe78382)
        .setDepth(9);
      object.setImmovable(true);
      (object.body as Phaser.Physics.Arcade.Body).allowGravity = false;
      object.body!.setSize(28, 18);
      const eyes = this.add
        .text(x, 568, "• •", {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#fff2ce",
        })
        .setDepth(10);
      object.setData("eyes", eyes);
      this.mites.push({ object, origin: x, phase: i * 1.7, activeAt: 0 });
      this.physics.add.overlap(this.player, object, () => this.hurt(object));
    }
    if (this.mission.id === 12) {
      this.debtCore = this.add.container(3980, 350).setDepth(5);
      for (let i = 0; i < 8; i++) {
        const arm = this.add
          .rectangle(
            Math.cos((i * Math.PI) / 4) * 75,
            Math.sin((i * Math.PI) / 4) * 60,
            80,
            18,
            0x693a58,
          )
          .setAngle(i * 45);
        this.debtCore.add(arm);
      }
      this.debtCore.add([
        this.add.circle(0, 0, 75, 0x38263f).setStrokeStyle(3, 0xf0a1b2),
        this.add
          .text(0, -12, "TECH\nDEBT", {
            fontFamily: "monospace",
            fontSize: "20px",
            color: "#f1a5bb",
            align: "center",
          })
          .setOrigin(0.5),
      ]);
    }
    this.keys = this.input.keyboard!.addKeys(
      "A,D,W,SPACE,LEFT,RIGHT,UP,SHIFT,E,F,R,ESC,Q",
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on("keydown-E", () => {
      if (this.canControl()) this.connect();
    });
    this.input.keyboard!.on("keydown-F", () => {
      if (this.canControl()) this.pulse();
    });
    this.input.keyboard!.on("keydown-R", () => {
      if (started && !docOpen && !this.cinematic) this.validateRelease();
    });
    this.input.keyboard!.on("keydown-Q", () => {
      if (started) doc.setOpen(!docOpen);
    });
    this.input.keyboard!.on("keydown-ESC", () => {
      this.closeTerminal();
      q("#sector-menu").hidden = true;
      doc.setOpen(false);
    });
    this.events.once("shutdown", () => {
      this.art.shutdown();
      this.input.keyboard?.removeAllListeners();
      this.scale.off("resize", this.resize, this);
      held.left = held.right = false;
    });
    this.updateHud();
    announce(
      this.mission.id === 3
        ? "PATCH: There! The red terminal. Revoke the exposed credential before it escapes further."
        : scenario(this.mission.id).brief,
    );
  }
  resize() {
    this.cameras.main.setZoom(this.scale.height / 720);
  }
  canControl() {
    return (
      started &&
      !docOpen &&
      q("#sector-menu").hidden &&
      q("#mission-clear").hidden &&
      !this.terminalStage &&
      !this.cinematic
    );
  }
  stopMoving() {
    this.target = null;
    if (this.player) this.player.setVelocityX(0);
    held.left = held.right = false;
  }
  jump() {
    if (!this.canControl()) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down || body.touching.down) {
      this.player.setVelocityY(-650);
      sound("click");
    }
  }
  pulse() {
    if (!this.canControl() || this.time.now - this.lastPulse < 650) return;
    this.lastPulse = this.time.now;
    this.actor.burst("repair");
    this.ripple(this.player.x, this.player.y, 0x83f3d2, 130);
    for (const mite of this.mites) {
      if (mite.object.active && Math.abs(mite.object.x - this.player.x) < 190) {
        mite.activeAt = this.time.now + 5000;
        mite.object.disableBody(true, true);
        (mite.object.getData("eyes") as Phaser.GameObjects.Text).setVisible(
          false,
        );
        this.ripple(mite.object.x, mite.object.y, 0xf4c28c);
      }
    }
    sound("apply");
  }
  hurt(object: Phaser.Physics.Arcade.Image) {
    if (!this.canControl() || !object.active || this.time.now < this.hurtUntil)
      return;
    this.hurtUntil = this.time.now + 1600;
    this.health--;
    this.actor.burst("hurt");
    if (!reduced) this.cameras.main.shake(160, 0.003);
    this.player.setVelocityY(-230);
    sound("warning");
    if (this.health <= 0) {
      this.health = 3;
      const checkpoint = nearestStation(this.player.x);
      this.player.setPosition(checkpoint.x - 70, 530);
      announce(
        "PATCH: Back on our feet. Your investigation is safe. Pulse (F) clears nearby debt mites.",
      );
    } else
      announce(
        "PATCH: Debt mites! Jump over them or use a pulse (F). Your mission progress is safe.",
      );
    this.updateHud();
  }
  ripple(x: number, y: number, color: number, size = 70) {
    const circle = this.add
      .circle(x, y, 10)
      .setStrokeStyle(3, color, 0.9)
      .setDepth(20);
    this.tweens.add({
      targets: circle,
      radius: size,
      alpha: 0,
      duration: reduced ? 150 : 650,
      onComplete: () => circle.destroy(),
    });
  }
  connect() {
    if (!started || docOpen || this.cinematic) return;
    const station = nearestStation(this.player.x);
    if (Math.abs(station.x - this.player.x) > 180) {
      this.target = station.x - 65;
      announce(`PATCH: Heading to the ${station.stage} terminal.`);
      return;
    }
    this.openTerminal(station.stage);
  }
  openTerminal(stage: Stage) {
    this.stopMoving();
    this.terminalStage = stage;
    const evidence = stationEvidence(this.mission, stage);
    for (const e of evidence)
      this.mission = inspectEvidence(this.mission, e.id);
    this.evidenceId = evidence[0]?.id ?? "";
    this.renderTerminal();
    q("#terminal").hidden = false;
    q("#terminal-close").focus();
    this.updateHud();
    sound("click");
  }
  closeTerminal() {
    if (!this.terminalStage) return;
    this.terminalStage = null;
    q("#terminal").hidden = true;
    this.input.keyboard?.resetKeys();
    q("#world").focus();
  }
  renderTerminal() {
    if (!this.terminalStage) return;
    const stage = this.terminalStage;
    const station = stations.find((s) => s.stage === stage)!;
    q("#terminal-sector").textContent =
      `${stage} / ${effortCost[stage]}× REPAIR EFFORT`;
    q("#terminal-title").textContent = station.name;
    q("#terminal-cost").textContent =
      `Code fixes applied here cost ${effortCost[stage]} effort. Move LEFT to prevent problems earlier. Containment and investigation are free.`;
    const tabs = q("#terminal-evidence");
    tabs.replaceChildren();
    for (const e of stationEvidence(this.mission, stage)) {
      const button = document.createElement("button");
      button.textContent = e.title;
      button.setAttribute("aria-pressed", String(e.id === this.evidenceId));
      button.onclick = () => {
        this.evidenceId = e.id;
        this.renderTerminal();
        sound("click");
      };
      tabs.append(button);
    }
    const e = scenario(this.mission.id).evidence.find(
      (e) => e.id === this.evidenceId,
    );
    q("#evidence-heading").textContent = e?.title ?? "Maintenance access";
    q("#world-evidence").textContent = e
      ? evidenceText(this.mission, e)
      : "No local finding. Apply a source fix here, or travel to the highlighted investigation terminal.";
    const actions = q("#terminal-actions");
    actions.replaceChildren();
    const available = stationActions(this.mission, stage);
    for (const a of available) {
      const reason = blockedReason(this.mission, a);
      const button = document.createElement("button");
      button.className = "world-action" + (a.warning ? " danger-action" : "");
      button.dataset.action = a.id;
      button.disabled = !!reason;
      const label = document.createElement("strong");
      label.textContent = a.label;
      const detail = document.createElement("small");
      detail.textContent =
        reason ??
        (a.kind === "fix"
          ? `Repair at ${stage} • ${effortCost[stage]} effort`
          : "Operational action • free");
      button.append(label, detail);
      button.title = a.detail;
      button.onclick = () => this.applyAction(a, stage);
      actions.append(button);
    }
    q("#terminal-feedback").textContent = this.mission.feedback;
    q<HTMLButtonElement>("#terminal-run").disabled = this.mission.completed;
  }
  applyAction(action: Action, stage: Stage) {
    const before = { ...this.mission.flags };
    this.mission = act(this.mission, action.id, stage);
    this.actor.burst(action.warning ? "hurt" : "repair");
    this.ripple(this.player.x, 550, action.warning ? 0xee8b94 : 0x73e8c8);
    sound(action.warning ? "warning" : "apply");
    if (
      (!before.revoked && this.mission.flags.revoked) ||
      (!before.contained && this.mission.flags.contained) ||
      (!before.quarantined && this.mission.flags.quarantined)
    ) {
      setMusicMood("contained");
      announce(
        "PATCH: Contained. Now we can repair the cause. Follow the pipeline LEFT.",
      );
    } else announce(this.mission.feedback);
    this.updateHud();
    this.renderTerminal();
  }
  validateRelease() {
    if (this.cinematic || !started || docOpen) return;
    this.closeTerminal();
    this.stopMoving();
    this.mission = runScenario(this.mission);
    this.updateHud();
    if (!this.mission.completed) {
      sound("warning");
      announce(this.mission.feedback);
      this.actor.burst("hurt");
      if (!reduced) this.cameras.main.shake(130, 0.002);
      return;
    }
    this.cinematic = true;
    this.deployment = 1;
    this.physics.pause();
    setMusicMood("complete");
    sound("success");
    announce("PATCH: All gates passed. Ride the release to production!");
    this.actor.burst("complete");
    this.tweens.add({
      targets: this.actor.visual,
      x: 3820,
      y: 545,
      duration: reduced
        ? 250
        : Math.max(
            1700,
            Math.min(4200, Math.abs(this.actor.visual.x - 3820) * 1.1),
          ),
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.player.setPosition(3820, 545);
        (this.player.body as Phaser.Physics.Arcade.Body).reset(3820, 545);
        this.physics.resume();
        this.cinematic = false;
        this.actor.burst("complete");
        this.ripple(3820, 490, 0x8df1c7, 220);
        progress.selected = this.mission.id;
        if (!progress.completed.includes(this.mission.id))
          progress.completed.push(this.mission.id);
        save();
        q("#clear-title").textContent =
          this.mission.id === 3
            ? "The leak is contained."
            : this.mission.id === 12
              ? "TECH DEBT is defeated."
              : "A safer release. A brighter grid.";
        q("#clear-learning").textContent = scenario(this.mission.id).learning;
        q("#clear-stats").textContent =
          `${this.signalCount} SIGNALS RECOVERED / ${this.mission.effort} REPAIR EFFORT / ${this.mission.attempts} VALIDATION RUNS`;
        q("#mission-clear").hidden = false;
        q("#next-sector").focus();
        this.updateHud();
      },
    });
  }
  updateHud() {
    const s = scenario(this.mission.id);
    q("#mission-number").textContent =
      `INCIDENT ${String(this.mission.id).padStart(2, "0")} / ${this.mission.id < 5 ? "APPRENTICE" : this.mission.id < 9 ? "ENGINEER" : "ARCHITECT"}`;
    q("#mission-title").textContent = s.title;
    q("#live-state").textContent = this.mission.completed
      ? "RELEASE RESTORED"
      : isContained(this.mission)
        ? "CONTAINED / TRACE THE CAUSE"
        : this.mission.id === 3
          ? "CREDENTIAL EXPOSURE ACTIVE"
          : "RELEASE HELD";
    q("#objective-line").textContent = nextDestination(
      this.mission,
    ).instruction;
    q("#shield").textContent = Array.from({ length: 3 }, (_, i) =>
      i < this.health ? "◈" : "◇",
    ).join(" ");
    q("#signal-count").textContent =
      `SIGNALS ${String(this.signalCount).padStart(2, "0")}`;
    q("#effort-count").textContent =
      `EFFORT ${String(this.mission.effort).padStart(2, "0")}`;
    q<HTMLButtonElement>("#validate-world").disabled = this.mission.completed;
    const stage = this.player ? nearestStation(this.player.x).stage : "PROD";
    for (const b of document.querySelectorAll<HTMLButtonElement>(
      "[data-travel]",
    )) {
      b.classList.toggle("here", b.dataset.travel === stage);
      b.classList.toggle(
        "destination",
        b.dataset.travel === nextDestination(this.mission).stage,
      );
      b.classList.toggle(
        "repaired",
        this.mission.completed ||
          this.mission.log.some(
            (line) => line === `${b.dataset.travel}: PASSED`,
          ),
      );
    }
    document.body.classList.toggle("contained", isContained(this.mission));
  }
  update(time: number, delta: number) {
    if (!this.player) return;
    this.art.update(time, delta, isContained(this.mission));
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (this.canControl()) {
      let direction =
        held.left || this.keys.A.isDown || this.keys.LEFT.isDown
          ? -1
          : held.right || this.keys.D.isDown || this.keys.RIGHT.isDown
            ? 1
            : 0;
      if (direction) this.target = null;
      else if (this.target !== null) {
        const d = this.target - this.player.x;
        if (Math.abs(d) < 18) {
          this.target = null;
          direction = 0;
        } else direction = Math.sign(d);
      }
      this.player.setVelocityX(
        direction *
          (this.keys.SHIFT.isDown || this.target !== null ? 465 : 315),
      );
      const jump =
        this.keys.SPACE.isDown || this.keys.W.isDown || this.keys.UP.isDown;
      if (jump && !this.spaceWasDown) this.jump();
      this.spaceWasDown = jump;
      if (
        this.target !== null &&
        this.mites.some(
          (m) => m.object.active && Math.abs(m.object.x - this.player.x) < 140,
        ) &&
        body.blocked.down
      )
        this.jump();
    } else if (!this.cinematic) this.player.setVelocityX(0);
    if (!this.cinematic)
      this.actor.visual.setPosition(this.player.x, this.player.y);
    this.actor.update(
      time,
      delta,
      this.cinematic ? 360 : body.velocity.x,
      body.blocked.down || body.touching.down,
    );
    for (const m of this.mites) {
      if (isContained(this.mission) && m.origin > 3200) {
        m.object.disableBody(true, true);
        (m.object.getData("eyes") as Phaser.GameObjects.Text).setVisible(false);
        continue;
      }
      if (!m.object.active && time > m.activeAt)
        m.object.enableBody(true, m.origin, 575, true, true);
      if (m.object.active) {
        m.object.setX(m.origin + Math.sin(time * 0.0013 + m.phase) * 85);
        (m.object.getData("eyes") as Phaser.GameObjects.Text)
          .setPosition(m.object.x - 10, m.object.y - 8)
          .setVisible(true);
        m.object.setAngle(Math.sin(time * 0.005 + m.phase) * 8);
      }
    }
    const nearest = nearestStation(this.player.x);
    const near = Math.abs(nearest.x - this.player.x) < 180;
    q("#station-prompt").hidden = !near || !this.canControl();
    q("#prompt-stage").textContent = nearest.stage;
    q("#prompt-label").textContent =
      nearest.stage === "PROD" &&
      this.mission.id === 3 &&
      !this.mission.flags.revoked
        ? "Contain exposed credential"
        : "Connect to terminal";
    for (const k of this.kiosks) {
      const done =
        this.mission.completed ||
        this.mission.log.some((line) => line === `${k.station.stage}: PASSED`);
      k.screen.setFillStyle(
        k.station.stage === "PROD" && !isContained(this.mission)
          ? 0xe87e87
          : done
            ? 0x7cedba
            : 0x50c5d5,
      );
      k.halo.setStrokeStyle(
        near && nearest.stage === k.station.stage ? 3 : 1,
        done ? 0x8cf3b9 : 0x61dcd5,
        near && nearest.stage === k.station.stage ? 0.8 : 0.25,
      );
    }
    if (this.debtCore) {
      const resolved = [
        "secrets",
        "tests",
        "dependencies",
        "recovery",
        "enforced",
      ].filter((f) => this.mission.flags[f]).length;
      this.debtCore.setScale(Math.max(0.15, 1 - resolved * 0.15));
      this.debtCore.setAngle(Math.sin(time * 0.0005) * 5);
    }
    const percent = Math.max(
      0,
      Math.min(1, (this.player.x - 380) / (3820 - 380)),
    );
    q("#map-patch").style.left = `${percent * 90 + 5}%`;
    Object.assign(snapshot, {
      missionId: this.mission.id,
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      cameraX: Math.round(this.cameras.main.scrollX),
      stage: nearest.stage,
      flags: { ...this.mission.flags },
      completed: this.mission.completed,
      effort: this.mission.effort,
      signals: this.signalCount,
      panel: docOpen
        ? "doc"
        : this.terminalStage
          ? "terminal"
          : !q("#mission-clear").hidden
            ? "complete"
            : !started
              ? "arrival"
              : "world",
      moving: Math.abs(body.velocity.x) > 2,
      fps: Math.round(this.game.loop.actualFps),
    });
    if (time - this.lastHud > 180) {
      this.lastHud = time;
      this.updateHud();
    }
  }
}
const game = new Phaser.Game({
  type: Phaser.CANVAS,
  fps: { target: 60, smoothStep: false },
  parent: "world",
  backgroundColor: "#06111c",
  width: innerWidth,
  height: innerHeight,
  scale: { mode: Phaser.Scale.RESIZE },
  physics: {
    default: "arcade",
    arcade: { gravity: { x: 0, y: 1450 }, debug: false },
  },
  scene: [DeliveryScene],
  banner: false,
  audio: { noAudio: true },
  render: { antialias: true, roundPixels: true },
});
q("#world").tabIndex = 0;
function changeMission(id: number) {
  doc.setOpen(false);
  q("#terminal").hidden = true;
  q("#mission-clear").hidden = true;
  q("#sector-menu").hidden = true;
  startId = id;
  progress.selected = id;
  save();
  currentScene?.scene.restart();
  currentScene!.mission = startScenario(id);
  setMusicMood([3, 9, 10, 11].includes(id) ? "incident" : "investigate");
}
q("#enter-grid").onclick = () => {
  started = true;
  q("#arrival").hidden = true;
  if (q<HTMLInputElement>("#start-music").checked)
    q<HTMLButtonElement>("#sound-toggle").click();
  setMusicMood("incident");
  q("#world").focus();
  sound("patch");
};
q("#campaign-toggle").onclick = () => {
  if (!started) return;
  doc.setOpen(false);
  currentScene?.stopMoving();
  q("#sector-menu").hidden = !q("#sector-menu").hidden;
  if (!q("#sector-menu").hidden) q("#menu-close").focus();
};
q("#menu-close").onclick = () => {
  q("#sector-menu").hidden = true;
};
q("#controls-help").onclick = () => {
  q("#sector-menu").hidden = true;
  announce(
    "PATCH: A/D or arrows move. Space jumps. F clears debt mites. E connects nearby terminals. R validates. Tap a pipeline stage to travel there.",
  );
};
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-sector]",
))
  button.onclick = () => changeMission(Number(button.dataset.sector));
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-travel]",
))
  button.onclick = () => {
    if (!currentScene?.canControl()) return;
    currentScene.target =
      stations.find((s) => s.stage === button.dataset.travel)!.x - 65;
    announce(
      `PATCH: Moving ${button.dataset.travel === "SOURCE" ? "LEFT toward the source" : `to ${button.dataset.travel}`}. You can steer with A/D at any time.`,
    );
  };
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-hold]",
)) {
  const key = button.dataset.hold as keyof typeof held;
  button.onpointerdown = (e) => {
    if (!currentScene?.canControl()) return;
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    held[key] = true;
  };
  button.onpointerup = () => (held[key] = false);
  button.onpointercancel = () => (held[key] = false);
  button.onlostpointercapture = () => (held[key] = false);
}
q("#touch-jump").onclick = () => currentScene?.jump();
q("#touch-pulse").onclick = () => currentScene?.pulse();
q("#touch-interact").onclick = q("#interact-prompt").onclick = () =>
  currentScene?.connect();
q("#terminal-close").onclick = () => currentScene?.closeTerminal();
q("#terminal-run").onclick = q("#validate-world").onclick = () =>
  currentScene?.validateRelease();
q("#next-sector").onclick = () =>
  changeMission(nextMission(currentScene!.mission.id));
q("#replay-sector").onclick = () => changeMission(currentScene!.mission.id);
window.addEventListener("blur", () => currentScene?.stopMoving());
// Modal keyboard focus stays inside the currently open game panel.
document.addEventListener(
  "keydown",
  (event) => {
    const panel = docOpen
      ? null
      : !q("#terminal").hidden
        ? q("#terminal")
        : !q("#sector-menu").hidden
          ? q("#sector-menu")
          : !q("#mission-clear").hidden
            ? q("#mission-clear")
            : !q("#arrival").hidden
              ? q("#arrival")
              : null;
    if (event.key === "Tab" && panel) {
      const buttons = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,textarea,[tabindex="0"]',
        ),
      ).filter((b) => !b.hidden);
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  },
  true,
);

// Native text/range inputs keep their own keys, including spaces and arrows.
document.addEventListener("focusin", (event) => {
  if (
    (event.target as HTMLElement).matches("input,textarea,select") &&
    currentScene?.input.keyboard
  ) {
    currentScene.stopMoving();
    currentScene.input.keyboard.resetKeys();
    currentScene.input.keyboard.enabled = false;
  }
});
document.addEventListener("focusout", () =>
  queueMicrotask(() => {
    if (currentScene?.input.keyboard)
      currentScene.input.keyboard.enabled =
        !docOpen &&
        !(document.activeElement as HTMLElement)?.matches(
          "input,textarea,select",
        );
  }),
);
