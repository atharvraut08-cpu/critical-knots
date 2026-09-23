/**
 * particle.js — High-performance Batched Ring-Buffer Particle System
 * 
 * Performance Optimizations:
 * - Pre-allocated ring buffer eliminates runtime GC pressure
 * - Dual-pass batched rendering (pass 1: normal smoke/explosions, pass 2: additive sparks/flames/shockwaves)
 * - Complete elimination of per-particle ctx.save() and ctx.restore() (saves 1,500+ state stack pushes/frame)
 * - Fast viewport culling with zero object allocations
 */

import { CONFIG } from '../config.js?v=2.3';
import { randRange } from '../utils/math.js?v=2.3';

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
 * 
 * @param {number} x - emit world X
 * @param {number} y - emit world Y
 * @param {number} count - number of particles to spawn
 * @param {'smoke'|'explosion'|'spark'|'flame'|'shockwave'} kind
 * @param {string} color - CSS rgb components e.g. '255,100,50'
 * @param {object} [opts] - optional overrides
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
 * Batched dual-pass particle renderer:
 * - Pass 1: Standard atmospheric smoke & explosion clouds (source-over)
 * - Pass 2: High-intensity glowing sparks, flame cores & shockwaves (lighter / additive blend)
 * Zero ctx.save() / ctx.restore() inside the loop!
 * 
 * @param {CanvasRenderingContext2D} ctx
 * @param {function} worldToScreenFn
 * @param {number} canvasW
 * @param {number} canvasH
 */
export function drawParticles(ctx, worldToScreenFn, canvasW, canvasH) {
    // ── PASS 1: Volumetric Smoke & Explosions (source-over) ─
    ctx.globalCompositeOperation = 'source-over';

    for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.alive || p.kind === 'spark' || p.kind === 'flame' || p.kind === 'shockwave') continue;

        const sp = worldToScreenFn(p.x, p.y, canvasW, canvasH);
        if (sp.x < -50 || sp.x > canvasW + 50 || sp.y < -50 || sp.y > canvasH + 50) continue;

        const t = p.life / p.maxLife; // 1.0 (birth) -> 0.0 (death)

        if (p.kind === 'explosion') {
            const alpha = t * 0.85;
            const curSize = p.size * (0.4 + (1 - t) * 1.4);
            ctx.fillStyle = `rgba(${p.color},${alpha})`;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, curSize, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Billowing smoke
            const alpha = t * 0.5;
            const curSize = p.size * (0.5 + (1 - t) * 1.6);
            ctx.fillStyle = `rgba(${p.color},${alpha})`;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, curSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ── PASS 2: Additive Luminous Blends (Sparks, Flames, Shockwaves) ─
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.alive || (p.kind !== 'spark' && p.kind !== 'flame' && p.kind !== 'shockwave')) continue;

        const sp = worldToScreenFn(p.x, p.y, canvasW, canvasH);
        if (sp.x < -60 || sp.x > canvasW + 60 || sp.y < -60 || sp.y > canvasH + 60) continue;

        const t = p.life / p.maxLife;

        if (p.kind === 'spark') {
            const alpha = Math.min(t * 1.5, 1);
            ctx.fillStyle = `rgba(${p.color},${alpha})`;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, p.size * 1.2, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.kind === 'flame') {
            const alpha = t;
            const curSize = p.size * (0.7 + (1 - t) * 0.7);
            ctx.fillStyle = `rgba(${p.color},${alpha})`;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, curSize, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.kind === 'shockwave') {
            const alpha = t * 0.85;
            const ringRadius = p.size * (1 + (1 - t) * 4.5);
            ctx.strokeStyle = `rgba(${p.color},${alpha})`;
            ctx.lineWidth = Math.max(1.2, 3 * t);
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // Reset composite operation to standard
    ctx.globalCompositeOperation = 'source-over';
}

/** Return active particle count (for HUD debug). */
export function getActiveCount() {
    let count = 0;
    for (let i = 0; i < pool.length; i++) {
        if (pool[i].alive) count++;
    }
    return count;
}
