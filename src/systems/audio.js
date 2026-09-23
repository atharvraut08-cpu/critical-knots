/**
 * audio.js — Zero-Asset Procedural Web Audio API Sound Engine
 * 
 * Synthesizes military jet engines, machine guns, missile thrusters,
 * lock-on seeker telemetry, cinematic explosions, and powerup chimes
 * using pure native Web Audio API oscillators, noise buffers, and filters.
 */

let audioCtx = null;
let masterGain = null;
let sfxGain = null;
let engineGain = null;
let engineOsc = null;
let engineFilter = null;
let engineNoiseNode = null;
let isMuted = false;
let audioInitialized = false;

// Lock tone state
let lockOsc = null;
let lockGain = null;
let lastLockBeep = 0;

/**
 * Initialize Web Audio Context on first user gesture.
 */
export function initAudio() {
    if (audioInitialized) return;

    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        audioCtx = new AudioContextClass();
        masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(0.7, audioCtx.currentTime);
        masterGain.connect(audioCtx.destination);

        sfxGain = audioCtx.createGain();
        sfxGain.gain.setValueAtTime(0.8, audioCtx.currentTime);
        sfxGain.connect(masterGain);

        initEngineSound();
        audioInitialized = true;
    } catch (e) {
        console.warn('Web Audio initialization error:', e);
    }
}

/**
 * Ensure AudioContext is running after user interaction.
 */
export function resumeAudio() {
    if (!audioInitialized) {
        initAudio();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Attach gesture listeners
window.addEventListener('pointerdown', resumeAudio, { once: false });
window.addEventListener('keydown', (e) => {
    resumeAudio();
    if (e.key === 'm' || e.key === 'M') {
        toggleMute();
    }
}, { once: false });

export function toggleMute() {
    isMuted = !isMuted;
    if (masterGain && audioCtx) {
        masterGain.gain.setValueAtTime(isMuted ? 0 : 0.7, audioCtx.currentTime);
    }
    return isMuted;
}

export function getMuteState() {
    return isMuted;
}

/**
 * Setup persistent procedural jet turbine engine sound.
 */
function initEngineSound() {
    if (!audioCtx) return;

    // 1. Noise buffer generator for jet roar
    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.05;
        b1 = 0.95 * b1 + white * 0.08;
        b2 = 0.85 * b2 + white * 0.15;
        output[i] = (b0 + b1 + b2) * 0.6;
    }

    engineNoiseNode = audioCtx.createBufferSource();
    engineNoiseNode.buffer = noiseBuffer;
    engineNoiseNode.loop = true;

    engineFilter = audioCtx.createBiquadFilter();
    engineFilter.type = 'bandpass';
    engineFilter.frequency.setValueAtTime(140, audioCtx.currentTime);
    engineFilter.Q.setValueAtTime(1.8, audioCtx.currentTime);

    // 2. Low turbine sub-rumble oscillator
    engineOsc = audioCtx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.setValueAtTime(55, audioCtx.currentTime);

    const oscFilter = audioCtx.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.setValueAtTime(110, audioCtx.currentTime);
    engineOsc.connect(oscFilter);

    engineGain = audioCtx.createGain();
    engineGain.gain.setValueAtTime(0.08, audioCtx.currentTime);

    engineNoiseNode.connect(engineFilter);
    engineFilter.connect(engineGain);
    oscFilter.connect(engineGain);
    engineGain.connect(masterGain);

    engineNoiseNode.start();
    engineOsc.start();
}

/**
 * Modulate engine sound pitch and resonance based on flight speed.
 * @param {number} speedRatio (0.0 to 1.5)
 * @param {boolean} isBoosting
 * @param {boolean} isAlive
 */
export function updateEngineSound(speedRatio, isBoosting, isAlive) {
    if (!audioCtx || !engineFilter || !engineGain || !engineOsc) return;

    try {
        const now = audioCtx.currentTime;
        if (!Number.isFinite(now)) return;

        if (!isAlive || audioCtx.state !== 'running') {
            engineGain.gain.setValueAtTime(0, now);
            return;
        }

        const safeRatio = Number.isFinite(speedRatio) ? Math.max(0, Math.min(2.0, speedRatio)) : 0.5;
        const targetFreq = Math.max(40, Math.min(3000, 120 + safeRatio * 240 + (isBoosting ? 260 : 0)));
        const targetGain = Math.max(0, Math.min(0.25, 0.06 + safeRatio * 0.07 + (isBoosting ? 0.09 : 0)));
        const targetOscFreq = Math.max(20, Math.min(500, 48 + safeRatio * 35 + (isBoosting ? 45 : 0)));

        engineFilter.frequency.setValueAtTime(targetFreq, now);
        engineGain.gain.setValueAtTime(targetGain, now);
        engineOsc.frequency.setValueAtTime(targetOscFreq, now);
    } catch (e) {
        // Silently tolerate transition states
    }
}

/**
 * Play high-frequency military machine gun burst.
 */
export function playGunFire() {
    if (!audioCtx || audioCtx.state !== 'running') return;

    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.045);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(gain);
    gain.connect(sfxGain);

    osc.start(t);
    osc.stop(t + 0.05);
}

/**
 * Play wing missile launch rocket whoosh.
 */
export function playMissileLaunch() {
    if (!audioCtx || audioCtx.state !== 'running') return;

    const t = audioCtx.currentTime;

    // Rocket thruster hiss
    const bufferSize = audioCtx.sampleRate * 0.35;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(350, t);
    filter.frequency.exponentialRampToValueAtTime(2200, t + 0.25);
    filter.Q.setValueAtTime(3.0, t);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);

    noise.start(t);
    noise.stop(t + 0.35);
}

/**
 * Update lock-on telemetry sound.
 * @param {number} progress (0.0 to 1.0)
 * @param {boolean} hasTarget
 */
export function updateLockTone(progress, hasTarget) {
    if (!audioCtx || audioCtx.state !== 'running') return;

    const now = performance.now();
    if (!hasTarget || progress <= 0) return;

    // Periodic beep if acquiring, continuous rapid beep if locked
    const interval = progress >= 1.0 ? 120 : (450 - progress * 300);
    if (now - lastLockBeep >= interval) {
        lastLockBeep = now;
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(progress >= 1.0 ? 1350 : 880, t);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + (progress >= 1.0 ? 0.07 : 0.05));

        osc.connect(gain);
        gain.connect(sfxGain);

        osc.start(t);
        osc.stop(t + 0.08);
    }
}

/**
 * Play detonation / explosion sound.
 * @param {boolean} isHeavy - whether it's a massive aircraft explosion
 */
export function playExplosion(isHeavy = false) {
    if (!audioCtx || audioCtx.state !== 'running') return;

    const t = audioCtx.currentTime;
    const duration = isHeavy ? 1.4 : 0.65;

    // Deep sub bass impact
    const subOsc = audioCtx.createOscillator();
    const subGain = audioCtx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(isHeavy ? 140 : 180, t);
    subOsc.frequency.exponentialRampToValueAtTime(26, t + duration * 0.7);

    subGain.gain.setValueAtTime(isHeavy ? 0.6 : 0.35, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    subOsc.connect(subGain);
    subGain.connect(sfxGain);
    subOsc.start(t);
    subOsc.stop(t + duration);

    // Noise rumble
    const bufferSize = audioCtx.sampleRate * duration;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.8;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isHeavy ? 800 : 550, t);
    filter.frequency.exponentialRampToValueAtTime(45, t + duration);

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(isHeavy ? 0.5 : 0.3, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(sfxGain);

    noise.start(t);
    noise.stop(t + duration);
}

/**
 * Play medical health kit collection chime (+50 HP).
 */
export function playHealthKitChime() {
    if (!audioCtx || audioCtx.state !== 'running') return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const t = audioCtx.currentTime;

    notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const noteTime = t + idx * 0.07;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.2, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);

        osc.connect(gain);
        gain.connect(sfxGain);

        osc.start(noteTime);
        osc.stop(noteTime + 0.26);
    });
}

/**
 * Play tactical shield powerup chime.
 */
export function playShieldChime() {
    if (!audioCtx || audioCtx.state !== 'running') return;

    const t = audioCtx.currentTime;
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, t);
    osc1.frequency.exponentialRampToValueAtTime(880, t + 0.22);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(660, t);
    osc2.frequency.exponentialRampToValueAtTime(1320, t + 0.22);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(sfxGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.35);
    osc2.stop(t + 0.35);
}

/**
 * Play nitro boost / missile restock pickup sound.
 */
export function playBoostChime() {
    if (!audioCtx || audioCtx.state !== 'running') return;

    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.18);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, t);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);

    osc.start(t);
    osc.stop(t + 0.25);
}

/**
 * Play jet hit / shield deflection thud.
 */
export function playHitThud() {
    if (!audioCtx || audioCtx.state !== 'running') return;

    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.08);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(sfxGain);

    osc.start(t);
    osc.stop(t + 0.09);
}

/**
 * Play victory fanfare.
 */
export function playVictoryFanfare() {
    if (!audioCtx || audioCtx.state !== 'running') return;

    const chords = [
        [523.25, 659.25, 783.99],       // C Maj
        [587.33, 739.99, 880.00],       // D Maj
        [659.25, 830.61, 987.77],       // E Maj
        [1046.50, 1318.51, 1567.98],    // C High Maj
    ];

    const t = audioCtx.currentTime;
    chords.forEach((chord, step) => {
        const stepTime = t + step * 0.22;
        chord.forEach(freq => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, stepTime);

            gain.gain.setValueAtTime(0.18, stepTime);
            gain.gain.exponentialRampToValueAtTime(0.001, stepTime + (step === 3 ? 0.7 : 0.2));

            osc.connect(gain);
            gain.connect(sfxGain);

            osc.start(stepTime);
            osc.stop(stepTime + (step === 3 ? 0.75 : 0.22));
        });
    });
}
