/**
 * spawner.js — Threat escalation spawner
 * 
 * Manages:
 * - Dynamic missile archetype escalation based on survival time
 */

import { CONFIG } from '../config.js';
import { randRange, randInt } from '../utils/math.js';
import { distance, angleTo } from '../utils/vector.js';
import { createMissile } from '../entities/missile.js';

/**
 * Compute current missile spawn interval based on survival time and phase.
 * Phase 1 (0-30s): Steady cadence.
 * Phase 2 (30-60s): Moderate cadence.
 * Phase 3 (60s+): Exponential decay applied to cooldown timer, spawning missiles much faster.
 * 
 * @param {number} timeAlive
 * @returns {number} seconds
 */
export function getSpawnInterval(timeAlive) {
    if (timeAlive < 30) {
        // Phase 1 (0 to 30s): Steady baseline cadence
        return CONFIG.phase1Interval || 2.6;
    } else if (timeAlive < 60) {
        // Phase 2 (30 to 60s): Moderate cadence
        return CONFIG.phase2Interval || 2.0;
    } else {
        // Phase 3 (60+ seconds): Exponential decay applied to spawn cooldown timer
        const timeInPhase3 = timeAlive - 60;
        const decayFactor = Math.pow(0.5, timeInPhase3 / (CONFIG.phase3HalfLife || 16));
        const interval = (CONFIG.phase3BaseInterval || 1.8) * decayFactor;
        return Math.max(interval, CONFIG.spawnIntervalFloor || 0.45);
    }
}

/**
 * Select a missile archetype based on strict survival phases:
 * - Phase 1 (0 to 30s): Spawn ONLY 'BASIC' missiles.
 * - Phase 2 (30 to 60s): Stop spawning 'BASIC' missiles. Spawn 50/50 mix of 'HEAVY' and 'INTERCEPTOR'.
 * - Phase 3 (60+s): Spawn a mix of 'HEAVY' and 'INTERCEPTOR'.
 * 
 * @param {number} timeAlive
 * @returns {'basic'|'heavy'|'interceptor'}
 */
export function getMissileArchetype(timeAlive) {
    if (timeAlive < 30) {
        // Phase 1 (0 to 30 seconds): Spawn ONLY 'BASIC' missiles
        return 'basic';
    } else {
        // Phase 2 (30 to 60 seconds) & Phase 3 (60+ seconds): 50/50 mix of 'HEAVY' and 'INTERCEPTOR'
        return Math.random() < 0.5 ? 'heavy' : 'interceptor';
    }
}

/**
 * Update spawner timers, phase transition warnings, and spawn entities.
 * 
 * @param {object} state
 * @param {number} dt
 * @param {number} canvasW
 * @param {number} canvasH
 */
export function updateSpawner(state, dt, canvasW, canvasH) {
    const player = state.player;
    if (!player || !player.alive) return;

    // ── Phase Transition UI Warnings ───────────────────
    if (state.timeAlive >= 30 && !state.phase30Triggered) {
        state.phase30Triggered = true;
        state.phaseWarning = {
            text: 'WARNING: ESCALATION',
            subtext: 'PHASE 2 — HEAVY & INTERCEPTORS INBOUND',
            timer: 3.0,
            duration: 3.0,
            color: '#ff8800',
        };
    } else if (state.timeAlive >= 60 && !state.phase60Triggered) {
        state.phase60Triggered = true;
        state.phaseWarning = {
            text: 'WARNING: SUDDEN DEATH',
            subtext: 'PHASE 3 — MAXIMUM THREAT ESCALATION',
            timer: 3.0,
            duration: 3.0,
            color: '#ff2233',
        };
    }

    if (state.phaseWarning && state.phaseWarning.timer > 0) {
        state.phaseWarning.timer -= dt;
        if (state.phaseWarning.timer <= 0) {
            state.phaseWarning = null;
        }
    }

    // ── Missile Spawning ────────────────────────────────
    state.missileSpawnTimer -= dt;
    if (state.missileSpawnTimer <= 0) {
        spawnMissile(state, player, canvasW, canvasH);
        state.missileSpawnTimer = getSpawnInterval(state.timeAlive);
    }
}

/**
 * Spawn a missile on the perimeter ring outside camera culling.
 */
function spawnMissile(state, player, canvasW, canvasH) {
    const screenRadius = Math.hypot(canvasW / 2, canvasH / 2);
    const spawnDist = CONFIG.missileSpawnDist || (screenRadius + (CONFIG.spawnRingMargin || 250));

    // Random angle around player
    const angle = randRange(0, Math.PI * 2);
    const x = player.x + Math.cos(angle) * spawnDist;
    const y = player.y + Math.sin(angle) * spawnDist;

    if (distance({ x, y }, player) < CONFIG.minSpawnDistFromPlayer) {
        return;
    }

    // Initial heading roughly directed at the player
    const heading = angleTo({ x, y }, player) + randRange(-0.25, 0.25);
    const type = getMissileArchetype(state.timeAlive);

    state.missiles.push(createMissile(x, y, heading, type));
}


/**
 * Scatter environmental obstacles (Removed).
 * 
 * @param {object} state
 */
export function scatterObstacles(state) {
    if (state.obstacles) state.obstacles.length = 0;
}
