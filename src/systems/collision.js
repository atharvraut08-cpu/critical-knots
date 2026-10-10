/**
 * collision.js — Centralized collision detection & multi-stage explosion effects
 * 
 * CG Concepts:
 * - Euclidean distance & circle-circle / circle-AABB intersection tests
 * - Multi-stage parametric particle explosion emitters
 */

import { distance } from '../utils/vector.js';
import { CONFIG } from '../config.js';
import { applyShake } from '../camera.js';
import { emit } from '../entities/particle.js';

/**
 * Circle-circle collision test.
 * CG Concept: Euclidean distance — dist(a,b) < radiusA + radiusB
 * 
 * @param {object} a - { x, y, radius }
 * @param {object} b - { x, y, radius }
 * @returns {boolean}
 */
export function circleCircle(a, b) {
    const dist = distance(a, b);
    return dist < (a.radius + b.radius);
}

/**
 * Run all collision checks for the current frame.
 * 
 * @param {object} state
 */
export function checkAllCollisions(state) {
    const player = state.player;
    if (!player || !player.alive || state.phase !== 'playing') return;

    const missiles = state.missiles;
    const flares = state.flares;

    // ── 1. Player ↔ Missile ─────────────────────────────
    for (let i = 0; i < missiles.length; i++) {
        const m = missiles[i];
        if (!m.alive) continue;

        if (circleCircle(player, m)) {
            player.alive = false;
            m.alive = false;
            spawnExplosion(player.x, player.y, true);
            spawnExplosion(m.x, m.y, false);
            if (state.phase === 'playing') {
                state.phase = 'gameover';
                state.stats.timeSurvived = state.timeAlive;
            }
            return;
        }

        // Near-miss detection
        const dist = distance(player, m);
        if (dist < CONFIG.nearMissRadius && dist > player.radius + m.radius) {
            if (!m._nearMissCounted) {
                state.stats.nearMisses++;
                m._nearMissCounted = true;
            }
        }
    }

    // ── 2. Missile ↔ Missile ────────────────────────────
    for (let i = 0; i < missiles.length; i++) {
        if (!missiles[i].alive) continue;
        for (let j = i + 1; j < missiles.length; j++) {
            if (!missiles[j].alive) continue;

            if (circleCircle(missiles[i], missiles[j])) {
                missiles[i].alive = false;
                missiles[j].alive = false;
                state.stats.missilesDestroyed += 2;
                spawnExplosion(missiles[i].x, missiles[i].y, false, true);
            }
        }
    }

    // ── 3. Missile ↔ Flare Impact ───────────────────────
    for (let i = 0; i < missiles.length; i++) {
        const m = missiles[i];
        if (!m.alive) continue;

        for (let k = 0; k < flares.length; k++) {
            const f = flares[k];
            if (!f.alive) continue;

            // Direct flare intercept
            if (distance(m, f) < m.radius + 12) {
                m.alive = false;
                f.alive = false;
                state.stats.missilesDestroyed++;
                spawnExplosion(f.x, f.y, false);
                break;
            }
        }
    }

    // ── 4. Bullet ↔ Missile Impact ──────────────────────
    const bullets = state.bullets;
    if (bullets && bullets.length > 0) {
        for (let bIdx = 0; bIdx < bullets.length; bIdx++) {
            const b = bullets[bIdx];
            if (!b.alive) continue;

            // Check bullet against Missiles
            for (let mIdx = 0; mIdx < missiles.length; mIdx++) {
                const m = missiles[mIdx];
                if (!m.alive) continue;

                if (circleCircle(b, m)) {
                    b.alive = false;
                    m.alive = false;
                    state.stats.missilesDestroyed++;
                    spawnExplosion(m.x, m.y, false, m.type === 'heavy');
                    break;
                }
            }
        }
    }
}

/**
 * Multi-stage realistic explosion:
 * 1. Expanding shockwave ring
 * 2. High-heat fireball
 * 3. High-velocity burning sparks/shrapnel
 * 4. Lingering billowing smoke cloud
 * 
 * @param {number} x
 * @param {number} y
 * @param {boolean} isPlayer
 * @param {boolean} isHeavy
 */
export function spawnExplosion(x, y, isPlayer = false, isHeavy = false) {
    const mult = isPlayer ? 2.2 : (isHeavy ? 1.6 : 1.0);
    const count = Math.round(CONFIG.explosionParticleCount * mult);

    // 1. Shockwave ring
    emit(x, y, 1, 'shockwave', isPlayer ? '180,230,255' : '255,200,120', {
        sizeMin: 14 * mult,
        sizeMax: 20 * mult,
        lifeMin: 0.3,
        lifeMax: 0.45,
    });

    // 2. Fiery expanding core
    const coreColor = isPlayer ? '120,200,255' : '255,140,40';
    emit(x, y, Math.round(count * 0.5), 'explosion', coreColor, {
        speedMin: 30,
        speedMax: 130 * mult,
        sizeMin: 4 * mult,
        sizeMax: 12 * mult,
        lifeMin: 0.35,
        lifeMax: 0.75,
    });

    // 3. Shrapnel / fiery sparks
    emit(x, y, Math.round(count * 0.7), 'spark', '255,220,100', {
        speedMin: 60,
        speedMax: 200 * mult,
        sizeMin: 1.5,
        sizeMax: 3.5,
        lifeMin: 0.2,
        lifeMax: 0.5,
    });

    // 4. Lingering billowing smoke
    emit(x, y, Math.round(count * 0.4), 'smoke', '70,75,85', {
        speedMin: 15,
        speedMax: 50 * mult,
        sizeMin: 5 * mult,
        sizeMax: 14 * mult,
        lifeMin: 0.6,
        lifeMax: 1.1,
    });

    // Camera shake
    applyShake(CONFIG.shakeMaxMagnitude * (isPlayer ? 1.0 : (isHeavy ? 0.75 : 0.5)));
}
