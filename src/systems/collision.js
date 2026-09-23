/**
 * collision.js — Centralized collision detection & multi-stage explosion effects
 * 
 * CG Concepts:
 * - Euclidean distance & circle-circle / circle-AABB intersection tests
 * - Multi-stage parametric particle explosion emitters
 * - Multiplayer damage arbitration & friendly fire checks
 */

import { distance } from '../utils/vector.js';
import { CONFIG } from '../config.js';
import { applyShake } from '../camera.js';
import { emit } from '../entities/particle.js';
import { playExplosion } from './audio.js?v=2.4.0';

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
 * Circle-AABB collision test (clamped-point method).
 * 
 * @param {{ x: number, y: number, radius: number }} circle
 * @param {{ x: number, y: number, w: number, h: number }} rect
 * @returns {boolean}
 */
export function circleAABB(circle, rect) {
    const halfW = rect.w / 2;
    const halfH = rect.h / 2;
    const closestX = Math.max(rect.x - halfW, Math.min(circle.x, rect.x + halfW));
    const closestY = Math.max(rect.y - halfH, Math.min(circle.y, rect.y + halfH));

    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return (dx * dx + dy * dy) < (circle.radius * circle.radius);
}

/**
 * Run all collision checks for the single-player game modes.
 * 
 * @param {object} state
 */
export function checkAllCollisions(state) {
    const player = state.player;
    if (!player || !player.alive) return;

    const missiles = state.missiles;
    const obstacles = state.obstacles;
    const pickups = state.pickups;
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

    // ── 2. Player ↔ Obstacle ────────────────────────────
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

    // ── 3. Player ↔ Pickup ──────────────────────────────
    for (let i = 0; i < pickups.length; i++) {
        const pk = pickups[i];
        if (!pk.alive) continue;

        if (circleCircle(player, pk)) {
            pk.alive = false;
            player.fuel = Math.min(player.fuel + pk.amount, player.maxFuel);
            state.stats.fuelCollected++;
            emit(pk.x, pk.y, 12, 'spark', '0,255,140', {
                speedMin: 40,
                speedMax: 110,
            });
        }
    }

    // ── 4. Missile ↔ Obstacle ───────────────────────────
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
                spawnExplosion(m.x, m.y, false, m.type === 'heavy');
                break;
            }
        }
    }

    // ── 5. Missile ↔ Missile ────────────────────────────
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

    // ── 6. Missile ↔ Flare Impact ───────────────────────
    for (let i = 0; i < missiles.length; i++) {
        const m = missiles[i];
        if (!m.alive) continue;

        for (let k = 0; k < flares.length; k++) {
            const f = flares[k];
            if (!f.alive) continue;

            if (distance(m, f) < m.radius + 12) {
                m.alive = false;
                f.alive = false;
                state.stats.missilesDestroyed++;
                spawnExplosion(f.x, f.y, false);
                break;
            }
        }
    }

    // ── 7. Bullet ↔ Missile & Obstacle Impact ───────────
    const bullets = state.bullets;
    if (bullets && bullets.length > 0) {
        for (let bIdx = 0; bIdx < bullets.length; bIdx++) {
            const b = bullets[bIdx];
            if (!b.alive) continue;

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

            if (!b.alive) continue;

            for (let oIdx = 0; oIdx < obstacles.length; oIdx++) {
                const obs = obstacles[oIdx];
                if (!obs.alive) continue;

                const hit = obs.shape === 'aabb'
                    ? circleAABB(b, obs)
                    : circleCircle(b, obs);

                if (hit) {
                    b.alive = false;
                    obs.alive = false;
                    emit(b.x, b.y, 16, 'spark', '255,200,100', {
                        speedMin: 50,
                        speedMax: 150,
                        sizeMin: 1.5,
                        sizeMax: 3.5,
                        lifeMin: 0.15,
                        lifeMax: 0.4,
                    });
                    emit(obs.x, obs.y, 10, 'smoke', '110,110,120', {
                        speedMin: 20,
                        speedMax: 70,
                        sizeMin: 4,
                        sizeMax: 12,
                        lifeMin: 0.4,
                        lifeMax: 0.9,
                    });
                    break;
                }
            }
        }
    }
}

/**
 * Run collision checks for Multiplayer Mode:
 * - Bullets vs Enemy Jets (friendly-fire disabled)
 * - Wing Missiles vs Enemy Jets & Flares
 * - Jets vs Health Kits (+50 HP) & Boost Crates
 * 
 * @param {object} state
 * @param {object} net - NetworkClient instance
 */
export function checkMultiplayerCollisions(state, net) {
    const player = state.player;
    if (!player) return;

    const allTargets = [player, ...(state.remotePlayers || [])];

    // ── 1. Bullets vs Aircraft ──────────────────────────
    const bullets = state.bullets;
    if (bullets && bullets.length > 0) {
        for (let bIdx = 0; bIdx < bullets.length; bIdx++) {
            const b = bullets[bIdx];
            if (!b.alive) continue;

            for (const target of allTargets) {
                if (!target.alive) continue;
                // Friendly fire immunity
                if (target.team === b.ownerTeam) continue;

                if (circleCircle(b, target)) {
                    b.alive = false;
                    // Spark impact
                    emit(b.x, b.y, 8, 'spark', '255,230,100', {
                        speedMin: 40,
                        speedMax: 100,
                        sizeMin: 1.5,
                        sizeMax: 3.0,
                    });

                    // If local player fired this bullet, report hit to server
                    if (b.ownerId === player.id) {
                        net.reportHit(target.id, 6, '20mm Cannon');
                    }
                    break;
                }
            }
        }
    }

    // ── 2. Combat Missiles vs Aircraft ──────────────────
    const combatMissiles = state.combatMissiles || [];
    for (const m of combatMissiles) {
        if (!m.alive) continue;

        for (const target of allTargets) {
            if (!target.alive) continue;
            if (target.team === m.ownerTeam) continue;

            if (circleCircle(m, target)) {
                m.alive = false;
                spawnExplosion(m.x, m.y, false, true);

                if (m.ownerId === player.id) {
                    net.reportHit(target.id, 50, 'Sidewinder Missile');
                }
                break;
            }
        }
    }

    // ── 3. Local Player ↔ Health Kits & Boosts ──────────
    if (player.alive && state.pickups) {
        for (const pk of state.pickups) {
            if (!pk.alive) continue;

            if (circleCircle(player, pk)) {
                pk.alive = false;
                // Health nanotech green sparkles or shield blue sparks
                const sparkColor = pk.type === 'health' ? '52,199,89'
                    : pk.type === 'shield' ? '0,122,255'
                    : pk.type === 'missile' ? '255,149,0'
                    : '175,82,222';

                emit(pk.x, pk.y, 20, 'spark', sparkColor, {
                    speedMin: 50,
                    speedMax: 140,
                    sizeMin: 2,
                    sizeMax: 4,
                });

                net.collectPickup(pk.id);
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
 */
export function spawnExplosion(x, y, isPlayer = false, isHeavy = false) {
    playExplosion(isPlayer || isHeavy);
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
