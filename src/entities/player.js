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
import state from '../state.js';
import { emit } from './particle.js';

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
        flareCooldown: 0,
        radius: CONFIG.playerRadius,
        alive: true,
        boosting: false,
        trailTimer: 0,

        // ── Guns & Ammo System (Single Hard-Capped Pool of 500 rounds) ──
        ammo: CONFIG.maxAmmo || 500,
        maxAmmo: CONFIG.maxAmmo || 500,
        fireTimer: 0,                        // rate of fire limiter

        // ── Flight Aerodynamics State ───────────────────
        isTurning: false,
    };
}

/**
 * Update player state each frame.
 * CG Concept: Kinematic motion with induced aerodynamic drag & momentum deceleration
 * 
 * @param {object} player
 * @param {number} dt
 * @param {object} input - keyboard state
 */
export function updatePlayer(player, dt, input) {
    if (!player.alive) return;

    // ── Steering & Banking (angular velocity) ───────────
    player.isTurning = !!(input.left || input.right);
    if (input.left) player.heading -= CONFIG.playerTurnRate * dt;
    if (input.right) player.heading += CONFIG.playerTurnRate * dt;

    // ── Boost ───────────────────────────────────────────
    player.boosting = !!input.boost;

    // Target top speed based on engine throttle/boost
    const cruiseSpeed = CONFIG.playerBaseSpeed;
    const maxBoostSpeed = cruiseSpeed * CONFIG.boostMultiplier;
    const targetTopSpeed = player.boosting ? maxBoostSpeed : cruiseSpeed;

    // ── Physics-Based Speed, Induced Drag & Gradual Deceleration ──
    // CG Concept: Aerodynamic induced drag & forward kinetic momentum.
    // Releasing boost smoothly bleeds off speed via deceleration (momentum/drag),
    // ensuring the HUD airspeed needle sweeps down naturally.
    if (player.isTurning) {
        const turnFloor = targetTopSpeed * CONFIG.minTurnSpeedFactor;
        if (player.speed > turnFloor) {
            player.speed = Math.max(turnFloor, player.speed - CONFIG.turnDragDecel * dt);
        }
    } else {
        if (player.speed < targetTopSpeed) {
            // Forward thrust acceleration towards target speed
            const accel = player.boosting ? CONFIG.planeBoostAccelRate : CONFIG.planeAccelRate;
            player.speed = Math.min(targetTopSpeed, player.speed + accel * dt);
        } else if (player.speed > targetTopSpeed) {
            // Gradual aerodynamic deceleration (momentum/drag) upon releasing boost
            const decel = CONFIG.boostDecelRate || 135;
            player.speed = Math.max(targetTopSpeed, player.speed - decel * dt);
        }
    }

    // ── Kinematic Position Integration ──────────────────
    player.x += Math.cos(player.heading) * player.speed * dt;
    player.y += Math.sin(player.heading) * player.speed * dt;

    if (player.fireTimer > 0) {
        player.fireTimer -= dt;
    }

    // ── Machine Gun Firing ('C' key) ────────────────────
    if (input.fire && player.fireTimer <= 0 && player.ammo > 0) {
        player.ammo--;
        player.fireTimer = CONFIG.gunFireRate;

        // Spawn bullet directly at needle radome nose
        const noseDist = player.radius * 2.1;
        const noseX = player.x + Math.cos(player.heading) * noseDist;
        const noseY = player.y + Math.sin(player.heading) * noseDist;

        // Muzzle velocity combined with current dynamic aircraft forward speed
        const totalBulletSpeed = player.speed + CONFIG.bulletSpeed;
        const bvx = Math.cos(player.heading) * totalBulletSpeed;
        const bvy = Math.sin(player.heading) * totalBulletSpeed;

        state.bullets.push({
            x: noseX,
            y: noseY,
            vx: bvx,
            vy: bvy,
            heading: player.heading,
            radius: CONFIG.bulletRadius,
            life: CONFIG.bulletLife,
            maxLife: CONFIG.bulletLife,
            alive: true,
        });

        // Muzzle flash spark emission
        emit(noseX, noseY, 2, 'spark', '255,220,100', {
            speedMin: 35,
            speedMax: 90,
            sizeMin: 1.5,
            sizeMax: 3.2,
            lifeMin: 0.05,
            lifeMax: 0.12,
        });
    }

    // ── Fuel (Fuel does not deplete) ───────────────────
    player.fuel = CONFIG.maxFuel;

    // ── Cooldown Timers ─────────────────────────────────
    if (player.flareCooldown > 0) player.flareCooldown -= dt;

    player.trailTimer -= dt;
}

/**
 * Draw the sleek aerodynamic fighter aircraft using bezier curves, panel detailing,
 * canopy glass reflections, and neon afterburner glow.
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

    // Helper: Build the sleek fighter airframe path using Bezier curves & supersonic contours
    const buildAirframePath = (context) => {
        context.beginPath();
        // Needle Radome / Nose
        context.moveTo(0, -s * 2.2);

        // Port radome contour into LERX
        context.bezierCurveTo(-s * 0.1, -s * 1.8, -s * 0.22, -s * 1.35, -s * 0.32, -s * 0.95);
        context.bezierCurveTo(-s * 0.4, -s * 0.7, -s * 0.55, -s * 0.45, -s * 0.62, -s * 0.25);

        // Port engine intake shoulder
        context.lineTo(-s * 0.68, -s * 0.1);

        // Port swept wing leading edge to wingtip
        context.lineTo(-s * 1.65, s * 0.55);

        // Wingtip missile launch rail
        context.lineTo(-s * 1.65, s * 0.72);

        // Wing trailing edge & aileron cutout
        context.lineTo(-s * 1.48, s * 0.8);
        context.lineTo(-s * 0.72, s * 0.72);

        // Port engine nacelle flank & nozzle
        context.lineTo(-s * 0.62, s * 1.15);
        context.lineTo(-s * 0.22, s * 1.15);

        // Twin-engine centerline stinger / beaver tail
        context.bezierCurveTo(-s * 0.14, s * 0.95, -s * 0.08, s * 0.82, 0, s * 0.92);
        context.bezierCurveTo(s * 0.08, s * 0.82, s * 0.14, s * 0.95, s * 0.22, s * 1.15);

        // Starboard nozzle & nacelle flank
        context.lineTo(s * 0.62, s * 1.15);
        context.lineTo(s * 0.72, s * 0.72);

        // Starboard wing trailing edge & wingtip rail
        context.lineTo(s * 1.48, s * 0.8);
        context.lineTo(s * 1.65, s * 0.72);
        context.lineTo(s * 1.65, s * 0.55);

        // Starboard engine intake shoulder
        context.lineTo(s * 0.68, -s * 0.1);

        // Starboard LERX into radome contour
        context.bezierCurveTo(s * 0.55, -s * 0.45, s * 0.4, -s * 0.7, s * 0.32, -s * 0.95);
        context.bezierCurveTo(s * 0.22, -s * 1.35, s * 0.1, -s * 1.8, 0, -s * 2.2);
        context.closePath();
    };

    // ── 1. Aircraft Altitude Drop Shadow ────────────────
    ctx.save();
    ctx.translate(screenPos.x + shadowOffset, screenPos.y + shadowOffset);
    ctx.rotate(player.heading + Math.PI / 2);
    ctx.fillStyle = 'rgba(8, 14, 26, 0.38)';
    buildAirframePath(ctx);
    ctx.fill();
    ctx.restore();

    // ── 2. Fighter Airframe Transform ───────────────────
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(player.heading + Math.PI / 2);

    // ── 3. Twin Afterburner Plumes with Neon Glow ───────
    const nozzleOffsets = [-s * 0.42, s * 0.42];
    const exhaustLen = player.boosting
        ? s * (2.1 + Math.random() * 0.5)
        : s * (0.8 + Math.random() * 0.2);

    for (const nx of nozzleOffsets) {
        ctx.save();

        if (player.boosting) {
            // High-energy supersonic afterburner glow (fiery neon orange)
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 24;

            // Outer flame cone
            const flameGrad = ctx.createLinearGradient(nx, s * 1.1, nx, s * 1.1 + exhaustLen);
            flameGrad.addColorStop(0, '#ffffff');
            flameGrad.addColorStop(0.2, '#ffdd33');
            flameGrad.addColorStop(0.6, '#ff6600');
            flameGrad.addColorStop(1, 'rgba(255, 30, 0, 0)');

            ctx.fillStyle = flameGrad;
            ctx.beginPath();
            ctx.moveTo(nx - s * 0.18, s * 1.15);
            ctx.lineTo(nx, s * 1.15 + exhaustLen);
            ctx.lineTo(nx + s * 0.18, s * 1.15);
            ctx.closePath();
            ctx.fill();

            // Mach shock diamonds along exhaust centerline
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#ffffff';
            const diamondDist = [0.3, 0.6];
            for (const d of diamondDist) {
                const dy = s * 1.15 + exhaustLen * d;
                const dw = s * 0.08;
                const dh = s * 0.14;
                ctx.beginPath();
                ctx.moveTo(nx, dy - dh);
                ctx.lineTo(nx + dw, dy);
                ctx.lineTo(nx, dy + dh);
                ctx.lineTo(nx - dw, dy);
                ctx.closePath();
                ctx.fill();
            }
        } else {
            // Cruise afterburner glow (electric cyan neon)
            ctx.shadowColor = '#00e5ff';
            ctx.shadowBlur = 14;

            const cruiseGrad = ctx.createLinearGradient(nx, s * 1.1, nx, s * 1.1 + exhaustLen);
            cruiseGrad.addColorStop(0, '#ffffff');
            cruiseGrad.addColorStop(0.4, '#40d0ff');
            cruiseGrad.addColorStop(1, 'rgba(0, 160, 255, 0)');

            ctx.fillStyle = cruiseGrad;
            ctx.beginPath();
            ctx.moveTo(nx - s * 0.14, s * 1.15);
            ctx.lineTo(nx, s * 1.15 + exhaustLen);
            ctx.lineTo(nx + s * 0.14, s * 1.15);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }

    // ── 4. Main Fuselage & Aerodynamic Wings ────────────
    buildAirframePath(ctx);

    // Multi-stop military stealth air-superiority gradient
    const airframeGrad = ctx.createLinearGradient(0, -s * 2.2, 0, s * 1.2);
    airframeGrad.addColorStop(0, '#7aaad0');
    airframeGrad.addColorStop(0.2, '#447094');
    airframeGrad.addColorStop(0.55, '#224364');
    airframeGrad.addColorStop(1, '#0e2035');
    ctx.fillStyle = airframeGrad;
    ctx.fill();

    // High-tech panel edge highlight
    ctx.strokeStyle = 'rgba(168, 218, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── 5. Intake & Wing Flap Panel Detailing ───────────
    ctx.strokeStyle = 'rgba(120, 185, 240, 0.35)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    // Port wing aileron hinge line
    ctx.moveTo(-s * 0.72, s * 0.45);
    ctx.lineTo(-s * 1.45, s * 0.65);
    // Starboard wing aileron hinge line
    ctx.moveTo(s * 0.72, s * 0.45);
    ctx.lineTo(s * 1.45, s * 0.65);
    // Center spine ridge
    ctx.moveTo(0, -s * 0.1);
    ctx.lineTo(0, s * 0.85);
    ctx.stroke();

    // Air Intake Cowlings
    ctx.fillStyle = '#15293d';
    ctx.beginPath();
    ctx.moveTo(-s * 0.58, -s * 0.1);
    ctx.lineTo(-s * 0.38, -s * 0.1);
    ctx.lineTo(-s * 0.35, s * 0.4);
    ctx.lineTo(-s * 0.55, s * 0.4);
    ctx.closePath();
    ctx.moveTo(s * 0.58, -s * 0.1);
    ctx.lineTo(s * 0.38, -s * 0.1);
    ctx.lineTo(s * 0.35, s * 0.4);
    ctx.lineTo(s * 0.55, s * 0.4);
    ctx.closePath();
    ctx.fill();

    // ── 6. Twin Canted Vertical Stabilizers (Tail Fins) ──
    ctx.fillStyle = '#1a334e';
    ctx.beginPath();
    // Port fin
    ctx.moveTo(-s * 0.36, -s * 0.05);
    ctx.lineTo(-s * 0.75, s * 0.98);
    ctx.lineTo(-s * 0.42, s * 0.85);
    ctx.closePath();
    // Starboard fin
    ctx.moveTo(s * 0.36, -s * 0.05);
    ctx.lineTo(s * 0.75, s * 0.98);
    ctx.lineTo(s * 0.42, s * 0.85);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(150, 205, 255, 0.45)';
    ctx.stroke();

    // ── 7. Cockpit Canopy Bubble Glass ───────────────────
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.45);
    ctx.bezierCurveTo(-s * 0.22, -s * 1.15, -s * 0.26, -s * 0.65, -s * 0.18, -s * 0.15);
    ctx.bezierCurveTo(-s * 0.10, s * 0.05, 0, s * 0.05, 0, s * 0.05);
    ctx.bezierCurveTo(0, s * 0.05, s * 0.10, s * 0.05, s * 0.18, -s * 0.15);
    ctx.bezierCurveTo(s * 0.26, -s * 0.65, s * 0.22, -s * 1.15, 0, -s * 1.45);
    ctx.closePath();

    const canopyGrad = ctx.createLinearGradient(0, -s * 1.45, 0, s * 0.05);
    canopyGrad.addColorStop(0, '#eaf8ff');
    canopyGrad.addColorStop(0.35, '#38bdf8');
    canopyGrad.addColorStop(0.7, '#0284c7');
    canopyGrad.addColorStop(1, '#072b45');
    ctx.fillStyle = canopyGrad;
    ctx.fill();

    // Canopy Specular Glint Highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 1.25);
    ctx.bezierCurveTo(-s * 0.14, -s * 0.9, -s * 0.12, -s * 0.5, -s * 0.08, -s * 0.2);
    ctx.stroke();

    // ── 8. Wingtip Formation Navigation Strobes ─────────
    const navBlink = Math.sin(Date.now() / 180) > 0;
    if (navBlink) {
        // Port wingtip: Aviation Red with subtle neon glow
        ctx.fillStyle = '#ff2233';
        ctx.shadowColor = '#ff2233';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(-s * 1.62, s * 0.65, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Starboard wingtip: Aviation Green with subtle neon glow
        ctx.fillStyle = '#00ff66';
        ctx.shadowColor = '#00ff66';
        ctx.beginPath();
        ctx.arc(s * 1.62, s * 0.65, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    ctx.restore();
}

/**
 * Draw machine gun tracer projectile with luminous neon glow.
 * 
 * @param {object} bullet
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} screenPos
 */
export function drawBullet(bullet, ctx, screenPos) {
    if (!bullet.alive) return;

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(bullet.heading);

    // Premium luminous tracer glow
    ctx.shadowColor = '#ffe066';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#fff8dd';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(2, 0);
    ctx.stroke();

    // Hot incandescent tracer warhead core
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(2, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}
