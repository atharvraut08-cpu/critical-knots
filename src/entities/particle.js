/**
 * particle.js — Pre-allocated ring-buffer particle pool
 * 
 * CG Concept: Parametric Particle Systems
 * Particles are spawned from emitters (plane exhaust, missile trails,
 * explosions, flares). Alpha and size are interpolated
 * by life/maxLife as a pure function of the particle's age.
 * 
 * Performance: the pool is pre-allocated to CONFIG.maxParticles and reused
 * via a ring-buffer overwrite-oldest strategy, avoiding GC pressure
 * from push/splice churn in hot paths.
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
 * CG Concept: Parametric particle systems
 * 
 * @param {number} x - emit world X
 * @param {number} y - emit world Y
 * @param {number} count - number of particles to spawn
 * @param {'smoke'|'explosion'|'spark'|'flame'|'shockwave'} kind
 * @param {string} color - CSS rgb components e.g. '255,100,50'
 * @param {object} [opts] - optional overrides (speedMin, speedMax, sizeMin, sizeMax, lifeMin, lifeMax)
 */
export function emit(x, y, count, kind, color, opts = {}) {
    const speedMin = opts.speedMin ?? (kind === 'spark' ? 60 : (kind === 'explosion' ? 40 : 20));
    const speedMax = opts.speedMax ?? (kind === 'spark' ? 160 : (kind === 'explosion' ? 150 : 70));
    const lifeMin = opts.lifeMin ?? (kind === 'explosion' ? CONFIG.explosionLifeMin : (kind === 'spark' ? 0.15 : CONFIG.smokeLifeMin));
    const lifeMax = opts.lifeMax ?? (kind === 'explosion' ? CONFIG.explosionLifeMax : (kind === 'spark' ? 0.45 : CONFIG.smokeLifeMax));
    const sizeMin = opts.sizeMin ?? (kind === 'explosion' ? 4 : (kind === 'spark' ? 1.2 : 2));
    const sizeMax = opts.sizeMax ?? (kind === 'explosion' ? 12 : (kind === 'spark' ? 3 : 5));

    for (let i = 0; i < count; i++) {
        const p = pool[head];
        const angle = randRange(0, Math.PI * 2);
        const speed = randRange(speedMin, speedMax);
        const life = randRange(lifeMin, lifeMax);

        p.x = x;
        p.y = y;
        p.vx = (opts.baseVx ?? 0) + Math.cos(angle) * speed;
        p.vy = (opts.baseVy ?? 0) + Math.sin(angle) * speed;
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
export function emitTrail(x, y, heading, color, kind = 'smoke', opts = {}) {
    const p = pool[head];
    const spread = randRange(-0.35, 0.35);
    const speed = randRange(15, 40);
    const backAngle = heading + Math.PI + spread;

    p.x = x;
    p.y = y;
    p.vx = Math.cos(backAngle) * speed;
    p.vy = Math.sin(backAngle) * speed;
    p.life = randRange(opts.lifeMin ?? 0.25, opts.lifeMax ?? 0.6);
    p.maxLife = p.life;
    p.size = randRange(opts.sizeMin ?? 2, opts.sizeMax ?? 4.5);
    p.color = color;
    p.kind = kind;
    p.alive = true;

    head = (head + 1) % CONFIG.maxParticles;
}

/**
 * Update all alive particles.
 * CG Concept: Parametric particle systems — kinematic motion + life decay
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

        // Kinematic motion
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Aerodynamic drag
        p.vx *= 0.96;
        p.vy *= 0.96;
    }
}

/**
 * Draw all alive particles with tailored shaders/blends based on particle kind.
 * CG Concept: Parametric particle systems — life/maxLife parametric curves
 * 
 * @param {CanvasRenderingContext2D} ctx
 * @param {function} worldToScreenFn
 * @param {number} canvasW
 * @param {number} canvasH
 */
export function drawParticles(ctx, worldToScreenFn, canvasW, canvasH) {
    for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.alive) continue;

        const t = p.life / p.maxLife; // 1.0 (birth) -> 0.0 (death)
        const sp = worldToScreenFn(p.x, p.y, canvasW, canvasH);

        // Cull off-screen
        if (sp.x < -40 || sp.x > canvasW + 40 || sp.y < -40 || sp.y > canvasH + 40) continue;

        ctx.save();

        if (p.kind === 'spark') {
            // Hot electrical or fiery spark: bright glowing line/dot
            const alpha = Math.min(t * 1.4, 1);
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.color},${alpha})`;
            ctx.shadowColor = `rgb(${p.color})`;
            ctx.shadowBlur = 6;
            ctx.fill();
        } else if (p.kind === 'flame') {
            // Fiery core: intense center fading out
            const alpha = t * 0.9;
            const curSize = p.size * (0.6 + (1 - t) * 0.6);
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, curSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.color},${alpha})`;
            ctx.shadowColor = `rgb(${p.color})`;
            ctx.shadowBlur = 8;
            ctx.fill();
        } else if (p.kind === 'shockwave') {
            // Expanding thin blast ring
            const alpha = t * 0.8;
            const ringRadius = p.size * (1 + (1 - t) * 4);
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, ringRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${p.color},${alpha})`;
            ctx.lineWidth = Math.max(1, 2.5 * t);
            ctx.stroke();
        } else if (p.kind === 'explosion') {
            // Fireball explosion: expands and darkens from white/yellow to smoky red
            const alpha = t * 0.85;
            const curSize = p.size * (0.4 + (1 - t) * 1.2);
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, curSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.color},${alpha})`;
            ctx.fill();
        } else {
            // Billowing smoke: expands as it fades
            const alpha = t * 0.55;
            const curSize = p.size * (0.5 + (1 - t) * 1.5);
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, curSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.color},${alpha})`;
            ctx.fill();
        }

        ctx.restore();
    }
}

/** Return active particle count (for HUD debug). */
export function getActiveCount() {
    let count = 0;
    for (let i = 0; i < pool.length; i++) {
        if (pool[i].alive) count++;
    }
    return count;
}
