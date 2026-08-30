(() => {
  "use strict";

  const FPS = 60;
  const PREVIEW_SECONDS = 90;

  const $ = (s) => document.querySelector(s);
  const canvas = $("#canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const audioInput = $("#audioInput");
  const artist = $("#artist");
  const title = $("#title");
  const subtitle = $("#subtitle");
  const animationSelect = $("#animationSelect");
  const paletteSelect = $("#paletteSelect");
  const backgroundSelect = $("#backgroundSelect");
  const fontSelect = $("#fontSelect");
  const positionSelect = $("#positionSelect");
  const intensitySelect = $("#intensitySelect");
  const formatSelect = $("#formatSelect");
  const playBtn = $("#playPreview");
  const muteBtn = $("#mutePreview");
  const exportBtn = $("#exportButton");
  const randomStyleButton = $("#randomStyleButton");
  const advancedToggle = $("#advancedToggle");
  const advancedPanel = $("#advancedPanel");
  const status = $("#status");
  const empty = $("#emptyState");
  const progress = $("#previewProgress");
  const previewTime = $("#previewTime");
  const fileLabel = $("#fileLabel");
  const exportFill = $("#exportFill");
  const styleSummary = $("#styleSummary");

  const formats = {
    vertical: { w: 1080, h: 1920 },
    portrait: { w: 1080, h: 1350 },
    square: { w: 1080, h: 1080 },
    landscape: { w: 1920, h: 1080 }
  };

  const palettes = {
    ocean: {
      label: "Ocean",
      colors: ["#7ee7ff", "#2db8ff", "#5967ff", "#10162e"],
      bg: ["#07111f", "#0b1730", "#020308"]
    },
    sunset: {
      label: "Sunset",
      colors: ["#ffe08a", "#ff9a4d", "#ff4f7b", "#5b173b"],
      bg: ["#1e0d16", "#32131b", "#070307"]
    },
    ultraviolet: {
      label: "Ultraviolet",
      colors: ["#f2b6ff", "#b56dff", "#6d5cff", "#241447"],
      bg: ["#120b22", "#1d0e36", "#040208"]
    }
  };

  const animationLabels = {
    spectrum: "Espectro",
    wave: "Ondas",
    particles: "Partículas",
    planets: "Planetas"
  };

  const backgroundLabels = {
    aurora: "Aurora",
    waves: "Ondulado",
    prisms: "Prismas"
  };

  const fontLabels = {
    modern: "Modern",
    editorial: "Editorial",
    mono: "Mono"
  };

  const positionLabels = {
    top: "Arriba",
    center: "Centro",
    bottom: "Abajo"
  };

  const intensityLabels = {
    soft: "Suave",
    balanced: "Equilibrada",
    bold: "Intensa"
  };

  const fontStacks = {
    modern: 'Arial, Helvetica, sans-serif',
    editorial: 'Georgia, "Times New Roman", serif',
    mono: '"Courier New", Courier, monospace'
  };

  let audioCtx = null;
  let buffer = null;
  let analyser = null;
  let source = null;
  let gain = null;
  let playing = false;
  let muted = false;
  let animationId = 0;
  let resizeTimer = null;

  let visual = {
    animation: "spectrum",
    palette: "ocean",
    background: "aurora",
    font: "modern",
    position: "top",
    intensity: "balanced"
  };

  function audioEngine() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error("Web Audio no disponible");
      audioCtx = new AC();
    }
    return audioCtx;
  }

  function fmt(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function setStatus(text) {
    if (!status) return;

    status.textContent = text;

    const match = text.match(/EXPORTANDO WEBM\s*[·-]\s*(\d+)%/i);
    const percent = match
      ? Number(match[1])
      : (/LISTO\s*[·-]\s*100%/i.test(text) ? 100 : 0);

    if (exportFill) exportFill.style.width = percent + "%";
  }

  function seeded(n) {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function randomVisualStyle() {
    const animation = randomItem(Object.keys(animationLabels));
    const palette = randomItem(Object.keys(palettes));
    const intensity = randomItem(Object.keys(intensityLabels));
    const font = randomItem(Object.keys(fontLabels));

    // Solo combinaciones que existen y que se mantienen visualmente seguras.
    const allowedBackgrounds =
      animation === "wave"
        ? ["aurora", "waves", "prisms"]
        : animation === "particles"
          ? ["aurora", "prisms"]
          : animation === "planets"
            ? ["aurora", "prisms"]
            : ["aurora", "waves", "prisms"];

    const background = randomItem(allowedBackgrounds);

    const allowedPositions = animation === "spectrum"
      ? ["top", "center"]
      : animation === "wave"
        ? ["top", "center"]
        : animation === "planets"
          ? ["top", "center"]
          : ["top", "center", "bottom"];

    const position = randomItem(allowedPositions);

    return {
      animation,
      palette,
      background,
      font,
      position,
      intensity
    };
  }

  function applyVisual(next, redraw = true) {
    visual = { ...visual, ...next };

    animationSelect.value = visual.animation;
    paletteSelect.value = visual.palette;
    backgroundSelect.value = visual.background;
    fontSelect.value = visual.font;
    positionSelect.value = visual.position;
    intensitySelect.value = visual.intensity;

    updateSummary();

    if (redraw) draw(performance.now(), 0.08);
  }

  function updateSummary() {
    const p = palettes[visual.palette];

    styleSummary.textContent =
      `${animationLabels[visual.animation]} · ${p.label} · ${backgroundLabels[visual.background]}`;
  }

  function newRandomStyle() {
    applyVisual(randomVisualStyle());
  }

  function fit() {
    const format = formats[formatSelect.value];
    if (!format) return;

    canvas.width = format.w;
    canvas.height = format.h;

    const previewWrap = document.querySelector(".preview-wrap");

    if (previewWrap) {
      previewWrap.style.aspectRatio = `${format.w} / ${format.h}`;
    }

    draw(performance.now(), 0.08);
  }

  function energyProfile() {
    const map = {
      soft: 0.72,
      balanced: 1,
      bold: 1.35
    };

    return map[visual.intensity] || 1;
  }

  function clearBackground(t, energy) {
    const w = canvas.width;
    const h = canvas.height;
    const p = palettes[visual.palette];
    const intensity = energyProfile();

    if (visual.background === "waves") {
      ctx.fillStyle = p.bg[2];
      ctx.fillRect(0, 0, w, h);
      drawSoftWaveBackground(t, p, intensity);
    } else if (visual.background === "prisms") {
      drawPrismsBackground(t, p, intensity);
    } else {
      const gradient = ctx.createRadialGradient(
        w * 0.5,
        h * 0.32,
        0,
        w * 0.5,
        h * 0.55,
        Math.max(w, h) * 0.78
      );

      gradient.addColorStop(0, p.bg[0]);
      gradient.addColorStop(.48, p.bg[1]);
      gradient.addColorStop(1, p.bg[2]);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      drawOrbs(t, p, energy, intensity);
    }
  }

  function drawOrbs(t, p, energy, intensity) {
    const w = canvas.width;
    const h = canvas.height;

    const spots = [
      [0.18, 0.25, 0.36, p.colors[2]],
      [0.82, 0.38, 0.32, p.colors[1]],
      [0.48, 0.78, 0.42, p.colors[3]]
    ];

    spots.forEach((s, i) => {
      const x =
        w * s[0] +
        Math.sin(t * 0.00025 + i) * w * 0.025;

      const y =
        h * s[1] +
        Math.cos(t * 0.0002 + i) * h * 0.02;

      const r =
        Math.min(w, h) *
        s[2] *
        (0.9 + energy * 0.08 * intensity);

      const g = ctx.createRadialGradient(
        x,
        y,
        0,
        x,
        y,
        r
      );

      const c = hexToRgba(
        s[3],
        0.22 + energy * 0.08
      );

      g.addColorStop(0, c);
      g.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
  }

  function drawSoftWaveBackground(t, p, intensity) {
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();

    for (let k = 0; k < 3; k++) {
      ctx.beginPath();

      const yBase = h * (0.22 + k * 0.27);

      for (
        let x = 0;
        x <= w;
        x += Math.max(10, w / 90)
      ) {
        const y =
          yBase +
          Math.sin(
            x * 0.008 +
            t * 0.00045 +
            k * 1.7
          ) *
          h *
          (0.045 + k * 0.008) *
          intensity;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();

      ctx.fillStyle = hexToRgba(
        p.colors[k + 1],
        0.11 + k * 0.025
      );

      ctx.fill();
    }

    ctx.restore();
  }

  function drawPrismsBackground(t, p, intensity) {
    const w = canvas.width;
    const h = canvas.height;
    const base = Math.min(w, h);

    ctx.save();

    // Multicolor base: never a flat/empty black background.
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, p.bg[0]);
    bg.addColorStop(.48, p.bg[1]);
    bg.addColorStop(1, p.bg[2]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Lightweight translucent geometric planes.
    const count = 16;
    const drift = t * 0.000035;

    for (let i = 0; i < count; i++) {
      const seed = seeded(i * 13.7 + 4.2);
      const x = (seeded(i * 7.1 + 1.4) * 1.25 - .125) * w;
      const y = (seeded(i * 5.3 + 8.2) * 1.20 - .10) * h;
      const size = base * (.10 + seed * .15);
      const angle =
        seeded(i * 3.9 + 2.1) * Math.PI +
        drift * (i % 2 === 0 ? 1 : -1);

      const c1 = p.colors[i % p.colors.length];
      const c2 = p.colors[(i + 1) % p.colors.length];
      const alpha = .07 + seeded(i + 21) * .055;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      const g = ctx.createLinearGradient(-size, -size, size, size);
      g.addColorStop(0, hexToRgba(c1, alpha));
      g.addColorStop(.52, hexToRgba(c2, alpha * 1.25));
      g.addColorStop(1, hexToRgba(c1, 0));

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-size, size * .58);
      ctx.lineTo(size * .72, size);
      ctx.lineTo(size, -size * .52);
      ctx.lineTo(-size * .42, -size);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // Subtle light sweep tied to intensity, keeping the background alive.
    const sweepX =
      ((Math.sin(t * 0.00016) + 1) * .5) * w;
    const sweep = ctx.createRadialGradient(
      sweepX,
      h * .42,
      0,
      sweepX,
      h * .42,
      base * .42
    );
    sweep.addColorStop(0, hexToRgba(p.colors[0], .045 * intensity));
    sweep.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, w, h);

    ctx.restore();
  }

  function hexToRgba(hex, alpha) {
    const value = hex.replace("#", "");
    const bigint = parseInt(value, 16);

    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    return `rgba(${r},${g},${b},${alpha})`;
  }

  function drawTextBackdrop() {
    const w = canvas.width;
    const h = canvas.height;
    const y = getTextY();

    const radius = Math.min(w, h) * 0.33;

    const g = ctx.createRadialGradient(
      w * .5,
      y,
      0,
      w * .5,
      y,
      radius
    );

    g.addColorStop(0, "rgba(0,0,0,.28)");
    g.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = g;

    ctx.fillRect(
      0,
      Math.max(0, y - radius),
      w,
      Math.min(h, radius * 2)
    );
  }

  function getTextY() {
    const h = canvas.height;

    if (visual.position === "top") return h * 0.25;
    if (visual.position === "bottom") return h * 0.78;

    return h * 0.50;
  }

  function textLayer() {
    const w = canvas.width;
    const h = canvas.height;
    const base = Math.min(w, h);
    const cx = w / 2;
    const y = getTextY();

    const p = palettes[visual.palette];
    const font = fontStacks[visual.font];

    const artistText =
      (artist.value || "NOVA").trim().toUpperCase();

    const titleText =
      (title.value || "MIDNIGHT").trim().toUpperCase();

    const subtitleText =
      (subtitle.value || "NEW RELEASE").trim().toUpperCase();

    drawTextBackdrop();

    ctx.save();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.shadowColor = hexToRgba(p.colors[2], .5);
    ctx.shadowBlur = base * .018;

    ctx.fillStyle = "#ffffff";

    ctx.font =
      `800 ${Math.max(24, base * .058)}px ${font}`;

    ctx.fillText(
      artistText,
      cx,
      y
    );

    ctx.shadowBlur = base * .012;
    ctx.fillStyle = p.colors[0];

    ctx.font =
      `600 ${Math.max(15, base * .028)}px ${font}`;

    ctx.fillText(
      titleText,
      cx,
      y + Math.max(31, base * .07)
    );

    if (subtitleText) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = hexToRgba(
        p.colors[0],
        .72
      );

      ctx.font =
        `600 ${Math.max(11, base * .016)}px ${font}`;

      ctx.letterSpacing = "2px";

      ctx.fillText(
        subtitleText,
        cx,
        y + Math.max(56, base * .105)
      );
    }

    ctx.restore();
  }

  /*
   * ESPECTRO
   *
   * Cambio realizado:
   * - Las barras ahora ocupan prácticamente todo el ancho.
   * - Se mantienen pequeños márgenes laterales.
   * - La altura máxima se adapta a la posición del texto.
   * - Las barras no pueden crecer dentro de la zona reservada
   *   para los textos.
   *
   * El resto del visualizador permanece igual.
   */
  function spectrum(energy, t) {
    const w = canvas.width;
    const h = canvas.height;
    const base = Math.min(w, h);
    const cx = w / 2;

    const p = palettes[visual.palette];
    const intensity = energyProfile();

    const count = 72;

    const sideMargin = Math.max(
      8,
      w * 0.012
    );

    const maxWidth =
      w - sideMargin * 2;

    const gap = Math.max(
      1.5,
      base * 0.003
    );

    const bw =
      (maxWidth - gap * (count - 1)) /
      count;

    /*
     * Zona segura para las barras.
     *
     * El texto se dibuja DESPUÉS de las barras,
     * pero no queremos depender de que el texto
     * simplemente tape las barras.
     */
    let floor;
    let maxBarHeight;

    if (visual.position === "bottom") {
      /*
       * En la posición inferior el texto está
       * alrededor de h * .78.
       *
       * Las barras quedan por encima del bloque
       * de texto.
       */
      const textY = getTextY();

      floor =
        textY -
        Math.max(70, base * 0.14);

      maxBarHeight =
        Math.max(
          base * 0.06,
          floor - base * 0.05
        );

    } else {
      /*
       * Arriba o centro:
       * las barras se mantienen debajo del texto.
       */
      floor = h * 0.93;

      const textY = getTextY();

      const textBottom =
        textY +
        Math.max(56, base * 0.105);

      maxBarHeight =
        Math.max(
          base * 0.08,
          floor -
          textBottom -
          base * 0.06
        );
    }

    ctx.save();

    ctx.lineCap = "round";

    for (let i = 0; i < count; i++) {
      const wave =
        .22 +
        .78 *
        Math.abs(
          Math.sin(
            i * .73 +
            t * .0024
          )
        );

      const edge =
        Math.sin(
          i / count * Math.PI
        );

      const rawHeight =
        base *
        (
          .018 +
          energy *
          .30 *
          intensity *
          wave *
          edge
        );

      const height =
        Math.min(
          Math.max(
            base * .012,
            rawHeight
          ),
          maxBarHeight
        );

      const x =
        sideMargin +
        i * (bw + gap);

      const y =
        floor -
        height;

      const gradient =
        ctx.createLinearGradient(
          0,
          y,
          0,
          floor
        );

      gradient.addColorStop(
        0,
        p.colors[0]
      );

      gradient.addColorStop(
        .35,
        p.colors[1]
      );

      gradient.addColorStop(
        1,
        p.colors[2]
      );

      ctx.fillStyle = gradient;

      ctx.shadowColor =
        p.colors[1];

      ctx.shadowBlur = 8;

      ctx.fillRect(
        x,
        y,
        bw,
        height
      );
    }

    ctx.shadowBlur = 0;

    ctx.strokeStyle =
      hexToRgba(
        p.colors[1],
        .45
      );

    ctx.lineWidth =
      Math.max(
        1,
        base * .002
      );

    ctx.beginPath();

    ctx.moveTo(
      sideMargin,
      floor + 2
    );

    ctx.lineTo(
      w - sideMargin,
      floor + 2
    );

    ctx.stroke();

    ctx.restore();
  }

  function wave(energy, t) {
    const w = canvas.width;
    const h = canvas.height;
    const base = Math.min(w, h);
    const p = palettes[visual.palette];

    const intensity = energyProfile();

    const y =
      visual.position === "top"
        ? h * .72
        : h * .66;

    ctx.save();

    ctx.lineCap = "round";

    for (let k = 0; k < 3; k++) {
      ctx.beginPath();

      for (let x = 0; x <= w; x += 8) {
        const amplitude =
          base *
          (.025 + k * .007) +
          energy *
          base *
          (.11 - k * .018) *
          intensity;

        const yy =
          y +
          (k - 1) *
          base *
          .065 +
          Math.sin(
            x * .014 +
            t * .006 +
            k
          ) *
          amplitude;

        if (x === 0) {
          ctx.moveTo(x, yy);
        } else {
          ctx.lineTo(x, yy);
        }
      }

      ctx.strokeStyle =
        k === 1
          ? p.colors[0]
          : hexToRgba(
              p.colors[1],
              .62
            );

      ctx.shadowColor =
        p.colors[1];

      ctx.shadowBlur = 15;

      ctx.lineWidth =
        Math.max(
          2,
          base * .006
        );

      ctx.stroke();
    }

    ctx.restore();
  }

  function particles(energy, t) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const base = Math.min(w, h);
    const p = palettes[visual.palette];

    const intensity = energyProfile();

    const centerY =
      visual.position === "bottom"
        ? h * .35
        : h * .63;

    ctx.save();

    for (let i = 0; i < 210; i++) {
      const angle =
        seeded(i) *
        Math.PI *
        2 +
        t *
        .00025 *
        (.5 + seeded(i + 4));

      const radius =
        base *
        (.16 + seeded(i + 9) * .29) +
        energy *
        base *
        .1 *
        intensity;

      const x =
        cx +
        Math.cos(angle) *
        radius;

      const y =
        centerY +
        Math.sin(angle) *
        radius *
        .35;

      ctx.fillStyle =
        i % 9 === 0
          ? p.colors[0]
          : hexToRgba(
              p.colors[1],
              .6
            );

      ctx.shadowColor =
        p.colors[1];

      ctx.shadowBlur = 8;

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        Math.max(
          1,
          base *
          .003 *
          (.7 + energy * 2) *
          intensity
        ),
        0,
        Math.PI * 2
      );

      ctx.fill();
    }

    ctx.restore();
  }

  function planets(energy, t) {
    const w = canvas.width;
    const h = canvas.height;
    const base = Math.min(w, h);
    const cx = w / 2;
    const p = palettes[visual.palette];
    const intensity = energyProfile();

    // Keep planets away from the text when text is at the top.
    // Center remains visually balanced; the randomizer avoids risky
    // combinations for this animation.
    const cy =
      visual.position === "top"
        ? h * .67
        : h * .50;

    // More planets, independent speeds and phases.
    const systems = [
      { rx: .105, ry: .052, speed: .00145, phase: .20, size: .0080, color: 0 },
      { rx: .135, ry: .067, speed: -.00120, phase: 1.50, size: .0100, color: 1 },
      { rx: .165, ry: .082, speed: .00102, phase: 2.40, size: .0070, color: 2 },
      { rx: .195, ry: .097, speed: -.00088, phase: 3.20, size: .0110, color: 0 },
      { rx: .225, ry: .112, speed: .00076, phase: 4.10, size: .0085, color: 1 },
      { rx: .255, ry: .127, speed: -.00066, phase: 5.00, size: .0120, color: 2 },
      { rx: .285, ry: .142, speed: .00057, phase: .90, size: .0075, color: 0 },
      { rx: .315, ry: .157, speed: -.00050, phase: 2.10, size: .0095, color: 1 },
      { rx: .345, ry: .172, speed: .00044, phase: 3.80, size: .0065, color: 2 },
      { rx: .375, ry: .187, speed: -.00039, phase: 5.30, size: .0105, color: 0 }
    ];

    const beat =
      Math.max(0, Math.min(1, energy * intensity));

    // Subtle musical "jump": orbit and planet radius expand together,
    // capped so the movement stays elegant.
    const orbitPulse = 1 + beat * .045;

    ctx.save();

    ctx.lineWidth =
      Math.max(1, base * .0010);

    systems.forEach((s, i) => {
      const rx = base * s.rx * orbitPulse;
      const ry = base * s.ry * orbitPulse;
      const rot = -.12 + (i % 5) * .05;

      ctx.strokeStyle =
        hexToRgba(
          p.colors[s.color],
          .07 + beat * .025
        );

      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy,
        rx,
        ry,
        rot,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    });

    // Central star.
    const starR =
      base * (.018 + beat * .006 * intensity);

    const star =
      ctx.createRadialGradient(
        cx, cy, 0,
        cx, cy, starR * 4
      );

    star.addColorStop(
      0,
      hexToRgba(p.colors[0], .94)
    );
    star.addColorStop(
      .25,
      hexToRgba(p.colors[1], .36)
    );
    star.addColorStop(
      1,
      "rgba(0,0,0,0)"
    );

    ctx.fillStyle = star;
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      starR * 4,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = p.colors[0];
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      starR,
      0,
      Math.PI * 2
    );
    ctx.fill();

    systems.forEach((s, i) => {
      const angle =
        t * s.speed + s.phase;

      const rot =
        -.12 + (i % 5) * .05;

      const rx =
        base * s.rx * orbitPulse;

      const ry =
        base * s.ry * orbitPulse;

      const lx =
        Math.cos(angle) * rx;

      const ly =
        Math.sin(angle) * ry;

      const x =
        cx +
        lx * Math.cos(rot) -
        ly * Math.sin(rot);

      const y =
        cy +
        lx * Math.sin(rot) +
        ly * Math.cos(rot);

      const planetPulse =
        1 +
        beat * (
          .14 +
          (i % 3) * .025
        );

      const r =
        Math.max(
          2,
          base * s.size * planetPulse
        );

      const planet =
        ctx.createRadialGradient(
          x - r * .35,
          y - r * .35,
          r * .05,
          x,
          y,
          r
        );

      planet.addColorStop(
        0,
        "rgba(255,255,255,.90)"
      );
      planet.addColorStop(
        .20,
        hexToRgba(p.colors[s.color], .98)
      );
      planet.addColorStop(
        1,
        hexToRgba(p.colors[s.color], .18)
      );

      ctx.fillStyle = planet;
      ctx.shadowColor = p.colors[s.color];
      ctx.shadowBlur =
        Math.max(
          2,
          base * (.0035 + beat * .003)
        );

      ctx.beginPath();
      ctx.arc(
        x,
        y,
        r,
        0,
        Math.PI * 2
      );
      ctx.fill();

      ctx.shadowBlur = 0;

      // Small halo on stronger beats.
      if (beat > .20) {
        ctx.strokeStyle =
          hexToRgba(
            p.colors[s.color],
            beat * .16
          );

        ctx.lineWidth =
          Math.max(
            1,
            base * .001
          );

        ctx.beginPath();
        ctx.arc(
          x,
          y,
          r * (1.22 + beat * .30),
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }

      // Small highlight.
      ctx.fillStyle =
        "rgba(255,255,255,.26)";

      ctx.beginPath();
      ctx.arc(
        x - r * .26,
        y - r * .26,
        Math.max(1, r * .14),
        0,
        Math.PI * 2
      );
      ctx.fill();
    });

    // Lightweight deterministic stars.
    for (let i = 0; i < 42; i++) {
      const sx =
        seeded(i * 17.13 + 2.7) * w;

      const sy =
        seeded(i * 9.71 + 8.4) * h;

      const twinkle =
        .30 +
        .70 *
        Math.abs(
          Math.sin(
            t * .001 +
            i * 1.9
          )
        );

      const sr =
        Math.max(
          1,
          base * .001
        );

      ctx.fillStyle =
        hexToRgba(
          p.colors[i % p.colors.length],
          .14 * twinkle
        );

      ctx.beginPath();
      ctx.arc(
        sx,
        sy,
        sr,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Occasional shooting star.
    const cycle = 11;
    const phase =
      (t * .001 / cycle) % 1;

    if (phase > .80 && phase < .93) {
      const q =
        (phase - .80) / .13;

      const sx =
        w * (.10 + q * .95);

      const sy =
        h * (.18 + q * .28);

      const tail =
        base * .065;

      const g =
        ctx.createLinearGradient(
          sx - tail,
          sy - tail * .35,
          sx,
          sy
        );

      g.addColorStop(
        0,
        "rgba(255,255,255,0)"
      );

      g.addColorStop(
        1,
        hexToRgba(
          p.colors[0],
          .72
        )
      );

      ctx.strokeStyle = g;
      ctx.lineWidth =
        Math.max(
          1,
          base * .002
        );

      ctx.beginPath();
      ctx.moveTo(
        sx - tail,
        sy - tail * .35
      );
      ctx.lineTo(
        sx,
        sy
      );
      ctx.stroke();
    }

    ctx.restore();
  }

  function draw(t, energy) {
    clearBackground(t, energy);

    if (visual.animation === "spectrum") {
      spectrum(energy, t);
    }

    if (visual.animation === "wave") {
      wave(energy, t);
    }

    if (visual.animation === "particles") {
      particles(energy, t);
    }

    if (visual.animation === "planets") {
      planets(energy, t);
    }

    textLayer();
  }

  function getEnergy() {
    if (!analyser) return .08;

    const data =
      new Uint8Array(
        analyser.frequencyBinCount
      );

    analyser.getByteFrequencyData(data);

    let sum = 0;

    for (const value of data) {
      sum += value;
    }

    return Math.min(
      1,
      (sum / data.length) /
      255 *
      2.1
    );
  }

  function stop() {
    if (source) {
      try {
        source.stop();
      } catch {}

      try {
        source.disconnect();
      } catch {}
    }

    if (gain) {
      try {
        gain.disconnect();
      } catch {}
    }

    source = null;
    gain = null;
    playing = false;

    cancelAnimationFrame(animationId);

    if (progress) {
      progress.style.width = "0%";
    }

    if (previewTime) {
      const duration = buffer
        ? Math.min(PREVIEW_SECONDS, buffer.duration)
        : 0;

      previewTime.textContent =
        `0:00 / ${fmt(duration)}`;
    }

    if (playBtn) {
      playBtn.textContent = "▶";
    }
  }

  async function preview() {
    if (!buffer) return;

    stop();

    const previewDuration =
      Math.min(
        PREVIEW_SECONDS,
        buffer.duration
      );

    const ac = audioEngine();

    await ac.resume();

    analyser =
      ac.createAnalyser();

    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = .72;

    source =
      ac.createBufferSource();

    source.buffer = buffer;

    gain =
      ac.createGain();

    gain.gain.value =
      muted ? 0 : 1;

    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(ac.destination);

    source.onended = () => {
      if (playing) {
        playing = false;

        if (progress) {
          progress.style.width = "100%";
        }

        if (previewTime) {
          previewTime.textContent =
            `0:00 / ${fmt(previewDuration)}`;
        }

        playBtn.textContent = "▶";
      }
    };

    source.start(0);

    playing = true;

    playBtn.textContent = "■";

    const start =
      performance.now();

    const loop = (now) => {
      if (!playing) return;

      const elapsed =
        (now - start) / 1000;

      if (elapsed >= previewDuration) {
        stop();
        draw(now, .08);

        if (previewTime) {
          previewTime.textContent =
            `${fmt(previewDuration)} / ${fmt(previewDuration)}`;
        }

        if (progress) {
          progress.style.width = "100%";
        }

        return;
      }

      draw(
        now,
        getEnergy()
      );

      if (progress) {
        progress.style.width =
          (
            elapsed /
            previewDuration *
            100
          ) + "%";
      }

      if (previewTime) {
        previewTime.textContent =
          `${fmt(elapsed)} / ${fmt(previewDuration)}`;
      }

      animationId =
        requestAnimationFrame(loop);
    };

    animationId =
      requestAnimationFrame(loop);
  }

  function download(blob) {
    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    const name =
      (
        title.value ||
        "music-visualizer"
      )
        .replace(/[^\w\- ]/g, "")
        .trim() ||
      "music-visualizer";

    a.href = url;
    a.download = `${name}.webm`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      60000
    );
  }

  async function exportVideo() {
    if (!buffer) return;

    if (
      !HTMLCanvasElement.prototype.captureStream ||
      !window.MediaRecorder
    ) {
      setStatus(
        "Usa Chrome o Edge para exportar WEBM."
      );

      return;
    }

    stop();

    exportBtn.disabled = true;
    randomStyleButton.disabled = true;

    exportBtn.classList.add(
      "exporting"
    );

    if (exportFill) {
      exportFill.style.width = "0%";
    }

    const format =
      formats[formatSelect.value];

    canvas.width = format.w;
    canvas.height = format.h;

    const previewWrap =
      document.querySelector(
        ".preview-wrap"
      );

    if (previewWrap) {
      previewWrap.style.aspectRatio =
        `${format.w} / ${format.h}`;
    }

    const AC =
      window.AudioContext ||
      window.webkitAudioContext;

    const ac = new AC();

    await ac.resume();

    const src =
      ac.createBufferSource();

    src.buffer = buffer;

    const analyserExport =
      ac.createAnalyser();

    analyserExport.fftSize = 1024;
    analyserExport.smoothingTimeConstant = .72;

    const audioDestination =
      ac.createMediaStreamDestination();

    src.connect(analyserExport);
    analyserExport.connect(
      audioDestination
    );

    const videoStream =
      canvas.captureStream(FPS);

    const stream =
      new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks()
      ]);

    const mimeTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm"
    ];

    const mime =
      mimeTypes.find(
        (m) =>
          MediaRecorder.isTypeSupported(m)
      );

    if (!mime) {
      setStatus(
        "WEBM no está disponible en este navegador."
      );

      stream
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      await ac.close();

      exportBtn.disabled = false;
      randomStyleButton.disabled = false;

      exportBtn.classList.remove(
        "exporting"
      );

      return;
    }

    const chunks = [];

    const recorder =
      new MediaRecorder(
        stream,
        {
          mimeType: mime,
          videoBitsPerSecond: 12000000,
          audioBitsPerSecond: 192000
        }
      );

    recorder.ondataavailable =
      (event) => {
        if (
          event.data &&
          event.data.size
        ) {
          chunks.push(event.data);
        }
      };

    const stopped =
      new Promise((resolve) =>
        recorder.addEventListener(
          "stop",
          resolve,
          { once: true }
        )
      );

    const duration =
      buffer.duration;

    let startedAt = 0;
    let renderId = 0;

    function renderExport(now) {
      if (!startedAt) {
        startedAt = now;
      }

      const elapsed =
        Math.min(
          duration,
          (now - startedAt) / 1000
        );

      const percent =
        Math.round(
          elapsed /
          duration *
          100
        );

      const data =
        new Uint8Array(
          analyserExport.frequencyBinCount
        );

      analyserExport.getByteFrequencyData(
        data
      );

      let sum = 0;

      for (const value of data) {
        sum += value;
      }

      const exportEnergy =
        Math.min(
          1,
          (sum / data.length) /
          255 *
          2.1
        );

      draw(
        now,
        exportEnergy
      );

      setStatus(
        `EXPORTANDO WEBM · ${percent}% · ${fmt(elapsed)} / ${fmt(duration)}`
      );

      if (elapsed < duration) {
        renderId =
          requestAnimationFrame(
            renderExport
          );
      }
    }

    setStatus(
      `EXPORTANDO WEBM · 0% · 0:00 / ${fmt(duration)}`
    );

    recorder.start(250);

    src.addEventListener(
      "ended",
      () => {
        cancelAnimationFrame(
          renderId
        );

        draw(
          performance.now(),
          .08
        );

        setStatus(
          `EXPORTANDO WEBM · 100% · ${fmt(duration)} / ${fmt(duration)}`
        );

        setTimeout(
          () => {
            if (
              recorder.state !==
              "inactive"
            ) {
              recorder.stop();
            }
          },
          350
        );
      },
      { once: true }
    );

    src.start(0);

    renderId =
      requestAnimationFrame(
        renderExport
      );

    setTimeout(
      () => {
        if (
          recorder.state !==
          "inactive"
        ) {
          cancelAnimationFrame(
            renderId
          );

          recorder.stop();
        }
      },
      (duration + 3) * 1000
    );

    await stopped;

    stream
      .getTracks()
      .forEach((track) =>
        track.stop()
      );

    try {
      await ac.close();
    } catch {}

    const blob =
      new Blob(
        chunks,
        { type: mime }
      );

    download(blob);

    setStatus(
      `LISTO · 100% · ${format.w}×${format.h} · WEBM · ${(blob.size / 1048576).toFixed(1)} MB`
    );

    exportBtn.disabled = false;
    randomStyleButton.disabled = false;

    exportBtn.classList.remove(
      "exporting"
    );

    fit();
  }

  audioInput.addEventListener(
    "change",
    async (event) => {
      const file =
        event.target.files?.[0];

      if (!file) return;

      try {
        const ac =
          audioEngine();

        await ac.resume();

        buffer =
          await ac.decodeAudioData(
            await file.arrayBuffer()
          );

        if (fileLabel) {
          fileLabel.textContent =
            file.name.length > 32
              ? file.name.slice(0, 29) + "…"
              : file.name;
        }

        if (empty) {
          empty.style.display = "none";
        }

        playBtn.disabled = false;
        muteBtn.disabled = false;
        exportBtn.disabled = false;

        if (previewTime) {
          previewTime.textContent =
            `0:00 / ${fmt(Math.min(PREVIEW_SECONDS, buffer.duration))}`;
        }

        setStatus(
          `Audio listo · ${fmt(buffer.duration)} · revisa el estilo y exporta.`
        );

        fit();

      } catch (error) {
        console.error(error);

        setStatus(
          "No pude leer ese archivo. Prueba con un MP3 o WAV estándar."
        );
      }
    }
  );

  [artist, title, subtitle].forEach(
    (input) =>
      input.addEventListener(
        "input",
        () =>
          draw(
            performance.now(),
            .08
          )
      )
  );

  function bindAdvanced(select, key) {
    select.addEventListener(
      "change",
      () => {
        visual[key] =
          select.value;

        updateSummary();

        draw(
          performance.now(),
          .08
        );
      }
    );
  }

  bindAdvanced(
    animationSelect,
    "animation"
  );

  bindAdvanced(
    paletteSelect,
    "palette"
  );

  bindAdvanced(
    backgroundSelect,
    "background"
  );

  bindAdvanced(
    fontSelect,
    "font"
  );

  bindAdvanced(
    positionSelect,
    "position"
  );

  bindAdvanced(
    intensitySelect,
    "intensity"
  );

  randomStyleButton.addEventListener(
    "click",
    newRandomStyle
  );

  formatSelect.addEventListener(
    "change",
    fit
  );

  playBtn.addEventListener(
    "click",
    () =>
      playing
        ? stop()
        : preview()
  );

  exportBtn.addEventListener(
    "click",
    exportVideo
  );

  muteBtn.addEventListener(
    "click",
    () => {
      muted = !muted;

      muteBtn.textContent =
        muted ? "○" : "◉";

      if (gain) {
        gain.gain.value =
          muted ? 0 : 1;
      }
    }
  );

  advancedToggle.addEventListener(
    "click",
    () => {
      const open =
        advancedToggle.getAttribute(
          "aria-expanded"
        ) === "true";

      advancedToggle.setAttribute(
        "aria-expanded",
        String(!open)
      );

      advancedPanel.hidden =
        open;
    }
  );

  window.addEventListener(
    "resize",
    () => {
      clearTimeout(
        resizeTimer
      );

      resizeTimer =
        setTimeout(
          fit,
          120
        );
    }
  );

  // Siempre arrancamos con una combinación nueva,
  // nunca con un preset fijo.
  applyVisual(
    randomVisualStyle(),
    false
  );

  fit();

  draw(
    performance.now(),
    .08
  );
})();
