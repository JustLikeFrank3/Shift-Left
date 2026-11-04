import Phaser from "phaser";

export type PatchBurst = "repair" | "hurt" | "complete";

export interface PatchActor {
  /** World-positioned origin at the centre of the character; feet are at y + 34. */
  visual: Phaser.GameObjects.Container;
  update(
    time: number,
    delta: number,
    velocityX: number,
    onFloor: boolean,
  ): void;
  burst(kind: PatchBurst): void;
  destroy(): void;
}

const COLOR = {
  navy: 0x0c263b,
  blue: 0x19516c,
  screen: 0x061522,
  cyan: 0x58cde4,
  mint: 0x6af4cf,
  white: 0xf4fcff,
  arm: 0xbce9ee,
  coral: 0xffb19b,
};

type Expression = "happy" | "air" | "hurt" | "complete";

/** A purely visual PATCH rig. The caller owns movement, collisions, and gravity. */
export function createPatchActor(
  scene: Phaser.Scene,
  x: number,
  y: number,
): PatchActor {
  const visual = scene.add.container(x, y).setSize(52, 72);
  const shadow = scene.add.ellipse(0, 35, 35, 5, 0x04121e, 0.42);
  const effects = scene.add.graphics();
  const rig = scene.add.container(0, 0);
  visual.add([shadow, effects, rig]);

  const graphics = (parent: Phaser.GameObjects.Container) => {
    const result = scene.add.graphics();
    parent.add(result);
    return result;
  };

  const thruster = graphics(rig);
  const leftLeg = scene.add.container(-8, 21);
  const rightLeg = scene.add.container(8, 21);
  rig.add([leftLeg, rightLeg]);
  for (const leg of [leftLeg, rightLeg]) {
    const ink = graphics(leg);
    ink.lineStyle(5, COLOR.cyan, 1).lineBetween(0, 0, 0, 8);
    ink.fillStyle(COLOR.navy).fillRoundedRect(-5, 7, 12, 5, 2);
    ink.lineStyle(1.2, COLOR.cyan).strokeRoundedRect(-5, 7, 12, 5, 2);
    ink.lineStyle(1, COLOR.white, 0.65).lineBetween(-2, 9, 4, 9);
  }

  const leftArm = scene.add.container(-16, 6);
  const rightArm = scene.add.container(16, 6);
  rig.add([leftArm, rightArm]);
  for (const [arm, side] of [[leftArm, -1], [rightArm, 1]] as const) {
    const ink = graphics(arm);
    ink.fillStyle(COLOR.blue).fillCircle(0, 0, 4);
    ink.lineStyle(3.8, COLOR.arm).lineBetween(0, 0, side * 5, 10);
    ink.fillStyle(COLOR.cyan).fillCircle(side * 5, 11, 3.5);
    ink.fillStyle(COLOR.navy).fillCircle(side * 5, 11, 1.5);
  }

  const body = graphics(rig);
  body.fillStyle(COLOR.navy).fillRoundedRect(-14, 2, 28, 23, 7);
  body.fillStyle(COLOR.blue).fillRoundedRect(-12, 3, 24, 9, 5);
  body.lineStyle(1.3, COLOR.cyan).strokeRoundedRect(-14, 2, 28, 23, 7);
  body.lineStyle(1.6, COLOR.mint);
  body.strokePoints([{ x: -3, y: 9 }, { x: -7, y: 13 }, { x: -3, y: 17 }]);
  body.strokePoints([{ x: 3, y: 9 }, { x: 7, y: 13 }, { x: 3, y: 17 }]);
  body.fillStyle(COLOR.mint).fillCircle(0, 21, 1);

  const head = scene.add.container(0, -13);
  const antenna = scene.add.container(0, -16);
  rig.add(head);
  head.add(antenna);
  const antennaInk = graphics(antenna);
  antennaInk.lineStyle(2.3, COLOR.mint).lineBetween(0, 0, 0, -7);
  antennaInk.fillStyle(COLOR.mint).fillCircle(0, -8, 2.7);
  antennaInk.fillStyle(COLOR.white, 0.8).fillCircle(-0.7, -8.7, 0.8);
  const antennaGlow = scene.add.circle(0, -8, 5, COLOR.mint, 0.08);
  antenna.addAt(antennaGlow, 0);

  const headInk = graphics(head);
  headInk.fillStyle(COLOR.navy).fillRoundedRect(-22, -16, 44, 34, 11);
  headInk.fillStyle(COLOR.blue).fillRoundedRect(-20, -14, 40, 16, 9);
  headInk.lineStyle(1.4, COLOR.cyan).strokeRoundedRect(-22, -16, 44, 34, 11);
  headInk.lineStyle(0.8, COLOR.white, 0.22).lineBetween(-12, -13, 9, -13);
  headInk.fillStyle(COLOR.screen).fillRoundedRect(-17, -10, 34, 22, 7);
  headInk.fillStyle(COLOR.cyan, 0.3).fillCircle(-19, 1, 1);
  headInk.fillStyle(COLOR.cyan, 0.3).fillCircle(19, 1, 1);

  const eyes = scene.add.container(0, -2);
  head.add(eyes);
  const eyeInk = graphics(eyes);
  const mouthInk = graphics(head);
  let expression: Expression | undefined;

  const drawFace = (next: Expression) => {
    if (expression === next) return;
    expression = next;
    eyeInk.clear().lineStyle(2.1, COLOR.mint);
    mouthInk.clear().lineStyle(1.5, COLOR.white);
    if (next === "hurt") {
      for (const side of [-1, 1]) {
        eyeInk.strokePoints([
          { x: side * 11, y: -2 },
          { x: side * 6, y: 1 },
          { x: side * 11, y: 3 },
        ]);
      }
      mouthInk.strokePoints([
        { x: -4, y: 8 }, { x: -1, y: 6 },
        { x: 2, y: 8 }, { x: 5, y: 6 },
      ]);
    } else if (next === "air") {
      eyeInk.fillStyle(COLOR.mint);
      eyeInk.fillEllipse(-8, 0, 3.8, 6);
      eyeInk.fillEllipse(8, 0, 3.8, 6);
      mouthInk.strokeEllipse(0, 7, 4, 4);
    } else {
      for (const side of [-1, 1]) {
        eyeInk.strokePoints([
          { x: side * 8 - 3, y: 1 },
          { x: side * 8 - 2, y: -1 },
          { x: side * 8, y: -2 },
          { x: side * 8 + 2, y: -1 },
          { x: side * 8 + 3, y: 1 },
        ]);
      }
      mouthInk.strokePoints([
        { x: -4, y: 6 }, { x: -2, y: 8 },
        { x: 0, y: 8.5 }, { x: 2, y: 8 }, { x: 4, y: 6 },
      ]);
      if (next === "complete") {
        mouthInk.fillStyle(COLOR.mint, 0.5);
        mouthInk.fillCircle(-12, 6, 1.4).fillCircle(12, 6, 1.4);
      }
    }
  };
  drawFace("happy");

  const hurtOutline = graphics(rig);
  hurtOutline.lineStyle(2, COLOR.coral);
  hurtOutline.strokeRoundedRect(-23, -30, 46, 35, 11);
  hurtOutline.strokeRoundedRect(-15, 1, 30, 25, 7);
  hurtOutline.setAlpha(0);

  const motionQuery = typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : undefined;
  let reducedMotion = motionQuery?.matches ?? false;
  const motionChanged = (event: MediaQueryListEvent) => { reducedMotion = event.matches; };
  motionQuery?.addEventListener("change", motionChanged);

  let destroyed = false;
  let facing = 1;
  let walkPhase = 0;
  let elapsed = 0;
  let nextBlink = 2400;
  let activeBurst: PatchBurst | undefined;
  let burstStarted = 0;
  let burstDuration = 0;

  const drawBurst = (progress: number) => {
    effects.clear();
    if (!activeBurst) return;
    const color = activeBurst === "hurt" ? COLOR.coral : COLOR.mint;
    const fade = Math.sin(Math.PI * progress);
    const radius = reducedMotion ? 32 : 25 + progress * 28;
    effects.lineStyle(1.5, color, fade * 0.72).strokeCircle(0, -2, radius);
    if (activeBurst === "hurt") return;
    const count = activeBurst === "complete" ? 10 : 6;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const distance = reducedMotion ? 35 : 26 + progress * 32;
      const px = Math.cos(angle) * distance;
      const py = Math.sin(angle) * distance - 3;
      effects.lineStyle(1.5, i % 2 ? COLOR.cyan : COLOR.mint, fade);
      effects.lineBetween(px - 2.5, py, px + 2.5, py);
      effects.lineBetween(px, py - 2.5, px, py + 2.5);
    }
  };

  const update: PatchActor["update"] = (_time, delta, velocityX, onFloor) => {
    if (destroyed) return;
    // Clamp visual time after a suspended tab without altering the caller's physics.
    const dt = Math.max(0, Math.min(delta, 64));
    elapsed += dt;
    const speed = Math.min(Math.abs(velocityX) / 170, 1.4);
    const walking = speed > 0.04 && onFloor;
    if (Math.abs(velocityX) > 5) facing = velocityX < 0 ? -1 : 1;
    if (walking) walkPhase += dt * (0.009 + speed * 0.009);
    const stride = walking && !reducedMotion ? Math.sin(walkPhase) : 0;
    const idle = reducedMotion ? 0 : Math.sin(elapsed / 350);
    const burstAge = elapsed - burstStarted;
    if (activeBurst && burstAge >= burstDuration) {
      activeBurst = undefined;
      effects.clear();
    }
    const progress = activeBurst ? burstAge / burstDuration : 0;
    const victory = activeBurst === "complete";
    const repairing = activeBurst === "repair";
    const hurt = activeBurst === "hurt";
    const flourish = victory && !reducedMotion ? Math.sin(progress * Math.PI) : 0;

    rig.setScale(facing, 1);
    rig.y = reducedMotion ? 0 : onFloor
      ? walking ? -Math.abs(stride) * 1.6 : idle * 0.8
      : -1;
    rig.y -= flourish * 4;
    rig.rotation = reducedMotion ? 0 : hurt
      ? Math.sin(progress * Math.PI * 2) * 0.09
      : onFloor ? (walking ? speed * 0.045 * facing : 0) : -0.035 * facing;
    head.rotation = reducedMotion ? 0 : idle * 0.025;
    antenna.rotation = reducedMotion ? 0 : Math.sin(elapsed / 230) * 0.08;
    antennaGlow.setAlpha(repairing || victory ? 0.25 : reducedMotion ? 0.1 : 0.1 + (idle + 1) * 0.035);
    leftLeg.rotation = onFloor ? stride * 0.42 : -0.3;
    rightLeg.rotation = onFloor ? -stride * 0.42 : 0.35;
    leftLeg.y = 21 + (stride < 0 ? stride * 1.5 : 0);
    rightLeg.y = 21 + (stride > 0 ? -stride * 1.5 : 0);
    leftArm.rotation = !onFloor ? 0.75 : victory ? 1.8 : -stride * 0.45 + idle * 0.025;
    rightArm.rotation = !onFloor ? -0.75 : victory ? -1.8 : repairing ? -1.1 : stride * 0.45 - idle * 0.025;
    if (reducedMotion) {
      leftArm.rotation = victory ? 1.5 : 0;
      rightArm.rotation = victory ? -1.5 : repairing ? -0.8 : 0;
    }
    hurtOutline.setAlpha(hurt ? Math.sin(progress * Math.PI) * 0.8 : 0);
    shadow.setScale(onFloor ? 1 : 0.76, 1).setAlpha(onFloor ? 0.42 : 0.18);

    thruster.clear();
    if (!onFloor) {
      const flame = reducedMotion ? 8 : 8 + (Math.sin(elapsed / 33) + 1) * 3;
      thruster.fillStyle(COLOR.cyan, 0.24).fillTriangle(-7, 22, 7, 22, 0, 28 + flame);
      thruster.fillStyle(COLOR.mint, 0.8).fillTriangle(-4, 23, 4, 23, 0, 25 + flame * 0.65);
      thruster.fillStyle(COLOR.white, 0.9).fillEllipse(0, 24, 5, 3);
    }

    drawFace(hurt ? "hurt" : victory ? "complete" : !onFloor ? "air" : "happy");
    if (elapsed > nextBlink + 140) nextBlink = elapsed + 2600;
    eyes.scaleY = !reducedMotion && elapsed >= nextBlink && !hurt && !victory ? 0.12 : 1;
    if (activeBurst) drawBurst(progress);
  };

  const burst: PatchActor["burst"] = (kind) => {
    if (destroyed) return;
    activeBurst = kind;
    burstStarted = elapsed;
    burstDuration = kind === "complete" ? 1250 : kind === "repair" ? 720 : 450;
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    motionQuery?.removeEventListener("change", motionChanged);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, destroy);
    visual.destroy(true);
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, destroy);

  return { visual, update, burst, destroy };
}
