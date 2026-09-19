/**
 * spawner.js — Missile, pickup, and obstacle spawn logic + difficulty curve
 * 
 * A single module owns all spawn timing so the difficulty curve is
 * tunable in one place via CONFIG. Missiles spawn on a ring just
 * outside the camera's culling radius, at a random angle, heading
 * roughly toward the player's current position at spawn time.
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
 * Floor at CONFIG.spawnIntervalFloor.
 * 
 * @param {number} timeAlive - seconds survived
 * @returns {number} spawn interval in seconds
 */
export function getSpawnInterval(timeAlive) {
    const decayFactor = Math.pow(0.5, timeAlive / CONFIG.spawnIntervalHalfLife);
    const interval = CONFIG.spawnIntervalStart * decayFactor;
    return Math.max(interval, CONFIG.spawnIntervalFloor);
}

/**
 * Compute current missile archetype mix.
 * Linearly transitions from archetypeMixStart to archetypeMixEnd
 * over archetypeMixTransitionTime seconds.
 * 
 * @param {number} timeAlive
 * @returns {number} probability of homing missile (0-1)
 */
function getHomingProbability(timeAlive) {
    const t = Math.min(timeAlive / CONFIG.archetypeMixTransitionTime, 1);
    return CONFIG.archetypeMixStart + (CONFIG.archetypeMixEnd - CONFIG.archetypeMixStart) * t;
}

/**
 * Update spawner timers and spawn entities as needed.
 * 
 * @param {object} state - game state
 * @param {number} dt
 * @param {number} canvasW
 * @param {number} canvasH
 */
export function updateSpawner(state, dt, canvasW, canvasH) {
    const player = state.player;
    if (!player || !player.alive) return;

    // ── Missile spawning ────────────────────────────────
    state.missileSpawnTimer -= dt;
    if (state.missileSpawnTimer <= 0) {
        spawnMissile(state, player, canvasW, canvasH);
        state.missileSpawnTimer = getSpawnInterval(state.timeAlive);
    }

    // ── Fuel canister spawning ──────────────────────────
    state.pickupSpawnTimer -= dt;
    if (state.pickupSpawnTimer <= 0) {
        spawnPickup(state, player);
        state.pickupSpawnTimer = CONFIG.pickupSpawnInterval;
    }
}

/**
 * Spawn a missile on a ring outside the camera cull radius.
 * Risk #3 mitigation: enforce minimum spawn distance from player.
 */
function spawnMissile(state, player, canvasW, canvasH) {
    const maxDim = Math.max(canvasW, canvasH);
    const spawnDist = maxDim * CONFIG.cameraCullFactor + CONFIG.spawnRingMargin;

    // Random angle around the player
    const angle = randRange(0, Math.PI * 2);
    const x = player.x + Math.cos(angle) * spawnDist;
    const y = player.y + Math.sin(angle) * spawnDist;

    // Verify minimum distance (Risk #3)
    if (distance({ x, y }, player) < CONFIG.minSpawnDistFromPlayer) {
        return; // skip this spawn, will retry next interval
    }

    // Heading: point roughly toward the player at spawn time
    const heading = angleTo({ x, y }, player);

    // Archetype selection based on difficulty curve
    const homingProb = getHomingProbability(state.timeAlive);
    const type = Math.random() < homingProb ? 'homing' : 'rocket';

    state.missiles.push(createMissile(x, y, heading, type));
}

/**
 * Spawn a fuel canister ahead of the player's current heading.
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
 * Scatter initial obstacles in the world around origin.
 * Called once at game start.
 * 
 * @param {object} state
 */
export function scatterObstacles(state) {
    for (let i = 0; i < CONFIG.obstacleCount; i++) {
        const angle = randRange(0, Math.PI * 2);
        const dist = randRange(300, CONFIG.obstacleSpawnRadius);
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        const size = randRange(CONFIG.obstacleMinRadius, CONFIG.obstacleMaxRadius);
        const shape = Math.random() < 0.4 ? 'aabb' : 'circle';

        state.obstacles.push(createObstacle(x, y, shape, size));
    }
}
