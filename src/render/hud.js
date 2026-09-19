/**
 * hud.js — HUD, title screen, game-over screen, score display
 * 
 * Renders all UI overlays: in-game HUD (timer, fuel, charges),
 * title screen with controls reference, and game-over score screen.
 */

import { CONFIG } from '../config.js';
import { getActiveCount } from '../entities/particle.js';

/**
 * Draw the title screen.
 * Shows game title and control reference (PRD Section 3.1 requirement).
 * 
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - canvas width
 * @param {number} h - canvas height
 */
export function drawTitleScreen(ctx, w, h) {
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
    ctx.font = 'bold 56px "Segoe UI", Arial, sans-serif';
    ctx.fillText('SKYFALL EVASION', w / 2, h * 0.25);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = '#aaccee';
    ctx.font = '18px "Segoe UI", Arial, sans-serif';
    ctx.fillText('A 2D Missile Survival Arcade Game', w / 2, h * 0.32);

    // "Press Space to Fly"
    const pulse = 0.6 + Math.sin(Date.now() / 400) * 0.4;
    ctx.fillStyle = `rgba(96, 213, 255, ${pulse})`;
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.fillText('[ Press SPACE to Fly ]', w / 2, h * 0.45);

    // Controls reference
    ctx.fillStyle = '#8899aa';
    ctx.font = '14px monospace';
    const controls = [
        ['← / A', 'Bank Left'],
        ['→ / D', 'Bank Right'],
        ['SHIFT (hold)', 'Speed Boost'],
        ['SPACE', 'Drop Flare'],
        ['E', 'Trigger EMP'],
        ['P', 'Pause'],
        ['R', 'Restart (on game over)'],
    ];

    const startY = h * 0.56;
    const lineH = 22;
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
    ctx.fillText('TE INFT — Computer Graphics Project', w / 2, h * 0.92);
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
    const barW = 180;
    const barH = 12;

    // ── Survival Timer (top center) ─────────────────────
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(formatTime(state.timeAlive), w / 2, margin);

    // ── Fuel Bar (top-left) ─────────────────────────────
    const fuelX = margin;
    const fuelY = margin;

    // Label
    ctx.textAlign = 'left';
    ctx.fillStyle = '#aabbcc';
    ctx.font = '12px monospace';
    ctx.fillText('FUEL', fuelX, fuelY);

    // Background (rounded track)
    ctx.beginPath();
    ctx.roundRect(fuelX, fuelY + 16, barW, barH, barH / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();

    // Fill, with a soft glow that reads as urgency as fuel drops
    const fuelPct = player.fuel / player.maxFuel;
    const fuelColor = fuelPct > 0.3 ? '#22cc77' : (fuelPct > 0.15 ? '#ffaa22' : '#ff3344');
    if (barW * fuelPct > 1) {
        ctx.save();
        ctx.shadowColor = fuelColor;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.roundRect(fuelX, fuelY + 16, Math.max(barW * fuelPct, barH), barH, barH / 2);
        ctx.fillStyle = fuelColor;
        ctx.fill();
        ctx.restore();
    }

    // Border
    ctx.beginPath();
    ctx.roundRect(fuelX, fuelY + 16, barW, barH, barH / 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Low fuel warning flash
    if (fuelPct < 0.15 && Math.sin(Date.now() / 150) > 0) {
        ctx.fillStyle = 'rgba(255,50,50,0.15)';
        ctx.fillRect(0, 0, w, h);
    }

    // ── Countermeasure Charges (top-left, below fuel) ───
    const chargeY = fuelY + 40;

    // Flare charges
    ctx.fillStyle = '#aabbcc';
    ctx.font = '12px monospace';
    ctx.fillText('FLARE', fuelX, chargeY);
    for (let i = 0; i < player.maxFlares; i++) {
        const charged = i < player.flares;
        ctx.save();
        if (charged) {
            ctx.shadowColor = '#ffdd44';
            ctx.shadowBlur = 5;
        }
        ctx.fillStyle = charged ? '#ffdd44' : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.roundRect(fuelX + 50 + i * 18, chargeY, 12, 12, 3);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.roundRect(fuelX + 50 + i * 18, chargeY, 12, 12, 3);
        ctx.stroke();
    }

    // EMP charges
    ctx.fillStyle = '#aabbcc';
    ctx.fillText('EMP', fuelX, chargeY + 20);
    for (let i = 0; i < player.maxEmp; i++) {
        const charged = i < player.emp;
        ctx.save();
        if (charged) {
            ctx.shadowColor = '#6688ff';
            ctx.shadowBlur = 5;
        }
        ctx.fillStyle = charged ? '#6688ff' : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.roundRect(fuelX + 50 + i * 18, chargeY + 20, 12, 12, 3);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.roundRect(fuelX + 50 + i * 18, chargeY + 20, 12, 12, 3);
        ctx.stroke();
    }

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
        ['Fuel Collected', String(stats.fuelCollected)],
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

    // "Press R to Restart"
    const pulse = 0.5 + Math.sin(Date.now() / 400) * 0.5;
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(96, 213, 255, ${pulse})`;
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.fillText('[ Press R to Restart ]', w / 2, h * 0.78);
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
