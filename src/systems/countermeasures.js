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

        // Emit hot sparks & smoke trail while burning
        f.sparkTimer -= dt;
        if (f.sparkTimer <= 0) {
            emit(f.x, f.y, 2, 'spark', '255,220,100', {
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
            emit(f.x, f.y, 1, 'smoke', '220,225,235', {
                speedMin: 5,
                speedMax: 25,
                sizeMin: 3.5,
                sizeMax: 7.0,
                lifeMin: 0.4,
                lifeMax: 0.8,
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
 * Launch a physical flare salvo (port and starboard).
 * Ejected rearward and laterally away from the aircraft, slowing under aerodynamic drag.
 */
function activateFlares(state, player) {
    player.flares--;
    player.flareCooldown = CONFIG.flareCooldown;

    // Eject two flares angled port and starboard
    const angles = [
        player.heading + Math.PI - 0.45,
        player.heading + Math.PI + 0.45,
    ];

    for (const angle of angles) {
        const ejectSpeed = CONFIG.flareEjectionSpeed;
        const vx = Math.cos(player.heading) * (player.speed * 0.4) + Math.cos(angle) * ejectSpeed;
        const vy = Math.sin(player.heading) * (player.speed * 0.4) + Math.sin(angle) * ejectSpeed;

        state.flares.push({
            x: player.x,
            y: player.y,
            vx,
            vy,
            life: CONFIG.flareBurnDuration,
            maxLife: CONFIG.flareBurnDuration,
            age: 0,
            alive: true,
            sparkTimer: 0,
            smokeTimer: 0,
        });
    }

    // Initial ignition flash & shock particles
    emit(player.x, player.y, 18, 'spark', '255,255,200', {
        speedMin: 40,
        speedMax: 120,
        sizeMin: 2,
        sizeMax: 5,
        lifeMin: 0.1,
        lifeMax: 0.25,
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
