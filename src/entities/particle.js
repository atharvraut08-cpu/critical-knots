/**
 * particle.js — Pre-allocated ring-buffer particle pool
 * 
 * CG Concept: Parametric Particle Systems
 * Particles are spawned from emitters (plane exhaust, missile trails,
 * explosions). Alpha and size are interpolated by life/maxLife as
 * a pure function of the particle's age — this is the parametric aspect.
 * 
 * Performance: the pool is pre-allocated to MAX_PARTICLES and reused
 * via a ring-buffer overwrite-oldest strategy, avoiding GC pressure
 * from push/splice churn in hot paths. This is a deliberate,
 * performance-aware design decision.
 */

import { CONFIG } from '../config.js';
import { randRange } from '../utils/math.js';

// ── Pre-allocated pool ──────────────────────────────────
const pool = [];
let head = 0; // ring buffer write pointer

/** Initialize the particle pool (call once at startup). */
export function initParticles() {
    pool.length = 0;
    head = 0;
    for (let i = 0; i < CONFIG.maxParticles; i++) {
        pool.push({
            x: 0, y: 0,
            vx: 0, vy: 0,
            life: 0, maxLife: 1,
            size: 1,
            color: '255,255,255',
            kind: 'smoke',
            alive: false,
        });
    }
}

/**
 * Emit particles from a point.
 * CG Concept: Parametric particle systems — emitter spawns particles
 * with randomized velocity, lifetime, and size that evolve as pure
 * functions of their age.
 * 
 * Uses ring-buffer overwrite-oldest strategy (Risk #6 mitigation):
 * if pool is full, oldest particles are replaced rather than skipped,
 * so visuals degrade gracefully instead of missing effects entirely.
 * 
 * @param {number} x - emit world X
 * @param {number} y - emit world Y
 * @param {number} count - number of particles to spawn
 * @param {'smoke'|'explosion'|'spark'} kind
 * @param {string} color - CSS rgb components e.g. '255,100,50'
 * @param {object} [opts] - optional overrides
 */
export function emit(x, y, count, kind, color, opts = {}) {
    const speedMin = opts.speedMin ?? 20;
    const speedMax = opts.speedMax ?? 80;
    const lifeMin = kind === 'explosion' ? CONFIG.explosionLifeMin : CONFIG.smokeLifeMin;
    const lifeMax = kind === 'explosion' ? CONFIG.explosionLifeMax : CONFIG.smokeLifeMax;
    const sizeMin = opts.sizeMin ?? (kind === 'explosion' ? 3 : 1.5);
    const sizeMax = opts.sizeMax ?? (kind === 'explosion' ? 7 : 3.5);

    for (let i = 0; i < count; i++) {
        const p = pool[head];
        // Overwrite-oldest (ring buffer)
        const angle = randRange(0, Math.PI * 2);
        const speed = randRange(speedMin, speedMax);
        const life = randRange(lifeMin, lifeMax);

        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = life;
        p.maxLife = life;
        p.size = randRange(sizeMin, sizeMax);
        p.color = color;
        p.kind = kind;
        p.alive = true;

        head = (head + 1) % CONFIG.maxParticles;
    }
}

/**
 * Emit a directional trail particle (for exhaust/smoke trails).
 */
export function emitTrail(x, y, heading, color) {
    const p = pool[head];
    const spread = randRange(-0.4, 0.4);
    const speed = randRange(15, 35);
    const backAngle = heading + Math.PI + spread;

    p.x = x;
    p.y = y;
    p.vx = Math.cos(backAngle) * speed;
    p.vy = Math.sin(backAngle) * speed;
    p.life = randRange(0.2, 0.5);
    p.maxLife = p.life;
    p.size = randRange(1.5, 3);
    p.color = color;
    p.kind = 'smoke';
    p.alive = true;

    head = (head + 1) % CONFIG.maxParticles;
}

/**
 * Update all alive particles.
 * CG Concept: Parametric particle systems — life decays over time;
 * particles are removed when life <= 0.
 * 
 * @param {number} dt
 */
export function updateParticles(dt) {
    for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.alive) continue;

        p.life -= dt;
        if (p.life <= 0) {
            p.alive = false;
            continue;
        }

        // Kinematic motion for particles
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Drag/friction for natural deceleration
        p.vx *= 0.98;
        p.vy *= 0.98;
    }
}

/**
 * Draw all alive particles.
 * CG Concept: Parametric particle systems — alpha and size are
 * interpolated as pure functions of life/maxLife, creating smooth
 * fade-out and shrink effects.
 * 
 * @param {CanvasRenderingContext2D} ctx
 * @param {function} worldToScreenFn - camera transform function
 * @param {number} canvasW
 * @param {number} canvasH
 */
export function drawParticles(ctx, worldToScreenFn, canvasW, canvasH) {
    for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.alive) continue;

        const t = p.life / p.maxLife; // 1.0 at birth, 0.0 at death
        const screenPos = worldToScreenFn(p.x, p.y, canvasW, canvasH);

        // Skip off-screen particles
        if (screenPos.x < -20 || screenPos.x > canvasW + 20 ||
            screenPos.y < -20 || screenPos.y > canvasH + 20) continue;

        const alpha = t * 0.7;
        const size = p.size * (0.3 + t * 0.7);

        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},${alpha})`;
        ctx.fill();
    }
}

/** Return the current active particle count (for debug HUD). */
export function getActiveCount() {
    let count = 0;
    for (let i = 0; i < pool.length; i++) {
        if (pool[i].alive) count++;
    }
    return count;
}
