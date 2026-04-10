import * as THREE from 'three';

function easeOut(t) { return 1 - (1 - t) * (1 - t); }

// Screen-space centre of the explosion (always at origin)
const _worldOrigin = new THREE.Vector3(0, 0, 0);

export class ExplosionManager {
    constructor(fireParticles, smokeParticles, overlays, passes, camera, liveConfig) {
        this.fire = fireParticles;
        this.smoke = smokeParticles;
        this.overlays = overlays;
        this.passes = passes;
        this.camera = camera;
        this.liveConfig = liveConfig;

        this.state = 'idle';       // idle | active
        this.elapsed = 0;
        this.loopWait = 0;
        this.activeConfig = null;
        this.hasTriggeredOnce = false;

        // Shake state
        this.shakeElapsed = 0;
        this.shakeDuration = 0.5;
        this.shakeIntensity = 0;

        // Shockwave state
        this.shockwaveElapsed = 0;
        this.shockwaveDuration = 0;
    }

    trigger(cfg) {
        // Snapshot config
        this.activeConfig = Object.assign({}, cfg || this.liveConfig);
        this.state = 'active';
        this.elapsed = 0;
        this.hasTriggeredOnce = true;

        // Init particle systems
        this.fire.init(this.activeConfig);
        if (this.activeConfig.smokeTrail) {
            this.smoke.init(this.activeConfig);
        }

        // Init overlays
        this.overlays.init(this.activeConfig);

        // Init shake
        if (this.activeConfig.screenShake) {
            this.shakeElapsed = 0;
            this.shakeDuration = Math.min(this.activeConfig.particleLifetime * 0.3, 0.6);
            this.shakeIntensity = 1.0;
        } else {
            this.shakeIntensity = 0;
        }

        // Init shockwave distortion
        if (this.activeConfig.shockwave) {
            this.shockwaveElapsed = 0;
            this.shockwaveDuration = this.activeConfig.particleLifetime * 0.4;
        }

        // Update bloom from config
        this.passes.bloom.strength = this.activeConfig.bloomStrength;
        this.passes.outline.uniforms.thickness.value = this.activeConfig.outlineThickness;
        this.passes.celShade.uniforms.levels.value = this.activeConfig.celShadeLevels;
    }

    update(dt) {
        // ─── Idle state ───
        if (this.state === 'idle') {
            // Reset post-processing to neutral
            this.passes.shake.uniforms.offset.value.set(0, 0);
            this.passes.shockwave.uniforms.intensity.value = 0;

            // Handle loop
            if (this.hasTriggeredOnce && this.liveConfig.loop) {
                this.loopWait += dt;
                if (this.loopWait >= this.liveConfig.loopDelay) {
                    this.trigger(this.liveConfig);
                }
            }
            return;
        }

        // ─── Active state ───
        this.elapsed += dt;
        const lifetime = this.activeConfig.particleLifetime;
        const progress = Math.min(this.elapsed / lifetime, 1.0);

        // Update particles
        this.fire.update(dt, progress, this.activeConfig);
        if (this.activeConfig.smokeTrail) {
            this.smoke.update(dt, progress, this.activeConfig);
        }

        // Update overlays
        this.overlays.update(dt, progress, this.activeConfig);

        // ─── Screen shake ───
        if (this.activeConfig.screenShake && this.shakeIntensity > 0) {
            this.shakeElapsed += dt;
            if (this.shakeElapsed < this.shakeDuration) {
                const decay = 1.0 - this.shakeElapsed / this.shakeDuration;
                const intensity = this.shakeIntensity * decay * decay;
                this.passes.shake.uniforms.offset.value.set(
                    (Math.random() - 0.5) * intensity * 0.015,
                    (Math.random() - 0.5) * intensity * 0.015
                );
            } else {
                this.passes.shake.uniforms.offset.value.set(0, 0);
            }
        } else {
            this.passes.shake.uniforms.offset.value.set(0, 0);
        }

        // ─── Shockwave distortion ───
        if (this.activeConfig.shockwave && this.shockwaveElapsed < this.shockwaveDuration) {
            this.shockwaveElapsed += dt;
            const swT = Math.min(this.shockwaveElapsed / this.shockwaveDuration, 1.0);

            // Convert explosion origin to screen UV
            _worldOrigin.set(0, 0, 0);
            _worldOrigin.project(this.camera);
            this.passes.shockwave.uniforms.center.value.set(
                (_worldOrigin.x + 1) * 0.5,
                (_worldOrigin.y + 1) * 0.5
            );
            this.passes.shockwave.uniforms.radius.value = easeOut(swT) * 0.5;
            this.passes.shockwave.uniforms.waveWidth.value = 0.06;
            this.passes.shockwave.uniforms.intensity.value = (1.0 - swT) * 1.2;
        } else {
            this.passes.shockwave.uniforms.intensity.value = 0;
        }

        // ─── Transition to idle ───
        if (progress >= 1.0) {
            this.state = 'idle';
            this.loopWait = 0;
            this.fire.hide();
            if (this.activeConfig.smokeTrail) this.smoke.hide();
            this.overlays.hide();
        }
    }

    get isActive() {
        return this.state === 'active';
    }

    get progress() {
        if (!this.activeConfig) return 0;
        return Math.min(this.elapsed / this.activeConfig.particleLifetime, 1.0);
    }
}
