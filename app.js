(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const FORMAT = {
    "16:9": [1920, 1080],
    "9:16": [1080, 1920],
    "1:1": [1080, 1080]
  };

  const state = {
    audioFile: null,
    audioUrl: null,
    buffer: null,
    duration: 0,
    start: 0,
    end: 0,

    image: null,
    imageUrl: null,
    imageX: 0.5,
    imageY: 0.5,
    zoom: 1,

    format: "16:9",
    style: "pulse",

    audioContext: null,
    source: null,
    analyser: null,
    playing: false,
    animationId: null
  };

  // ---------------- UTILIDADES ----------------

  function formatTime(seconds) {
    seconds = Math.max(0, Number(seconds) || 0);

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");

    return `${minutes}:${secs}`;
  }

  function go(screenName) {
    $$(".screen").forEach((screen) => {
      screen.classList.toggle(
        "active",
        screen.dataset.screen === screenName
      );
    });

    const status = $("#status");

    if (status) {
      status.textContent =
        screenName === "home" ? "Listo" : screenName;
    }

    if (screenName === "image") {
      requestAnimationFrame(resizeImageCanvas);
    }

    if (screenName === "visualizer") {
      requestAnimationFrame(drawVisualizer);
    }

    if (screenName === "export") {
      requestAnimationFrame(() => {
        drawExportPreview();
        updateCompatibility();
      });
    }
  }

  // ---------------- NAVEGACIÓN ----------------

  $$("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.go;

      if (target === "image" && !state.buffer) {
        alert("Primero selecciona una canción.");
        return;
      }

      if (
        target === "visualizer" &&
        (!state.buffer || !state.image)
      ) {
        alert("Primero selecciona una canción y una imagen.");
        return;
      }

      go(target);
    });
  });

  // ---------------- AUDIO ----------------

  async function loadAudio(file) {
    if (!file) return;

    try {
      if (state.audioUrl) {
        URL.revokeObjectURL(state.audioUrl);
      }

      state.audioFile = file;
      state.audioUrl = URL.createObjectURL(file);

      $("#audioPlayer").src = state.audioUrl;
      $("#audioPanel").classList.remove("hidden");

      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error("Web Audio API no disponible.");
      }

      if (!state.audioContext) {
        state.audioContext = new AudioContextClass();
      }

      const arrayBuffer = await file.arrayBuffer();

      state.buffer =
        await state.audioContext.decodeAudioData(
          arrayBuffer
        );

      state.duration = state.buffer.duration;
      state.start = 0;
      state.end = state.duration;

      $("#startRange").min = "0";
      $("#startRange").max = String(state.duration);
      $("#startRange").value = "0";

      $("#endRange").min = "0";
      $("#endRange").max = String(state.duration);
      $("#endRange").value = String(state.duration);

      $("#audioInfo").textContent =
        `${file.name} · ${formatTime(state.duration)}`;

      $("#startLabel").textContent = "0:00";
      $("#endLabel").textContent =
        formatTime(state.duration);

      $("#toImage").disabled = false;

      drawWaveform();

    } catch (error) {
      console.error(error);

      alert(
        "No pude leer este audio. Prueba con un MP3 o WAV válido."
      );
    }
  }

  $("#audioInput").addEventListener(
    "change",
    (event) => {
      loadAudio(event.target.files[0]);
    }
  );

  function drawWaveform() {
    const canvas = $("#waveform");

    if (!canvas || !state.buffer) return;

    const width = Math.max(
      600,
      canvas.clientWidth * 2
    );

    const height = 200;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(
      0,
      0,
      width,
      height
    );

    const data =
      state.buffer.getChannelData(0);

    const step =
      Math.max(
        1,
        Math.ceil(data.length / width)
      );

    ctx.beginPath();
    ctx.strokeStyle = "#b8ff4a";
    ctx.lineWidth = 1;

    for (let x = 0; x < width; x++) {

      let min = 1;
      let max = -1;

      const start = x * step;

      const finish =
        Math.min(
          start + step,
          data.length
        );

      for (
        let i = start;
        i < finish;
        i++
      ) {
        min = Math.min(min, data[i]);
        max = Math.max(max, data[i]);
      }

      ctx.moveTo(
        x,
        height / 2 +
          min * height * 0.4
      );

      ctx.lineTo(
        x,
        height / 2 +
          max * height * 0.4
      );
    }

    ctx.stroke();
  }

  function updateTrim(input) {

    const value = Number(input.value);

    if (input.id === "startRange") {

      state.start =
        Math.min(
          value,
          state.end - 0.01
        );

    } else {

      state.end =
        Math.max(
          value,
          state.start + 0.01
        );
    }

    $("#startRange").value =
      String(state.start);

    $("#endRange").value =
      String(state.end);

    $("#startLabel").textContent =
      formatTime(state.start);

    $("#endLabel").textContent =
      formatTime(state.end);

    drawWaveform();
  }

  $("#startRange").addEventListener(
    "input",
    (event) => updateTrim(event.target)
  );

  $("#endRange").addEventListener(
    "input",
    (event) => updateTrim(event.target)
  );

  // ---------------- IMAGEN ----------------

  function resizeImageCanvas() {

    const frame = $("#frame");
    const canvas = $("#imageCanvas");

    if (!frame || !canvas) return;

    const [width, height] =
      FORMAT[state.format];

    frame.style.aspectRatio =
      `${width}/${height}`;

    const cssWidth =
      Math.max(
        1,
        frame.clientWidth
      );

    const cssHeight =
      Math.max(
        1,
        frame.clientHeight
      );

    const pixelRatio =
      Math.min(
        window.devicePixelRatio || 1,
        2
      );

    canvas.width =
      Math.round(
        cssWidth * pixelRatio
      );

    canvas.height =
      Math.round(
        cssHeight * pixelRatio
      );

    canvas.style.width =
      `${cssWidth}px`;

    canvas.style.height =
      `${cssHeight}px`;

    drawImage();
  }

  function drawImage() {

    const canvas =
      $("#imageCanvas");

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    const width =
      canvas.width;

    const height =
      canvas.height;

    ctx.clearRect(
      0,
      0,
      width,
      height
    );

    ctx.fillStyle = "#111";

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    if (!state.image) return;

    const scale =
      Math.max(
        width / state.image.width,
        height / state.image.height
      ) * state.zoom;

    const imageWidth =
      state.image.width * scale;

    const imageHeight =
      state.image.height * scale;

    const x =
      width * state.imageX -
      imageWidth / 2;

    const y =
      height * state.imageY -
      imageHeight / 2;

    ctx.drawImage(
      state.image,
      x,
      y,
      imageWidth,
      imageHeight
    );
  }

  $("#imageInput").addEventListener(
    "change",
    (event) => {

      const file =
        event.target.files[0];

      if (!file) return;

      if (state.imageUrl) {
        URL.revokeObjectURL(
          state.imageUrl
        );
      }

      state.imageUrl =
        URL.createObjectURL(file);

      const image =
        new Image();

      image.onload = () => {

        state.image = image;

        state.imageX = 0.5;
        state.imageY = 0.5;
        state.zoom = 1;

        $("#zoomRange").disabled =
          false;

        $("#centerImage").disabled =
          false;

        $("#toViz").disabled =
          !state.buffer;

        $("#imageHint").style.display =
          "none";

        $("#zoomRange").value =
          "1";

        resizeImageCanvas();

        drawVisualizer();
      };

      image.onerror = () => {

        alert(
          "No pude cargar esa imagen. Prueba JPG, PNG o WebP."
        );
      };

      image.src =
        state.imageUrl;
    }
  );

  $("#zoomRange").addEventListener(
    "input",
    (event) => {

      state.zoom =
        Number(event.target.value);

      drawImage();
      drawVisualizer();
    }
  );

  $("#centerImage").addEventListener(
    "click",
    () => {

      state.imageX = 0.5;
      state.imageY = 0.5;
      state.zoom = 1;

      $("#zoomRange").value =
        "1";

      drawImage();
      drawVisualizer();
    }
  );

  // ---------------- ARRASTRAR IMAGEN ----------------

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  $("#imageCanvas").addEventListener(
    "pointerdown",
    (event) => {

      if (!state.image) return;

      dragging = true;

      $("#imageCanvas").setPointerCapture(
        event.pointerId
      );

      lastX = event.clientX;
      lastY = event.clientY;
    }
  );

  $("#imageCanvas").addEventListener(
    "pointermove",
    (event) => {

      if (!dragging || !state.image) {
        return;
      }

      const rect =
        $("#imageCanvas")
          .getBoundingClientRect();

      state.imageX =
        Math.max(
          0,
          Math.min(
            1,
            state.imageX +
              (event.clientX - lastX) /
                rect.width
          )
        );

      state.imageY =
        Math.max(
          0,
          Math.min(
            1,
            state.imageY +
              (event.clientY - lastY) /
                rect.height
          )
        );

      lastX = event.clientX;
      lastY = event.clientY;

      drawImage();
      drawVisualizer();
    }
  );

  $("#imageCanvas").addEventListener(
    "pointerup",
    () => {
      dragging = false;
    }
  );

  $("#imageCanvas").addEventListener(
    "pointercancel",
    () => {
      dragging = false;
    }
  );

  // ---------------- FORMATO ----------------

  function setFormat(format) {

    if (!FORMAT[format]) return;

    state.format = format;

    $$(".format").forEach(
      (button) => {

        button.classList.toggle(
          "active",
          button.dataset.format ===
            format
        );
      }
    );

    resizeImageCanvas();
    drawVisualizer();
    drawExportPreview();
  }

  $$(".format").forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {
          setFormat(
            button.dataset.format
          );
        }
      );
    }
  );

  // ---------------- ESTILO ----------------

  $$(".style").forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          state.style =
            button.dataset.style;

          $$(".style").forEach(
            (item) => {

              item.classList.toggle(
                "active",
                item.dataset.style ===
                  state.style
              );
            }
          );

          drawVisualizer();
        }
      );
    }
  );

  // ---------------- AUDIO ANALYZER ----------------

  function getAudioData() {

    if (!state.analyser) {
      return null;
    }

    const values =
      new Uint8Array(
        state.analyser
          .frequencyBinCount
      );

    state.analyser
      .getByteFrequencyData(values);

    return [
      ...values.slice(0, 64)
    ].map(
      (value) => value / 255
    );
  }

  function averageAudio(data) {

    if (
      !data ||
      data.length === 0
    ) {
      return 0.2;
    }

    return (
      data.reduce(
        (sum, value) =>
          sum + value,
        0
      ) / data.length
    );
  }

  // ---------------- ESCENA ----------------

  function drawScene(
    ctx,
    width,
    height,
    time,
    audioData
  ) {

    ctx.fillStyle =
      "#050506";

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    if (state.image) {

      const scale =
        Math.max(
          width /
            state.image.width,
          height /
            state.image.height
        ) * state.zoom;

      const imageWidth =
        state.image.width *
        scale;

      const imageHeight =
        state.image.height *
        scale;

      const x =
        width * state.imageX -
        imageWidth / 2;

      const y =
        height * state.imageY -
        imageHeight / 2;

      ctx.globalAlpha =
        0.84;

      ctx.drawImage(
        state.image,
        x,
        y,
        imageWidth,
        imageHeight
      );

      ctx.globalAlpha = 1;
    }

    const energy =
      averageAudio(audioData);

    // PULSE
    if (state.style === "pulse") {

      ctx.beginPath();

      ctx.arc(
        width / 2,
        height / 2,
        Math.min(
          width,
          height
        ) *
          (0.22 +
            energy * 0.06),
        0,
        Math.PI * 2
      );

      ctx.strokeStyle =
        "#b8ff4a";

      ctx.lineWidth =
        Math.max(
          3,
          width / 500
        );

      ctx.stroke();
    }

    // WAVE
    else if (
      state.style === "wave"
    ) {

      ctx.beginPath();

      ctx.strokeStyle =
        "#b8ff4a";

      ctx.lineWidth =
        Math.max(
          2,
          width / 700
        );

      for (
        let i = 0;
        i < 100;
        i++
      ) {

        const x =
          (i / 99) * width;

        const y =
          height * 0.8 +
          Math.sin(
            i * 0.45 + time
          ) *
            energy *
            height *
            0.2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }

    // NEON
    else if (
      state.style === "neon"
    ) {

      for (
        let i = 0;
        i < 36;
        i++
      ) {

        const angle =
          i * 2.4 +
          time * 0.15;

        const radius =
          Math.min(
            width,
            height
          ) *
          (
            0.20 +
            (i % 8) *
              0.035
          );

        const x =
          width / 2 +
          Math.cos(angle) *
            radius;

        const y =
          height / 2 +
          Math.sin(angle) *
            radius;

        ctx.fillStyle =
          i % 2
            ? "#b8ff4acc"
            : "#ffffffaa";

        ctx.beginPath();

        ctx.arc(
          x,
          y,
          3 + energy * 10,
          0,
          Math.PI * 2
        );

        ctx.fill();
      }
    }
  }

  // ---------------- VISUALIZADOR ----------------

  const visualizerCanvas =
    $("#vizCanvas");

  const visualizerCtx =
    visualizerCanvas.getContext("2d");

  function prepareCanvas(canvas) {

    const [
      width,
      height
    ] = FORMAT[state.format];

    canvas.width = width;
    canvas.height = height;

    return [
      width,
      height
    ];
  }

  function drawVisualizer() {

    if (!visualizerCanvas) {
      return;
    }

    const [
      width,
      height
    ] =
      prepareCanvas(
        visualizerCanvas
      );

    const box =
      visualizerCanvas.parentElement;

    const availableWidth =
      Math.max(
        1,
        box.clientWidth - 20
      );

    const maxHeight =
      Math.max(
        240,
        window.innerHeight *
          0.6
      );

    const scale =
      Math.min(
        availableWidth / width,
        maxHeight / height,
        1
      );

    visualizerCanvas.style.width =
      `${Math.round(
        width * scale
      )}px`;

    visualizerCanvas.style.height =
      `${Math.round(
        height * scale
      )}px`;

    drawScene(
      visualizerCtx,
      width,
      height,
      performance.now() / 500,
      getAudioData()
    );
  }

  // ---------------- REPRODUCIR ----------------

  async function playAudio() {

    if (!state.buffer) {
      return;
    }

    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) {

      alert(
        "Este navegador no soporta Web Audio."
      );

      return;
    }

    if (!state.audioContext) {

      state.audioContext =
        new AudioContextClass();
    }

    await state.audioContext.resume();

    stopAudio();

    state.source =
      state.audioContext
        .createBufferSource();

    state.analyser =
      state.audioContext
        .createAnalyser();

    state.analyser.fftSize =
      256;

    state.source.buffer =
      state.buffer;

    state.source.connect(
      state.analyser
    );

    state.analyser.connect(
      state.audioContext.destination
    );

    state.source.onended =
      () => {

        state.playing = false;

        $("#playBtn").textContent =
          "▶ Reproducir";
      };

    state.source.start(
      0,
      state.start,
      Math.max(
        0.01,
        state.end -
          state.start
      )
    );

    state.playing = true;

    $("#playBtn").textContent =
      "■ Detener";

    function animate() {

      if (!state.playing) {
        return;
      }

      drawVisualizer();

      state.animationId =
        requestAnimationFrame(
          animate
        );
    }

    animate();
  }

  function stopAudio() {

    if (state.source) {

      try {
        state.source.stop();
      } catch (_) {}

      state.source = null;
    }

    state.playing = false;

    if (state.animationId) {

      cancelAnimationFrame(
        state.animationId
      );

      state.animationId = null;
    }

    if ($("#playBtn")) {

      $("#playBtn").textContent =
        "▶ Reproducir";
    }
  }

  $("#playBtn").addEventListener(
    "click",
    () => {

      if (state.playing) {
        stopAudio();
      } else {
        playAudio();
      }
    }
  );

  // ---------------- EXPORTACIÓN ----------------

  function updateCompatibility() {

    const compat =
      $("#compat");

    if (!compat) return;

    const canvasOK =
      typeof HTMLCanvasElement !==
        "undefined" &&
      typeof
        HTMLCanvasElement
          .prototype
          .captureStream ===
        "function";

    const recorderOK =
      typeof window.MediaRecorder !==
      "undefined";

    if (
      canvasOK &&
      recorderOK
    ) {

      compat.textContent =
        "Este navegador parece compatible con la exportación local. Chrome y Edge suelen ofrecer la mejor compatibilidad.";

    } else {

      compat.textContent =
        "Este navegador no ofrece todas las funciones necesarias para exportar video. Prueba Chrome o Edge.";
    }
  }

  function drawExportPreview() {

    const canvas =
      $("#exportCanvas");

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    const [
      width,
      height
    ] =
      prepareCanvas(canvas);

    drawScene(
      ctx,
      width,
      height,
      performance.now() / 500,
      null
    );
  }

  async function exportVideo() {

    if (
      !state.buffer ||
      !state.image
    ) {

      alert(
        "Carga primero una canción y una imagen."
      );

      return;
    }

    if (
      !HTMLCanvasElement
        .prototype
        .captureStream ||
      !window.MediaRecorder
    ) {

      alert(
        "Este navegador no permite esta forma de exportación. Prueba Chrome o Edge."
      );

      return;
    }

    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) {

      alert(
        "Este navegador no soporta Web Audio."
      );

      return;
    }

    const [
      width,
      height
    ] =
      FORMAT[state.format];

    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width =
      width;

    canvas.height =
      height;

    const ctx =
      canvas.getContext("2d");

    const videoStream =
      canvas.captureStream(30);

    const audioContext =
      new AudioContextClass();

    await audioContext.resume();

    const destination =
      audioContext
        .createMediaStreamDestination();

    const source =
      audioContext
        .createBufferSource();

    source.buffer =
      state.buffer;

    source.connect(
      destination
    );

    const audioTracks =
      destination.stream
        .getAudioTracks();

    if (
      audioTracks.length
    ) {

      videoStream.addTrack(
        audioTracks[0]
      );
    }

    const mimeTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm"
    ];

    const mimeType =
      mimeTypes.find(
        (type) =>
          MediaRecorder
            .isTypeSupported(
              type
            )
      );

    if (!mimeType) {

      await audioContext.close();

      alert(
        "El navegador no ofrece un formato de video compatible."
      );

      return;
    }

    const chunks = [];

    const recorder =
      new MediaRecorder(
        videoStream,
        {
          mimeType,
          videoBitsPerSecond:
            6000000
        }
      );

    recorder.ondataavailable =
      (event) => {

        if (
          event.data &&
          event.data.size > 0
        ) {

          chunks.push(
            event.data
          );
        }
      };

    const stopped =
      new Promise(
        (resolve) => {

          recorder.addEventListener(
            "stop",
            resolve,
            { once: true }
          );
        }
      );

    const duration =
      Math.max(
        0.1,
        state.end -
          state.start
      );

    const progress =
      $("#progress");

    progress.classList.remove(
      "hidden"
    );

    progress.style.width =
      "0%";

    source.start(
      0,
      state.start,
      duration
    );

    recorder.start(250);

    const startTime =
      performance.now();

    function renderFrame(now) {

      const elapsed =
        (now - startTime) /
        1000;

      const percent =
        Math.min(
          1,
          elapsed / duration
        );

      drawScene(
        ctx,
        width,
        height,
        now / 500,
        null
      );

      progress.style.width =
        `${percent * 100}%`;

      if (percent < 1) {

        requestAnimationFrame(
          renderFrame
        );

      } else {

        recorder.stop();
      }
    }

    requestAnimationFrame(
      renderFrame
    );

    await stopped;

    try {
      source.stop();
    } catch (_) {}

    videoStream
      .getTracks()
      .forEach(
        (track) =>
          track.stop()
      );

    await audioContext.close();

    const blob =
      new Blob(
        chunks,
        {
          type: "video/webm"
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;
    link.download =
      "music-release-kit.webm";

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    setTimeout(
      () => {
        URL.revokeObjectURL(
          url
        );
      },
      10000
    );

    progress.style.width =
      "100%";
  }

  $("#exportBtn").addEventListener(
    "click",
    exportVideo
  );

  // ---------------- INICIO ----------------

  window.addEventListener(
    "resize",
    () => {

      resizeImageCanvas();
      drawVisualizer();
      drawExportPreview();
    }
  );

  resizeImageCanvas();
  drawVisualizer();
  drawExportPreview();
  updateCompatibility();

})();