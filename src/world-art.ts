import Phaser from "phaser";

/** Decorative scenery only. All geometry is deliberately independent of Arcade physics. */
export interface WorldArt {
  update(time: number, delta: number, contained: boolean): void;
  shutdown(): void;
}

let artId = 0;

const seeded = (seed: number) => () => {
  seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
  return seed / 4294967296;
};

const line = (
  ctx: CanvasRenderingContext2D,
  points: readonly (readonly [number, number])[],
  color: string,
  width = 1,
) => {
  ctx.beginPath();
  points.forEach(([x, y], index) =>
    index ? ctx.lineTo(x, y) : ctx.moveTo(x, y),
  );
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
};

const tube = (
  ctx: CanvasRenderingContext2D,
  points: readonly (readonly [number, number])[],
  color = "#40c8bd",
) => {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  line(ctx, points, "#030d16", 17);
  line(ctx, points, "#1b3845", 12);
  line(ctx, points, "#29525a", 8);
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 13;
  line(ctx, points, color, 2);
  ctx.restore();
};

/**
 * A miniature industrial city behind the delivery floor. Canvas layers are baked
 * once, in modest texture strips; only fans, status lights, dust and sparks move.
 */
export function buildWorldArt(
  scene: Phaser.Scene,
  worldWidth: number,
  worldHeight: number,
): WorldArt {
  const floorY = 590;
  const prefix = `shift-world-${artId++}`;
  const objects: Phaser.GameObjects.GameObject[] = [];
  const textures: string[] = [];
  const viewportWidth = Math.max(960, scene.scale.gameSize.width);
  const media =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : undefined;
  let reducedMotion = media?.matches ?? false;
  let stopped = false;
  let elapsed = 0;
  let previousContained: boolean | undefined;
  const own = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
    objects.push(object);
    return object;
  };

  const bake = (
    name: string,
    width: number,
    height: number,
    paint: (ctx: CanvasRenderingContext2D) => void,
  ) => {
    const key = `${prefix}-${name}`;
    const texture = scene.textures.createCanvas(
      key,
      Math.ceil(width),
      Math.ceil(height),
    );
    if (!texture) throw new Error("Unable to create world scenery texture");
    paint(texture.getContext());
    texture.refresh();
    textures.push(key);
    return key;
  };

  const layer = (
    name: string,
    depth: number,
    scrollFactor: number,
    paint: (ctx: CanvasRenderingContext2D, width: number) => void,
  ) => {
    const width =
      scrollFactor === 1
        ? worldWidth
        : Math.ceil(viewportWidth + worldWidth * scrollFactor + 160);
    // Remain within small mobile GPU texture limits, including the 4,200px floor.
    for (let x = 0; x < width; x += 1536) {
      const stripWidth = Math.min(1536, width - x);
      const key = bake(`${name}-${x}`, stripWidth, worldHeight, (ctx) => {
        ctx.translate(-x, 0);
        paint(ctx, width);
      });
      own(
        scene.add
          .image(x, 0, key)
          .setOrigin(0)
          .setDepth(depth)
          .setScrollFactor(
            scrollFactor,
            scrollFactor === 0 ? 0 : Math.min(1, scrollFactor + 0.2),
          ),
      );
    }
  };

  layer("atmosphere", -100, 0, (ctx, width) => {
    const sky = ctx.createLinearGradient(0, 0, 0, worldHeight);
    sky.addColorStop(0, "#050c17");
    sky.addColorStop(0.42, "#102531");
    sky.addColorStop(0.8, "#13303a");
    sky.addColorStop(1, "#07131e");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, worldHeight);
    const glow = ctx.createRadialGradient(610, 290, 30, 610, 290, 530);
    glow.addColorStop(0, "rgba(50,126,139,.16)");
    glow.addColorStop(1, "rgba(6,18,30,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, worldHeight);
    const random = seeded(19);
    for (let i = 0; i < 65; i++) {
      const x = random() * width;
      const y = 80 + random() * 340;
      ctx.fillStyle = `rgba(132,197,208,${0.08 + random() * 0.13})`;
      ctx.fillRect(x, y, 1, 1 + random() * 2);
    }
    // Fine glass lines suggest a view through an immense control-room window.
    for (let x = 75; x < width; x += 310) {
      line(
        ctx,
        [
          [x, 0],
          [x, 520],
        ],
        "rgba(67,113,128,.1)",
      );
      line(
        ctx,
        [
          [x + 3, 0],
          [x + 3, 520],
        ],
        "rgba(0,9,19,.22)",
        3,
      );
    }
    line(
      ctx,
      [
        [0, 164],
        [width, 164],
      ],
      "rgba(78,120,135,.07)",
    );
  });

  layer("distant-city", -90, 0.12, (ctx, width) => {
    const random = seeded(72);
    for (let x = -40; x < width; x += 54 + random() * 44) {
      const w = 39 + random() * 66;
      const h = 110 + random() * 290;
      const top = 550 - h;
      ctx.fillStyle = random() > 0.5 ? "#10222e" : "#0c202c";
      ctx.fillRect(x, top, w, h);
      ctx.fillStyle = "#152d37";
      ctx.fillRect(x + 6, top - 8, w - 12, 8);
      if (h > 270) {
        line(
          ctx,
          [
            [x + w / 2, top],
            [x + w / 2, top - 34],
          ],
          "#22404a",
        );
        ctx.fillStyle = "#5b8f91";
        ctx.fillRect(x + w / 2 - 1, top - 34, 2, 2);
      }
      for (let yy = top + 15; yy < 530; yy += 16) {
        for (let xx = x + 9; xx < x + w - 6; xx += 12) {
          if (random() > 0.43) {
            ctx.fillStyle = random() > 0.87 ? "#5b6554" : "#22474f";
            ctx.fillRect(xx, yy, 3, 4);
          }
        }
      }
      line(
        ctx,
        [
          [x + w, top + 3],
          [x + w, 550],
        ],
        "#193440",
      );
    }
    const haze = ctx.createLinearGradient(0, 370, 0, 580);
    haze.addColorStop(0, "rgba(22,57,66,0)");
    haze.addColorStop(1, "rgba(30,71,77,.65)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 370, width, 210);
    line(
      ctx,
      [
        [0, 548],
        [width, 548],
      ],
      "rgba(81,161,161,.22)",
      2,
    );
  });

  layer("rack-city", -76, 0.34, (ctx, width) => {
    const random = seeded(321);
    for (let x = -55; x < width; x += 114 + random() * 55) {
      const w = 75 + random() * 48;
      const top = 165 + random() * 170;
      ctx.fillStyle = "#091925";
      ctx.fillRect(x, top, w, 590 - top);
      ctx.fillStyle = "#15313c";
      ctx.fillRect(x, top, w, 5);
      ctx.fillRect(x, top, 4, 590 - top);
      ctx.fillStyle = "#0e2632";
      ctx.fillRect(x + 8, top + 11, w - 16, 580 - top);
      line(
        ctx,
        [
          [x + w - 5, top + 8],
          [x + w - 5, 580],
        ],
        "#21404a",
      );
      for (let y = top + 18; y < 567; y += 22) {
        ctx.fillStyle = "#081b27";
        ctx.fillRect(x + 13, y, w - 26, 15);
        line(
          ctx,
          [
            [x + 17, y + 5],
            [x + w - 29, y + 5],
          ],
          "#203c47",
        );
        line(
          ctx,
          [
            [x + 17, y + 9],
            [x + w - 29, y + 9],
          ],
          "#152e3a",
        );
        ctx.fillStyle = random() > 0.8 ? "#8a7752" : "#3b8888";
        ctx.fillRect(x + w - 22, y + 5, 3, 3);
        if (random() > 0.6) {
          ctx.fillStyle = "#295764";
          ctx.fillRect(x + w - 29, y + 5, 3, 3);
        }
      }
      // Ducts and external braces break up the rectangular rack silhouettes.
      line(
        ctx,
        [
          [x + w / 2, top],
          [x + w / 2, top - 22],
          [x + w + 30, top - 22],
        ],
        "#152e39",
        7,
      );
      ctx.fillStyle = "#183640";
      ctx.fillRect(x + w / 2 - 5, top - 26, 10, 8);
    }
    ctx.fillStyle = "rgba(6,19,29,.34)";
    ctx.fillRect(0, 420, width, 170);
  });

  layer("superstructure", -63, 0.68, (ctx, width) => {
    ctx.fillStyle = "#07131e";
    ctx.fillRect(0, 0, width, 48);
    ctx.fillStyle = "#19313e";
    ctx.fillRect(0, 45, width, 13);
    ctx.fillStyle = "#0a1925";
    ctx.fillRect(0, 58, width, 28);
    line(
      ctx,
      [
        [0, 87],
        [width, 87],
      ],
      "#244451",
      2,
    );
    for (let x = -180; x < width; x += 390) {
      ctx.fillStyle = "#102633";
      ctx.beginPath();
      ctx.moveTo(x, 54);
      ctx.lineTo(x + 110, 54);
      ctx.lineTo(x + 28, 150);
      ctx.lineTo(x, 150);
      ctx.closePath();
      ctx.fill();
      line(
        ctx,
        [
          [x + 15, 67],
          [x + 78, 67],
          [x + 15, 137],
        ],
        "#29434e",
        2,
      );
      ctx.fillStyle = "#27424b";
      for (let i = 0; i < 4; i++) ctx.fillRect(x + 8 + i * 22, 48, 3, 3);
      // Slack cable bundles, with different lengths and drop points.
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 90 + i * 7, 68);
        ctx.bezierCurveTo(
          x + 135,
          216 + i * 16,
          x + 275,
          163 + i * 19,
          x + 318,
          79,
        );
        ctx.strokeStyle = i === 1 ? "#1b3944" : "#07121c";
        ctx.lineWidth = i === 1 ? 2 : 4;
        ctx.stroke();
      }
      ctx.fillStyle = "#224651";
      ctx.fillRect(x + 257, 73, 45, 7);
      ctx.save();
      ctx.shadowColor = "#79e2d9";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#69aaa9";
      ctx.fillRect(x + 262, 79, 35, 2);
      ctx.restore();
    }
    // Light shafts are deliberately faint enough to keep foreground text clear.
    for (let x = 180; x < width; x += 660) {
      const light = ctx.createLinearGradient(0, 90, 0, 560);
      light.addColorStop(0, "rgba(103,202,196,.045)");
      light.addColorStop(1, "rgba(103,202,196,0)");
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.moveTo(x, 88);
      ctx.lineTo(x + 40, 88);
      ctx.lineTo(x + 180, 570);
      ctx.lineTo(x - 80, 570);
      ctx.closePath();
      ctx.fill();
    }
  });

  const fans = [895, 1690, 2510, 3320].filter((x) => x < worldWidth - 100);
  layer("service-wall", -46, 1, (ctx, width) => {
    const posts = [72, 785, 1610, 2525, 3370, width - 62];
    for (const x of posts) {
      const post = ctx.createLinearGradient(x - 15, 0, x + 15, 0);
      post.addColorStop(0, "#081620");
      post.addColorStop(0.5, "#1c3440");
      post.addColorStop(1, "#0b1b27");
      ctx.fillStyle = post;
      ctx.fillRect(x - 15, 87, 30, floorY - 87);
      line(
        ctx,
        [
          [x - 13, 88],
          [x - 13, floorY],
        ],
        "#284650",
      );
      for (let y = 112; y < floorY; y += 85) {
        ctx.fillStyle = "#263f49";
        ctx.fillRect(x - 19, y, 38, 8);
        ctx.fillStyle = "#526268";
        ctx.fillRect(x - 13, y + 2, 2, 2);
        ctx.fillRect(x + 10, y + 2, 2, 2);
      }
    }
    const stations = [380, 1200, 2100, 2950, 3820];
    stations.forEach((x, i) => {
      if (x > width) return;
      // Architectural bay marks sit above the interactable station signage.
      ctx.font = "700 56px monospace";
      ctx.fillStyle = "rgba(73,121,132,.14)";
      ctx.fillText(`0${i + 1}`, x - 91, 205);
      ctx.fillStyle = "#3b616c";
      ctx.font = "9px monospace";
      ctx.fillText("DELIVERY SECTOR", x - 88, 222);
      line(
        ctx,
        [
          [x - 89, 235],
          [x + 83, 235],
        ],
        "#1f3f4c",
      );
      for (let n = 0; n < 10; n++) {
        ctx.fillStyle = n < 3 ? "#31646c" : "#142f3b";
        ctx.fillRect(x - 88 + n * 17, 247, 11, 2);
      }
      // A service panel at ground level adds depth below the machine silhouette.
      ctx.fillStyle = "#0b1d29";
      ctx.fillRect(x - 127, 484, 254, 102);
      ctx.strokeStyle = "#1c3946";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 127, 484, 254, 102);
      for (let j = 0; j < 8; j++)
        line(
          ctx,
          [
            [x - 111, 499 + j * 9],
            [x - 62, 499 + j * 9],
          ],
          "#23414c",
          2,
        );
      ctx.font = "8px monospace";
      ctx.fillStyle = "#365765";
      ctx.fillText(`SL / 2${i} — SERVICE ACCESS`, x - 34, 574);
    });
    fans.forEach((x) => {
      const y = 284;
      ctx.fillStyle = "#07151f";
      ctx.fillRect(x - 62, y - 62, 124, 124);
      ctx.strokeStyle = "#26444f";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 62, y - 62, 124, 124);
      ctx.strokeStyle = "#1b3743";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(x, y, 50, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#31505a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 57, 0, Math.PI * 2);
      ctx.stroke();
      for (const dx of [-54, 54])
        for (const dy of [-54, 54]) {
          ctx.fillStyle = "#4a6269";
          ctx.fillRect(x + dx - 1, y + dy - 1, 3, 3);
        }
      ctx.font = "8px monospace";
      ctx.fillStyle = "#3e626d";
      ctx.fillText("AIRFLOW / AUTO", x - 43, y + 79);
    });
  });

  const rotors = fans.map((x, index) => {
    const rotor = own(scene.add.graphics().setPosition(x, 284).setDepth(-44));
    rotor.fillStyle(0x1d3a46, 1);
    for (let n = 0; n < 5; n++) {
      const a = (n * Math.PI * 2) / 5;
      rotor.beginPath();
      rotor.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
      rotor.lineTo(Math.cos(a + 0.12) * 44, Math.sin(a + 0.12) * 44);
      rotor.lineTo(Math.cos(a + 0.62) * 39, Math.sin(a + 0.62) * 39);
      rotor.lineTo(Math.cos(a + 0.86) * 13, Math.sin(a + 0.86) * 13);
      rotor.closePath();
      rotor.fillPath();
    }
    rotor.fillStyle(0x345561);
    rotor.fillCircle(0, 0, 11);
    rotor.fillStyle(0x0b202c);
    rotor.fillCircle(0, 0, 5);
    rotor.rotation = index * 0.7;
    return rotor;
  });

  layer("conduits", -25, 1, (ctx, width) => {
    // A continuous luminous route makes the left-to-right delivery direction visible.
    tube(ctx, [
      [0, 522],
      [164, 522],
      [190, 546],
      [650, 546],
      [674, 522],
      [1005, 522],
      [1035, 546],
      [1435, 546],
      [1465, 522],
      [1900, 522],
      [1930, 546],
      [2300, 546],
      [2330, 522],
      [2780, 522],
      [2810, 546],
      [3160, 546],
      [3190, 522],
      [3655, 522],
      [3685, 546],
      [width, 546],
    ]);
    tube(
      ctx,
      [
        [0, 563],
        [width, 563],
      ],
      "#247a84",
    );
    for (let x = 42; x < width; x += 146) {
      ctx.fillStyle = "#152f3d";
      ctx.fillRect(x, 554, 11, 17);
      line(
        ctx,
        [
          [x + 2, 555],
          [x + 2, 570],
        ],
        "#365763",
      );
      ctx.fillStyle = "#638188";
      ctx.fillRect(x + 6, 556, 2, 2);
      ctx.fillRect(x + 6, 566, 2, 2);
    }
    // Occasional octagonal junction housings, with an inset live conduit.
    for (const x of [725, 1530, 2420, 3260]) {
      ctx.fillStyle = "#0a1a26";
      ctx.beginPath();
      ctx.moveTo(x - 17, 509);
      ctx.lineTo(x + 17, 509);
      ctx.lineTo(x + 25, 517);
      ctx.lineTo(x + 25, 537);
      ctx.lineTo(x + 17, 545);
      ctx.lineTo(x - 17, 545);
      ctx.lineTo(x - 25, 537);
      ctx.lineTo(x - 25, 517);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#315260";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#184852";
      ctx.fillRect(x - 13, 519, 26, 14);
      ctx.fillStyle = "#5cbeaf";
      ctx.fillRect(x - 9, 524, 18, 3);
    }
    // Red leak effects are separate from this neutral, reusable production hardware.
    const x = Math.min(3820, width - 180) + 72;
    tube(
      ctx,
      [
        [x, 522],
        [x, 414],
        [x + 35, 379],
        [x + 35, 314],
      ],
      "#3d6873",
    );
    ctx.fillStyle = "#0b1a25";
    ctx.fillRect(x + 12, 359, 46, 43);
    ctx.strokeStyle = "#37525d";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 12, 359, 46, 43);
    ctx.beginPath();
    ctx.arc(x + 35, 380, 13, 0, Math.PI * 2);
    ctx.stroke();
    line(
      ctx,
      [
        [x + 26, 371],
        [x + 44, 389],
      ],
      "#476872",
      3,
    );
  });

  layer("floor", -10, 1, (ctx, width) => {
    const floor = ctx.createLinearGradient(0, floorY, 0, worldHeight);
    floor.addColorStop(0, "#16313d");
    floor.addColorStop(0.08, "#0c1c29");
    floor.addColorStop(1, "#040d17");
    ctx.fillStyle = floor;
    ctx.fillRect(0, floorY, width, worldHeight - floorY);
    ctx.fillStyle = "#284451";
    ctx.fillRect(0, floorY, width, 6);
    ctx.fillStyle = "#446a70";
    ctx.fillRect(0, floorY, width, 1);
    ctx.fillStyle = "#07151f";
    ctx.fillRect(0, floorY + 8, width, 9);
    for (let x = 8; x < width; x += 25) {
      ctx.fillStyle = "#294552";
      ctx.fillRect(x, floorY + 10, 13, 2);
    }
    for (let x = -80; x < width + 80; x += 105) {
      line(
        ctx,
        [
          [x, floorY + 19],
          [x - 54, worldHeight],
        ],
        "rgba(43,78,92,.33)",
      );
      line(
        ctx,
        [
          [x + 2, floorY + 19],
          [x - 52, worldHeight],
        ],
        "rgba(0,6,14,.6)",
      );
    }
    for (const y of [616, 641, 677, 716]) {
      line(
        ctx,
        [
          [0, y],
          [width, y],
        ],
        "rgba(48,83,96,.32)",
      );
      line(
        ctx,
        [
          [0, y + 2],
          [width, y + 2],
        ],
        "rgba(0,5,13,.6)",
      );
    }
    for (let x = 80; x < width; x += 290) {
      ctx.fillStyle = "#31515e";
      ctx.fillRect(x, 626, 3, 2);
      ctx.fillRect(x + 89, 626, 3, 2);
      ctx.fillStyle = "#112936";
      ctx.fillRect(x + 13, 660, 66, 12);
      for (let n = 0; n < 8; n++)
        line(
          ctx,
          [
            [x + 17 + n * 8, 662],
            [x + 13 + n * 8, 670],
          ],
          "#27424e",
          2,
        );
    }
    for (const x of [700, 1575, 2465, 3340]) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 25, floorY + 1, 64, 5);
      ctx.clip();
      for (let n = -1; n < 8; n++)
        line(
          ctx,
          [
            [x - 22 + n * 13, floorY + 8],
            [x - 12 + n * 13, floorY - 2],
          ],
          "#a18b52",
          5,
        );
      ctx.restore();
    }
  });

  // Canvas rendering does not support image tint: carry each color in its pixels.
  const makeGlow = (name: string, rgb: string) =>
    bake(name, 96, 96, (ctx) => {
      const glow = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
      glow.addColorStop(0, `rgba(${rgb},.55)`);
      glow.addColorStop(0.18, `rgba(${rgb},.2)`);
      glow.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 96, 96);
    });
  const glowKey = makeGlow("teal-glow", "49,186,174");
  const leakGlowKey = makeGlow("leak-glow", "255,78,98");
  const containedGlowKey = makeGlow("contained-glow", "81,215,183");
  const makeSpark = (name: string, rgb: string) =>
    bake(name, 16, 16, (ctx) => {
      const light = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      light.addColorStop(0, `rgba(${rgb},.9)`);
      light.addColorStop(0.25, `rgba(${rgb},.5)`);
      light.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = `rgb(${rgb})`;
      ctx.fillRect(7, 5, 2, 6);
    });
  const dustKey = makeSpark("blue-dust", "121,164,171");
  const sparkKey = makeSpark("leak-spark", "255,100,116");

  const accentLights = [203, 1030, 1880, 2745, 3600].map((x, index) => ({
    image: own(
      scene.add
        .image(x, 548, glowKey)
        .setScale(2.1, 0.6)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.22)
        .setDepth(-18),
    ),
    phase: index * 1.8,
  }));
  const random = seeded(917);
  const dust = Array.from({ length: 18 }, () => ({
    image: own(
      scene.add
        .image(random() * (viewportWidth + worldWidth * 0.5), 0, dustKey)
        .setScrollFactor(0.5, 0.65)
        .setDepth(-33)
        .setAlpha(0.1 + random() * 0.12)
        .setScale(0.15 + random() * 0.12),
    ),
    y: 160 + random() * 360,
    phase: random() * Math.PI * 2,
    speed: 0.07 + random() * 0.12,
  }));

  const leakX = Math.min(3820, worldWidth - 180) + 107;
  const leakY = 380;
  const leakGlow = own(
    scene.add
      .image(leakX, leakY, leakGlowKey)
      .setScale(2.8, 2.2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.45)
      .setDepth(-22),
  );
  const leakRing = own(
    scene.add
      .circle(leakX, leakY, 17, 0x251c29, 0.7)
      .setStrokeStyle(2, 0xff7280, 0.8)
      .setDepth(-21),
  );
  const status = own(
    scene.add
      .text(leakX - 36, leakY - 39, "! EXPOSED", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#f8949c",
        letterSpacing: 1,
      })
      .setDepth(-20),
  );
  const sparks = Array.from({ length: 25 }, (_, index) => ({
    image: own(
      scene.add
        .image(leakX, leakY, sparkKey)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(-8)
        .setVisible(false),
    ),
    life: 0,
    maxLife: 0.9 + random() * 0.8,
    delay: index * 0.055,
    vx: 12 + random() * 75,
    vy: -22 - random() * 58,
    bend: random() * 18,
  }));

  const onMotionChange = (event: MediaQueryListEvent) => {
    reducedMotion = event.matches;
  };
  media?.addEventListener("change", onMotionChange);

  function shutdown() {
    if (stopped) return;
    stopped = true;
    media?.removeEventListener("change", onMotionChange);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, shutdown);
    scene.events.off(Phaser.Scenes.Events.DESTROY, shutdown);
    for (const object of objects) if (object.scene) object.destroy();
    for (const key of textures)
      if (scene.textures.exists(key)) scene.textures.remove(key);
  }
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, shutdown);
  scene.events.once(Phaser.Scenes.Events.DESTROY, shutdown);

  return {
    update(_time, delta, contained) {
      if (stopped) return;
      const dt = Math.min(Math.max(delta, 0), 50) / 1000;
      if (!reducedMotion) elapsed += dt;
      rotors.forEach((rotor, index) => {
        rotor.rotation = index * 0.7 + elapsed * (index % 2 ? -0.23 : 0.18);
      });
      accentLights.forEach(({ image, phase }) => {
        image.alpha = reducedMotion
          ? 0.22
          : 0.2 + Math.sin(elapsed * 0.7 + phase) * 0.035;
      });
      dust.forEach((mote) => {
        mote.image.setVisible(!reducedMotion);
        mote.image.y =
          mote.y + Math.sin(elapsed * mote.speed + mote.phase) * 15;
      });
      if (previousContained !== contained) {
        previousContained = contained;
        leakGlow.setTexture(contained ? containedGlowKey : leakGlowKey);
        leakRing.setStrokeStyle(2, contained ? 0x6ee7c0 : 0xff7280, 0.8);
        status
          .setText(contained ? "+ SEALED" : "! EXPOSED")
          .setColor(contained ? "#7edcbd" : "#f8949c");
      }
      leakGlow.alpha = contained
        ? 0.2
        : reducedMotion
          ? 0.36
          : 0.36 + Math.sin(elapsed * 2.4) * 0.07;
      for (const spark of sparks) {
        if (contained || reducedMotion) {
          spark.image.setVisible(false);
          spark.life = 0;
          continue;
        }
        if (spark.life <= 0) {
          spark.delay -= dt;
          if (spark.delay > 0) continue;
          spark.life = spark.maxLife;
          spark.image.setPosition(leakX, leakY).setVisible(true);
        }
        spark.life -= dt;
        const age = spark.maxLife - spark.life;
        const progress = age / spark.maxLife;
        spark.image.setPosition(
          leakX + spark.vx * age + Math.sin(age * 5) * spark.bend,
          leakY + spark.vy * age - 12 * age * age,
        );
        spark.image.setAlpha(Math.sin(Math.PI * progress) * 0.8);
        spark.image.setScale(0.3 + (1 - progress) * 0.35);
        spark.image.rotation = age * 1.2;
        if (spark.life <= 0) {
          spark.image.setVisible(false);
          spark.delay = 0.08 + spark.maxLife * 0.1;
        }
      }
    },
    shutdown,
  };
}
