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
import { clamp, angleDiff } from '../utils/math.js';
import state from '../state.js';
import { emit } from './particle.js';
import { createMissile } from './missile.js';
import { createBullet } from './bullet.js';
import { consumeAction } from '../input.js';

/**
 * Create a new player entity at world origin.
 * @returns {object} player state
 */
export function createPlayer() {
    const initHeading = -Math.PI / 2; // start facing up
    const initSpeed = CONFIG.playerBaseSpeed;

    return {
        x: 0,
        y: 0,
        heading: initHeading,   // where the nose points (radians)
        vx: Math.cos(initHeading) * initSpeed, // Newtonian velocity vector X
        vy: Math.sin(initHeading) * initSpeed, // Newtonian velocity vector Y
        speed: initSpeed,       // dynamic scalar velocity magnitude (px/s)
        baseSpeed: initSpeed,
        driftAngle: 0,          // radians: angle between nose heading and velocity vector
        gForce: 1.0,            // instantaneous G-force load
        fuel: CONFIG.maxFuel,
        maxFuel: CONFIG.maxFuel,
        flares: CONFIG.maxFlares,
        maxFlares: CONFIG.maxFlares,
        flareCooldown: 0,
        radius: CONFIG.playerRadius,
        alive: true,
        boosting: false,
        trailTimer: 0,

        // ── Lateral Strafe / Dash Roll State ────────────
        dashCooldown: 0,
        rollTimer: 0,
        rollDuration: 0.35,
        rollDirection: 0,       // -1 = left, 1 = right

        // ── Guns & Ammo System (Single Hard-Capped Pool of 500 rounds) ──
        ammo: CONFIG.maxAmmo || 500,
        maxAmmo: CONFIG.maxAmmo || 500,
        fireTimer: 0,                        // rate of fire limiter

        // ── Dogfight Hard-Lock Missile System ───────────
        missiles: CONFIG.playerDogfightMissiles || 6,
        maxMissiles: CONFIG.playerDogfightMissiles || 6,
        lockTimer: 0,
        lockDuration: CONFIG.dogfightLockTime || 0.5,
        lockedTarget: null,
        isLocking: false,

        // ── Flight Aerodynamics State ───────────────────
        isTurning: false,
    };
}

/**
 * Update player state each frame.
 * Implements realistic Newtonian flight mechanics:
 * 1. Decouples nose heading from velocity vector (vx, vy).
 * 2. Applies lateral aerodynamic restoring force (grip) pulling velocity vector toward nose, creating drift.
 * 3. Applies quadratic aerodynamic drag (Fd ∝ v²) so engine thrust reaches a physical terminal velocity.
 * 4. Executes lateral strafe/dash displacement rolls upon double-tap A or D.
 * 
 * @param {object} player
 * @param {number} dt
 * @param {object} input - keyboard state
 */
export function updatePlayer(player, dt, input) {
    if (!player.alive) return;

    // ── 1. Nose Heading Steering (Angular Rotation) ─────
    player.isTurning = !!(input.left || input.right);
    const turnRate = CONFIG.playerTurnRate || 3.1;
    let turnAngularSpeed = 0;
    if (input.left) {
        player.heading -= turnRate * dt;
        turnAngularSpeed -= turnRate;
    }
    if (input.right) {
        player.heading += turnRate * dt;
        turnAngularSpeed += turnRate;
    }

    // Forward and lateral unit vectors from nose heading
    const ufx = Math.cos(player.heading);
    const ufy = Math.sin(player.heading);
    const ulx = -Math.sin(player.heading); // lateral right unit vector
    const uly = Math.cos(player.heading);

    // ── 2. Engine Thrust Acceleration Along Nose Vector ─
    player.boosting = !!input.boost;
    const thrust = player.boosting
        ? (CONFIG.thrustBoost || 1152)
        : (CONFIG.thrustCruise || 450);

    player.vx += ufx * thrust * dt;
    player.vy += ufy * thrust * dt;

    // ── 3. Aerodynamic Lateral Grip & Drift Simulation ──
    // Decompose velocity into forward (vf) and lateral sideslip (vl) components
    const vl = player.vx * ulx + player.vy * uly;

    // Stabilizers and wings apply a restoring force pulling the velocity vector to heading
    const lateralGripRate = CONFIG.lateralGrip || 3.8; // s⁻¹
    const latRestoreAccel = -lateralGripRate * vl;
    player.vx += ulx * latRestoreAccel * dt;
    player.vy += uly * latRestoreAccel * dt;

    // ── 4. Quadratic Aerodynamic Drag (Fd ∝ v²) ─────────
    const currentSpeed = Math.hypot(player.vx, player.vy);
    const dragCoeff = CONFIG.dragCoeff || 0.0093;
    // F_drag = C_d * v * v
    const dragAccel = dragCoeff * currentSpeed * currentSpeed;

    if (currentSpeed > 0.01) {
        const dragDirX = player.vx / currentSpeed;
        const dragDirY = player.vy / currentSpeed;
        player.vx -= dragDirX * dragAccel * dt;
        player.vy -= dragDirY * dragAccel * dt;

        // Extra induced drag while hard banking
        if (player.isTurning) {
            const inducedDrag = (CONFIG.turnDragDecel || 130) * 0.45;
            player.vx -= dragDirX * inducedDrag * dt;
            player.vy -= dragDirY * inducedDrag * dt;
        }
    }

    // ── 5. Lateral Strafe / Dash Mechanic (Double-Tap A or D) ──
    if (player.dashCooldown > 0) {
        player.dashCooldown -= dt;
    }
    if (player.rollTimer > 0) {
        player.rollTimer -= dt;
    }

    const dashImpulse = CONFIG.dashImpulse || 320;
    const dashLeftRequested = consumeAction('dashLeft') || input.dashLeft;
    const dashRightRequested = consumeAction('dashRight') || input.dashRight;

    if (dashLeftRequested && player.dashCooldown <= 0) {
        // Sudden lateral burst to the port side (-ul)
        player.vx -= ulx * dashImpulse;
        player.vy -= uly * dashImpulse;
        player.dashCooldown = CONFIG.dashCooldown || 0.75;
        player.rollTimer = player.rollDuration;
        player.rollDirection = -1;

        // Lateral vapor condensation puff
        emit(player.x, player.y, 8, 'smoke', '200,230,255', {
            speedMin: 40,
            speedMax: 120,
            sizeMin: 2.5,
            sizeMax: 5.5,
            lifeMin: 0.15,
            lifeMax: 0.35,
        });
    } else if (dashRightRequested && player.dashCooldown <= 0) {
        // Sudden lateral burst to the starboard side (+ul)
        player.vx += ulx * dashImpulse;
        player.vy += uly * dashImpulse;
        player.dashCooldown = CONFIG.dashCooldown || 0.75;
        player.rollTimer = player.rollDuration;
        player.rollDirection = 1;

        // Lateral vapor condensation puff
        emit(player.x, player.y, 8, 'smoke', '200,230,255', {
            speedMin: 40,
            speedMax: 120,
            sizeMin: 2.5,
            sizeMax: 5.5,
            lifeMin: 0.15,
            lifeMax: 0.35,
        });
    }

    // ── 6. Kinematic Position Integration & Telemetry ───
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.speed = Math.hypot(player.vx, player.vy);

    // Calculate drift angle (sideslip beta between velocity vector and nose heading)
    const velocityHeading = Math.atan2(player.vy, player.vx);
    player.driftAngle = angleDiff(player.heading, velocityHeading);

    // G-Force estimation: dynamic lateral load
    const lateralG = Math.abs(vl * lateralGripRate) / 98.0;
    const turnG = Math.abs(turnAngularSpeed * player.speed) / 98.0;
    player.gForce = 1.0 + lateralG + turnG;

    if (player.fireTimer > 0) {
        player.fireTimer -= dt;
    }

    // ── Machine Gun Firing ('C' key) with Velocity Inheritance ──
    if (input.fire && player.fireTimer <= 0 && player.ammo > 0) {
        player.ammo--;
        player.fireTimer = CONFIG.gunFireRate;

        // Spawn bullet directly at needle radome nose
        const noseDist = player.radius * 2.1;
        const noseX = player.x + Math.cos(player.heading) * noseDist;
        const noseY = player.y + Math.sin(player.heading) * noseDist;

        // Inherit aircraft velocity vector + muzzle impulse
        state.bullets.push(createBullet(noseX, noseY, player.heading, player.vx, player.vy));

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

    // ── Hard-Lock Missile System ('X' key) ─────────────
    // To lock, target must remain inside 15-degree nose cone (Dot Product)
    // for exactly 0.5s while 'X' is held. Releases or cone breaks reset timer to 0.
    if (input.lock && player.missiles > 0 && state.enemies && state.enemies.length > 0) {
        player.isLocking = true;
        const cosThreshold = CONFIG.playerLockCosThreshold || Math.cos(15 * Math.PI / 180);

        let bestTarget = null;
        let bestDot = -1;

        // If already tracking a valid target, check if still in cone
        if (player.lockedTarget && player.lockedTarget.alive) {
            const dx = player.lockedTarget.x - player.x;
            const dy = player.lockedTarget.y - player.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 5 && dist < 2200) {
                const dot = ufx * (dx / dist) + ufy * (dy / dist);
                if (dot >= cosThreshold) {
                    bestTarget = player.lockedTarget;
                    bestDot = dot;
                }
            }
        }

        // If no existing target in cone, search among active enemy jets
        if (!bestTarget) {
            for (let i = 0; i < state.enemies.length; i++) {
                const enemy = state.enemies[i];
                if (!enemy.alive) continue;
                const dx = enemy.x - player.x;
                const dy = enemy.y - player.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 5 && dist < 2200) {
                    const dot = ufx * (dx / dist) + ufy * (dy / dist);
                    if (dot >= cosThreshold) {
                        if (dot > bestDot) {
                            bestDot = dot;
                            bestTarget = enemy;
                        }
                    }
                }
            }
        }

        if (bestTarget) {
            player.lockedTarget = bestTarget;
            player.lockTimer += dt;

            // When lock completes after 0.5s -> fire heat-seeking missile!
            if (player.lockTimer >= player.lockDuration) {
                player.missiles--;
                const noseDist = player.radius * 2.2;
                const spawnX = player.x + Math.cos(player.heading) * noseDist;
                const spawnY = player.y + Math.sin(player.heading) * noseDist;

                const m = createMissile(spawnX, spawnY, player.heading, 'basic', 'player', bestTarget);
                // Inherit aircraft velocity at launch + rocket boost impulse
                m.speed = Math.max(m.speed, player.speed + 90);
                state.missiles.push(m);

                // Muzzle / launch flash & smoke
                emit(spawnX, spawnY, 8, 'spark', '100,200,255', {
                    speedMin: 35,
                    speedMax: 100,
                    sizeMin: 1.5,
                    sizeMax: 3.5,
                    lifeMin: 0.1,
                    lifeMax: 0.25,
                });

                player.lockTimer = 0;
                player.lockedTarget = null;
            }
        } else {
            // Target left cone -> reset timer to 0
            player.lockTimer = 0;
            player.lockedTarget = null;
        }
    } else {
        // 'X' released or no missiles -> reset timer to 0
        player.isLocking = false;
        player.lockTimer = 0;
        player.lockedTarget = null;
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

    // Dynamic 3D-perspective banking and barrel-roll displacement roll
    if (player.rollTimer > 0) {
        const rollProgress = 1 - (player.rollTimer / (player.rollDuration || 0.35));
        const rollAngle = rollProgress * Math.PI * 2 * (player.rollDirection || 1);
        let rollScaleX = Math.cos(rollAngle);
        if (Math.abs(rollScaleX) < 0.18) rollScaleX = rollScaleX < 0 ? -0.18 : 0.18;
        ctx.scale(rollScaleX, 1);
    } else if (player.isTurning) {
        // Subtle aerodynamic banking compression
        ctx.scale(0.90, 1.0);
    }

    // ── 3. Twin Exhaust Plumes (Clean Vector Flames, Zero Neon Glow) ──
    const nozzleOffsets = [-s * 0.42, s * 0.42];
    const exhaustLen = player.boosting
        ? s * (1.3 + Math.random() * 0.3)
        : s * (0.6 + Math.random() * 0.15);

    for (const nx of nozzleOffsets) {
        if (player.boosting) {
            // Crisp supersonic afterburner flame
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.moveTo(nx - s * 0.16, s * 1.15);
            ctx.lineTo(nx, s * 1.15 + exhaustLen);
            ctx.lineTo(nx + s * 0.16, s * 1.15);
            ctx.closePath();
            ctx.fill();

            // Inner hot core
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.moveTo(nx - s * 0.08, s * 1.15);
            ctx.lineTo(nx, s * 1.15 + exhaustLen * 0.5);
            ctx.lineTo(nx + s * 0.08, s * 1.15);
            ctx.closePath();
            ctx.fill();
        } else {
            // Subtle cruise exhaust flame
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.moveTo(nx - s * 0.12, s * 1.15);
            ctx.lineTo(nx, s * 1.15 + exhaustLen);
            ctx.lineTo(nx + s * 0.12, s * 1.15);
            ctx.closePath();
            ctx.fill();
        }
    }

    // ── 4. Main Fuselage & Aerodynamic Wings (Solid Matte Steel Blue) ──
    buildAirframePath(ctx);
    ctx.fillStyle = '#334e68'; // Solid realistic matte steel blue
    ctx.fill();

    // Matte Wing Panel Tone
    ctx.fillStyle = '#486581';
    ctx.beginPath();
    ctx.moveTo(-s * 0.68, -s * 0.1);
    ctx.lineTo(-s * 1.65, s * 0.55);
    ctx.lineTo(-s * 1.65, s * 0.72);
    ctx.lineTo(-s * 1.48, s * 0.8);
    ctx.lineTo(-s * 0.72, s * 0.72);
    ctx.closePath();
    ctx.moveTo(s * 0.68, -s * 0.1);
    ctx.lineTo(s * 1.65, s * 0.55);
    ctx.lineTo(s * 1.65, s * 0.72);
    ctx.lineTo(s * 1.48, s * 0.8);
    ctx.lineTo(s * 0.72, s * 0.72);
    ctx.closePath();
    ctx.fill();

    // Crisp Vector Airframe Outlines (Zero shadowBlur, Zero shadowColor)
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.3;
    buildAirframePath(ctx);
    ctx.stroke();

    // ── 5. Intake & Wing Flap Panel Detailing ───────────
    ctx.strokeStyle = '#1e293b';
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
    ctx.fillStyle = '#102a43';
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

    // ── 6. Twin Vertical Stabilizers (Tail Fins) ────────
    ctx.fillStyle = '#243b53';
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

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── 7. Cockpit Canopy Glass (Solid Matte Aviator Glass) ──
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.45);
    ctx.bezierCurveTo(-s * 0.22, -s * 1.15, -s * 0.26, -s * 0.65, -s * 0.18, -s * 0.15);
    ctx.bezierCurveTo(-s * 0.10, s * 0.05, 0, s * 0.05, 0, s * 0.05);
    ctx.bezierCurveTo(0, s * 0.05, s * 0.10, s * 0.05, s * 0.18, -s * 0.15);
    ctx.bezierCurveTo(s * 0.26, -s * 0.65, s * 0.22, -s * 1.15, 0, -s * 1.45);
    ctx.closePath();
    ctx.fillStyle = '#0284c7'; // Clean tinted cockpit glass
    ctx.fill();

    ctx.strokeStyle = '#0c4a6e';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Canopy Specular Glint Highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 1.25);
    ctx.bezierCurveTo(-s * 0.14, -s * 0.9, -s * 0.12, -s * 0.5, -s * 0.08, -s * 0.2);
    ctx.stroke();

    // ── 8. Wingtip Formation Navigation Strobes ─────────
    const navBlink = Math.sin(Date.now() / 180) > 0;
    if (navBlink) {
        // Port wingtip: Aviation Red (clean vector dot, no shadowBlur)
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(-s * 1.62, s * 0.65, 2, 0, Math.PI * 2);
        ctx.fill();

        // Starboard wingtip: Aviation Green (clean vector dot, no shadowBlur)
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(s * 1.62, s * 0.65, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();

    // ── Flight School Vector Feedback (Green Heading & Blue Velocity) ─
    if (state && state.gameMode === 'flightschool') {
        drawFlightVectors(player, ctx, screenPos);
    }
}

/**
 * Render visual flight vector feedback (Flight School Mode).
 * Originates from the center of the player's plane to visually teach aerodynamic drift:
 * - Green line: plane's 'Heading' (where nose is pointing)
 * - Blue line: plane's 'Velocity' (actual trajectory, scaled by current speed)
 * - Dynamic sideslip arc: shows angle beta during high-G banking drift
 * 
 * @param {object} player
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} screenPos
 */
export function drawFlightVectors(player, ctx, screenPos) {
    if (!player || !player.alive) return;

    ctx.save();
    const cx = screenPos.x;
    const cy = screenPos.y;

    // ── 1. GREEN LINE: Plane's Nose Heading ─────────────────
    const headingLen = 85;
    const hx = cx + Math.cos(player.heading) * headingLen;
    const hy = cy + Math.sin(player.heading) * headingLen;

    ctx.strokeStyle = '#22c55e'; // Vibrant Aviation Green
    ctx.lineWidth = 2.8;
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    // Green Arrowhead at nose tip
    const arrowSizeH = 8;
    const angleH = player.heading;
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(
        hx - arrowSizeH * Math.cos(angleH - Math.PI / 6),
        hy - arrowSizeH * Math.sin(angleH - Math.PI / 6)
    );
    ctx.lineTo(
        hx - arrowSizeH * Math.cos(angleH + Math.PI / 6),
        hy - arrowSizeH * Math.sin(angleH + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();

    // Heading label (offset perpendicular to heading on port side)
    const normH_x = -Math.sin(player.heading);
    const normH_y = Math.cos(player.heading);
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#22c55e';
    ctx.shadowBlur = 4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NOSE', hx + normH_x * 18, hy + normH_y * 18);

    // ── 2. BLUE LINE: Actual Velocity Vector ─────────────────
    const velAngle = Math.atan2(player.vy, player.vx);
    // Scale length proportional to current speed (at cruise 220px/s -> ~84px, at boost 352px/s -> ~134px)
    const velLen = Math.max(28, player.speed * 0.38);
    const vx = cx + Math.cos(velAngle) * velLen;
    const vy = cy + Math.sin(velAngle) * velLen;

    ctx.strokeStyle = '#38bdf8'; // Aero Sky Blue
    ctx.lineWidth = 2.8;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(vx, vy);
    ctx.stroke();

    // Blue Arrowhead at velocity tip
    const arrowSizeV = 8;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(
        vx - arrowSizeV * Math.cos(velAngle - Math.PI / 6),
        vy - arrowSizeV * Math.sin(velAngle - Math.PI / 6)
    );
    ctx.lineTo(
        vx - arrowSizeV * Math.cos(velAngle + Math.PI / 6),
        vy - arrowSizeV * Math.sin(velAngle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();

    // Velocity label (offset perpendicular to velocity on starboard side)
    const normV_x = Math.sin(velAngle);
    const normV_y = -Math.cos(velAngle);
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.shadowBlur = 4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VELOCITY', vx + normV_x * 24, vy + normV_y * 24);

    // ── 3. Sideslip Drift Arc & Dynamic Label ────────────────
    const sideslipDeg = Math.abs((player.driftAngle || 0) * 180 / Math.PI);
    if (sideslipDeg > 2.0) {
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        const startA = Math.min(player.heading, velAngle);
        const endA = Math.max(player.heading, velAngle);
        if (Math.abs(player.heading - velAngle) < Math.PI) {
            ctx.arc(cx, cy, 48, startA, endA);
        } else {
            ctx.arc(cx, cy, 48, endA, startA);
        }
        ctx.stroke();

        // Sideslip angle badge
        let midA = (player.heading + velAngle) / 2;
        if (Math.abs(player.heading - velAngle) > Math.PI) {
            midA += Math.PI;
        }
        const textDist = 60;
        const tx = cx + Math.cos(midA) * textDist;
        const ty = cy + Math.sin(midA) * textDist;
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`β:${sideslipDeg.toFixed(1)}°`, tx, ty);
    }

    // Origin center anchor dot
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();

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
