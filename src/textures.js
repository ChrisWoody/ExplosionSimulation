import * as THREE from 'three';

export function createFireTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.15, 'rgba(255, 255, 200, 0.9)');
    gradient.addColorStop(0.35, 'rgba(255, 180, 50, 0.6)');
    gradient.addColorStop(0.65, 'rgba(255, 80, 0, 0.25)');
    gradient.addColorStop(1.0, 'rgba(255, 0, 0, 0.0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

export function createSmokeTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0.0, 'rgba(180, 180, 190, 0.5)');
    gradient.addColorStop(0.25, 'rgba(140, 140, 150, 0.35)');
    gradient.addColorStop(0.55, 'rgba(100, 100, 110, 0.15)');
    gradient.addColorStop(1.0, 'rgba(60, 60, 70, 0.0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

export function createSparkTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half * 0.7);
    gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.25, 'rgba(255, 255, 180, 0.9)');
    gradient.addColorStop(0.6, 'rgba(255, 200, 80, 0.4)');
    gradient.addColorStop(1.0, 'rgba(255, 150, 0, 0.0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}
