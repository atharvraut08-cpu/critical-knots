/**
 * countermeasures.js — Believable Physical Flares & Expanding EMP Shockwaves
 * 
 * CG Concepts:
 * - Kinematic motion & aerodynamic drag for physical flare trajectories
 * - Radial expanding wavefront propagation for EMP shockwave
 * - Atmospheric illumination & emission blending
 */

import { CONFIG } from '../config.js';
import { distance, lerp } from '../utils/vector.js';
import { randRange } from '../utils/math.js';
import { consumeAction } from '../input.js';
import { emit } from '../entities/particle.js';
import { applyShake } from '../camera.js';

/**
 * Update countermeasure systems (flares + EMP waves).
 * 
 * @param {object} state
 * @param {number} dt
 * @param {object} input
 */
export function updateCountermeasures(state, dt, input) {
    const player = state.player;
    if (!player || !player.alive) return;

    // ── Charge Regeneration ─────────────────────────────
    if (player.flares < player.maxFlares) {
        state.flareRegenTimer += dt;
        if (state.flareRegenTimer >= CONFIG.flareRegenTime) {
            player.flares = Math.min(player.flares + 1, player.maxFlares);
            state.flareRegenTimer = 0;
        }
    }

    if (player.emp < player.maxEmp) {
        state.empRegenTimer += dt;
        if (state.empRegenTimer >= CONFIG.empRegenTime) {
            player.emp = Math.min(player.emp + 1, player.maxEmp);
            state.empRegenTimer = 0;
        }
    }

    // ── Input Triggers ──────────────────────────────────
    if (consumeAction('flare') && player.flares > 0 && player.flareCooldown <= 0) {
        activateFlares(state, player);
    }

    if (consumeAction('emp') && player.emp > 0 && player.empCooldown <= 0) {
        activateEMP(state, player);
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

    // ── Update Active Expanding EMP Shockwaves ───────────
    for (let i = state.empWaves.length - 1; i >= 0; i--) {
        const w = state.empWaves[i];
        w.radius += w.speed * dt;

        // Check wavefront collision with missiles
        for (let j = 0; j < state.missiles.length; j++) {
            const m = state.missiles[j];
            if (!m.alive) continue;

            const dist = distance(w, m);
            // If wavefront has reached this missile
            if (dist <= w.radius && !m._hitByEmpWave) {
                m._hitByEmpWave = true;

                // Distance-based disruption duration (longer closer to epicenter)
                const distRatio = Math.min(dist / w.maxRadius, 1);
                const duration = lerp(CONFIG.empDisruptDurationMax, CONFIG.empDisruptDurationMin, distRatio);

                m.disabledTimer = Math.max(m.disabledTimer, duration);
                m.confuseTarget = null; // drop lock

                // Electrical discharge spark burst from missile
                emit(m.x, m.y, 14, 'spark', '80,200,255', {
                    speedMin: 50,
                    speedMax: 140,
                    sizeMin: 2,
                    sizeMax: 4,
                });
            }
        }

        if (w.radius >= w.maxRadius) {
            w.alive = false;
        }
    }
    state.empWaves = state.empWaves.filter(w => w.alive);

    // ── HUD Glitch Timer ────────────────────────────────
    if (state.hudGlitchTimer > 0) {
        state.hudGlitchTimer -= dt;
    }
}

/**
 * Launch a realistic physical multi-flare burst salvo (8 to 12 flares).
 * Flares fan out backward and outward in a wide arc from the aircraft tail.
 */
function activateFlares(state, player) {
    player.flares--;
    player.flareCooldown = CONFIG.flareCooldown;

    const count = CONFIG.flareBurstCount || 10;
    const baseBackAngle = player.heading + Math.PI;
    const maxSpread = CONFIG.flareSpreadAngle || 1.25; // ~72 deg spread each side

    for (let i = 0; i < count; i++) {
        // Symmetrical fan distribution from port to starboard with organic spread jitter
        const t = count > 1 ? (i / (count - 1)) * 2 - 1 : 0; // -1 to +1
        const spreadJitter = randRange(-0.06, 0.06);
        const flareAngle = baseBackAngle + (t * maxSpread) + spreadJitter;

        const ejectSpeed = randRange(CONFIG.flareMinSpeed || 140, CONFIG.flareMaxSpeed || 240);

        // Aircraft momentum + wide lateral/rearward ejection velocity vector
        const vx = Math.cos(player.heading) * (player.speed * 0.35) + Math.cos(flareAngle) * ejectSpeed;
        const vy = Math.sin(player.heading) * (player.speed * 0.35) + Math.sin(flareAngle) * ejectSpeed;

        state.flares.push({
            id: Math.random(),
            x: player.x - Math.cos(player.heading) * (player.radius * 0.8),
            y: player.y - Math.sin(player.heading) * (player.radius * 0.8),
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
    emit(player.x, player.y, 25, 'spark', '255,255,210', {
        speedMin: 50,
        speedMax: 180,
        sizeMin: 2.5,
        sizeMax: 5.5,
        lifeMin: 0.1,
        lifeMax: 0.28,
    });
    emit(player.x, player.y, 8, 'explosion', '255,200,100', {
        speedMin: 25,
        speedMax: 80,
        sizeMin: 4,
        sizeMax: 9,
        lifeMin: 0.15,
        lifeMax: 0.35,
    });
}

/**
 * Trigger high-speed expanding electromagnetic pulse wave.
 */
function activateEMP(state, player) {
    player.emp--;
    player.empCooldown = CONFIG.empCooldown;

    // Register active expanding shockwave
    state.empWaves.push({
        x: player.x,
        y: player.y,
        radius: 15,
        maxRadius: CONFIG.empRadius,
        speed: CONFIG.empExpansionSpeed,
        alive: true,
    });

    // Reset hit flag on current missiles so new wave can hit them
    for (const m of state.missiles) {
        m._hitByEmpWave = false;
    }

    // Trigger cockpit HUD electrical interference static
    state.hudGlitchTimer = CONFIG.empHudGlitchDuration;

    // Electromagnetic discharge flash & screen shake
    emit(player.x, player.y, 35, 'spark', '100,210,255', {
        speedMin: 80,
        speedMax: 240,
        sizeMin: 2,
        sizeMax: 5,
        lifeMin: 0.2,
        lifeMax: 0.5,
    });
    applyShake(CONFIG.shakeMaxMagnitude * 0.65);
}

/**
 * Draw active flares and EMP shockwaves with high-fidelity glow and electric arcs.
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

    // ── 2. Draw Expanding EMP Shockwaves ────────────────
    for (const w of state.empWaves) {
        if (!w.alive) continue;

        const sp = worldToScreenFn(w.x, w.y, canvasW, canvasH);
        const progress = w.radius / w.maxRadius; // 0 to 1
        const alpha = (1 - progress) * 0.85;

        ctx.save();

        // Primary electric cyan shockwave ring
        ctx.strokeStyle = `rgba(100, 220, 255, ${alpha})`;
        ctx.lineWidth = Math.max(1.5, 4.5 * (1 - progress));
        ctx.shadowColor = '#40d0ff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, w.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Secondary inner distortion ring
        ctx.strokeStyle = `rgba(220, 245, 255, ${alpha * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, Math.max(2, w.radius - 8), 0, Math.PI * 2);
        ctx.stroke();

        // Procedural electric lightning crackles along wave rim
        const arcCount = 10;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < arcCount; i++) {
            const a1 = (i / arcCount) * Math.PI * 2 + Math.sin(w.radius * 0.05 + i) * 0.1;
            const a2 = a1 + 0.18;
            const rOffset = (Math.random() - 0.5) * 8;
            const px1 = sp.x + Math.cos(a1) * (w.radius + rOffset);
            const py1 = sp.y + Math.sin(a1) * (w.radius + rOffset);
            const px2 = sp.x + Math.cos(a2) * (w.radius - rOffset);
            const py2 = sp.y + Math.sin(a2) * (w.radius - rOffset);
            ctx.moveTo(px1, py1);
            ctx.lineTo(px2, py2);
        }
        ctx.stroke();

        ctx.restore();
    }
}
