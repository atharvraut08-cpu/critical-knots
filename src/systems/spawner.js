/**
 * spawner.js — Threat escalation spawner & terrain generation
 * 
 * Manages:
 * - Dynamic missile archetype escalation based on survival time
 * - Environmental mesa and cliff formations
 * - Fuel canister distribution
 */

import { CONFIG } from '../config.js';
import { randRange, randInt } from '../utils/math.js';
import { distance, angleTo } from '../utils/vector.js';
import { createMissile } from '../entities/missile.js';
import { createObstacle } from '../entities/obstacle.js';
import { createPickup } from '../entities/pickup.js';

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

    // ── Fuel Canister Spawning ──────────────────────────
    state.pickupSpawnTimer -= dt;
    if (state.pickupSpawnTimer <= 0) {
        spawnPickup(state, player);
        state.pickupSpawnTimer = CONFIG.pickupSpawnInterval;
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
 * Spawn fuel canister ahead of player flight corridor.
 */
function spawnPickup(state, player) {
    const dist = randRange(CONFIG.pickupSpawnRadius * 0.5, CONFIG.pickupSpawnRadius);
    const angleSpread = randRange(-Math.PI / 3, Math.PI / 3);
    const angle = player.heading + angleSpread;
    const x = player.x + Math.cos(angle) * dist;
    const y = player.y + Math.sin(angle) * dist;

    state.pickups.push(createPickup(x, y));
}

/**
 * Scatter environmental mesa/cliff formations in the world.
 * 
 * @param {object} state
 */
export function scatterObstacles(state) {
    state.obstacles.length = 0;

    // ── Mesa / Cliff Formations ──────────────────────────
    const cliffCount = CONFIG.obstacleCount || 14;
    for (let i = 0; i < cliffCount; i++) {
        const angle = (i / cliffCount) * Math.PI * 2 + randRange(-0.2, 0.2);
        const dist = randRange(350, CONFIG.obstacleSpawnRadius * 0.95);
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        const size = randRange(55, 95);

        state.obstacles.push(createObstacle(x, y, 'cliff', size));
    }
}
