export const COLOR_PRESETS = {
    'Fire': { primary: '#ff4500', secondary: '#ffd700', accent: '#ffffff' },
    'Energy': { primary: '#0088ff', secondary: '#00ffff', accent: '#ffffff' },
    'Dark Energy': { primary: '#8800ff', secondary: '#ff00aa', accent: '#ffffff' },
    'Custom': null
};

export const config = {
    // Shape & Size
    shape: 'Sphere',
    radius: 3.0,

    // Colours
    colorPreset: 'Fire',
    primaryColor: '#ff4500',
    secondaryColor: '#ffd700',
    accentColor: '#ffffff',

    // Particles
    particleCount: 500,
    particleLifetime: 1.5,
    particleSpeed: 3.0,

    // Effects toggles
    shockwave: true,
    speedLines: true,
    screenShake: true,
    debris: true,
    smokeTrail: true,
    heatRays: true,

    // Effects intensity
    bloomStrength: 1.2,
    outlineThickness: 2,
    celShadeLevels: 5,

    // Background
    backgroundMode: 'Solid',
    backgroundColor: '#1a1a2e',
    gradientTop: '#0f0c29',
    gradientBottom: '#302b63',

    // Playback
    loop: false,
    loopDelay: 1.0
};
