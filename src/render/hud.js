/**
 * hud.js — HUD, title screen, game-over screen, score display
 * 
 * Renders all UI overlays: in-game HUD (timer, fuel, charges),
 * title screen with controls reference, and game-over score screen.
 */

import { CONFIG } from '../config.js';
import { getActiveCount } from '../entities/particle.js';
import { clamp } from '../utils/math.js';

/**
 * Draw the title screen.
 * Shows game title and control reference (PRD Section 3.1 requirement).
 * 
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - canvas width
 * @param {number} h - canvas height
 */
export function drawTitleScreen(ctx, w, h, state) {
    // Darkened overlay
    ctx.fillStyle = 'rgba(10, 10, 30, 0.85)';
    ctx.fillRect(0, 0, w, h);

    // Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Glow effect
    ctx.shadowColor = '#60d5ff';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#60d5ff';
    ctx.font = 'bold 54px "Segoe UI", Arial, sans-serif';
    ctx.fillText('SKYFALL EVASION', w / 2, h * 0.19);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = '#aaccee';
    ctx.font = '17px "Segoe UI", Arial, sans-serif';
    ctx.fillText('A 2D Missile Survival Arcade Game', w / 2, h * 0.255);

    // ── Start Game Prompt ───────────────────────────────
    const pulse = 0.6 + Math.sin(Date.now() / 400) * 0.4;
    ctx.fillStyle = `rgba(96, 213, 255, ${pulse})`;
    ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    ctx.fillText('[ Press SPACE to Start Game ]', w / 2, h * 0.36);

    // ── Controls Reference ──────────────────────────────
    ctx.fillStyle = '#8899aa';
    ctx.font = '13px monospace';
    const controls = [
        ['← / A', 'Bank Left (Induces Drag)'],
        ['→ / D', 'Bank Right (Induces Drag)'],
        ['SHIFT (hold)', 'Speed Boost / Afterburner'],
        ['C', 'Fire Machine Gun'],
        ['Q', 'Deploy Flare Salvo'],
        ['E', 'Trigger EMP Wave'],
        ['P', 'Pause Game'],
        ['SPACE', 'Start Game / Restart'],
    ];

    const startY = h * 0.46;
    const lineH = 24;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#60d5ff';
    for (let i = 0; i < controls.length; i++) {
        ctx.fillText(controls[i][0], w / 2 - 20, startY + i * lineH);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8899aa';
    for (let i = 0; i < controls.length; i++) {
        ctx.fillText(controls[i][1], w / 2 + 20, startY + i * lineH);
    }

    // Academic credit
    ctx.textAlign = 'center';
    ctx.fillStyle = '#556677';
    ctx.font = '12px "Segoe UI", Arial, sans-serif';
    ctx.fillText('TE INFT — Computer Graphics Project', w / 2, h * 0.94);
}

/**
 * Draw the in-game HUD (survival timer, fuel bar, charges, debug info).
 * 
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {object} state
 */
export function drawHUD(ctx, w, h, state) {
    const player = state.player;
    if (!player) return;

    const margin = 20;

    // ── Survival Timer (top center) ─────────────────────
    const timerText = formatTime(state.timeAlive);
    ctx.save();
    ctx.font = 'bold 20px monospace';
    const timerMetrics = ctx.measureText(timerText);
    const pillW = timerMetrics.width + 32;
    const pillH = 34;
    const pillX = w / 2 - pillW / 2;
    const pillY = margin - 6;

    ctx.fillStyle = 'rgba(10, 16, 28, 0.65)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 17);
    ctx.fill();
    ctx.strokeStyle = 'rgba(96, 213, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(timerText, w / 2, pillY + pillH / 2);
    ctx.restore();

    // ── Top-Left Tactical HUD Panel ─────────────────────
    const panelX = 16;
    const panelY = 16;
    const panelW = 224;
    const panelH = 186;

    // Dark semi-transparent background panel
    ctx.save();
    ctx.fillStyle = 'rgba(10, 16, 28, 0.70)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(96, 213, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const hudX = panelX + 16;
    const hudW = panelW - 32; // 192 px width for bars

    // ── 1. Fuel Bar ─────────────────────────────────────
    const fuelLabelY = panelY + 14;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#c5d8ea';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('FUEL', hudX, fuelLabelY);

    const fuelBarY = fuelLabelY + 18;
    const fuelBarH = 10;
    // Track
    ctx.beginPath();
    ctx.roundRect(hudX, fuelBarY, hudW, fuelBarH, fuelBarH / 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fill();

    // Full green fuel bar
    const fuelColor = '#22cc77';
    ctx.save();
    ctx.shadowColor = fuelColor;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.roundRect(hudX, fuelBarY, hudW, fuelBarH, fuelBarH / 2);
    ctx.fillStyle = fuelColor;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.roundRect(hudX, fuelBarY, hudW, fuelBarH, fuelBarH / 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── 2. Flare Charges ────────────────────────────────
    const flareY = fuelBarY + fuelBarH + 16;
    ctx.fillStyle = '#c5d8ea';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('FLARE', hudX, flareY);

    for (let i = 0; i < player.maxFlares; i++) {
        const charged = i < player.flares;
        const boxX = hudX + 54 + i * 19;
        const boxY = flareY - 1;
        const boxSize = 13;

        ctx.save();
        if (charged) {
            ctx.shadowColor = '#ffdd44';
            ctx.shadowBlur = 6;
        }
        ctx.fillStyle = charged ? '#ffdd44' : 'rgba(255, 255, 255, 0.12)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxSize, boxSize, 3);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxSize, boxSize, 3);
        ctx.stroke();
    }

    // ── 3. EMP Charges ──────────────────────────────────
    const empY = flareY + 24;
    ctx.fillStyle = '#c5d8ea';
    ctx.fillText('EMP', hudX, empY);

    for (let i = 0; i < player.maxEmp; i++) {
        const charged = i < player.emp;
        const boxX = hudX + 54 + i * 19;
        const boxY = empY - 1;
        const boxSize = 13;

        ctx.save();
        if (charged) {
            ctx.shadowColor = '#6688ff';
            ctx.shadowBlur = 6;
        }
        ctx.fillStyle = charged ? '#6688ff' : 'rgba(255, 255, 255, 0.12)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxSize, boxSize, 3);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxSize, boxSize, 3);
        ctx.stroke();
    }

    // ── 4. Machine Gun Ammo & Magazines UI ───────────────
    const ammoCount = player.ammoInMag !== undefined ? player.ammoInMag : CONFIG.magCapacity;
    const magsLeft = player.magsRemaining !== undefined ? player.magsRemaining : (CONFIG.maxMags - 1);
    const isReloading = !!player.reloading;

    // Header label & status row
    const gunLabelY = empY + 26;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#c5d8ea';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('GUN AMMO', hudX, gunLabelY);

    if (isReloading) {
        const timeLeft = Math.max(0, player.reloadTimer).toFixed(1);
        const blink = Math.sin(Date.now() / 140) > 0;
        ctx.textAlign = 'right';
        ctx.fillStyle = blink ? '#ffcc00' : '#ff6622';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`⚡ RELOAD ${timeLeft}s`, hudX + hudW, gunLabelY);
    } else {
        ctx.textAlign = 'right';
        ctx.fillStyle = ammoCount > 40 ? '#ffffff' : (ammoCount > 0 ? '#ffaa22' : '#ff4444');
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`${ammoCount} / ${CONFIG.magCapacity}`, hudX + hudW, gunLabelY);
    }

    // Ammo Bar / Reload Progress Bar row
    const ammoBarY = gunLabelY + 18;
    const ammoBarH = 6;

    ctx.beginPath();
    ctx.roundRect(hudX, ammoBarY, hudW, ammoBarH, 3);
    ctx.fillStyle = isReloading ? 'rgba(255, 170, 40, 0.15)' : 'rgba(255, 255, 255, 0.12)';
    ctx.fill();

    if (isReloading) {
        const reloadProg = Math.max(0, Math.min(1, (CONFIG.reloadDuration - player.reloadTimer) / CONFIG.reloadDuration));
        ctx.beginPath();
        ctx.roundRect(hudX, ammoBarY, Math.max(hudW * reloadProg, 3), ammoBarH, 3);
        ctx.fillStyle = '#ffaa22';
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 180, 50, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
    } else {
        const ammoPct = ammoCount / CONFIG.magCapacity;
        if (hudW * ammoPct > 1) {
            ctx.beginPath();
            ctx.roundRect(hudX, ammoBarY, Math.max(hudW * ammoPct, 3), ammoBarH, 3);
            ctx.fillStyle = ammoCount > 40 ? '#ffdd44' : '#ff5533';
            ctx.fill();
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Reserve Magazines row
    const magRowY = ammoBarY + ammoBarH + 13;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#9cb3c9';
    ctx.font = '10px monospace';
    ctx.fillText(`MAGS: ${magsLeft} / ${CONFIG.maxMags - 1}`, hudX, magRowY + 5);

    const magBoxStartX = hudX + 86;
    const magBoxY = magRowY;
    const totalReserve = CONFIG.maxMags - 1; // 9
    for (let m = 0; m < totalReserve; m++) {
        const hasMag = m < magsLeft;
        ctx.fillStyle = hasMag ? '#60d5ff' : 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(magBoxStartX + m * 11, magBoxY, 8, 11);
        if (hasMag) {
            ctx.strokeStyle = 'rgba(160, 230, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(magBoxStartX + m * 11, magBoxY, 8, 11);
        }
    }

    ctx.restore();

    // ── Entity count debug display (top-right) ──────────
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px monospace';
    const missiles = state.missiles.length;
    const particles = getActiveCount();
    ctx.fillText(`M:${missiles} P:${particles}`, w - margin, margin);

    // ── Boost indicator ─────────────────────────────────
    if (player.boosting) {
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255,180,50,${0.5 + Math.sin(Date.now() / 100) * 0.3})`;
        ctx.font = 'bold 14px monospace';
        ctx.fillText('» BOOST «', w / 2, margin + 30);
    }

    // ── Tactical Cockpit Speedometer (bottom-left) ─────
    drawSpeedometer(ctx, player, w, h);

    // ── Minimap / Radar (bottom-right) ──────────────────
    drawMinimap(ctx, w, h, state);

    // ── EMP Avionics Glitch / Static Overlay ────────────
    if (state.hudGlitchTimer > 0) {
        drawHUDGlitch(ctx, w, h, state.hudGlitchTimer);
    }

    // ── Paused overlay ──────────────────────────────────
    if (state.paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
        ctx.fillText('PAUSED', w / 2, h / 2);
        ctx.fillStyle = '#aabbcc';
        ctx.font = '16px "Segoe UI", Arial, sans-serif';
        ctx.fillText('Press P to resume', w / 2, h / 2 + 40);
    }
}

/**
 * Render brief digital scanlines and electromagnetic glitch static across the HUD on EMP pulse.
 */
function drawHUDGlitch(ctx, w, h, timer) {
    const intensity = Math.min(timer / CONFIG.empHudGlitchDuration, 1);
    ctx.save();

    // 1. Semi-transparent cyan/blue surge vignette
    ctx.fillStyle = `rgba(80, 200, 255, ${intensity * 0.12})`;
    ctx.fillRect(0, 0, w, h);

    // 2. Horizontal digital scanline noise slices
    const bandCount = Math.floor(6 + Math.random() * 8);
    for (let i = 0; i < bandCount; i++) {
        const by = Math.random() * h;
        const bh = 2 + Math.random() * 8;
        const alpha = Math.random() * 0.18 * intensity;
        ctx.fillStyle = Math.random() > 0.5 ? `rgba(120, 220, 255, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(0, by, w, bh);
    }

    // 3. EMP discharge warning banner
    if (intensity > 0.25) {
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = `rgba(100, 220, 255, ${intensity * 0.85})`;
        ctx.textAlign = 'center';
        ctx.fillText('⚡ EMP DISCHARGE // AVIONICS SURGE ⚡', w / 2, h * 0.18);
    }

    ctx.restore();
}

/**
 * Map absolute world coordinates into localized minimap viewport coordinates.
 * CG Concept: Window-to-Viewport coordinate transformation (affine mapping)
 * 
 * Maps world coordinates from a viewing window centered on the player:
 *   [playerX - worldRange, playerX + worldRange] x [playerY - worldRange, playerY + worldRange]
 * to the screen-space minimap viewport:
 *   [vx, vx + vw] x [vy, vy + vh]
 *
 * @param {number} worldX
 * @param {number} worldY
 * @param {number} playerX
 * @param {number} playerY
 * @param {number} worldRange
 * @param {number} vx
 * @param {number} vy
 * @param {number} vw
 * @param {number} vh
 * @returns {{ x: number, y: number, inBounds: boolean }}
 */
export function worldToMinimap(worldX, worldY, playerX, playerY, worldRange, vx, vy, vw, vh) {
    // CG Concept: Window-to-viewport coordinate transformation
    const windowMinX = playerX - worldRange;
    const windowMinY = playerY - worldRange;
    const windowSpan = worldRange * 2;

    const tx = (worldX - windowMinX) / windowSpan;
    const ty = (worldY - windowMinY) / windowSpan;

    const inBounds = tx >= 0 && tx <= 1 && ty >= 0 && ty <= 1;

    return {
        x: vx + tx * vw,
        y: vy + ty * vh,
        inBounds,
    };
}

/**
 * Draw the tactical radar minimap in the bottom-right corner.
 * CG Concept: Window-to-Viewport transformation + Viewport Clipping
 * 
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - canvas width
 * @param {number} h - canvas height
 * @param {object} state - global game state
 */
export function drawMinimap(ctx, w, h, state) {
    const player = state.player;
    if (!player) return;

    const mw = CONFIG.minimapWidth;
    const mh = CONFIG.minimapHeight;
    const margin = CONFIG.minimapMargin;
    const range = CONFIG.minimapWorldRange;

    // Viewport coordinates in bottom-right corner
    const vx = w - mw - margin;
    const vy = h - mh - margin;

    ctx.save();

    // ── Semi-transparent background ─────────────────────
    ctx.fillStyle = CONFIG.minimapBgColor;
    ctx.fillRect(vx, vy, mw, mh);

    // ── Coordinate grid / crosshairs ────────────────────
    ctx.strokeStyle = CONFIG.minimapGridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(vx + mw / 2, vy);
    ctx.lineTo(vx + mw / 2, vy + mh);
    ctx.moveTo(vx, vy + mh / 2);
    ctx.lineTo(vx + mw, vy + mh / 2);
    ctx.stroke();

    // Concentric range ring at half range
    ctx.beginPath();
    ctx.arc(vx + mw / 2, vy + mh / 2, mw / 4, 0, Math.PI * 2);
    ctx.stroke();

    // ── Viewport clipping for internal blips ────────────
    ctx.beginPath();
    ctx.rect(vx, vy, mw, mh);
    ctx.clip();

    // ── 1. Obstacles (gray/stone dots) ───────────────────
    ctx.fillStyle = CONFIG.minimapDotObstacle;
    for (let i = 0; i < state.obstacles.length; i++) {
        const obs = state.obstacles[i];
        if (!obs.alive) continue;
        const pt = worldToMinimap(obs.x, obs.y, player.x, player.y, range, vx, vy, mw, mh);
        if (!pt.inBounds) continue;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.8, 0, Math.PI * 2);
        ctx.fill();
    }


    // ── 3. Flares (yellow decoy dots) ───────────────────
    ctx.fillStyle = '#ffcc00';
    for (let i = 0; i < state.flares.length; i++) {
        const f = state.flares[i];
        if (!f.alive) continue;
        const pt = worldToMinimap(f.x, f.y, player.x, player.y, range, vx, vy, mw, mh);
        if (!pt.inBounds) continue;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.0, 0, Math.PI * 2);
        ctx.fill();
    }

    // ── 4. Missiles (color-coded by archetype) ──────────
    for (let i = 0; i < state.missiles.length; i++) {
        const m = state.missiles[i];
        if (!m.alive) continue;
        const pt = worldToMinimap(m.x, m.y, player.x, player.y, range, vx, vy, mw, mh);
        if (!pt.inBounds) continue;

        const def = CONFIG.missileTypes[m.type] || CONFIG.missileTypes.standard;
        const dotColor = m.disabledTimer > 0 ? '#44aaff' : (def.hudDot || '#ff4455');
        const dotRadius = m.type === 'heavy' ? 3.8 : (m.type === 'hyper' ? 3.2 : 2.5);

        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        // High-threat ring for Hyper and Heavy
        if (m.type === 'hyper' && m.disabledTimer <= 0) {
            ctx.strokeStyle = '#ff33ff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, dotRadius + 2.5, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // ── 5. Player (white dot at center + heading line) ──
    const playerPt = worldToMinimap(player.x, player.y, player.x, player.y, range, vx, vy, mw, mh);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(playerPt.x, playerPt.y);
    ctx.lineTo(
        playerPt.x + Math.cos(player.heading) * 9,
        playerPt.y + Math.sin(player.heading) * 9
    );
    ctx.stroke();

    ctx.fillStyle = CONFIG.minimapDotPlayer;
    ctx.beginPath();
    ctx.arc(playerPt.x, playerPt.y, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // ── Minimap border & label ──────────────────────────
    ctx.strokeStyle = CONFIG.minimapBorderColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, mw, mh);

    // Subtle label above the minimap
    ctx.fillStyle = 'rgba(96, 213, 255, 0.7)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('RADAR', vx + mw, vy - 4);
}

/**
 * Draw the game-over score screen.
 * 
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {object} stats
 */
export function drawGameOverScreen(ctx, w, h, stats) {
    // Dark overlay
    ctx.fillStyle = 'rgba(10, 10, 30, 0.88)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // "GAME OVER"
    ctx.shadowColor = '#ff3344';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#ff4455';
    ctx.font = 'bold 48px "Segoe UI", Arial, sans-serif';
    ctx.fillText('GAME OVER', w / 2, h * 0.25);
    ctx.shadowBlur = 0;

    // Stats
    const statLines = [
        ['Time Survived', formatTime(stats.timeSurvived)],
        ['Missiles Destroyed', String(stats.missilesDestroyed)],
        ['Near Misses', String(stats.nearMisses)],
    ];

    const startY = h * 0.42;
    const lineH = 34;

    for (let i = 0; i < statLines.length; i++) {
        const y = startY + i * lineH;

        ctx.textAlign = 'right';
        ctx.fillStyle = '#8899aa';
        ctx.font = '16px monospace';
        ctx.fillText(statLines[i][0], w / 2 - 20, y);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(statLines[i][1], w / 2 + 20, y);
    }

    // "Press SPACE to Restart"
    const pulse = 0.5 + Math.sin(Date.now() / 400) * 0.5;
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(96, 213, 255, ${pulse})`;
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.fillText('[ Press SPACE to Restart ]', w / 2, h * 0.78);
}

/**
 * Format seconds as MM:SS.T
 * Rounds to tenths BEFORE splitting into minutes/seconds so that e.g.
 * 59.96s displays as "02:00.0" instead of the rounding artifact "01:60.0".
 */
function formatTime(seconds) {
    const totalTenths = Math.round(seconds * 10);
    const mins = Math.floor(totalTenths / 600);
    const secs = (totalTenths % 600) / 10;
    return `${String(mins).padStart(2, '0')}:${secs.toFixed(1).padStart(4, '0')}`;
}

/**
 * Render tactical cockpit airspeed indicator (Speedometer) in bottom-left.
 * Accurately displays real-time dynamic forward velocity and turning drag.
 * 
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} player
 * @param {number} w
 * @param {number} h
 */
export function drawSpeedometer(ctx, player, w, h) {
    if (!player) return;

    const cx = 95;
    const cy = h - 90;
    const r = 50;
    const curSpeed = player.speed || 0;
    const maxGaugeSpeed = 400; // gauge range: 0 to 400 px/s

    ctx.save();

    // 1. Semi-transparent housing background
    ctx.beginPath();
    ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 15, 28, 0.65)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(96, 213, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Bezel tick marks and dial arc (from 135° to 405°, 270° total span)
    const startAngle = Math.PI * 0.75; // 135 deg (bottom-left)
    const arcSpan = Math.PI * 1.5;    // 270 deg span to bottom-right
    const endAngle = startAngle + arcSpan;

    // Track arc background
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Active speed arc
    const speedRatio = clamp(curSpeed / maxGaugeSpeed, 0, 1);
    const curAngle = startAngle + arcSpan * speedRatio;

    let arcColor = '#60d5ff'; // cruise blue
    if (player.boosting) {
        arcColor = '#ff7700'; // boost orange
    } else if (player.isTurning) {
        arcColor = '#ffbb22'; // turn drag amber
    }

    ctx.save();
    ctx.shadowColor = arcColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, curAngle);
    ctx.strokeStyle = arcColor;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();

    // Tick marks at 0, 100, 200, 300, 400
    for (let s = 0; s <= 400; s += 100) {
        const t = s / 400;
        const a = startAngle + arcSpan * t;
        const x1 = cx + Math.cos(a) * (r - 7);
        const y1 = cy + Math.sin(a) * (r - 7);
        const x2 = cx + Math.cos(a) * (r + 1);
        const y2 = cy + Math.sin(a) * (r + 1);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // Needle pointer
    const needleX = cx + Math.cos(curAngle) * (r - 4);
    const needleY = cy + Math.sin(curAngle) * (r - 4);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(needleX, needleY);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Needle center hub
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Digital readout in center
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`${Math.round(curSpeed)}`, cx, cy + 10);

    ctx.fillStyle = '#8899aa';
    ctx.font = '10px monospace';
    ctx.fillText('KTS IAS', cx, cy + 24);

    // Aerodynamic flight state badge above dial
    let badgeText = 'CRUISE';
    let badgeColor = '#60d5ff';
    if (player.boosting) {
        badgeText = 'AFTERBURNER';
        badgeColor = '#ff7700';
    } else if (player.isTurning) {
        badgeText = 'G-DRAG';
        badgeColor = '#ffbb22';
    }

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = badgeColor;
    ctx.fillText(badgeText, cx, cy - r - 22);

    ctx.restore();
}
