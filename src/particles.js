import * as THREE from 'three';
import { particleVert, particleFrag, smokeFrag } from './shaders.js';
import { createFireTexture, createSmokeTexture } from './textures.js';

const MAX_PARTICLES = 2000;
const MAX_SMOKE = 200;

// Pre-allocated temp objects
const _dir = new THREE.Vector3();
const _primary = new THREE.Color();
const _secondary = new THREE.Color();
const _accent = new THREE.Color();

function easeOut(t) { return 1 - (1 - t) * (1 - t); }
function easeOutHard(t) { return 1 - Math.pow(1 - t, 4); } // very fast start, hard brake
function easeIn(t) { return t * t; }

function randomDirection(shape) {
    switch (shape) {
        case 'Hemisphere':
            // Uniform hemisphere distribution using spherical coordinates
            // This creates an even spread across the dome surface
            {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(Math.random()); // 0..PI/2 uniform on hemisphere
                _dir.set(
                    Math.sin(phi) * Math.cos(theta),
                    Math.cos(phi),
                    Math.sin(phi) * Math.sin(theta)
                );
            }
            return _dir;

        case 'Cone':
            const cAngle = Math.random() * Math.PI * 2;
            const upBias = 0.5 + Math.random() * 0.5;
            const cSpread = Math.random() * 0.5;
            _dir.set(
                Math.cos(cAngle) * cSpread,
                upBias,
                Math.sin(cAngle) * cSpread
            ).normalize();
            return _dir;

        case 'Ring':
            const rAngle = Math.random() * Math.PI * 2;
            _dir.set(
                Math.cos(rAngle),
                (Math.random() - 0.5) * 0.3,
                Math.sin(rAngle)
            ).normalize();
            return _dir;

        case 'Sphere':
        default:
            _dir.set(
                Math.random() * 2 - 1,
                Math.random() * 2 - 1,
                Math.random() * 2 - 1
            ).normalize();
            return _dir;
    }
}

// ─── Fire Particle System ───
export class FireParticles {
    constructor(scene) {
        this.count = 0;
        this.fireTexture = createFireTexture();

        // Pre-allocate max buffers
        const positions = new Float32Array(MAX_PARTICLES * 3);
        const colors = new Float32Array(MAX_PARTICLES * 3);
        const sizes = new Float32Array(MAX_PARTICLES);
        const alphas = new Float32Array(MAX_PARTICLES);

        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
        this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTexture: { value: this.fireTexture }
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
        scene.add(this.points);

        // Internal arrays (not attributes — used for simulation)
        this.velocities = new Float32Array(MAX_PARTICLES * 3);
        this.ages = new Float32Array(MAX_PARTICLES);
        this.maxAges = new Float32Array(MAX_PARTICLES);
        this.baseSizes = new Float32Array(MAX_PARTICLES);
        this.isHot = new Uint8Array(MAX_PARTICLES); // 1 = hot patch particle
    }

    init(cfg) {
        this.count = Math.min(cfg.particleCount, MAX_PARTICLES);
        this.geometry.setDrawRange(0, this.count);

        _primary.set(cfg.primaryColor);
        _secondary.set(cfg.secondaryColor);
        _accent.set(cfg.accentColor);

        const pos = this.geometry.attributes.position.array;
        const col = this.geometry.attributes.aColor.array;
        const siz = this.geometry.attributes.aSize.array;
        const alp = this.geometry.attributes.aAlpha.array;

        const isHemisphere = cfg.shape === 'Hemisphere';

        // ─── Generate hot-patch cluster centres ───
        const hotClusterCount = isHemisphere ? 5 + Math.floor(Math.random() * 4) : 3;
        const hotClusters = [];
        for (let c = 0; c < hotClusterCount; c++) {
            const cd = new THREE.Vector3();
            if (isHemisphere) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(Math.random());
                cd.set(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
            } else {
                cd.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
            }
            hotClusters.push({ dir: cd, radius: 0.3 + Math.random() * 0.25 });
        }

        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;

            // Start at origin
            pos[i3] = 0;
            pos[i3 + 1] = 0;
            pos[i3 + 2] = 0;

            // Direction
            randomDirection(cfg.shape);

            // Check if this particle is near a hot-patch cluster
            let hot = false;
            for (const cluster of hotClusters) {
                const dx = _dir.x - cluster.dir.x;
                const dy = _dir.y - cluster.dir.y;
                const dz = _dir.z - cluster.dir.z;
                if (Math.sqrt(dx * dx + dy * dy + dz * dz) < cluster.radius) {
                    hot = true;
                    break;
                }
            }
            this.isHot[i] = hot ? 1 : 0;

            if (isHemisphere) {
                // ─── Shell mode: all particles move at ~same speed ───
                // Very tight speed variance so they stay on a coherent expanding shell
                const speed = cfg.particleSpeed * (0.95 + Math.random() * 0.1);
                this.velocities[i3] = _dir.x * speed;
                this.velocities[i3 + 1] = _dir.y * speed;
                this.velocities[i3 + 2] = _dir.z * speed;

                // Hot particles punch slightly ahead of the shell
                if (hot) {
                    const boost = 1.15 + Math.random() * 0.2;
                    this.velocities[i3] *= boost;
                    this.velocities[i3 + 1] *= boost;
                    this.velocities[i3 + 2] *= boost;
                }

                // Lifetime: very uniform so they all fade together
                this.ages[i] = 0;
                this.maxAges[i] = cfg.particleLifetime * (0.9 + Math.random() * 0.2);

                // Large sizes to overlap heavily → solid shell surface
                this.baseSizes[i] = cfg.radius * (hot ? (1.2 + Math.random() * 0.6) : (0.9 + Math.random() * 0.5));
            } else {
                // ─── Other shapes: scattered cloud ───
                const speed = cfg.particleSpeed * (0.5 + Math.random() * 1.0);
                this.velocities[i3] = _dir.x * speed;
                this.velocities[i3 + 1] = _dir.y * speed;
                this.velocities[i3 + 2] = _dir.z * speed;

                if (hot) {
                    const boost = 1.3 + Math.random() * 0.5;
                    this.velocities[i3] *= boost;
                    this.velocities[i3 + 1] *= boost;
                    this.velocities[i3 + 2] *= boost;
                }

                this.ages[i] = 0;
                this.maxAges[i] = cfg.particleLifetime * (hot ? (0.8 + Math.random() * 0.6) : (0.6 + Math.random() * 0.8));
                this.baseSizes[i] = cfg.radius * (hot ? (0.5 + Math.random() * 0.6) : (0.3 + Math.random() * 0.5));
            }

            siz[i] = 0;

            // Start with accent colour
            col[i3] = _accent.r;
            col[i3 + 1] = _accent.g;
            col[i3 + 2] = _accent.b;

            alp[i] = 1.0;
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.aColor.needsUpdate = true;
        this.geometry.attributes.aSize.needsUpdate = true;
        this.geometry.attributes.aAlpha.needsUpdate = true;

        this.points.visible = true;
    }

    update(dt, progress, cfg) {
        _primary.set(cfg.primaryColor);
        _secondary.set(cfg.secondaryColor);
        _accent.set(cfg.accentColor);

        const pos = this.geometry.attributes.position.array;
        const col = this.geometry.attributes.aColor.array;
        const siz = this.geometry.attributes.aSize.array;
        const alp = this.geometry.attributes.aAlpha.array;
        const radius = cfg.radius;
        const isHemi = cfg.shape === 'Hemisphere';

        for (let i = 0; i < this.count; i++) {
            this.ages[i] += dt;
            const t = Math.min(this.ages[i] / this.maxAges[i], 1.0);
            const i3 = i * 3;
            const hot = this.isHot[i] === 1;

            if (t >= 1.0) {
                alp[i] = 0;
                siz[i] = 0;
                continue;
            }

            // Speed multiplier based on phase — hemisphere uses harder easing
            let speedMul;
            if (isHemi) {
                // Very fast initial burst, hard brake
                if (t < 0.15) {
                    speedMul = 1.0 - easeOutHard(t / 0.15) * 0.5;
                } else if (t < 0.35) {
                    speedMul = 0.15;
                } else {
                    speedMul = 0.15 * (1.0 - easeIn((t - 0.35) / 0.65) * 0.95);
                }
            } else {
                if (t < 0.3) {
                    speedMul = 1.0 - easeOut(t / 0.3) * 0.6;
                } else if (t < 0.5) {
                    speedMul = 0.25;
                } else {
                    speedMul = 0.25 * (1.0 - easeIn((t - 0.5) / 0.5) * 0.9);
                }
            }

            // Position update
            pos[i3] += this.velocities[i3] * speedMul * dt;
            pos[i3 + 1] += this.velocities[i3 + 1] * speedMul * dt;
            pos[i3 + 2] += this.velocities[i3 + 2] * speedMul * dt;

            // Size
            if (isHemi) {
                // Shell: snap to full size almost immediately, then shrink as it fades
                if (t < 0.05) {
                    siz[i] = this.baseSizes[i] * (t / 0.05);
                } else if (t < 0.5) {
                    siz[i] = this.baseSizes[i];
                } else {
                    siz[i] = this.baseSizes[i] * (1.0 - easeIn((t - 0.5) / 0.5) * 0.5);
                }
            } else {
                // Other: scale up quickly then slowly shrink
                if (t < 0.3) {
                    siz[i] = this.baseSizes[i] * easeOut(t / 0.3);
                } else {
                    siz[i] = this.baseSizes[i] * (1.0 - easeIn((t - 0.3) / 0.7) * 0.7);
                }
            }

            // Alpha: full then fade in dissipation (hot stays opaque longer)
            const fadeStart = hot ? 0.65 : 0.5;
            if (t < fadeStart) {
                alp[i] = 1.0;
            } else {
                alp[i] = 1.0 - easeIn((t - fadeStart) / (1.0 - fadeStart));
            }

            // Colour: hot particles stay accent/white longer, then snap to primary
            if (hot) {
                if (t < 0.5) {
                    // Stay near white-hot accent with slight blend toward primary
                    const ct = t / 0.5;
                    const blend = ct * 0.3; // barely shift
                    col[i3]     = _accent.r + (_primary.r - _accent.r) * blend;
                    col[i3 + 1] = _accent.g + (_primary.g - _accent.g) * blend;
                    col[i3 + 2] = _accent.b + (_primary.b - _accent.b) * blend;
                } else {
                    const ct = (t - 0.5) / 0.5;
                    col[i3]     = _primary.r + (_secondary.r - _primary.r) * ct;
                    col[i3 + 1] = _primary.g + (_secondary.g - _primary.g) * ct;
                    col[i3 + 2] = _primary.b + (_secondary.b - _primary.b) * ct;
                }
            } else {
                // Normal: accent → primary → secondary
                if (t < 0.3) {
                    const ct = t / 0.3;
                    col[i3]     = _accent.r + (_primary.r - _accent.r) * ct;
                    col[i3 + 1] = _accent.g + (_primary.g - _accent.g) * ct;
                    col[i3 + 2] = _accent.b + (_primary.b - _accent.b) * ct;
                } else {
                    const ct = (t - 0.3) / 0.7;
                    col[i3]     = _primary.r + (_secondary.r - _primary.r) * ct;
                    col[i3 + 1] = _primary.g + (_secondary.g - _primary.g) * ct;
                    col[i3 + 2] = _primary.b + (_secondary.b - _primary.b) * ct;
                }
            }
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.aColor.needsUpdate = true;
        this.geometry.attributes.aSize.needsUpdate = true;
        this.geometry.attributes.aAlpha.needsUpdate = true;
    }

    hide() {
        this.points.visible = false;
    }
}

// ─── Smoke Particle System ───
export class SmokeParticles {
    constructor(scene) {
        this.count = 0;
        this.smokeTexture = createSmokeTexture();

        const positions = new Float32Array(MAX_SMOKE * 3);
        const colors = new Float32Array(MAX_SMOKE * 3);
        const sizes = new Float32Array(MAX_SMOKE);
        const alphas = new Float32Array(MAX_SMOKE);

        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
        this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTexture: { value: this.smokeTexture }
            },
            vertexShader: particleVert,
            fragmentShader: smokeFrag,
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,
            depthTest: true
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.points.frustumCulled = false;
        this.points.visible = false;
        this.points.renderOrder = 10;
        scene.add(this.points);

        this.velocities = new Float32Array(MAX_SMOKE * 3);
        this.ages = new Float32Array(MAX_SMOKE);
        this.maxAges = new Float32Array(MAX_SMOKE);
        this.baseSizes = new Float32Array(MAX_SMOKE);
    }

    init(cfg) {
        this.count = Math.min(Math.floor(cfg.particleCount * 0.15), MAX_SMOKE);
        this.geometry.setDrawRange(0, this.count);

        const pos = this.geometry.attributes.position.array;
        const col = this.geometry.attributes.aColor.array;
        const siz = this.geometry.attributes.aSize.array;
        const alp = this.geometry.attributes.aAlpha.array;

        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;

            // Start near origin with slight offset
            pos[i3] = (Math.random() - 0.5) * cfg.radius * 0.5;
            pos[i3 + 1] = (Math.random() - 0.5) * cfg.radius * 0.3;
            pos[i3 + 2] = (Math.random() - 0.5) * cfg.radius * 0.5;

            // Slow upward drift
            this.velocities[i3] = (Math.random() - 0.5) * 0.3;
            this.velocities[i3 + 1] = 0.3 + Math.random() * 0.5;
            this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.3;

            this.ages[i] = 0;
            this.maxAges[i] = cfg.particleLifetime * (0.8 + Math.random() * 0.6);
            this.baseSizes[i] = cfg.radius * (0.8 + Math.random() * 1.0);
            siz[i] = 0;

            // Dark grey-ish tinted with secondary colour
            const sc = new THREE.Color(cfg.secondaryColor);
            col[i3] = sc.r * 0.3 + 0.15;
            col[i3 + 1] = sc.g * 0.3 + 0.15;
            col[i3 + 2] = sc.b * 0.3 + 0.15;

            alp[i] = 0;
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.aColor.needsUpdate = true;
        this.geometry.attributes.aSize.needsUpdate = true;
        this.geometry.attributes.aAlpha.needsUpdate = true;

        this.points.visible = true;
    }

    update(dt, progress, cfg) {
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

            // Smoke appears during peak/dissipation (after 30% progress)
            const smokeStart = 0.3;
            if (progress < smokeStart) {
                alp[i] = 0;
                continue;
            }

            // Position: slow drift upward
            pos[i3] += this.velocities[i3] * dt;
            pos[i3 + 1] += this.velocities[i3 + 1] * dt;
            pos[i3 + 2] += this.velocities[i3 + 2] * dt;

            // Size: grow slowly
            const smokeT = (progress - smokeStart) / (1.0 - smokeStart);
            siz[i] = this.baseSizes[i] * Math.min(smokeT * 2, 1.0);

            // Alpha: fade in then fade out
            if (smokeT < 0.3) {
                alp[i] = smokeT / 0.3 * 0.5;
            } else {
                alp[i] = (1.0 - (smokeT - 0.3) / 0.7) * 0.5;
            }
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.aSize.needsUpdate = true;
        this.geometry.attributes.aAlpha.needsUpdate = true;
    }

    hide() {
        this.points.visible = false;
    }
}
