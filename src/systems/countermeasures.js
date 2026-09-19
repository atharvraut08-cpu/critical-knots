/**
 * countermeasures.js — Flare + EMP logic
 * 
 * Flare: drops a decoy at player position, confuses nearby homing
 * missiles within radius — they pursue the flare instead of the player.
 * Uses the same homing function with a different target (deliberate
 * design choice: one function, two behaviors, driven by target selection).
 * 
 * EMP: destroys all missiles within radius instantly.
 * Both have limited charges with regeneration timers.
 */

import { CONFIG } from '../config.js';
import { distance } from '../utils/vector.js';
import { consumeAction } from '../input.js';
import { emit } from '../entities/particle.js';
import { applyShake } from '../camera.js';

/**
 * Update countermeasure systems (flare + EMP).
 * Handles input, charge management, cooldowns, and regen.
 * 
 * @param {object} state - game state
 * @param {number} dt
 * @param {object} input - keyboard state
 */
export function updateCountermeasures(state, dt, input) {
    const player = state.player;
    if (!player || !player.alive) return;

    // ── Flare regeneration ──────────────────────────────
    if (player.flares < player.maxFlares) {
        state.flareRegenTimer += dt;
        if (state.flareRegenTimer >= CONFIG.flareRegenTime) {
            player.flares = Math.min(player.flares + 1, player.maxFlares);
            state.flareRegenTimer = 0;
        }
    }

    // ── EMP regeneration ────────────────────────────────
    if (player.emp < player.maxEmp) {
        state.empRegenTimer += dt;
        if (state.empRegenTimer >= CONFIG.empRegenTime) {
            player.emp = Math.min(player.emp + 1, player.maxEmp);
            state.empRegenTimer = 0;
        }
    }

    // ── Flare activation ────────────────────────────────
    if (consumeAction('flare') && player.flares > 0 && player.flareCooldown <= 0) {
        activateFlare(state, player);
    }

    // ── EMP activation ──────────────────────────────────
    if (consumeAction('emp') && player.emp > 0 && player.empCooldown <= 0) {
        activateEMP(state, player);
    }

    // ── Update active flares (decay) ────────────────────
    for (let i = state.flares.length - 1; i >= 0; i--) {
        state.flares[i].life -= dt;
        if (state.flares[i].life <= 0) {
            state.flares[i].alive = false;
        }
    }
    state.flares = state.flares.filter(f => f.alive);
}

/**
 * Deploy a flare at the player's current position.
 * Confuses all homing missiles within CONFIG.flareConfuseRadius.
 */
function activateFlare(state, player) {
    player.flares--;
    player.flareCooldown = CONFIG.flareCooldown;

    const flareEntity = {
        x: player.x,
        y: player.y,
        life: CONFIG.flareConfuseDuration,
        alive: true,
    };
    state.flares.push(flareEntity);

    // Confuse nearby homing missiles: redirect their pursuit target
    const now = state.timeAlive;
    for (const m of state.missiles) {
        if (!m.alive || m.type !== 'homing') continue;
        if (distance(m, player) < CONFIG.flareConfuseRadius) {
            m.confusedUntil = now + CONFIG.flareConfuseDuration;
            m.confuseTarget = { x: flareEntity.x, y: flareEntity.y };
        }
    }

    // Visual feedback: bright flare burst
    emit(player.x, player.y, 15, 'spark', '255,255,100', {
        speedMin: 30,
        speedMax: 100,
        sizeMin: 2,
        sizeMax: 5,
    });
}

/**
 * Trigger EMP burst at the player's position.
 * Destroys all missiles within CONFIG.empKillRadius.
 */
function activateEMP(state, player) {
    player.emp--;
    player.empCooldown = CONFIG.empCooldown;

    let destroyed = 0;
    for (const m of state.missiles) {
        if (!m.alive) continue;
        if (distance(m, player) < CONFIG.empKillRadius) {
            m.alive = false;
            destroyed++;
            emit(m.x, m.y, 10, 'explosion', '100,150,255');
        }
    }
    state.stats.missilesDestroyed += destroyed;

    // EMP shockwave visual + shake
    emit(player.x, player.y, 20, 'spark', '120,160,255', {
        speedMin: 80,
        speedMax: 200,
        sizeMin: 2,
        sizeMax: 4,
    });
    applyShake(CONFIG.shakeMaxMagnitude * 0.4);
}

/**
 * Draw active flare decoys and EMP shockwave rings.
 * @param {object} state
 * @param {CanvasRenderingContext2D} ctx
 * @param {function} worldToScreenFn
 * @param {number} canvasW
 * @param {number} canvasH
 */
export function drawCountermeasures(state, ctx, worldToScreenFn, canvasW, canvasH) {
    // Draw flare decoys as bright glowing points
    for (const flare of state.flares) {
        if (!flare.alive) continue;

        const sp = worldToScreenFn(flare.x, flare.y, canvasW, canvasH);
        const alpha = Math.min(flare.life / CONFIG.flareConfuseDuration, 1);
        const radius = 6 + (1 - alpha) * 10;

        // Outer glow
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, radius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,100,${alpha * 0.15})`;
        ctx.fill();

        // Inner flare
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,150,${alpha * 0.8})`;
        ctx.fill();
    }
}
