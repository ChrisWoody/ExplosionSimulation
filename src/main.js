import * as THREE from 'three';
import { GUI } from 'lil-gui';
import { config, COLOR_PRESETS } from './config.js';
import { createScene, updateBackground, resizeScene } from './scene.js';
import { FireParticles, SmokeParticles } from './particles.js';
import { Overlays } from './overlays.js';
import { ExplosionManager } from './explosion.js';

// ─── WebGL 2.0 check ───
const testCanvas = document.createElement('canvas');
const gl = testCanvas.getContext('webgl2');
if (!gl) {
    document.getElementById('webgl-error').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    throw new Error('WebGL 2.0 is not supported by this browser.');
}

// ─── Init Three.js scene + post-processing ───
const canvasContainer = document.getElementById('canvas-container');
const { scene, camera, renderer, composer, backgroundMesh, passes } = createScene(canvasContainer);

// ─── Init particle systems ───
const fireParticles = new FireParticles(scene);
const smokeParticles = new SmokeParticles(scene);

// ─── Init overlays ───
const overlays = new Overlays(scene);

// ─── Init explosion manager ───
const explosion = new ExplosionManager(
    fireParticles, smokeParticles, overlays, passes, camera, config
);

// ─── Set initial background ───
updateBackground(backgroundMesh, config);

// ─── GUI Setup ───
const guiContainer = document.getElementById('gui-container');
const gui = new GUI({ container: guiContainer, title: '' });

// -- Shape & Size --
const shapeFolder = gui.addFolder('Shape & Size');
shapeFolder.add(config, 'shape', { 'Sphere': 'Sphere', 'Hemisphere': 'Hemisphere', 'Cone (directional)': 'Cone', 'Ring / Torus': 'Ring' }).name('Shape');
shapeFolder.add(config, 'radius', 0.5, 10.0, 0.1).name('Radius');

// -- Colours --
const coloursFolder = gui.addFolder('Colours');
const presetCtrl = coloursFolder.add(config, 'colorPreset', Object.keys(COLOR_PRESETS)).name('Preset');
const primaryCtrl = coloursFolder.addColor(config, 'primaryColor').name('Primary');
const secondaryCtrl = coloursFolder.addColor(config, 'secondaryColor').name('Secondary');
const accentCtrl = coloursFolder.addColor(config, 'accentColor').name('Accent');

presetCtrl.onChange(name => {
    const preset = COLOR_PRESETS[name];
    if (preset) {
        config.primaryColor = preset.primary;
        config.secondaryColor = preset.secondary;
        config.accentColor = preset.accent;
        primaryCtrl.updateDisplay();
        secondaryCtrl.updateDisplay();
        accentCtrl.updateDisplay();
    }
});
function onManualColorChange() {
    config.colorPreset = 'Custom';
    presetCtrl.updateDisplay();
}
primaryCtrl.onChange(onManualColorChange);
secondaryCtrl.onChange(onManualColorChange);
accentCtrl.onChange(onManualColorChange);

// -- Particles --
const particlesFolder = gui.addFolder('Particles');
particlesFolder.add(config, 'particleCount', 50, 2000, 10).name('Count');
particlesFolder.add(config, 'particleLifetime', 0.3, 5.0, 0.1).name('Lifetime (s)');
particlesFolder.add(config, 'particleSpeed', 0.1, 10.0, 0.1).name('Speed');

// -- Effects Toggles --
const togglesFolder = gui.addFolder('Effects Toggles');
togglesFolder.add(config, 'shockwave').name('Shockwave ring');
togglesFolder.add(config, 'speedLines').name('Speed lines');
togglesFolder.add(config, 'screenShake').name('Screen shake');
togglesFolder.add(config, 'debris').name('Debris / sparks');
togglesFolder.add(config, 'smokeTrail').name('Smoke trail');
togglesFolder.add(config, 'heatRays').name('Heat rays');

// -- Effects Intensity --
const intensityFolder = gui.addFolder('Effects Intensity');
intensityFolder.add(config, 'bloomStrength', 0.0, 3.0, 0.1).name('Bloom strength');
intensityFolder.add(config, 'outlineThickness', 0, 5, 0.5).name('Outline thickness');
intensityFolder.add(config, 'celShadeLevels', 3, 8, 1).name('Cel-shade levels');

// -- Background --
const bgFolder = gui.addFolder('Background');
const bgModeCtrl = bgFolder.add(config, 'backgroundMode', ['Solid', 'Gradient']).name('Mode');
const bgSolidCtrl = bgFolder.addColor(config, 'backgroundColor').name('Solid colour');
const bgTopCtrl = bgFolder.addColor(config, 'gradientTop').name('Gradient top');
const bgBottomCtrl = bgFolder.addColor(config, 'gradientBottom').name('Gradient bottom');

function updateBgVisibility() {
    if (config.backgroundMode === 'Solid') {
        bgSolidCtrl.show();
        bgTopCtrl.hide();
        bgBottomCtrl.hide();
    } else {
        bgSolidCtrl.hide();
        bgTopCtrl.show();
        bgBottomCtrl.show();
    }
    updateBackground(backgroundMesh, config);
}
bgModeCtrl.onChange(updateBgVisibility);
bgSolidCtrl.onChange(() => updateBackground(backgroundMesh, config));
bgTopCtrl.onChange(() => updateBackground(backgroundMesh, config));
bgBottomCtrl.onChange(() => updateBackground(backgroundMesh, config));
updateBgVisibility();

// -- Playback --
const playbackFolder = gui.addFolder('Playback');
const loopCtrl = playbackFolder.add(config, 'loop').name('Loop explosion');
const delayCtrl = playbackFolder.add(config, 'loopDelay', 0.0, 5.0, 0.1).name('Loop delay (s)');

function updateLoopVisibility() {
    if (config.loop) delayCtrl.show();
    else delayCtrl.hide();
}
loopCtrl.onChange(updateLoopVisibility);
updateLoopVisibility();

// ─── EXPLODE button ───
const explodeBtn = document.getElementById('explode-btn');
explodeBtn.addEventListener('click', () => {
    explosion.trigger(config);
});

// ─── Panel toggle ───
const panel = document.getElementById('panel');
const panelToggle = document.getElementById('panel-toggle');
panelToggle.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    panelToggle.classList.toggle('shifted');
    // Allow CSS transition to finish before resize
    setTimeout(() => {
        resizeScene(camera, renderer, composer, passes, canvasContainer);
    }, 320);
});

// ─── Window resize ───
window.addEventListener('resize', () => {
    resizeScene(camera, renderer, composer, passes, canvasContainer);
});

// ─── Animation loop ───
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);

    explosion.update(dt);
    composer.render();
}

animate();
