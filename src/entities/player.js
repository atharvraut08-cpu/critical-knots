/**
 * player.js — High-fidelity military fighter aircraft entity with Wing Missiles & Team Liveries
 * 
 * Features:
 * - Swept delta-wing fighter silhouette with twin canted stabilizers
 * - 4 High-visibility Team Liveries (Crimson, Cobalt, Emerald, Solar)
 * - Visible wing-mounted air-to-air missiles attached to hardpoint pylons
 * - Hexagonal energy shield bubble when shield power-up is active
 * - Overhead tactical callsign, team badge, and floating HP/Shield bars
 * - Twin supersonic afterburner exhaust with dynamic shock diamonds
 * - Kinematic flight aerodynamics with induced drag
 * - Machine gun tracers + Wing missile hardpoint ordnance
 * - 100 HP health system (no fuel depletion in combat)
 */

import { CONFIG } from '../config.js?v=2.4.0';
import { clamp } from '../utils/math.js?v=2.4.0';
import state from '../state.js?v=2.4.0';
import { emit } from './particle.js?v=2.4.0';
import { playGunFire } from '../systems/audio.js?v=2.4.0';

export const TEAM_COLORS = [
    { name: 'Crimson', main: '#ff3b30', dark: '#801814', glow: 'rgba(255, 59, 48, 0.4)' },
    { name: 'Cobalt',  main: '#007aff', dark: '#0d4077', glow: 'rgba(0, 122, 255, 0.4)' },
    { name: 'Emerald', main: '#34c759', dark: '#146328', glow: 'rgba(52, 199, 89, 0.4)' },
    { name: 'Solar',   main: '#ff9500', dark: '#8a4e00', glow: 'rgba(255, 149, 0, 0.4)' },
];

/**
 * Create a new player entity at world origin.
 * @param {object} [opts]
 * @returns {object} player state
 */
export function createPlayer(opts = {}) {
    return {
        id: opts.id || 'player_local',
        name: opts.name || 'Commander',
        team: opts.team !== undefined ? opts.team : 0,
        x: opts.x || 0,
        y: opts.y || 0,
        heading: opts.heading !== undefined ? opts.heading : -Math.PI / 2,
        speed: CONFIG.playerBaseSpeed,
        baseSpeed: CONFIG.playerBaseSpeed,
        
        // ── Health & Shields ────────────────────────────────
        health: 100,
        maxHealth: 100,
        shield: 0,
        maxShield: 50,
        
        // ── Missiles & Ordnance ─────────────────────────────
        missilesReady: 2,           // 2 wing-mounted missiles ready
        maxMissiles: 4,
        missileReloadTimer: 0,
        missileCooldown: 0,
        lockTargetId: null,
        lockProgress: 0,            // 0..1 tracking progress
        
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

        // ── Guns & Ammo System ──────────────────────────────
        ammoInMag: CONFIG.magCapacity,
        magsRemaining: CONFIG.maxMags - 1,
        reloading: false,
        reloadTimer: 0,
        reloadDuration: CONFIG.reloadDuration,
        fireTimer: 0,

        // ── Flight Aerodynamics State ───────────────────
        isTurning: false,
    };
}

/**
 * Update player state each frame.
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
    const targetTopSpeed = player.boosting
        ? CONFIG.playerBaseSpeed * CONFIG.boostMultiplier
        : CONFIG.playerBaseSpeed;

    // ── Physics-Based Speed & Induced Drag ──────────────
    if (player.isTurning) {
        const turnFloor = targetTopSpeed * CONFIG.minTurnSpeedFactor;
        player.speed = Math.max(turnFloor, player.speed - CONFIG.turnDragDecel * dt);
    } else {
        const accel = player.boosting ? CONFIG.planeBoostAccelRate : CONFIG.planeAccelRate;
        player.speed = Math.min(targetTopSpeed, player.speed + accel * dt);
    }

    // ── Kinematic Position Integration ──────────────────
    player.x += Math.cos(player.heading) * player.speed * dt;
    player.y += Math.sin(player.heading) * player.speed * dt;

    // ── Gun Reload Countdown ────────────────────────────
    if (player.reloading) {
        player.reloadTimer -= dt;
        if (player.reloadTimer <= 0) {
            player.reloading = false;
            player.reloadTimer = 0;
            player.ammoInMag = CONFIG.magCapacity;
        }
    }

    if (player.fireTimer > 0) {
        player.fireTimer -= dt;
    }

    // ── Machine Gun Firing ('C' key) ────────────────────
    if (input.fire && !player.reloading && player.fireTimer <= 0) {
        if (player.ammoInMag > 0) {
            player.ammoInMag--;
            player.fireTimer = CONFIG.gunFireRate;
            playGunFire();

            const noseDist = player.radius * 1.75;
            const noseX = player.x + Math.cos(player.heading) * noseDist;
            const noseY = player.y + Math.sin(player.heading) * noseDist;

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
                ownerId: player.id,
                ownerTeam: player.team,
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

            if (player.ammoInMag <= 0 && player.magsRemaining > 0) {
                player.reloading = true;
                player.reloadTimer = CONFIG.reloadDuration;
                player.magsRemaining--;
            }
        }
    }

    // ── Fuel: Never depletes in combat mode ─────────────
    player.fuel = CONFIG.maxFuel;

    // ── Cooldown Timers ─────────────────────────────────
    if (player.flareCooldown > 0) player.flareCooldown -= dt;
    if (player.empCooldown > 0) player.empCooldown -= dt;
    if (player.missileCooldown > 0) player.missileCooldown -= dt;

    player.trailTimer -= dt;
}

/**
 * Draw the fighter aircraft with wing-mounted missiles, team livery, overhead HUD, and shield bubble.
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
    const teamStyle = TEAM_COLORS[player.team % 4] || TEAM_COLORS[0];

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

    // ── 3. Twin Afterburner Plumes ──────────────────────
    const exhaustLen = player.boosting ? s * (1.8 + Math.random() * 0.6) : s * 0.75;
    const nozzleOffsets = [-s * 0.28, s * 0.28];

    for (const nx of nozzleOffsets) {
        // Outer flame envelope
        ctx.beginPath();
        ctx.moveTo(nx - s * 0.14, s * 0.85);
        ctx.lineTo(nx, s * 0.85 + exhaustLen);
        ctx.lineTo(nx + s * 0.14, s * 0.85);
        ctx.fillStyle = player.boosting ? '#ff7700' : teamStyle.glow;
        ctx.fill();

        // Inner shock-diamond core
        ctx.beginPath();
        ctx.moveTo(nx - s * 0.08, s * 0.85);
        ctx.lineTo(nx, s * 0.85 + exhaustLen * 0.6);
        ctx.lineTo(nx + s * 0.08, s * 0.85);
        ctx.fillStyle = player.boosting ? '#ffffff' : '#e0f4ff';
        ctx.fill();
    }

    // ── 4. Wing Hardpoint Missiles Attached to Wings ────
    // Port wing missile pylon
    const pylonY = s * 0.25;
    const pylonXLeft = -s * 0.95;
    const pylonXRight = s * 0.95;

    // Draw hardpoint pylons
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(pylonXLeft - 1.5, pylonY - s * 0.3, 3, s * 0.6);
    ctx.fillRect(pylonXRight - 1.5, pylonY - s * 0.3, 3, s * 0.6);

    // Render missiles if ready on pylons
    if (player.missilesReady >= 1) {
        // Starboard wing missile
        drawWingMissile(ctx, pylonXRight, pylonY, s, teamStyle.main);
    }
    if (player.missilesReady >= 2) {
        // Port wing missile
        drawWingMissile(ctx, pylonXLeft, pylonY, s, teamStyle.main);
    }

    // ── 5. Main Fuselage & Delta Wings ──────────────────
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.75);              // Needle Radome / Nose
    ctx.lineTo(-s * 0.28, -s * 0.7);      // LERX Port
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

    // High-tech team livery gradient
    const airframeGrad = ctx.createLinearGradient(0, -s * 1.75, 0, s * 1.0);
    airframeGrad.addColorStop(0, '#4a5568');
    airframeGrad.addColorStop(0.3, teamStyle.dark);
    airframeGrad.addColorStop(0.8, '#1a202c');
    airframeGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = airframeGrad;
    ctx.fill();

    // Team racing stripes / panel accents
    ctx.strokeStyle = teamStyle.main;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, -s * 0.5);
    ctx.lineTo(-s * 1.15, s * 0.65);
    ctx.moveTo(s * 0.25, -s * 0.5);
    ctx.lineTo(s * 1.15, s * 0.65);
    ctx.stroke();

    // Border outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── 6. Twin Canted Vertical Stabilizers ──────────────
    ctx.fillStyle = teamStyle.dark;
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, s * 0.1);
    ctx.lineTo(-s * 0.55, s * 0.85);
    ctx.lineTo(-s * 0.32, s * 0.75);
    ctx.moveTo(s * 0.35, s * 0.1);
    ctx.lineTo(s * 0.55, s * 0.85);
    ctx.lineTo(s * 0.32, s * 0.75);
    ctx.fill();

    // ── 7. Cockpit Canopy Glass with Dynamic Specular Glint ──
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.55, s * 0.2, s * 0.55, 0, 0, Math.PI * 2);
    const canopyGrad = ctx.createLinearGradient(0, -s * 1.1, 0, 0);
    canopyGrad.addColorStop(0, '#ffffff');
    canopyGrad.addColorStop(0.35, '#60d5ff');
    canopyGrad.addColorStop(0.8, '#0d2238');
    canopyGrad.addColorStop(1, '#06101c');
    ctx.fillStyle = canopyGrad;
    ctx.fill();

    // Dynamic sun-relative specular gleam sweep
    const glintOffset = Math.sin(player.heading * 2) * (s * 0.08);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(glintOffset, -s * 0.92);
    ctx.lineTo(glintOffset * 0.5, -s * 0.38);
    ctx.stroke();

    // ── 8. Wingtip Condensation Vortices (Banking Turn Aerodynamics) ─
    if (player.isTurning) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        // Port vortex ribbon
        ctx.moveTo(-s * 1.35, s * 0.65);
        ctx.quadraticCurveTo(-s * 1.45, s * 1.2, -s * 1.3, s * 1.8);
        // Starboard vortex ribbon
        ctx.moveTo(s * 1.35, s * 0.65);
        ctx.quadraticCurveTo(s * 1.45, s * 1.2, s * 1.3, s * 1.8);
        ctx.stroke();
    }

    // ── 9. Wingtip Navigation Strobes ───────────────────
    const navBlink = Math.sin(Date.now() / 180) > 0;
    if (navBlink) {
        ctx.fillStyle = '#ff2233'; // Port (Red)
        ctx.beginPath();
        ctx.arc(-s * 1.32, s * 0.68, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#00ff66'; // Starboard (Green)
        ctx.beginPath();
        ctx.arc(s * 1.32, s * 0.68, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // ── 10. Additive Hexagonal Energy Shield Bubble ─────
    if (player.shield > 0) {
        const shieldR = s * 2.2;
        const shieldPulse = 1 + Math.sin(Date.now() / 120) * 0.06;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.scale(shieldPulse, shieldPulse);

        // Outer glow
        ctx.beginPath();
        ctx.arc(0, 0, shieldR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 198, 255, 0.18)';
        ctx.fill();

        // Hexagonal lattice
        ctx.strokeStyle = '#00e1ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.stroke();

        // Inner harmonic ring
        ctx.beginPath();
        ctx.arc(0, 0, shieldR * 0.85, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(96, 213, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.stroke();

        ctx.restore();
    }

    ctx.restore(); // Restore world transform

    // ── 10. Overhead Tactical Nameplate & Health Bar ────
    drawPlayerTacticalPlate(player, ctx, screenPos, teamStyle);
}

/**
 * Draw single air-to-air missile attached to wing hardpoint.
 */
function drawWingMissile(ctx, x, y, s, accentColor) {
    ctx.save();
    ctx.translate(x, y);

    // Missile body
    ctx.fillStyle = '#f0f4f8';
    ctx.fillRect(-2, -s * 0.7, 4, s * 1.2);

    // Red/Team Seeker Nose
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.95);
    ctx.lineTo(2, -s * 0.7);
    ctx.lineTo(-2, -s * 0.7);
    ctx.closePath();
    ctx.fill();

    // Guidance fins
    ctx.fillStyle = '#2d3748';
    ctx.beginPath();
    ctx.moveTo(-4, -s * 0.3);
    ctx.lineTo(4, -s * 0.3);
    ctx.lineTo(0, -s * 0.4);
    ctx.closePath();
    ctx.fill();

    // Tail fins
    ctx.beginPath();
    ctx.moveTo(-5, s * 0.45);
    ctx.lineTo(5, s * 0.45);
    ctx.lineTo(0, s * 0.3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

/**
 * Draw player callsign, team indicator, and floating health/shield bar above the aircraft.
 */
function drawPlayerTacticalPlate(player, ctx, screenPos, teamStyle) {
    const barW = 54;
    const barH = 5;
    const barY = screenPos.y - player.radius * 2.3;
    const barX = screenPos.x - barW / 2;

    // Callsign text
    ctx.save();
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText(player.name, screenPos.x, barY - 4);

    // Team pip badge
    ctx.beginPath();
    ctx.arc(screenPos.x - ctx.measureText(player.name).width / 2 - 8, barY - 10, 4, 0, Math.PI * 2);
    ctx.fillStyle = teamStyle.main;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Bar Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    // Health Bar Fill
    const hpFrac = clamp(player.health / player.maxHealth, 0, 1);
    const hpColor = hpFrac > 0.5 ? '#34c759' : hpFrac > 0.25 ? '#ffcc00' : '#ff3b30';
    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, barW * hpFrac, barH);

    // Shield Bar (if active, cyan line on top of health bar)
    if (player.shield > 0) {
        const shieldFrac = clamp(player.shield / player.maxShield, 0, 1);
        ctx.fillStyle = '#00c6ff';
        ctx.fillRect(barX, barY - 3, barW * shieldFrac, 2);
    }

    ctx.restore();
}

/**
 * Draw machine gun tracer round.
 */
export function drawBullet(bullet, ctx, screenPos) {
    if (!bullet.alive) return;

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(bullet.heading);

    // Luminous tracer streak glow
    ctx.shadowColor = '#ffe066';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#fff5cc';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(2, 0);
    ctx.stroke();

    // Hot tracer incandescent tip
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(2, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}
