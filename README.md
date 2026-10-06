# Halcyon

Halcyon is an interactive calm experience. It opens on a threshold, then a floating gallery of three scenes: resting waters (lake), remembering rain, and salt smoke and stars (bonfire).

The site is static. `index.html` is the built page. It loads three.js r170 (WebGPU with a WebGL 2 fallback) and Tone.js from jsDelivr, and it reads `art/` and `audio/` next to it. Add `#webgl` to the URL to force the WebGL 2 path.

## Build

The source is in `src/`: `shell-head.html`, `engine.js`, `scenes/*.js` and `main.js`.

    python3 build.py

This writes `index.html` (the site page) and `halcyon.html` (the artifact copy). `SCENES=rain python3 build.py` builds the lake plus only the named scenes.

## Deploy

Vercel serves the repository root with no build step. `.vercelignore` keeps the source, tools and old builds out of the deployment.

## Credits

Sound credits and licenses are in `audio/CREDITS.md`. Two loops are CC BY and need the attribution in that file.

`archive/` keeps older builds (v1 WebGL, v3, v4).
