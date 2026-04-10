import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import {
    passthroughVert,
    outlineFrag,
    celShadeFrag,
    shakeFrag,
    shockwaveFrag,
    backgroundVert,
    backgroundFrag
} from './shaders.js';

// ─── Background mesh ───
function createBackgroundMesh() {
    const geometry = new THREE.PlaneGeometry(200, 200);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uMode: { value: 0 },
            uSolidColor: { value: new THREE.Color('#1a1a2e') },
            uGradientTop: { value: new THREE.Color('#0f0c29') },
            uGradientBottom: { value: new THREE.Color('#302b63') }
        },
        vertexShader: backgroundVert,
        fragmentShader: backgroundFrag,
        depthWrite: false,
        depthTest: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = -80;
    mesh.renderOrder = -1000;
    return mesh;
}

// ─── Custom post-processing shader definitions ───
const OutlineShader = {
    uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(1, 1) },
        thickness: { value: 2.0 }
    },
    vertexShader: passthroughVert,
    fragmentShader: outlineFrag
};

const CelShadeShader = {
    uniforms: {
        tDiffuse: { value: null },
        levels: { value: 5.0 }
    },
    vertexShader: passthroughVert,
    fragmentShader: celShadeFrag
};

const ShakeShader = {
    uniforms: {
        tDiffuse: { value: null },
        offset: { value: new THREE.Vector2(0, 0) }
    },
    vertexShader: passthroughVert,
    fragmentShader: shakeFrag
};

const ShockwaveShader = {
    uniforms: {
        tDiffuse: { value: null },
        center: { value: new THREE.Vector2(0.5, 0.5) },
        radius: { value: 0.0 },
        waveWidth: { value: 0.08 },
        intensity: { value: 0.0 }
    },
    vertexShader: passthroughVert,
    fragmentShader: shockwaveFrag
};

// ─── Create the full scene + post-processing pipeline ───
export function createScene(canvasContainer) {
    const canvas = document.getElementById('webgl-canvas');

    // Renderer
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.autoClear = true;

    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;
    renderer.setSize(width, height);

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 200);
    camera.position.set(0, 0, 20);
    camera.lookAt(0, 0, 0);

    // Background mesh
    const backgroundMesh = createBackgroundMesh();
    scene.add(backgroundMesh);

    // ─── EffectComposer ───
    const composer = new EffectComposer(renderer);

    // 1. Scene render
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // 2. Shockwave distortion
    const shockwavePass = new ShaderPass(ShockwaveShader);
    composer.addPass(shockwavePass);

    // 3. Outline / ink edge
    const outlinePass = new ShaderPass(OutlineShader);
    outlinePass.uniforms.resolution.value.set(width, height);
    composer.addPass(outlinePass);

    // 4. Cel-shading (posterise)
    const celShadePass = new ShaderPass(CelShadeShader);
    composer.addPass(celShadePass);

    // 5. Bloom / glow
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        1.2,   // strength
        0.4,   // radius
        0.2    // threshold
    );
    composer.addPass(bloomPass);

    // 6. Screen shake
    const shakePass = new ShaderPass(ShakeShader);
    composer.addPass(shakePass);

    // 7. Output (tone mapping + gamma)
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    // Collect passes for external control
    const passes = {
        shockwave: shockwavePass,
        outline: outlinePass,
        celShade: celShadePass,
        bloom: bloomPass,
        shake: shakePass
    };

    return { scene, camera, renderer, composer, backgroundMesh, passes };
}

// ─── Update background ───
export function updateBackground(backgroundMesh, cfg) {
    const u = backgroundMesh.material.uniforms;
    if (cfg.backgroundMode === 'Solid') {
        u.uMode.value = 0;
        u.uSolidColor.value.set(cfg.backgroundColor);
    } else {
        u.uMode.value = 1;
        u.uGradientTop.value.set(cfg.gradientTop);
        u.uGradientBottom.value.set(cfg.gradientBottom);
    }
}

// ─── Resize handler ───
export function resizeScene(camera, renderer, composer, passes, canvasContainer) {
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;
    if (width === 0 || height === 0) return;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer.setSize(width, height);

    passes.outline.uniforms.resolution.value.set(width, height);
}
