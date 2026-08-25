# Music Release Kit V1

Sube una canción y una portada, ajusta el recorte, previsualiza un visualizer y exporta el video directamente desde el navegador.

## GitHub Pages

1. Crea un repositorio público.
2. Sube `index.html`, `style.css`, `app.js` y `README.md` a la raíz.
3. Ve a **Settings → Pages**.
4. En Source elige **Deploy from a branch**.
5. Elige `main` y `/ (root)`.
6. Guarda y espera a que aparezca **Visit site**.

## Nota sobre exportación

La exportación usa `Canvas.captureStream()` y `MediaRecorder`. El formato final depende del navegador. Chrome/Edge suelen ofrecer la mejor compatibilidad. Safari puede variar según versión y dispositivo.

No se usa servidor: audio e imágenes se procesan localmente.
