/**
 * state.js — Global game state + reset()
 * 
 * Single source of truth for all mutable game state.
 * reset() reinitializes EVERYTHING — the most critical function
 * for correct restart without page reload.
 */

import { CONFIG } from './config.js';

/** @type {'title' | 'playing' | 'gameover'} */
let phase = 'title';

// ── Core state object ───────────────────────────────────
const state = {
    phase: 'title',
    paused: false,
    gameMode: 'survival',   // 'survival' | 'freeflight'
    timeAlive: 0,           // seconds survived

    // Entity arrays — filtered each frame by alive flag
    missiles: [],
    obstacles: [],
    pickups: [],
    flares: [],             // active flare decoys in the world
    empWaves: [],           // active expanding electromagnetic pulse shockwaves
    bullets: [],            // active player machine gun projectiles

    // Player reference (set by main.js on game start)
    player: null,

    // Spawn timers
    missileSpawnTimer: 0,
    pickupSpawnTimer: 0,
    flareRegenTimer: 0,
    empRegenTimer: 0,

    // HUD effect timers
    hudGlitchTimer: 0,      // digital static distortion countdown

    // Stats for score screen
    stats: {
        timeSurvived: 0,
        missilesDestroyed: 0,
        nearMisses: 0,
        fuelCollected: 0,
    },

    // Camera shake state (managed by camera.js, stored here for reset)
    shakeMagnitude: 0,
};

/**
 * Reset ALL game state for a clean restart.
 * This must zero/reinitialize every array and stat.
 * If you add new state anywhere, add its reset here too.
 */
export function reset() {
    state.phase = 'playing';
    state.paused = false;
    state.timeAlive = 0;

    state.missiles.length = 0;
    state.obstacles.length = 0;
    state.pickups.length = 0;
    state.flares.length = 0;
    state.empWaves.length = 0;
    state.bullets.length = 0;

    state.player = null;

    state.missileSpawnTimer = CONFIG.warmupTime;
    state.pickupSpawnTimer = CONFIG.pickupSpawnInterval;
    state.flareRegenTimer = 0;
    state.empRegenTimer = 0;
    state.hudGlitchTimer = 0;

    state.stats.timeSurvived = 0;
    state.stats.missilesDestroyed = 0;
    state.stats.nearMisses = 0;
    state.stats.fuelCollected = 0;

    state.shakeMagnitude = 0;
}

export default state;
