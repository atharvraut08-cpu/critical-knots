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
 * Compute current missile spawn interval based on survival time.
 * Exponential decay: interval halves every CONFIG.spawnIntervalHalfLife seconds.
 * 
 * @param {number} timeAlive
 * @returns {number} seconds
 */
export function getSpawnInterval(timeAlive) {
    const decayFactor = Math.pow(0.5, timeAlive / CONFIG.spawnIntervalHalfLife);
    const interval = CONFIG.spawnIntervalStart * decayFactor;
    return Math.max(interval, CONFIG.spawnIntervalFloor);
}

/**
 * Select a missile archetype based on current survival time.
 * Progressively introduces more lethal and specialized missile threats.
 * 
 * @param {number} timeAlive
 * @returns {'standard'|'heavy'|'fast'|'hyper'}
 */
export function getMissileArchetype(timeAlive) {
    const roll = Math.random();

    if (timeAlive < 15) {
        // Early game: mostly standard Sidewinders
        return roll < 0.75 ? 'standard' : 'heavy';
    } else if (timeAlive < 40) {
        // Mid game: Sidewinders, Heavy Titans, and Fast Falcons
        if (roll < 0.40) return 'standard';
        if (roll < 0.75) return 'fast';
        return 'heavy';
    } else {
        // Late game: All 4 types, with dangerous Hypersonic Vipers
        if (roll < 0.30) return 'standard';
        if (roll < 0.55) return 'fast';
        if (roll < 0.75) return 'heavy';
        return 'hyper'; // 25% Hypersonic threats
    }
}

/**
 * Update spawner timers and spawn entities.
 * 
 * @param {object} state
 * @param {number} dt
 * @param {number} canvasW
 * @param {number} canvasH
 */
export function updateSpawner(state, dt, canvasW, canvasH) {
    const player = state.player;
    if (!player || !player.alive) return;

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
    const maxDim = Math.max(canvasW, canvasH);
    const spawnDist = maxDim * CONFIG.cameraCullFactor + CONFIG.spawnRingMargin;

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
