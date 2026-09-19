/**
 * player.js — Player plane entity
 * 
 * CG Concepts demonstrated:
 * - Kinematic motion (velocity, acceleration, angular velocity)
 * - Affine transformations (translate, rotate for drawing)
 * - Vector math (heading-based movement via cos/sin)
 */

import { CONFIG } from '../config.js';
import { clamp } from '../utils/math.js';

/**
 * Create a new player entity at world origin.
 * @returns {object} player data (JSDoc contract from PRD Section 4.3)
 */
export function createPlayer() {
    return {
        x: 0,
        y: 0,
        heading: -Math.PI / 2,  // start facing up
        speed: CONFIG.playerBaseSpeed,
        baseSpeed: CONFIG.playerBaseSpeed,
        fuel: CONFIG.maxFuel,
        maxFuel: CONFIG.maxFuel,
        flares: CONFIG.maxFlares,
        maxFlares: CONFIG.maxFlares,
        emp: CONFIG.maxEmp,
        maxEmp: CONFIG.maxEmp,
        flareCooldown: 0,
        empCooldown: 0,
        radius: CONFIG.playerRadius,
        alive: true,
        boosting: false,
        trailTimer: 0,
    };
}

/**
 * Update player state each frame.
 * CG Concept: Kinematic motion — velocity and angular velocity scaled by dt
 * 
 * @param {object} player
 * @param {number} dt - delta time in seconds
 * @param {object} input - keyboard state
 */
export function updatePlayer(player, dt, input) {
    if (!player.alive) return;

    // ── Steering (angular velocity) ─────────────────────
    // Kinematic motion: angular velocity scaled by dt
    if (input.left) player.heading -= CONFIG.playerTurnRate * dt;
    if (input.right) player.heading += CONFIG.playerTurnRate * dt;

    // ── Boost ───────────────────────────────────────────
    // Boost disabled below fuel floor (Risk #2 mitigation)
    player.boosting = input.boost && player.fuel > CONFIG.fuelFloorForBoost;
    player.speed = player.boosting
        ? CONFIG.playerBaseSpeed * CONFIG.boostMultiplier
        : CONFIG.playerBaseSpeed;

    // ── Movement (kinematic motion) ─────────────────────
    // Kinematic motion: position += velocity * dt, where velocity = speed × heading direction
    player.x += Math.cos(player.heading) * player.speed * dt;
    player.y += Math.sin(player.heading) * player.speed * dt;

    // ── Fuel consumption ────────────────────────────────
    const drainMultiplier = player.boosting ? CONFIG.boostFuelDrainMultiplier : 1;
    player.fuel -= CONFIG.fuelDrainRate * drainMultiplier * dt;
    player.fuel = clamp(player.fuel, 0, CONFIG.maxFuel);

    // Fuel empty → game over (within one frame)
    if (player.fuel <= 0) {
        player.alive = false;
    }

    // ── Cooldown timers ─────────────────────────────────
    if (player.flareCooldown > 0) player.flareCooldown -= dt;
    if (player.empCooldown > 0) player.empCooldown -= dt;

    // ── Trail particle timer ────────────────────────────
    player.trailTimer -= dt;
}

/**
 * Draw the player plane using affine transformations.
 * CG Concept: Affine transformations — translate + rotate to place and orient
 * the entity, then draw at local origin. This is the transform stack:
 * ctx.save() → translate(screenPos) → rotate(heading) → draw → ctx.restore()
 * 
 * @param {object} player
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} screenPos - pre-computed screen coordinates
 */
export function drawPlayer(player, ctx, screenPos) {
    if (!player.alive) return;

    ctx.save();

    // Affine transform: translate to screen position, then rotate by heading
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(player.heading + Math.PI / 2); // +90° because triangle points up at heading=0

    // Draw plane as a sleek triangle with wing detail
    const s = player.radius;

    // Main body
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.5);           // nose
    ctx.lineTo(-s * 0.9, s * 0.8);     // left wing
    ctx.lineTo(-s * 0.3, s * 0.4);     // left indent
    ctx.lineTo(0, s * 0.6);            // tail
    ctx.lineTo(s * 0.3, s * 0.4);      // right indent
    ctx.lineTo(s * 0.9, s * 0.8);      // right wing
    ctx.closePath();

    // Gradient fill for premium look
    const grad = ctx.createLinearGradient(0, -s * 1.5, 0, s * 0.8);
    grad.addColorStop(0, '#60d5ff');
    grad.addColorStop(1, '#1a73e8');
    ctx.fillStyle = grad;
    ctx.fill();

    // Outline
    ctx.strokeStyle = '#ffffff44';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Cockpit dot
    ctx.beginPath();
    ctx.arc(0, -s * 0.4, s * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#b0e0ff';
    ctx.fill();

    // Boost flame effect
    if (player.boosting) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.25, s * 0.6);
        ctx.lineTo(0, s * 1.2 + Math.random() * s * 0.4);
        ctx.lineTo(s * 0.25, s * 0.6);
        ctx.fillStyle = `hsl(${30 + Math.random() * 20}, 100%, ${55 + Math.random() * 15}%)`;
        ctx.fill();
    }

    ctx.restore();
}
