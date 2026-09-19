/**
 * collision.js — Centralized collision detection
 * 
 * CG Concept: Euclidean Distance & Collision Detection
 * All collision checks live here — never inlined in entity files.
 * Uses circle-circle and circle-AABB primitives to cover all
 * entity interactions.
 * 
 * Broad phase: brute-force O(n²) is acceptable given the entity
 * cap in the performance budget (≤20 missiles). A spatial grid
 * is the documented stretch optimization if profiling shows need.
 */

import { distance } from '../utils/vector.js';
import { CONFIG } from '../config.js';
import { applyShake } from '../camera.js';
import { emit } from '../entities/particle.js';

/**
 * Circle-circle collision test.
 * CG Concept: Euclidean distance — dist(a,b) < radiusA + radiusB
 * Justification: circle-circle is O(1) per pair and sufficient
 * for all entities at this scale; pixel-perfect would be overkill.
 * 
 * @param {object} a - { x, y, radius }
 * @param {object} b - { x, y, radius }
 * @returns {boolean}
 */
export function circleCircle(a, b) {
    const dist = distance(a, b);
    return dist < a.radius + b.radius;
}

/**
 * Circle-AABB collision test (clamped-point method).
 * CG Concept: Collision detection — find the closest point on the
 * AABB to the circle center, then check Euclidean distance.
 * 
 * @param {{ x: number, y: number, radius: number }} circle
 * @param {{ x: number, y: number, w: number, h: number }} rect
 * @returns {boolean}
 */
export function circleAABB(circle, rect) {
    // Find closest point on AABB to circle center
    const halfW = rect.w / 2;
    const halfH = rect.h / 2;
    const closestX = Math.max(rect.x - halfW, Math.min(circle.x, rect.x + halfW));
    const closestY = Math.max(rect.y - halfH, Math.min(circle.y, rect.y + halfH));

    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return (dx * dx + dy * dy) < (circle.radius * circle.radius);
}

/**
 * Run all collision checks for the current frame.
 * 
 * @param {object} state - game state
 */
export function checkAllCollisions(state) {
    const player = state.player;
    if (!player || !player.alive) return;

    const missiles = state.missiles;
    const obstacles = state.obstacles;
    const pickups = state.pickups;

    // ── Player ↔ Missile ────────────────────────────────
    for (let i = 0; i < missiles.length; i++) {
        const m = missiles[i];
        if (!m.alive) continue;

        if (circleCircle(player, m)) {
            // Player hit — game over
            player.alive = false;
            m.alive = false;
            spawnExplosion(player.x, player.y, true);
            spawnExplosion(m.x, m.y, false);
            return; // stop checking after death
        }

        // Near-miss detection (for scoring)
        const dist = distance(player, m);
        if (dist < CONFIG.nearMissRadius && dist > player.radius + m.radius) {
            // Mark as near-miss (tracked per missile to avoid double-counting)
            if (!m._nearMissCounted) {
                state.stats.nearMisses++;
                m._nearMissCounted = true;
            }
        }
    }

    // ── Player ↔ Obstacle ───────────────────────────────
    for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        if (!obs.alive) continue;

        const hit = obs.shape === 'aabb'
            ? circleAABB(player, obs)
            : circleCircle(player, obs);

        if (hit) {
            player.alive = false;
            spawnExplosion(player.x, player.y, true);
            return;
        }
    }

    // ── Player ↔ Pickup ─────────────────────────────────
    for (let i = 0; i < pickups.length; i++) {
        const pk = pickups[i];
        if (!pk.alive) continue;

        if (circleCircle(player, pk)) {
            pk.alive = false;
            player.fuel = Math.min(player.fuel + pk.amount, player.maxFuel);
            state.stats.fuelCollected++;
            // Pickup sparkle
            emit(pk.x, pk.y, 8, 'spark', '0,255,140');
        }
    }

    // ── Missile ↔ Obstacle ──────────────────────────────
    for (let i = 0; i < missiles.length; i++) {
        const m = missiles[i];
        if (!m.alive) continue;

        for (let j = 0; j < obstacles.length; j++) {
            const obs = obstacles[j];
            if (!obs.alive) continue;

            const hit = obs.shape === 'aabb'
                ? circleAABB(m, obs)
                : circleCircle(m, obs);

            if (hit) {
                m.alive = false;
                state.stats.missilesDestroyed++;
                spawnExplosion(m.x, m.y, false);
                break;
            }
        }
    }

    // ── Missile ↔ Missile ───────────────────────────────
    // Risk #8: Two missiles collide — both destroyed, counts for player
    for (let i = 0; i < missiles.length; i++) {
        if (!missiles[i].alive) continue;
        for (let j = i + 1; j < missiles.length; j++) {
            if (!missiles[j].alive) continue;

            if (circleCircle(missiles[i], missiles[j])) {
                missiles[i].alive = false;
                missiles[j].alive = false;
                state.stats.missilesDestroyed += 2;
                spawnExplosion(missiles[i].x, missiles[i].y, false);
            }
        }
    }
}

/**
 * Spawn explosion particles and apply screen shake.
 * @param {number} x
 * @param {number} y
 * @param {boolean} isPlayer - bigger explosion for player death
 */
function spawnExplosion(x, y, isPlayer) {
    const count = isPlayer ? CONFIG.explosionParticleCount * 2 : CONFIG.explosionParticleCount;
    const color = isPlayer ? '100,180,255' : '255,140,50';
    emit(x, y, count, 'explosion', color, {
        speedMin: 40,
        speedMax: isPlayer ? 200 : 140,
        sizeMin: 2,
        sizeMax: isPlayer ? 10 : 6,
    });
    applyShake(isPlayer ? CONFIG.shakeMaxMagnitude : CONFIG.shakeMaxMagnitude * 0.5);
}
