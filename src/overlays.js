import * as THREE from 'three';
import { particleVert, particleFrag } from './shaders.js';
import { createSparkTexture } from './textures.js';

function easeOut(t) { return 1 - (1 - t) * (1 - t); }
function easeIn(t) { return t * t; }

const MAX_DEBRIS = 300;
const MAX_RAYS = 18;

function easeOutHard(t) { return 1 - Math.pow(1 - t, 4); }

// ─── Shockwave Ring ───
export class ShockwaveRing {
    constructor(scene) {
        this.rings = [];
        this.group = new THREE.Group();
        this.group.visible = false;
        scene.add(this.group);

        // Create 3 concentric rings for visual richness
        const ringConfigs = [
            { inner: 0.75, outer: 1.0, opacity: 0.8 },
            { inner: 0.5, outer: 0.6, opacity: 0.5 },
            { inner: 0.3, outer: 0.35, opacity: 0.3 }
        ];

        for (const rc of ringConfigs) {
            const geometry = new THREE.RingGeometry(rc.inner, rc.outer, 64);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: rc.opacity,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.renderOrder = 5;
            this.rings.push({ mesh, baseOpacity: rc.opacity });
            this.group.add(mesh);
        }

        this.elapsed = 0;
        this.duration = 0;
    }

    init(cfg) {
        this.group.visible = true;
        this.elapsed = 0;
        this.duration = cfg.particleLifetime * 0.4;
        this.maxScale = cfg.radius * 2.5;

        // Tint rings with accent colour
        const accent = new THREE.Color(cfg.accentColor);
        for (const r of this.rings) {
            r.mesh.material.color.copy(accent);
            r.mesh.scale.set(0.01, 0.01, 1);
            r.mesh.material.opacity = r.baseOpacity;
        }
    }

    update(dt) {
        if (!this.group.visible) return;
        this.elapsed += dt;
        const t = Math.min(this.elapsed / this.duration, 1.0);

        if (t >= 1.0) {
            this.group.visible = false;
            return;
        }

        const scale = this.maxScale * easeOut(t);
        const alpha = 1.0 - easeIn(t);

        for (const r of this.rings) {
            r.mesh.scale.set(scale, scale, 1);
            r.mesh.material.opacity = r.baseOpacity * alpha;
        }
    }

    hide() {
        this.group.visible = false;
    }
}

// ─── Speed Lines ───
export class SpeedLines {
    constructor(scene) {
        this.group = new THREE.Group();
        this.group.visible = false;
        this.group.renderOrder = 20;
        scene.add(this.group);

        this.lines = [];
        const lineCount = 28;

        for (let i = 0; i < lineCount; i++) {
            const angle = (i / lineCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
            const length = 5 + Math.random() * 10;
            const width = 0.03 + Math.random() * 0.04;

            const geometry = new THREE.PlaneGeometry(width, length);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide,
                depthTest: false,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });

            const mesh = new THREE.Mesh(geometry, material);
            const dist = 3 + length / 2;
            mesh.position.set(
                Math.cos(angle) * dist,
                Math.sin(angle) * dist,
                0.5
            );
            mesh.rotation.z = angle - Math.PI / 2;
            mesh.renderOrder = 20;

            this.lines.push({ mesh, baseOpacity: 0.4 + Math.random() * 0.6 });
            this.group.add(mesh);
        }

        this.elapsed = 0;
        this.fadeTime = 0.3;
    }

    init(cfg) {
        this.group.visible = true;
        this.elapsed = 0;
        this.fadeTime = Math.min(cfg.particleLifetime * 0.2, 0.4);
    }

    update(dt) {
        if (!this.group.visible) return;
        this.elapsed += dt;

        const t = Math.min(this.elapsed / this.fadeTime, 1.0);
        const alpha = 1.0 - easeIn(t);

        for (const l of this.lines) {
            l.mesh.material.opacity = l.baseOpacity * alpha;
        }

        if (t >= 1.0) {
            this.group.visible = false;
        }
    }

    hide() {
        this.group.visible = false;
    }
}

// ─── Debris / Sparks ───
export class DebrisSparks {
    constructor(scene) {
        this.count = 0;
        this.sparkTexture = createSparkTexture();

        const positions = new Float32Array(MAX_DEBRIS * 3);
        const colors = new Float32Array(MAX_DEBRIS * 3);
        const sizes = new Float32Array(MAX_DEBRIS);
        const alphas = new Float32Array(MAX_DEBRIS);

        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
        this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTexture: { value: this.sparkTexture }
            },
            vertexShader: particleVert,
            fragmentShader: particleFrag,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: true
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.points.frustumCulled = false;
        this.points.visible = false;
        this.points.renderOrder = 8;
        scene.add(this.points);

        this.velocities = new Float32Array(MAX_DEBRIS * 3);
        this.ages = new Float32Array(MAX_DEBRIS);
        this.maxAges = new Float32Array(MAX_DEBRIS);
        this.baseSizes = new Float32Array(MAX_DEBRIS);
        this.gravity = -2.0;
    }

    init(cfg) {
        this.count = Math.min(Math.floor(cfg.particleCount * 0.2), MAX_DEBRIS);
        this.geometry.setDrawRange(0, this.count);

        const pos = this.geometry.attributes.position.array;
        const col = this.geometry.attributes.aColor.array;
        const siz = this.geometry.attributes.aSize.array;
        const alp = this.geometry.attributes.aAlpha.array;
        const primary = new THREE.Color(cfg.primaryColor);
        const accent = new THREE.Color(cfg.accentColor);

        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;

            pos[i3] = 0;
            pos[i3 + 1] = 0;
            pos[i3 + 2] = 0;

            // High-speed random directions
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const speed = cfg.particleSpeed * (1.5 + Math.random() * 2.0);
            this.velocities[i3] = Math.sin(phi) * Math.cos(theta) * speed;
            this.velocities[i3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
            this.velocities[i3 + 2] = Math.cos(phi) * speed;

            this.ages[i] = 0;
            this.maxAges[i] = cfg.particleLifetime * (0.3 + Math.random() * 0.5);
            this.baseSizes[i] = cfg.radius * (0.05 + Math.random() * 0.12);
            siz[i] = this.baseSizes[i];

            // Mix of primary and accent colours
            const mix = Math.random();
            col[i3] = primary.r * (1 - mix) + accent.r * mix;
            col[i3 + 1] = primary.g * (1 - mix) + accent.g * mix;
            col[i3 + 2] = primary.b * (1 - mix) + accent.b * mix;

            alp[i] = 1.0;
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.aColor.needsUpdate = true;
        this.geometry.attributes.aSize.needsUpdate = true;
        this.geometry.attributes.aAlpha.needsUpdate = true;

        this.points.visible = true;
    }

    update(dt) {
        const pos = this.geometry.attributes.position.array;
        const siz = this.geometry.attributes.aSize.array;
        const alp = this.geometry.attributes.aAlpha.array;

        for (let i = 0; i < this.count; i++) {
            this.ages[i] += dt;
            const t = Math.min(this.ages[i] / this.maxAges[i], 1.0);
            const i3 = i * 3;

            if (t >= 1.0) {
                alp[i] = 0;
                siz[i] = 0;
                continue;
            }

            // Move with velocity + gravity
            pos[i3] += this.velocities[i3] * dt;
            pos[i3 + 1] += this.velocities[i3 + 1] * dt + this.gravity * dt * dt * 0.5;
            pos[i3 + 2] += this.velocities[i3 + 2] * dt;

            // Apply gravity to velocity
            this.velocities[i3 + 1] += this.gravity * dt;

            // Drag
            this.velocities[i3] *= (1 - dt * 0.5);
            this.velocities[i3 + 1] *= (1 - dt * 0.3);
            this.velocities[i3 + 2] *= (1 - dt * 0.5);

            siz[i] = this.baseSizes[i] * (1.0 - t * 0.5);
            alp[i] = 1.0 - easeIn(t);
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.aSize.needsUpdate = true;
        this.geometry.attributes.aAlpha.needsUpdate = true;
    }

    hide() {
        this.points.visible = false;
    }
}

// ─── Heat Rays ───
// Bright elongated beams that shoot outward through/past the fireball surface
export class HeatRays {
    constructor(scene) {
        this.group = new THREE.Group();
        this.group.visible = false;
        this.group.renderOrder = 6;
        scene.add(this.group);

        this.rays = [];
        this.elapsed = 0;
        this.duration = 0;
        this.maxLength = 0;

        // Pre-create ray meshes
        for (let i = 0; i < MAX_RAYS; i++) {
            // Tapered beam: wider at base, thin at tip
            const geometry = new THREE.CylinderGeometry(0.01, 0.12, 1.0, 6, 1, true);
            // Shift origin to base so scaling extends from center outward
            geometry.translate(0, 0.5, 0);

            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                depthWrite: false,
                depthTest: false
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.renderOrder = 6;
            this.group.add(mesh);

            this.rays.push({
                mesh,
                dirX: 0, dirY: 0, dirZ: 0,
                baseOpacity: 0,
                length: 0,
                speed: 0,
                delay: 0,
                width: 0
            });
        }
    }

    init(cfg) {
        this.group.visible = true;
        this.elapsed = 0;
        this.duration = cfg.particleLifetime * 0.55;
        this.maxLength = cfg.radius * 2.5;

        const accent = new THREE.Color(cfg.accentColor);
        const primary = new THREE.Color(cfg.primaryColor);
        const isHemisphere = cfg.shape === 'Hemisphere';
        const rayCount = isHemisphere ? 8 + Math.floor(Math.random() * 6) : 4 + Math.floor(Math.random() * 3);

        for (let i = 0; i < MAX_RAYS; i++) {
            const r = this.rays[i];
            if (i >= rayCount) {
                r.mesh.visible = false;
                r.baseOpacity = 0;
                continue;
            }
            r.mesh.visible = true;

            // Random direction (hemisphere-biased if hemisphere)
            if (isHemisphere) {
                r.dirX = (Math.random() - 0.5) * 2;
                r.dirY = 0.2 + Math.random() * 0.8;
                r.dirZ = (Math.random() - 0.5) * 2;
            } else {
                r.dirX = (Math.random() - 0.5) * 2;
                r.dirY = (Math.random() - 0.5) * 2;
                r.dirZ = (Math.random() - 0.5) * 2;
            }
            const len = Math.sqrt(r.dirX * r.dirX + r.dirY * r.dirY + r.dirZ * r.dirZ);
            r.dirX /= len; r.dirY /= len; r.dirZ /= len;

            r.length = this.maxLength * (0.6 + Math.random() * 0.8);
            r.speed = cfg.particleSpeed * (1.5 + Math.random() * 1.5);
            r.delay = Math.random() * 0.08; // slight stagger
            r.width = 0.06 + Math.random() * 0.1;
            r.baseOpacity = 0.5 + Math.random() * 0.5;

            // Colour: blend of accent and primary for hot intensity
            const mix = 0.2 + Math.random() * 0.3;
            r.mesh.material.color.setRGB(
                accent.r * (1 - mix) + primary.r * mix,
                accent.g * (1 - mix) + primary.g * mix,
                accent.b * (1 - mix) + primary.b * mix
            );
            r.mesh.material.opacity = 0;

            // Orient the ray along its direction
            const up = new THREE.Vector3(0, 1, 0);
            const dir = new THREE.Vector3(r.dirX, r.dirY, r.dirZ);
            const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
            r.mesh.quaternion.copy(quat);
            r.mesh.position.set(0, 0, 0);
            r.mesh.scale.set(r.width, 0.01, r.width);
        }
    }

    update(dt) {
        if (!this.group.visible) return;
        this.elapsed += dt;
        const t = Math.min(this.elapsed / this.duration, 1.0);

        if (t >= 1.0) {
            this.group.visible = false;
            return;
        }

        for (const r of this.rays) {
            if (!r.mesh.visible || r.baseOpacity === 0) continue;

            const rt = Math.max(0, (this.elapsed - r.delay) / this.duration);
            if (rt <= 0) continue;

            const clampedT = Math.min(rt, 1.0);

            // Rapid extension then hold
            const extendT = Math.min(clampedT / 0.25, 1.0);
            const currentLen = r.length * easeOutHard(extendT);
            r.mesh.scale.set(r.width, currentLen, r.width);

            // Move base outward slightly from origin along direction
            const offset = easeOutHard(extendT) * r.length * 0.1;
            r.mesh.position.set(r.dirX * offset, r.dirY * offset, r.dirZ * offset);

            // Opacity: bright flash then fade
            let alpha;
            if (clampedT < 0.15) {
                alpha = clampedT / 0.15;
            } else if (clampedT < 0.4) {
                alpha = 1.0;
            } else {
                alpha = 1.0 - (clampedT - 0.4) / 0.6;
            }
            r.mesh.material.opacity = r.baseOpacity * Math.max(alpha, 0);

            // Width narrows as ray fades
            const widthFade = clampedT > 0.5 ? 1.0 - (clampedT - 0.5) / 0.5 * 0.6 : 1.0;
            r.mesh.scale.x = r.width * widthFade;
            r.mesh.scale.z = r.width * widthFade;
        }
    }

    hide() {
        this.group.visible = false;
    }
}

// ─── Overlays Manager ───
export class Overlays {
    constructor(scene) {
        this.shockwave = new ShockwaveRing(scene);
        this.speedLines = new SpeedLines(scene);
        this.debris = new DebrisSparks(scene);
        this.heatRays = new HeatRays(scene);
    }

    init(cfg) {
        if (cfg.shockwave) this.shockwave.init(cfg);
        if (cfg.speedLines) this.speedLines.init(cfg);
        if (cfg.debris) this.debris.init(cfg);
        if (cfg.heatRays) this.heatRays.init(cfg);
    }

    update(dt, progress, cfg) {
        if (cfg.shockwave) this.shockwave.update(dt);
        if (cfg.speedLines) this.speedLines.update(dt);
        if (cfg.debris) this.debris.update(dt);
        if (cfg.heatRays) this.heatRays.update(dt);
    }

    hide() {
        this.shockwave.hide();
        this.speedLines.hide();
        this.debris.hide();
        this.heatRays.hide();
    }
}
