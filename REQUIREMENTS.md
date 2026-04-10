# Anime Explosion Simulator — Requirements

## 1. Project Overview

A browser-based explosion simulator with an **anime visual aesthetic**. The application renders a single configurable explosion in real time using WebGL, styled with bright saturated colours, cel-shading, hand-drawn overlay effects, and ink-style outlines. The user controls every aspect of the explosion through a configuration menu, triggers it with a button, and can optionally loop the animation.

- **Runs entirely in the browser** — no backend, no server, no build step required beyond a static file server.
- **Single explosion at a time** — one active explosion on screen; a new trigger replaces/restarts the current one.
- **No audio.**
- **No export or preset save/load features.**

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **3D / WebGL** | [Three.js](https://threejs.org/) (latest stable) | Scene graph, camera, renderer, particle geometry, post-processing composer |
| **Shaders** | Custom GLSL (vertex + fragment) | Anime post-processing: bloom, outline/edge detection, cel-shading (colour quantisation), shockwave distortion, screen shake |
| **UI** | Vanilla HTML/CSS **or** lightweight lib (`lil-gui` / `dat.GUI`) | Configuration panel, trigger button, loop checkbox |
| **Language** | Vanilla JavaScript (ES modules) | No framework; importmap or CDN for Three.js |
| **Package management** | None required | CDN imports or vendored files |

### Key Three.js features to leverage

- `THREE.Points` / `THREE.BufferGeometry` for GPU-driven particle system.
- `THREE.ShaderMaterial` for custom anime particle rendering.
- `EffectComposer` + custom `ShaderPass` instances for full-screen post-processing chain.
- `THREE.AdditiveBlending` for glow/energy effects.

---

## 3. Rendering & Visual Style (Anime Aesthetic)

### 3.1 Core Visual Identity

The explosion must look like it belongs in a shōnen anime — **not** photorealistic. Key characteristics:

- **Bright, saturated colour palette** — vivid oranges, reds, cyans, magentas; no muted earth tones.
- **Hard-edged outlines** — ink-style contour lines around the fireball and major particle clusters.
- **Cel-shaded gradients** — colour banding (posterisation) so shading snaps between 3–6 discrete tonal steps instead of smooth gradients.
- **Hand-drawn overlay effects** — speed lines, impact rings, and stylised sparks that feel illustrated rather than physically simulated.

### 3.2 Particle System

| Property | Detail |
|---|---|
| **Geometry** | Billboarded quads (always face camera) via `THREE.Points` or instanced quads |
| **Textures** | Stylised anime fire/smoke sprites — soft-edged blobs with painted highlights, not photographic |
| **Blend mode** | Additive blending for core fireball; normal blending for smoke |
| **Animation** | Per-particle: scale up → hold → fade out; colour lerps from bright core to darker edge over lifetime |
| **Count** | Configurable (see §4), default 500 |

### 3.3 Custom GLSL Shader Pipeline (Post-Processing)

The following passes are applied **in order** via Three.js `EffectComposer`:

| Pass | Shader | Description | Configurable? |
|---|---|---|---|
| 1. **Scene render** | Default | Render particles + overlays to an offscreen buffer | — |
| 2. **Outline / Ink Edge** | Sobel or Laplacian edge detection on depth + normal buffers | Draws dark outlines around bright regions to mimic hand-drawn ink | Thickness (px) |
| 3. **Cel-Shading (Posterise)** | Quantise colour channels into N discrete steps | Creates flat anime colour banding | Number of levels (3–8) |
| 4. **Bloom / Glow** | Dual-pass Kawase or Gaussian blur on bright pixels | Bright energy glow around the fireball core | Strength, radius, threshold |
| 5. **Screen Shake** | Translate UV offset with decay | Camera/viewport jitter on explosion trigger | Intensity, duration |
| 6. **Tone mapping + output** | Final gamma / exposure | — | — |

### 3.4 Drawn Overlay Effects

These are **non-particle geometry** rendered in the scene or as screen-space overlays:

| Effect | Geometry | Behaviour |
|---|---|---|
| **Shockwave ring** | Expanding torus / ring mesh or screen-space distortion shader | Expands outward from explosion centre; distorts pixels behind it; fades with distance |
| **Radial speed lines** | Screen-space lines radiating from explosion centre | Appear on trigger, taper in opacity over ~0.3 s; anime "impact frame" feel |
| **Debris / spark trails** | Small particle trails with billboard sprites | Fly outward, leave short fading trails (ribbon or dashed line) |
| **Smoke trail** | Large soft billboard sprites, low alpha | Rise slowly after fireball dissipates; cel-shade tinted |

### 3.5 Background

- Default: dark solid colour (`#1a1a2e`).
- Configurable: solid colour picker **or** vertical linear gradient (two colour pickers).

---

## 4. Configuration Menu

### 4.1 Layout

- **Fixed side panel** on the left or right of the viewport (≤ 320 px wide), scrollable if content overflows.
- The WebGL canvas fills the **remaining viewport space**.
- The panel must be collapsible (toggle button) so the canvas can go full-width.

### 4.2 Controls

All controls update a shared config object. Changes take effect on the **next trigger** (not mid-explosion, unless loop mode is active in which case the next loop iteration uses the updated config).

#### 4.2.1 Shape & Size

| Control | Type | Range / Options | Default |
|---|---|---|---|
| **Explosion shape** | Dropdown | `Sphere`, `Hemisphere`, `Cone (directional)`, `Ring / Torus` | `Sphere` |
| **Radius** | Slider | 0.5 – 10.0 (arbitrary units) | 3.0 |

#### 4.2.2 Colours

| Control | Type | Range / Options | Default |
|---|---|---|---|
| **Colour preset** | Dropdown | `Fire (red/orange)`, `Energy (blue/cyan)`, `Dark Energy (purple/pink)`, `Custom` | `Fire` |
| **Primary colour** | Colour picker | Any RGB | `#ff4500` (orange-red) |
| **Secondary colour** | Colour picker | Any RGB | `#ffd700` (gold) |
| **Accent colour** | Colour picker | Any RGB | `#ffffff` (white-hot core) |

Selecting a preset auto-fills the three colour pickers. Selecting `Custom` unlocks the pickers for free editing.

#### 4.2.3 Particles

| Control | Type | Range | Default |
|---|---|---|---|
| **Particle count** | Slider | 50 – 2 000 | 500 |
| **Particle lifetime** | Slider (seconds) | 0.3 – 5.0 | 1.5 |
| **Particle speed** | Slider | 0.1 – 10.0 | 3.0 |

#### 4.2.4 Effects Toggles

| Control | Type | Default |
|---|---|---|
| **Shockwave ring** | Checkbox | ✅ On |
| **Speed lines** | Checkbox | ✅ On |
| **Screen shake** | Checkbox | ✅ On |
| **Debris / sparks** | Checkbox | ✅ On |
| **Smoke trail** | Checkbox | ✅ On |

#### 4.2.5 Effects Intensity

| Control | Type | Range | Default |
|---|---|---|---|
| **Bloom strength** | Slider | 0.0 – 3.0 | 1.2 |
| **Outline thickness** | Slider (px) | 0 – 5 | 2 |
| **Cel-shade levels** | Slider (integer) | 3 – 8 | 5 |

#### 4.2.6 Background

| Control | Type | Default |
|---|---|---|
| **Background mode** | Toggle: `Solid` / `Gradient` | `Solid` |
| **Background colour** | Colour picker | `#1a1a2e` |
| **Gradient top colour** | Colour picker (visible when Gradient) | `#0f0c29` |
| **Gradient bottom colour** | Colour picker (visible when Gradient) | `#302b63` |

#### 4.2.7 Playback

| Control | Type | Default |
|---|---|---|
| **Loop explosion** | Checkbox | ☐ Off |
| **Loop delay** | Slider (seconds, visible when Loop is on) | 1.0 (range 0.0 – 5.0) |
| **EXPLODE!** | Button (prominent, styled) | — |

---

## 5. Explosion Lifecycle

Each explosion follows a deterministic timeline with four phases:

```
[Trigger] → Expansion → Peak → Dissipation → Idle
```

| Phase | Duration (relative to particle lifetime) | Behaviour |
|---|---|---|
| **Expansion** | 0 % – 30 % | Particles accelerate outward; fireball scales up; shockwave ring begins; speed lines flash; screen shake fires |
| **Peak** | 30 % – 50 % | Full brightness; particles at max spread; bloom at max; shockwave ring fades out |
| **Dissipation** | 50 % – 100 % | Particles decelerate + fade; colours shift toward darker secondary; smoke rises; outlines soften |
| **Idle** | After 100 % | Canvas shows background only (or smoke remnants fading). If **Loop** is checked, wait `loopDelay` seconds then restart from Expansion |

### Easing

- Expansion: ease-out (fast start, decelerate).
- Peak hold: linear.
- Dissipation: ease-in (slow start, accelerate fade).
- All transitions use smooth interpolation — no hard cuts.

---

## 6. Performance Requirements

| Metric | Target |
|---|---|
| **Frame rate** | ≥ 60 FPS on a mid-range GPU (e.g. integrated Intel Iris Xe or NVIDIA GTX 1650) at 1080p |
| **Particle hard cap** | 2 000 (enforced by slider max) |
| **Draw calls** | Minimise — use instancing or `THREE.Points` to render all particles in ≤ 2 draw calls |
| **Memory** | No per-frame allocations in the render loop (pre-allocate buffers) |
| **Responsiveness** | Canvas resizes on `window.resize`; menu remains usable at viewport widths ≥ 800 px |

---

## 7. Browser Compatibility

| Browser | Minimum Version | Notes |
|---|---|---|
| Chrome | 90+ | Primary target |
| Firefox | 90+ | |
| Edge | 90+ | Chromium-based |
| Safari | 15+ | WebGL 2.0 support required |

- **WebGL 2.0** is required. If unavailable, display a clear error message.
- **No Internet Explorer support.**

---

## 8. File / Folder Structure (Suggested)

```
ExplosionSimulation/
├── index.html              # Entry point — loads CSS, JS, canvas
├── style.css               # Menu panel + layout styles
├── src/
│   ├── main.js             # App bootstrap — init scene, renderer, menu, event wiring
│   ├── scene.js            # Three.js scene, camera, lights setup
│   ├── particles.js        # Particle system (BufferGeometry, attributes, update loop)
│   ├── explosion.js        # Explosion lifecycle state machine (trigger, phases, loop)
│   ├── overlays.js         # Shockwave ring, speed lines, debris, smoke
│   ├── config.js           # Shared config object + defaults
│   └── shaders/
│       ├── particle.vert   # Particle vertex shader
│       ├── particle.frag   # Particle fragment shader
│       ├── outline.frag    # Edge-detection post-process
│       ├── celshade.frag   # Posterisation post-process
│       ├── bloom.frag      # Bloom post-process
│       ├── shake.frag      # Screen-shake post-process
│       └── shockwave.frag  # Shockwave distortion
├── assets/
│   └── textures/
│       ├── fire-sprite.png     # Stylised anime fireball sprite
│       ├── smoke-sprite.png    # Stylised anime smoke sprite
│       ├── spark-sprite.png    # Small bright spark
│       └── speedline.png       # Radial line texture
└── REQUIREMENTS.md         # This file
```

---

## 9. Constraints & Non-Goals

- **No backend / API calls.** Everything runs client-side from static files.
- **No audio.**
- **No export** (no GIF, video, or screenshot capture).
- **No save/load** of configuration presets.
- **No mobile-specific optimisation** (touch support is nice-to-have, not required).
- **No physics simulation** — particles follow artistic motion curves, not a physics engine.

---

## 10. Acceptance Criteria

1. Opening `index.html` in a supported browser displays the WebGL canvas and configuration menu.
2. Clicking **EXPLODE!** triggers a single anime-styled explosion with the current configuration.
3. All controls in §4.2 are present and functional — changing a value and re-triggering produces a visibly different explosion.
4. The **Loop** checkbox causes the explosion to repeat automatically with the configured delay.
5. The post-processing pipeline (outline, cel-shading, bloom, screen shake) is visibly active and each effect can be independently toggled off.
6. The shockwave ring, speed lines, debris, and smoke overlays are visible and toggleable.
7. Performance stays at ≥ 60 FPS with default settings at 1080p on a mid-range GPU.
8. The canvas and menu resize correctly when the browser window is resized.
9. A clear error message is shown if WebGL 2.0 is not available.
