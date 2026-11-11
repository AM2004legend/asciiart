# asciiart

Live character art from your camera, photos and videos, rendered on the GPU in the browser.

asciiart reads each frame on the GPU, measures its brightness, and redraws it as text. Each cell picks a character from a density ramp, with ordered dithering so gradients survive. Optional Sobel edge tracing draws outlines as `-` `/` `|` `\`. Everything runs locally and nothing is uploaded.

## Features

- **Live camera.** Switch between front and back cameras on phones, with mirroring for selfies.
- **Images and videos.** Open, drag and drop, or paste them in.
- **Three styles.**
  - **Characters**: classic ASCII.
  - **Braille**: a 2×4 dot grid per cell, for 8× the detail.
  - **Dots**: halftone.
- **Fine grain.** Cells go down to 3px, about 400 columns on a 1080p screen.
- **Auto contrast.** Each frame is stretched to use every shade, which matters for flat webcam light.
- **Ordered dithering and temporal denoise.** Gradients read clearly and still areas don't shimmer.
- **Edge tracing.** Optional Sobel outlines with adjustable sensitivity.
- **Six palettes, plus color taken from the source.** Light palettes invert automatically.
- **Character sets.** Classic, Detailed, Blocks, Binary, or your own characters.
- **Export.** Save a PNG, copy the frame as text (Braille copies as real Unicode Braille), or save it as `.txt`.
- **Out of the way.** The interface fades while you watch, and your settings are remembered.

## Getting started

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev       # http://localhost:5173
```

Camera access needs a secure context: `localhost` works during development, and production needs HTTPS.

| Script            | What it does                         |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the dev server with hot reload |
| `npm run build`   | Build to `dist/`                     |
| `npm run preview` | Serve the production build locally   |
| `npm run lint`    | Lint with ESLint                     |

## Keyboard shortcuts

| Key     | Action                      |
| ------- | --------------------------- |
| `Space` | Pause or resume             |
| `S`     | Save PNG                    |
| `C`     | Copy as text                |
| `A`     | Show or hide adjustments    |
| `V`     | Switch front or back camera |
| `E`     | Turn outlines on or off     |
| `H`     | Hide the interface          |
| `F`     | Full screen                 |
| `Esc`   | Close panel, show interface |

## How it works

The renderer is a four-pass WebGL2 pipeline. Each pass is a single full-screen triangle, and no per-pixel work runs in JavaScript.

```text
frame ─► ANALYZE ──────────► STATS ───────────► CLASSIFY ─────────────► DRAW ──────► screen
         per sample:         1×1 texture:        per cell:               per pixel:
         mip-averaged color  brightness mean     auto contrast, Bayer    glyph atlas
         + luma, denoised    and spread          dither, Sobel edges     lookup
         against last frame                      or braille bitmask
```

- **Area averaging for free.** The source is mipmapped every frame, and each sample reads the mip level whose texel matches its size. This keeps the output stable instead of shimmering.
- **Braille detail.** Braille samples a 2×4 grid per cell and dithers each dot on or off. The 8 bits index straight into a 256-glyph atlas.
- **Smooth auto contrast.** It uses the frame's mean and spread, both smoothed over time so exposure doesn't pump.
- **Motion-aware denoise.** Each sample blends with the previous frame only where it barely changed.
- **Exact glyphs.** Glyphs are drawn once per cell size at device-pixel resolution and read with `texelFetch`, so they stay crisp at any DPI.
- **Redraws only on change.** A frame is rendered only when the video produced a new frame or a setting changed. A still image costs nothing once it is drawn.
- **Text export from the GPU.** The text export reads the small `cols × rows` glyph-index texture back from the GPU, so it matches the screen exactly.

## Project structure

```text
src/
├── engine/                 framework-free rendering (no React)
│   ├── AsciiRenderer.js    WebGL2 pipeline, frame loop, export
│   ├── shaders.js          GLSL for the four passes
│   ├── glyphAtlas.js       draws characters, braille and dots into a texture
│   └── demoSource.js       animated logo for the start screen
├── hooks/
│   ├── useMediaSource.js   camera / file input, race-safe
│   ├── useSettings.js      settings persisted to localStorage
│   ├── useIdle.js          fades the interface when idle
│   └── useToast.js
├── components/
│   ├── Stage.jsx           canvas + bridge from React state to the renderer
│   ├── TopBar.jsx          wordmark and live status
│   ├── StartScreen.jsx
│   ├── Dock.jsx            main actions
│   ├── SettingsPanel.jsx   Adjust panel
│   ├── controls.jsx        Slider, Switch, Segmented, IconButton
│   └── icons.jsx
├── config/presets.js       palettes, character sets, defaults
├── styles/index.css
├── App.jsx
└── main.jsx
```

## Browser support

Any browser with WebGL2: current Chrome, Edge, Firefox and Safari (15+), on desktop and mobile.

## Deploying

`npm run build` produces a static site in `dist/` that you can host anywhere: GitHub Pages, Netlify, Vercel, or Cloudflare Pages. Serve it over HTTPS so the camera works. For GitHub Pages under a sub-path, set `base` in `vite.config.js`, for example `base: '/asciiart/'`.
