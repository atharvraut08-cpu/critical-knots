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
    gameMode: 'survival',   // 'survival' | 'dogfight' | 'flightschool'
    selectedCardIndex: 0,   // 0 = Survival, 1 = Dogfight, 2 = Flight School (Menu navigation)
    paused: false,
    timeAlive: 0,           // seconds survived

    // Entity arrays — filtered each frame by alive flag
    missiles: [],
    obstacles: [],
    flares: [],             // active flare decoys in the world
    bullets: [],            // active player machine gun projectiles
    enemies: [],            // active enemy AI jet entities (Dogfight Mode / Practice Target)

    // Player reference (set by main.js on game start)
    player: null,

    // Spawn timers
    missileSpawnTimer: 0,
    flareRegenTimer: 0,

    // Stats for score screen
    stats: {
        timeSurvived: 0,
        missilesDestroyed: 0,
        nearMisses: 0,
        enemiesDestroyed: 0,
    },

    // Dogfight outcome: null | 'victory' | 'defeat'
    dogfightResult: null,

    // Camera shake state (managed by camera.js, stored here for reset)
    shakeMagnitude: 0,

    // Phase difficulty transition warnings
    phaseWarning: null,         // { text, subtext, timer, duration, color }
    phase30Triggered: false,
    phase60Triggered: false,

    // ── Flight School Tutorial Tracking ─────────────────
    flightSchool: {
        activeLesson: 0,        // 0: Break Turn, 1: Flat Scissors, 2: Drift, 3: Dash
        breakTurnDone: false,
        scissorsDone: false,
        driftDone: false,
        dashDone: false,
        scissorsCount: 0,
        lastTurnSign: 0,
        lastTurnSwitchTime: 0,
        feedbackMessage: '',
        feedbackTimer: 0,
        droneSpawned: false,
    },
};

/**
 * Reset ALL game state for a clean restart.
 * This must zero/reinitialize every array and stat.
 * If you add new state anywhere, add its reset here too.
 * 
 * @param {'survival' | 'dogfight' | 'flightschool'} [mode='survival']
 */
export function reset(mode = 'survival') {
    state.phase = 'playing';
    state.gameMode = mode;
    state.paused = false;
    state.timeAlive = 0;

    state.missiles.length = 0;
    state.obstacles.length = 0;
    state.flares.length = 0;
    state.bullets.length = 0;
    state.enemies.length = 0;

    state.player = null;

    state.missileSpawnTimer = CONFIG.warmupTime;
    state.flareRegenTimer = 0;

    state.stats.timeSurvived = 0;
    state.stats.missilesDestroyed = 0;
    state.stats.nearMisses = 0;
    state.stats.enemiesDestroyed = 0;

    state.dogfightResult = null;

    state.shakeMagnitude = 0;

    state.phaseWarning = null;
    state.phase30Triggered = false;
    state.phase60Triggered = false;

    // Reset Flight School tutorial progress
    state.flightSchool.activeLesson = 0;
    state.flightSchool.breakTurnDone = false;
    state.flightSchool.scissorsDone = false;
    state.flightSchool.driftDone = false;
    state.flightSchool.dashDone = false;
    state.flightSchool.scissorsCount = 0;
    state.flightSchool.lastTurnSign = 0;
    state.flightSchool.lastTurnSwitchTime = 0;
    state.flightSchool.feedbackMessage = '';
    state.flightSchool.feedbackTimer = 0;
    state.flightSchool.droneSpawned = false;
}

export default state;
