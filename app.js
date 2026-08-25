(() => {
"use strict";

const FPS = 60;
const PREVIEW_SECONDS = 10;

const $ = s => document.querySelector(s);

const canvas = $("#canvas");
const ctx = canvas.getContext("2d", { alpha: false });

const audioInput = $("#audioInput");
const artist = $("#artist");
const title = $("#title");
const styleSelect = $("#styleSelect");
const formatSelect = $("#formatSelect");

const playBtn = $("#playPreview");
const muteBtn = $("#mutePreview");
const exportBtn = $("#exportButton");

const status = $("#status");
const empty = $("#emptyState");
const progress = $("#previewProgress");
const previewTime = $("#previewTime");
const fileLabel = $("#fileLabel");

const exportFill = $("#exportFill");
const exportProgress = $("#exportProgress");

const formats = {
  vertical: {
    w: 1080,
    h: 1920
  },
  portrait: {
    w: 1080,
    h: 1350
  },
  square: {
    w: 1080,
    h: 1080
  },
  landscape: {
    w: 1920,
    h: 1080
  }
};

/* Elimina Minimal aunque exista en un HTML anterior */
styleSelect?.querySelector('option[value="minimal"]')?.remove();

let audioCtx = null;
let buffer = null;
let analyser = null;
let source = null;
let gain = null;

let playing = false;
let muted = false;
let currentStyle = "spectrum";
let animationId = 0;


/* =========================
   AUDIO
========================= */

function audioEngine() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;

    if (!AC) {
      throw new Error("Web Audio no disponible");
    }

    audioCtx = new AC();
  }

  return audioCtx;
}


/* =========================
   UTILIDADES
========================= */

function fmt(seconds) {
  seconds = Math.max(0, Math.floor(seconds));

  return `${Math.floor(seconds / 60)}:${String(
    seconds % 60
  ).padStart(2, "0")}`;
}


function setStatus(text) {
  status.textContent = text;

  const match = text.match(
    /EXPORTANDO WEBM\s*[·-]\s*(\d+)%/i
  );

  const percent = match
    ? Number(match[1])
    : (/LISTO\s*[·-]\s*100%/i.test(text) ? 100 : 0);

  if (exportFill) {
    exportFill.style.width = percent + "%";
  }

  if (exportProgress) {
    exportProgress.style.width = percent + "%";
  }
}


function fit() {
  const format = formats[formatSelect.value];

  canvas.width = format.w;
  canvas.height = format.h;

  draw(performance.now(), 0.08);
}


function seeded(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}


/* =========================
   MATRIX
========================= */

function matrix(t, intensity = 1) {

  const w = canvas.width;
  const h = canvas.height;

  const fs = Math.max(
    14,
    Math.round(Math.min(w, h) * 0.022)
  );

  ctx.font = `600 ${fs}px monospace`;
  ctx.textAlign = "center";

  const cols = Math.ceil(w / (fs * 1.35));

  for (let i = 0; i < cols; i++) {

    const speed =
      0.08 + seeded(i + 3) * 0.18;

    const y =
      ((t * speed * fs * 1.8 +
        seeded(i + 8) * h) %
        (h + fs)) -
      fs;

    const rows =
      5 + Math.floor(seeded(i + 11) * 10);

    for (let r = 0; r < rows; r++) {

      const yy =
        y - r * fs * 1.15;

      if (yy < -fs || yy > h) {
        continue;
      }

      const alpha =
        (0.02 + 0.055 * seeded(i * 19 + r)) *
        intensity;

      ctx.fillStyle =
        `rgba(0,151,255,${alpha})`;

      ctx.fillText(
        String.fromCharCode(
          48 + Math.floor(
            seeded(i * 7 + r) * 10
          )
        ),
        i * fs * 1.35 + fs / 2,
        yy
      );
    }
  }
}


/* =========================
   BACKGROUND
========================= */

function background(t, energy) {

  const w = canvas.width;
  const h = canvas.height;

  const gradient =
    ctx.createRadialGradient(
      w * 0.5,
      h * 0.42,
      0,
      w * 0.5,
      h * 0.48,
      Math.max(w, h) * 0.75
    );

  gradient.addColorStop(
    0,
    "#071c32"
  );

  gradient.addColorStop(
    0.45,
    "#030b15"
  );

  gradient.addColorStop(
    1,
    "#010308"
  );

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  matrix(
    t,
    0.9 + energy * 0.7
  );

  const glow =
    ctx.createRadialGradient(
      w * 0.5,
      h * 0.55,
      0,
      w * 0.5,
      h * 0.55,
      Math.min(w, h) * 0.42
    );

  glow.addColorStop(
    0,
    `rgba(0,126,255,${0.04 + energy * 0.06})`
  );

  glow.addColorStop(
    1,
    "rgba(0,0,0,0)"
  );

  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}


/* =========================
   TEXTO
========================= */

function textLayer() {

  const w = canvas.width;
  const h = canvas.height;

  const cx = w / 2;
  const cy = h * 0.43;

  const base = Math.min(w, h);

  const artistText =
    (artist.value || "ARTISTA")
      .trim()
      .toUpperCase();

  const titleText =
    (title.value || "TÍTULO DE LA CANCIÓN")
      .trim()
      .toUpperCase();

  ctx.textAlign = "center";

  ctx.shadowColor = "#66c9ff";
  ctx.shadowBlur = 18;

  ctx.fillStyle = "#f4fbff";

  ctx.font =
    `800 ${Math.max(24, base * 0.055)}px Arial`;

  ctx.fillText(
    artistText,
    cx,
    cy
  );

  ctx.shadowBlur = 12;

  ctx.fillStyle = "#13a4ff";

  ctx.font =
    `600 ${Math.max(15, base * 0.027)}px Arial`;

  ctx.fillText(
    titleText,
    cx,
    cy + Math.max(30, base * 0.07)
  );

  ctx.shadowBlur = 0;
}


/* =========================
   VISUALIZADOR — ESPECTRO
========================= */

function spectrum(energy, t) {

  const w = canvas.width;
  const h = canvas.height;

  const cx = w / 2;
  const base = Math.min(w, h);

  const floor = h * 0.73;

  const count = 64;

  const maxWidth =
    Math.min(
      w * 0.74,
      base * 1.15
    );

  const gap =
    Math.max(
      2,
      base * 0.0045
    );

  const bw =
    (maxWidth - gap * (count - 1)) /
    count;

  ctx.save();

  ctx.lineCap = "round";

  for (let i = 0; i < count; i++) {

    const wave =
      0.22 +
      0.78 *
      Math.abs(
        Math.sin(
          i * 0.73 +
          t * 0.0024
        )
      );

    const edge =
      Math.sin(
        i / count * Math.PI
      );

    const height =
      Math.max(
        base * 0.012,
        base *
        (
          0.025 +
          energy *
          0.22 *
          wave *
          edge
        )
      );

    const x =
      cx -
      maxWidth / 2 +
      i * (bw + gap);

    const y =
      floor - height;

    const gradient =
      ctx.createLinearGradient(
        0,
        y,
        0,
        floor
      );

    gradient.addColorStop(
      0,
      "#c5efff"
    );

    gradient.addColorStop(
      0.25,
      "#35b8ff"
    );

    gradient.addColorStop(
      1,
      "#0077ff"
    );

    ctx.fillStyle = gradient;

    ctx.shadowColor = "#078cff";
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
    "rgba(27,165,255,.55)";

  ctx.lineWidth =
    Math.max(
      1,
      base * 0.002
    );

  ctx.beginPath();

  ctx.moveTo(
    cx - maxWidth / 2,
    floor + 2
  );

  ctx.lineTo(
    cx + maxWidth / 2,
    floor + 2
  );

  ctx.stroke();

  ctx.restore();
}


/* =========================
   VISUALIZADOR — ONDA
========================= */

function wave(energy, t) {

  const w = canvas.width;
  const h = canvas.height;

  const base = Math.min(w, h);

  const y = h * 0.70;

  ctx.save();

  ctx.lineWidth =
    Math.max(
      2,
      base * 0.006
    );

  ctx.lineCap = "round";

  for (let k = 0; k < 3; k++) {

    ctx.beginPath();

    for (
      let x = 0;
      x <= w;
      x += 8
    ) {

      const amplitude =
        base *
        (0.025 + k * 0.007) +
        energy *
        base *
        (0.11 - k * 0.018);

      const yy =
        y +
        (k - 1) *
        base *
        0.065 +
        Math.sin(
          x * 0.014 +
          t * 0.006 +
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
        ? "#bdefff"
        : "rgba(0,135,255,.65)";

    ctx.shadowColor = "#078cff";
    ctx.shadowBlur = 15;

    ctx.stroke();
  }

  ctx.restore();
}


/* =========================
   VISUALIZADOR — PARTÍCULAS
========================= */

function particles(energy, t) {

  const w = canvas.width;
  const h = canvas.height;

  const cx = w / 2;
  const base = Math.min(w, h);

  ctx.save();

  for (let i = 0; i < 180; i++) {

    const angle =
      seeded(i) * Math.PI * 2 +
      t *
      0.00025 *
      (0.5 + seeded(i + 4));

    const radius =
      base *
      (0.16 + seeded(i + 9) * 0.27) +
      energy *
      base *
      0.1;

    const x =
      cx +
      Math.cos(angle) *
      radius;

    const y =
      h * 0.64 +
      Math.sin(angle) *
      radius *
      0.35;

    ctx.fillStyle =
      i % 9 === 0
        ? "#d6f5ff"
        : "rgba(14,151,255,.65)";

    ctx.shadowColor = "#078cff";
    ctx.shadowBlur = 8;

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      Math.max(
        1,
        base *
        0.003 *
        (0.7 + energy * 2)
      ),
      0,
      Math.PI * 2
    );

    ctx.fill();
  }

  ctx.restore();
}


/* =========================
   RENDER
========================= */

function draw(t, energy) {

  background(t, energy);

  textLayer();

  if (currentStyle === "spectrum") {
    spectrum(energy, t);
  }

  if (currentStyle === "wave") {
    wave(energy, t);
  }

  if (currentStyle === "particles") {
    particles(energy, t);
  }
}


/* =========================
   AUDIO ANALYSIS
========================= */

function energy() {

  if (!analyser) {
    return 0.08;
  }

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


/* =========================
   STOP
========================= */

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

  progress.style.width = "0%";

  previewTime.textContent =
    "0:00 / 0:10";

  playBtn.textContent = "▶";
}


/* =========================
   PREVIEW
========================= */

async function preview() {

  if (!buffer) {
    return;
  }

  stop();

  const ac = audioEngine();

  await ac.resume();

  analyser =
    ac.createAnalyser();

  analyser.fftSize = 1024;

  analyser.smoothingTimeConstant = 0.72;

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
      playBtn.textContent = "▶";
    }
  };

  source.start(0);

  playing = true;

  playBtn.textContent = "■";

  const start =
    performance.now();

  const loop = now => {

    if (!playing) {
      return;
    }

    const elapsed =
      (now - start) / 1000;

    if (elapsed >= PREVIEW_SECONDS) {

      stop();

      draw(now, 0.08);

      return;
    }

    draw(
      now,
      energy()
    );

    progress.style.width =
      `${elapsed / PREVIEW_SECONDS * 100}%`;

    previewTime.textContent =
      `${fmt(elapsed)} / 0:10`;

    animationId =
      requestAnimationFrame(loop);
  };

  animationId =
    requestAnimationFrame(loop);
}


/* =========================
   DOWNLOAD
========================= */

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

  a.download =
    `${name}.webm`;

  document.body.appendChild(a);

  a.click();

  a.remove();

  setTimeout(
    () => URL.revokeObjectURL(url),
    60000
  );
}


/* =========================
   EXPORT WEBM
========================= */

async function exportVideo() {

  if (!buffer) {
    return;
  }

  const AC =
    window.AudioContext ||
    window.webkitAudioContext;

  if (
    !AC ||
    !HTMLCanvasElement.prototype.captureStream ||
    !window.MediaRecorder
  ) {

    setStatus(
      "Este navegador no ofrece la captura WEBM necesaria. Usa Chrome o Edge de escritorio."
    );

    return;
  }

  stop();

  exportBtn.disabled = true;

  exportBtn.classList.add(
    "exporting"
  );

  if (exportFill) {
    exportFill.style.width = "0%";
  }

  if (exportProgress) {
    exportProgress.style.width = "0%";
  }

  const format =
    formats[formatSelect.value];

  canvas.width = format.w;
  canvas.height = format.h;

  const ac = new AC();

  await ac.resume();

  const src =
    ac.createBufferSource();

  src.buffer = buffer;

  const analyserExport =
    ac.createAnalyser();

  analyserExport.fftSize = 1024;

  analyserExport.smoothingTimeConstant =
    0.72;

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
      ...audioDestination
        .stream
        .getAudioTracks()
    ]);

  const mimeTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];

  const mime =
    mimeTypes.find(
      m => MediaRecorder.isTypeSupported(m)
    );

  if (!mime) {

    setStatus(
      "WEBM no está disponible. Usa Chrome o Edge de escritorio."
    );

    stream
      .getTracks()
      .forEach(track => track.stop());

    await ac.close();

    exportBtn.disabled = false;

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
    event => {

      if (
        event.data &&
        event.data.size
      ) {
        chunks.push(event.data);
      }
    };

  const stopped =
    new Promise(resolve => {

      recorder.addEventListener(
        "stop",
        resolve,
        { once: true }
      );

    });

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

    /* Usamos el analyser DE EXPORTACIÓN */
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
        0.08
      );

      setStatus(
        `EXPORTANDO WEBM · 100% · ${fmt(duration)} / ${fmt(duration)}`
      );

      /*
       * Dejamos que MediaRecorder
       * vacíe el último chunk.
       */

      setTimeout(() => {

        if (
          recorder.state !==
          "inactive"
        ) {
          recorder.stop();
        }

      }, 350);

    },
    { once: true }
  );

  src.start(0);

  renderId =
    requestAnimationFrame(
      renderExport
    );

  /*
   * Seguro por si algún navegador
   * no dispara "ended".
   */

  setTimeout(() => {

    if (
      recorder.state !==
      "inactive"
    ) {

      cancelAnimationFrame(
        renderId
      );

      draw(
        performance.now(),
        0.08
      );

      recorder.stop();
    }

  }, (duration + 3) * 1000);

  await stopped;

  stream
    .getTracks()
    .forEach(track => track.stop());

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

  exportBtn.classList.remove(
    "exporting"
  );

  fit();
}


/* =========================
   SUBIR AUDIO
========================= */

audioInput.addEventListener(
  "change",
  async event => {

    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    try {

      const ac =
        audioEngine();

      await ac.resume();

      buffer =
        await ac.decodeAudioData(
          await file.arrayBuffer()
        );

      fileLabel.textContent =
        file.name.length > 27
          ? file.name.slice(0, 24) + "…"
          : file.name;

      empty.style.display =
        "none";

      playBtn.disabled = false;

      muteBtn.disabled = false;

      exportBtn.disabled = false;

      setStatus(
        `Audio listo · ${fmt(buffer.duration)} · elige formato y exporta.`
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


/* =========================
   CONTROLES
========================= */

artist.addEventListener(
  "input",
  () => draw(
    performance.now(),
    0.08
  )
);

title.addEventListener(
  "input",
  () => draw(
    performance.now(),
    0.08
  )
);

styleSelect.addEventListener(
  "change",
  () => {

    currentStyle =
      styleSelect.value;

    draw(
      performance.now(),
      0.08
    );
  }
);

formatSelect.addEventListener(
  "change",
  fit
);

playBtn.addEventListener(
  "click",
  () => playing
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


/* =========================
   INICIO
========================= */

fit();

draw(
  performance.now(),
  0.08
);

})();
