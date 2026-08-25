# MP3 to WEBM — Video Visualizer V2

Client-side tool for GitHub Pages: MP3/WAV → generated artwork → visualizer → 10s preview → WEBM.

## Included
- Minimal electric-blue / Matrix-inspired UI.
- Centered artist and title; visualizer lives below the text.
- 4 social formats: 9:16 (1080×1920), 4:5 (1080×1350), 1:1 (1080×1080), 16:9 (1920×1080).
- Real 10-second audio preview.
- WEBM export with audio.
- 60 FPS capture target.
- No server; processing stays in the browser.

## 60 FPS note
The code requests `canvas.captureStream(60)`. Browser/hardware limits can reduce the actual encoded frame rate, so the UI calls it a capture target rather than a guarantee.

## MP4 note
This V2 intentionally exports WEBM. Reliable H.264/AAC MP4 conversion from GitHub Pages would require another layer (server-side encoding or a heavier browser/WASM encoder). Keep the first version simple and reliable.

## GitHub Pages
Upload `index.html`, `style.css`, and `app.js` to the repository root. Then GitHub → Settings → Pages → Deploy from a branch → `main` → `/root` → Save.

## Export behavior
The browser captures in real time. A 3-minute song therefore takes roughly 3 minutes to export. This is expected for a pure client-side MediaRecorder approach.
