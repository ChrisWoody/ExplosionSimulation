# Anime Explosion Simulator

A browser-based explosion simulator with an anime visual aesthetic. Renders a single configurable explosion in real time using WebGL and Three.js, styled with bright saturated colours, cel-shading, hand-drawn overlay effects, and ink-style outlines.

## Features

- Real-time anime-style explosion rendering
- Configurable particle system (count, speed, colour, lifetime, etc.)
- Custom GLSL post-processing pipeline (bloom, outlines, cel-shading, shockwave distortion)
- Hand-drawn overlay effects (speed lines, impact rings, stylised sparks)
- Loop mode for continuous playback
- Runs entirely in the browser — no build step required

## Getting Started

Serve the project directory with any static file server and open `index.html` in a browser.

```bash
# Example using Python
python -m http.server 8000

# Example using Node.js
npx serve .
```

Then navigate to `http://localhost:8000`.

## Technology

- [Three.js](https://threejs.org/) — 3D rendering, particle geometry, post-processing
- Custom GLSL shaders — anime post-processing effects
- Vanilla JavaScript (ES modules)

## License

This project is licensed under the [MIT License](LICENSE).
