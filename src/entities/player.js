/**
 * player.js — High-fidelity military fighter aircraft entity
 * 
 * CG Concepts:
 * - Kinematic motion: angular turn rate & linear velocity integration
 * - Affine transformations: transform stack, translate + rotate local coordinates
 * - Drop-shadow projection: elevation simulation via offset matrix
 * 
 * Features:
 * - Swept delta-wing fighter silhouette with twin canted stabilizers
 * - Tinted cockpit canopy with glass reflection gradient
 * - Wingtip navigation lights (red on port, green on starboard)
 * - Twin afterburner exhaust with supersonic shock diamonds during boost
 * - Altitude drop shadow
 */

import { CONFIG } from '../config.js';
import { clamp } from '../utils/math.js';

/**
 * Create a new player entity at world origin.
 * @returns {object} player state
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
 * @param {number} dt
 * @param {object} input - keyboard state
 */
export function updatePlayer(player, dt, input) {
    if (!player.alive) return;

    // ── Steering (angular velocity) ─────────────────────
    if (input.left) player.heading -= CONFIG.playerTurnRate * dt;
    if (input.right) player.heading += CONFIG.playerTurnRate * dt;

    // ── Boost ───────────────────────────────────────────
    player.boosting = input.boost && player.fuel > CONFIG.fuelFloorForBoost;
    player.speed = player.boosting
        ? CONFIG.playerBaseSpeed * CONFIG.boostMultiplier
        : CONFIG.playerBaseSpeed;

    // ── Kinematic Position Integration ──────────────────
    player.x += Math.cos(player.heading) * player.speed * dt;
    player.y += Math.sin(player.heading) * player.speed * dt;

    // ── Fuel Consumption ────────────────────────────────
    const drainMultiplier = player.boosting ? CONFIG.boostFuelDrainMultiplier : 1;
    player.fuel -= CONFIG.fuelDrainRate * drainMultiplier * dt;
    player.fuel = clamp(player.fuel, 0, CONFIG.maxFuel);

    if (player.fuel <= 0) {
        player.alive = false;
    }

    // ── Cooldown Timers ─────────────────────────────────
    if (player.flareCooldown > 0) player.flareCooldown -= dt;
    if (player.empCooldown > 0) player.empCooldown -= dt;

    player.trailTimer -= dt;
}

/**
 * Draw the fighter aircraft using affine transformations, panel detailing, and shadows.
 * 
 * @param {object} player
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} screenPos
 */
export function drawPlayer(player, ctx, screenPos) {
    if (!player.alive) return;

    ctx.save();

    const s = player.radius;
    const shadowOffset = CONFIG.altitudeShadowOffset;

    // ── 1. Aircraft Altitude Drop Shadow ────────────────
    ctx.save();
    ctx.translate(screenPos.x + shadowOffset, screenPos.y + shadowOffset);
    ctx.rotate(player.heading + Math.PI / 2);
    ctx.fillStyle = 'rgba(8, 12, 22, 0.35)';
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.6);
    ctx.lineTo(-s * 1.25, s * 0.9);
    ctx.lineTo(-s * 0.4, s * 0.7);
    ctx.lineTo(-s * 0.45, s * 1.1);
    ctx.lineTo(s * 0.45, s * 1.1);
    ctx.lineTo(s * 0.4, s * 0.7);
    ctx.lineTo(s * 1.25, s * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ── 2. Fighter Airframe Transform ───────────────────
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(player.heading + Math.PI / 2);

    // ── 3. Twin Afterburner Plumes (drawn beneath fuselage)
    const exhaustLen = player.boosting ? s * (1.6 + Math.random() * 0.5) : s * 0.7;
    const nozzleOffsets = [-s * 0.28, s * 0.28];

    for (const nx of nozzleOffsets) {
        // Outer flame envelope
        ctx.beginPath();
        ctx.moveTo(nx - s * 0.14, s * 0.85);
        ctx.lineTo(nx, s * 0.85 + exhaustLen);
        ctx.lineTo(nx + s * 0.14, s * 0.85);
        ctx.fillStyle = player.boosting ? '#ff7700' : 'rgba(96, 213, 255, 0.6)';
        ctx.fill();

        // Inner shock-diamond core
        ctx.beginPath();
        ctx.moveTo(nx - s * 0.08, s * 0.85);
        ctx.lineTo(nx, s * 0.85 + exhaustLen * 0.6);
        ctx.lineTo(nx + s * 0.08, s * 0.85);
        ctx.fillStyle = player.boosting ? '#ffffff' : '#b0e5ff';
        ctx.fill();
    }

    // ── 4. Main Fuselage & Delta Wings ──────────────────
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.75);              // Needle Radome / Nose
    ctx.lineTo(-s * 0.28, -s * 0.7);      // LERX (Leading Edge Extension)
    ctx.lineTo(-s * 1.35, s * 0.65);      // Port wingtip
    ctx.lineTo(-s * 1.25, s * 0.85);      // Port trailing edge
    ctx.lineTo(-s * 0.55, s * 0.75);      // Engine nacelle port
    ctx.lineTo(-s * 0.5, s * 0.98);       // Port nozzle
    ctx.lineTo(0, s * 0.75);              // Beaver tail center
    ctx.lineTo(s * 0.5, s * 0.98);        // Starboard nozzle
    ctx.lineTo(s * 0.55, s * 0.75);       // Engine nacelle starboard
    ctx.lineTo(s * 1.25, s * 0.85);       // Starboard trailing edge
    ctx.lineTo(s * 1.35, s * 0.65);       // Starboard wingtip
    ctx.lineTo(s * 0.28, -s * 0.7);       // Starboard LERX
    ctx.closePath();

    // High-tech military air-superiority gradient
    const airframeGrad = ctx.createLinearGradient(0, -s * 1.75, 0, s * 1.0);
    airframeGrad.addColorStop(0, '#5890b8');
    airframeGrad.addColorStop(0.4, '#31587a');
    airframeGrad.addColorStop(1, '#1b354e');
    ctx.fillStyle = airframeGrad;
    ctx.fill();

    // Panel outlines
    ctx.strokeStyle = 'rgba(160, 210, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── 5. Twin Canted Vertical Stabilizers (Tail Fins) ──
    ctx.fillStyle = '#213f5c';
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, s * 0.1);
    ctx.lineTo(-s * 0.55, s * 0.85);
    ctx.lineTo(-s * 0.32, s * 0.75);
    ctx.moveTo(s * 0.35, s * 0.1);
    ctx.lineTo(s * 0.55, s * 0.85);
    ctx.lineTo(s * 0.32, s * 0.75);
    ctx.fill();

    // ── 6. Cockpit Canopy Glass ─────────────────────────
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.55, s * 0.2, s * 0.55, 0, 0, Math.PI * 2);

    const canopyGrad = ctx.createLinearGradient(0, -s * 1.1, 0, 0);
    canopyGrad.addColorStop(0, '#d8f2ff');
    canopyGrad.addColorStop(0.5, '#40a0dc');
    canopyGrad.addColorStop(1, '#123854');
    ctx.fillStyle = canopyGrad;
    ctx.fill();

    // Canopy glass specular glint
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.95);
    ctx.lineTo(0, -s * 0.35);
    ctx.stroke();

    // ── 7. Wingtip Formation Navigation Strobes ─────────
    const navBlink = Math.sin(Date.now() / 180) > 0;
    if (navBlink) {
        // Port wingtip: Aviation Red
        ctx.fillStyle = '#ff2233';
        ctx.shadowColor = '#ff2233';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(-s * 1.32, s * 0.68, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Starboard wingtip: Aviation Green
        ctx.fillStyle = '#00ff66';
        ctx.shadowColor = '#00ff66';
        ctx.beginPath();
        ctx.arc(s * 1.32, s * 0.68, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    ctx.restore();
}
