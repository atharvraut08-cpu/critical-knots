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

        // Player's own missiles cannot hit player
        if (m.source !== 'player' && circleCircle(player, m)) {
            player.alive = false;
            m.alive = false;
            spawnExplosion(player.x, player.y, true);
            spawnExplosion(m.x, m.y, false);
            if (state.phase === 'playing') {
                state.phase = 'gameover';
                state.dogfightResult = 'defeat';
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

    // ── 2. Player ↔ Enemy Jet Mid-Air Collision ──────────
    if (state.enemies && state.enemies.length > 0) {
        for (let eIdx = 0; eIdx < state.enemies.length; eIdx++) {
            const enemy = state.enemies[eIdx];
            if (!enemy.alive) continue;

            if (circleCircle(player, enemy)) {
                player.alive = false;
                enemy.alive = false;
                spawnExplosion(player.x, player.y, true);
                spawnExplosion(enemy.x, enemy.y, false, true);
                applyShake(12);
                if (state.phase === 'playing') {
                    state.phase = 'gameover';
                    state.dogfightResult = 'defeat';
                    state.stats.timeSurvived = state.timeAlive;
                }
                return;
            }
        }
    }

    // ── 3. Player-Fired Missile ↔ Enemy Jet ──────────────
    if (state.enemies && state.enemies.length > 0) {
        for (let eIdx = 0; eIdx < state.enemies.length; eIdx++) {
            const enemy = state.enemies[eIdx];
            if (!enemy.alive) continue;

            for (let mIdx = 0; mIdx < missiles.length; mIdx++) {
                const m = missiles[mIdx];
                if (!m.alive || m.source !== 'player') continue;

                if (circleCircle(enemy, m)) {
                    m.alive = false;
                    enemy.alive = false;
                    state.stats.missilesDestroyed++;
                    state.stats.enemiesDestroyed++;
                    spawnExplosion(enemy.x, enemy.y, false, true);
                    applyShake(10);
                    break;
                }
            }
        }
    }

    // ── 4. Bullet ↔ Enemy Jet Impact ────────────────────
    const bullets = state.bullets;
    if (bullets && bullets.length > 0 && state.enemies && state.enemies.length > 0) {
        for (let bIdx = 0; bIdx < bullets.length; bIdx++) {
            const b = bullets[bIdx];
            if (!b.alive) continue;

            for (let eIdx = 0; eIdx < state.enemies.length; eIdx++) {
                const enemy = state.enemies[eIdx];
                if (!enemy.alive) continue;

                if (circleCircle(b, enemy)) {
                    b.alive = false;
                    enemy.health -= 25;
                    emit(b.x, b.y, 4, 'spark', '255,200,80', {
                        speedMin: 20,
                        speedMax: 80,
                        sizeMin: 1.5,
                        sizeMax: 3.5,
                        lifeMin: 0.1,
                        lifeMax: 0.25,
                    });
                    if (enemy.health <= 0) {
                        enemy.alive = false;
                        state.stats.enemiesDestroyed++;
                        spawnExplosion(enemy.x, enemy.y, false, true);
                        applyShake(10);
                    }
                    break;
                }
            }
        }
    }

    // ── 5. Missile ↔ Missile ────────────────────────────
    // Disabled by default via CONFIG.enableMissileToMissileCollisions to prevent vanishing in clusters
    if (CONFIG.enableMissileToMissileCollisions) {
        for (let i = 0; i < missiles.length; i++) {
            if (!missiles[i].alive) continue;
            for (let j = i + 1; j < missiles.length; j++) {
                if (!missiles[j].alive) continue;

                if (circleCircle(missiles[i], missiles[j])) {
                    missiles[i].alive = false;
                    missiles[j].alive = false;
                    state.stats.missilesDestroyed += 2;
                    spawnExplosion(missiles[i].x, missiles[i].y, false, true);
                    spawnExplosion(missiles[j].x, missiles[j].y, false, true);
                }
            }
        }
    }

    // ── 6. Missile ↔ Flare Impact ───────────────────────
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

    // ── 7. Bullet ↔ Missile Impact ──────────────────────
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

    // ── 8. Dogfight Mode Victory Evaluation ─────────────
    if (state.gameMode === 'dogfight' && state.phase === 'playing') {
        const allEnemiesDestroyed = state.enemies.length > 0 && state.enemies.every(e => !e.alive);
        if (allEnemiesDestroyed && player.alive) {
            state.phase = 'gameover';
            state.dogfightResult = 'victory';
            state.stats.timeSurvived = state.timeAlive;
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
