/**
 * countermeasures.js — Believable Physical Flares
 * 
 * CG Concepts:
 * - Kinematic motion & aerodynamic drag for physical flare trajectories
 * - Atmospheric illumination & emission blending
 */

import { CONFIG } from '../config.js';
import { randRange } from '../utils/math.js';
import { consumeAction } from '../input.js';
import { emit } from '../entities/particle.js';

/**
 * Update countermeasure systems (flares).
 * 
 * @param {object} state
 * @param {number} dt
 * @param {object} input
 */
export function updateCountermeasures(state, dt, input) {
    const player = state.player;
    if (!player || !player.alive) return;

    // Flares are a fixed finite supply of 5 charges for the entire run (no regeneration)

    // ── Input Triggers ──────────────────────────────────
    if (consumeAction('flare') && player.flares > 0 && player.flareCooldown <= 0) {
        deployFlareSalvo(player, state, false);
    }

    // ── Update Active Physical Flares ────────────────────
    for (let i = state.flares.length - 1; i >= 0; i--) {
        const f = state.flares[i];
        f.age += dt;
        f.life -= dt;

        if (f.life <= 0) {
            f.alive = false;
            continue;
        }

        // Kinematic position update with aerodynamic drag
        f.x += f.vx * dt;
        f.y += f.vy * dt;

        const drag = Math.max(0, 1 - CONFIG.flareDrag * dt);
        f.vx *= drag;
        f.vy *= drag;

        // Emit hot sparks & heavy glowing smoke trail while burning
        f.sparkTimer -= dt;
        if (f.sparkTimer <= 0) {
            emit(f.x, f.y, 1, 'spark', '255,230,120', {
                speedMin: 15,
                speedMax: 45,
                sizeMin: 1.5,
                sizeMax: 3.5,
                lifeMin: 0.15,
                lifeMax: 0.35,
            });
            f.sparkTimer = CONFIG.flareSparkRate;
        }

        f.smokeTimer -= dt;
        if (f.smokeTimer <= 0) {
            // Heavy, continuous billowing smoke trail forming thick arcs
            emit(f.x, f.y, 2, 'smoke', '235,235,245', {
                speedMin: 8,
                speedMax: 28,
                sizeMin: 4.5,
                sizeMax: 10.0,
                lifeMin: 0.5,
                lifeMax: 1.2,
            });
            // Glowing incandescent core inside the smoke plume
            emit(f.x, f.y, 1, 'flame', '255,180,60', {
                speedMin: 4,
                speedMax: 16,
                sizeMin: 3.0,
                sizeMax: 6.0,
                lifeMin: 0.2,
                lifeMax: 0.45,
            });
            f.smokeTimer = CONFIG.flareSmokeRate;
        }
    }
    state.flares = state.flares.filter(f => f.alive);
}

/**
 * Launch a realistic physical multi-flare burst salvo (8 to 12 flares).
 * Flares fan out backward and outward in a wide arc from the aircraft tail.
 * Usable by both player and enemy AI jets.
 * 
 * @param {object} entity - player or enemy jet
 * @param {object} state - global game state
 * @param {boolean} isEnemy
 */
export function deployFlareSalvo(entity, state, isEnemy = false) {
    if (entity.flares <= 0) return;
    entity.flares--;
    entity.flareCooldown = isEnemy ? 1.8 : CONFIG.flareCooldown;

    const count = CONFIG.flareBurstCount || 10;
    const baseBackAngle = entity.heading + Math.PI;
    const maxSpread = CONFIG.flareSpreadAngle || 1.25; // ~72 deg spread each side

    for (let i = 0; i < count; i++) {
        // Symmetrical fan distribution from port to starboard with organic spread jitter
        const t = count > 1 ? (i / (count - 1)) * 2 - 1 : 0; // -1 to +1
        const spreadJitter = randRange(-0.06, 0.06);
        const flareAngle = baseBackAngle + (t * maxSpread) + spreadJitter;

        const ejectSpeed = randRange(CONFIG.flareMinSpeed || 140, CONFIG.flareMaxSpeed || 240);

        // Aircraft momentum + wide lateral/rearward ejection velocity vector
        const forwardSpeed = entity.speed || CONFIG.playerBaseSpeed;
        const vx = Math.cos(entity.heading) * (forwardSpeed * 0.35) + Math.cos(flareAngle) * ejectSpeed;
        const vy = Math.sin(entity.heading) * (forwardSpeed * 0.35) + Math.sin(flareAngle) * ejectSpeed;

        state.flares.push({
            id: Math.random(),
            x: entity.x - Math.cos(entity.heading) * (entity.radius * 0.8),
            y: entity.y - Math.sin(entity.heading) * (entity.radius * 0.8),
            vx,
            vy,
            life: CONFIG.flareBurnDuration * randRange(0.85, 1.15),
            maxLife: CONFIG.flareBurnDuration,
            age: 0,
            alive: true,
            sparkTimer: randRange(0, 0.02),
            smokeTimer: randRange(0, 0.01),
            heatSignature: randRange(0.85, 1.45), // varying heat attraction profiles
        });
    }

    // Magnesium salvo ignition flash & burst sparks
    emit(entity.x, entity.y, 25, 'spark', '255,255,210', {
        speedMin: 50,
        speedMax: 180,
        sizeMin: 2.5,
        sizeMax: 5.5,
        lifeMin: 0.1,
        lifeMax: 0.28,
    });
    emit(entity.x, entity.y, 8, 'explosion', '255,200,100', {
        speedMin: 25,
        speedMax: 80,
        sizeMin: 4,
        sizeMax: 9,
        lifeMin: 0.15,
        lifeMax: 0.35,
    });
}

/**
 * Draw active flares with high-fidelity glow.
 * 
 * @param {object} state
 * @param {CanvasRenderingContext2D} ctx
 * @param {function} worldToScreenFn
 * @param {number} canvasW
 * @param {number} canvasH
 */
export function drawCountermeasures(state, ctx, worldToScreenFn, canvasW, canvasH) {
    // ── 1. Draw Active Flares ───────────────────────────
    for (const f of state.flares) {
        if (!f.alive) continue;

        const sp = worldToScreenFn(f.x, f.y, canvasW, canvasH);
        if (sp.x < -50 || sp.x > canvasW + 50 || sp.y < -50 || sp.y > canvasH + 50) continue;

        const burnRatio = Math.max(0, f.life / f.maxLife);
        const flicker = 0.85 + Math.sin(f.age * 35) * 0.15;
        const outerGlow = 28 * burnRatio * flicker;
        const coreSize = 5 * burnRatio * flicker;

        ctx.save();

        // Atmospheric heat illumination glow
        const glowGrad = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, outerGlow);
        glowGrad.addColorStop(0, `rgba(255, 220, 100, ${0.45 * burnRatio})`);
        glowGrad.addColorStop(0.4, `rgba(255, 120, 20, ${0.22 * burnRatio})`);
        glowGrad.addColorStop(1, 'rgba(255, 60, 0, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, outerGlow, 0, Math.PI * 2);
        ctx.fill();

        // Vivid yellow-orange flame core
        ctx.fillStyle = '#ff9900';
        ctx.shadowColor = '#ff6600';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, coreSize * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Incandescent white-hot magnesium center
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, Math.max(1.5, coreSize * 0.7), 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
