// ─── Passthrough vertex shader (used by all post-processing passes) ───
export const passthroughVert = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// ─── Particle vertex shader ───
export const particleVert = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;

varying float vAlpha;
varying vec3 vColor;

void main() {
    vAlpha = aAlpha;
    vColor = aColor;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (450.0 / -mvPosition.z);
    gl_PointSize = max(gl_PointSize, 1.0);
    gl_PointSize = min(gl_PointSize, 512.0);
    gl_Position = projectionMatrix * mvPosition;
}
`;

// ─── Particle fragment shader (fire — additive) ───
export const particleFrag = /* glsl */ `
uniform sampler2D uTexture;

varying float vAlpha;
varying vec3 vColor;

void main() {
    vec4 tex = texture2D(uTexture, gl_PointCoord);
    if (tex.a < 0.01) discard;
    gl_FragColor = vec4(vColor * tex.rgb, tex.a * vAlpha);
}
`;

// ─── Smoke fragment shader (normal blend) ───
export const smokeFrag = /* glsl */ `
uniform sampler2D uTexture;

varying float vAlpha;
varying vec3 vColor;

void main() {
    vec4 tex = texture2D(uTexture, gl_PointCoord);
    if (tex.a < 0.01) discard;
    gl_FragColor = vec4(vColor * tex.rgb * 0.5, tex.a * vAlpha * 0.6);
}
`;

// ─── Outline / ink-edge fragment (Sobel on luminance) ───
export const outlineFrag = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float thickness;

varying vec2 vUv;

void main() {
    vec2 texel = thickness / resolution;

    float tl = dot(texture2D(tDiffuse, vUv + vec2(-texel.x,  texel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float tm = dot(texture2D(tDiffuse, vUv + vec2( 0.0,      texel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float tr = dot(texture2D(tDiffuse, vUv + vec2( texel.x,  texel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float ml = dot(texture2D(tDiffuse, vUv + vec2(-texel.x,  0.0    )).rgb, vec3(0.299, 0.587, 0.114));
    float mr = dot(texture2D(tDiffuse, vUv + vec2( texel.x,  0.0    )).rgb, vec3(0.299, 0.587, 0.114));
    float bl = dot(texture2D(tDiffuse, vUv + vec2(-texel.x, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float bm = dot(texture2D(tDiffuse, vUv + vec2( 0.0,     -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float br = dot(texture2D(tDiffuse, vUv + vec2( texel.x, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));

    float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
    float gy = -tl - 2.0 * tm - tr + bl + 2.0 * bm + br;
    float edge = sqrt(gx * gx + gy * gy);

    vec4 color = texture2D(tDiffuse, vUv);
    color.rgb = mix(color.rgb, vec3(0.0), smoothstep(0.08, 0.35, edge));
    gl_FragColor = color;
}
`;

// ─── Cel-shading / posterise fragment ───
export const celShadeFrag = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float levels;

varying vec2 vUv;

void main() {
    vec4 color = texture2D(tDiffuse, vUv);
    color.rgb = floor(color.rgb * levels + 0.5) / levels;
    gl_FragColor = color;
}
`;

// ─── Screen-shake fragment ───
export const shakeFrag = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 offset;

varying vec2 vUv;

void main() {
    gl_FragColor = texture2D(tDiffuse, vUv + offset);
}
`;

// ─── Shockwave screen-space distortion fragment ───
export const shockwaveFrag = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 center;
uniform float radius;
uniform float waveWidth;
uniform float intensity;

varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    vec2 dir = uv - center;
    float dist = length(dir);

    if (dist > (radius - waveWidth) && dist < (radius + waveWidth) && radius > 0.001) {
        float diff = dist - radius;
        float power = 1.0 - pow(abs(diff / waveWidth), 2.0);
        power = max(power, 0.0);
        uv += normalize(dir) * power * intensity * 0.04;
    }

    gl_FragColor = texture2D(tDiffuse, uv);
}
`;

// ─── Background gradient fragment ───
export const backgroundFrag = /* glsl */ `
uniform int uMode;
uniform vec3 uSolidColor;
uniform vec3 uGradientTop;
uniform vec3 uGradientBottom;

varying vec2 vUv;

void main() {
    vec3 color;
    if (uMode == 0) {
        color = uSolidColor;
    } else {
        color = mix(uGradientBottom, uGradientTop, vUv.y);
    }
    gl_FragColor = vec4(color, 1.0);
}
`;

export const backgroundVert = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
