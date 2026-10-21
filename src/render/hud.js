/**
 * hud.js — HUD, card-based title screen, Flight School tutorial HUD, and score display
 * 
 * Features:
 * - Card-based main menu with frosted glassmorphism (Survival, Dogfight, Flight School)
 * - Flight School tutorial overlay (Break Turn, Flat Scissors, Drift, Dash Roll)
 * - Real-time cockpit telemetry (Airspeed, G-meter, Sideslip drift angle)
 */

import { CONFIG } from '../config.js';
import { getActiveCount } from '../entities/particle.js';
import { clamp } from '../utils/math.js';
import { worldToScreen } from '../camera.js';
import { mouse } from '../input.js';

/**
 * Compute the bounding geometry for the 3 title screen cards.
 * @param {number} w - canvas width
 * @param {number} h - canvas height
 */
export function getTitleCards(w, h) {
    const cardW = 330;
    const cardH = 405;
    const cardGap = 35;
    const totalW = 3 * cardW + 2 * cardGap;
    const startX = (w - totalW) / 2;
    const startY = 168;

    return [
        {
            id: 'survival',
            mode: 'survival',
            index: 0,
            x: startX,
            y: startY,
            w: cardW,
            h: cardH,
            title: 'SURVIVAL',
            badge: 'PHASED ESCALATION',
            color: '#38bdf8',
            glowColor: 'rgba(56, 189, 248, 0.45)',
            tagline: 'Classic missile evasion arcade mode.',
            description: [
                '• 3 escalating difficulty phases',
                '• Heavy tracking & supersonic rockets',
                '• Pop flares & manage fuel reserves',
                '• High-score endurance survival',
            ],
            hotkeyPrompt: '[ 1 ] LAUNCH SURVIVAL',
        },
        {
            id: 'dogfight',
            mode: 'dogfight',
            index: 1,
            x: startX + cardW + cardGap,
            y: startY,
            w: cardW,
            h: cardH,
            title: 'DOGFIGHT',
            badge: '1v2 AIR COMBAT',
            color: '#f43f5e',
            glowColor: 'rgba(244, 63, 94, 0.45)',
            tagline: 'High-stakes tactical air combat.',
            description: [
                '• Two computer-controlled adversary jets',
                '• AI Lead & Lag pursuit intercept curves',
                '• 150px separation formation steering',
                '• Radar Warning (RWR) & Hard-Locks',
            ],
            hotkeyPrompt: '[ 2 ] ENGAGE DOGFIGHT',
        },
        {
            id: 'flightschool',
            mode: 'flightschool',
            index: 2,
            locked: true,
            x: startX + 2 * (cardW + cardGap),
            y: startY,
            w: cardW,
            h: cardH,
            title: 'FLIGHT SCHOOL',
            sublabel: '(COMING SOON)',
            badge: 'COMING SOON',
            color: '#64748b',
            glowColor: 'rgba(100, 116, 139, 0.2)',
            tagline: 'Flight School (Coming Soon)',
            description: [
                '• Advanced tactical tutorials',
                '• Learn High-G Break Turns & Induced Drag',
                '• Execute Flat Scissors tail reversals',
                '• Practice Aerodynamic Drift & Dash Rolls',
            ],
            hotkeyPrompt: '[ LOCKED ] COMING SOON',
        },
    ];
}

/**
 * Draw the card-based title screen with frosted glassmorphism styling.
 * 
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - canvas width
 * @param {number} h - canvas height
 * @param {object} state
 */
export function drawTitleScreen(ctx, w, h, state) {
    // Dark sci-fi backdrop
    ctx.fillStyle = 'rgba(7, 11, 22, 0.88)';
    ctx.fillRect(0, 0, w, h);

    // Decorative grid scanlines
    ctx.strokeStyle = 'rgba(96, 213, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }

    // Title Header
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = '#60d5ff';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#60d5ff';
    ctx.font = '900 44px "Segoe UI", Arial, sans-serif';
    ctx.fillText('SKYFALL EVASION', w / 2, 72);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 14px monospace';
    ctx.fillText('NEWTONIAN AERODYNAMICS  •  PROPORTIONAL NAVIGATION  •  TACTICAL COMBAT', w / 2, 114);

    // ── Three Interactive Frosted Glass Cards ──────────
    const cards = getTitleCards(w, h);
    const selectedIdx = state.selectedCardIndex !== undefined ? state.selectedCardIndex : 0;

    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const isHovered = !card.locked && mouse.x >= card.x && mouse.x <= card.x + card.w &&
                          mouse.y >= card.y && mouse.y <= card.y + card.h;
        const isSelected = !card.locked && (selectedIdx === i || isHovered);

        ctx.save();

        // Visually disable locked card with lowered opacity
        if (card.locked) {
            ctx.globalAlpha = 0.5;
        }

        // 1. Frosted Glassmorphism Background Gradient
        const cardGrad = ctx.createLinearGradient(card.x, card.y, card.x + card.w, card.y + card.h);
        if (card.locked) {
            cardGrad.addColorStop(0, 'rgba(15, 23, 42, 0.65)');
            cardGrad.addColorStop(1, 'rgba(10, 15, 30, 0.75)');
        } else if (isSelected) {
            cardGrad.addColorStop(0, 'rgba(20, 32, 58, 0.88)');
            cardGrad.addColorStop(1, 'rgba(10, 18, 38, 0.94)');
        } else {
            cardGrad.addColorStop(0, 'rgba(14, 22, 42, 0.74)');
            cardGrad.addColorStop(1, 'rgba(8, 14, 28, 0.84)');
        }

        ctx.fillStyle = cardGrad;
        ctx.beginPath();
        ctx.roundRect(card.x, card.y, card.w, card.h, 14);
        ctx.fill();

        // 2. Frosted Diagonal Specular Sheen
        const sheenGrad = ctx.createLinearGradient(card.x, card.y, card.x + card.w, card.y + card.h * 0.45);
        sheenGrad.addColorStop(0, card.locked ? 'rgba(255, 255, 255, 0.02)' : (isSelected ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.05)'));
        sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = sheenGrad;
        ctx.beginPath();
        ctx.roundRect(card.x + 1, card.y + 1, card.w - 2, card.h * 0.45, [13, 13, 0, 0]);
        ctx.fill();

        // 3. Glowing Border (Glassmorphic Edge)
        ctx.strokeStyle = card.locked ? 'rgba(100, 116, 139, 0.35)' : (isSelected ? card.color : 'rgba(96, 213, 255, 0.22)');
        ctx.lineWidth = isSelected ? 2.4 : 1.2;
        if (isSelected && !card.locked) {
            ctx.shadowColor = card.color;
            ctx.shadowBlur = 18;
        } else {
            ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.roundRect(card.x, card.y, card.w, card.h, 14);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 4. Card Badge Pill
        const badgeText = card.badge;
        ctx.font = 'bold 10px monospace';
        const badgeMetrics = ctx.measureText(badgeText);
        const badgeW = badgeMetrics.width + 18;
        const badgeH = 20;
        const badgeX = card.x + card.w / 2 - badgeW / 2;
        const badgeY = card.y + 20;

        ctx.fillStyle = card.locked ? 'rgba(30, 41, 59, 0.6)' : (isSelected ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.3)');
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 10);
        ctx.fill();
        ctx.strokeStyle = card.locked ? '#475569' : card.color;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = card.locked ? '#94a3b8' : card.color;
        ctx.fillText(badgeText, card.x + card.w / 2, badgeY + badgeH / 2);

        // 5. Card Title & Sub-label
        if (card.locked) {
            ctx.font = '900 22px "Segoe UI", Arial, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(card.title, card.x + card.w / 2, card.y + 64);
            ctx.font = 'bold 12px monospace';
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText(card.sublabel || '(COMING SOON)', card.x + card.w / 2, card.y + 84);
        } else {
            ctx.font = '900 24px "Segoe UI", Arial, sans-serif';
            ctx.fillStyle = '#ffffff';
            if (isSelected) {
                ctx.shadowColor = card.color;
                ctx.shadowBlur = 12;
            }
            ctx.fillText(card.title, card.x + card.w / 2, card.y + 70);
            ctx.shadowBlur = 0;
        }

        // 6. Mode Tagline
        ctx.font = '12px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = card.locked ? '#64748b' : '#94a3b8';
        ctx.fillText(card.tagline, card.x + card.w / 2, card.y + (card.locked ? 104 : 98));

        // 7. Tactical CAD Vector Schematic Illustration
        const iconY = card.y + 155;
        ctx.save();
        ctx.translate(card.x + card.w / 2, iconY);

        if (card.id === 'survival') {
            // Evasive vector trajectory with incoming threat vectors
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(0, 0, 28, 0, Math.PI * 2);
            ctx.stroke();

            // Missile threat tracks
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-35, -20);
            ctx.lineTo(-8, -4);
            ctx.moveTo(35, 20);
            ctx.lineTo(8, 4);
            ctx.stroke();

            // Player aircraft chevron
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.moveTo(0, -14);
            ctx.lineTo(12, 12);
            ctx.lineTo(0, 7);
            ctx.lineTo(-12, 12);
            ctx.closePath();
            ctx.fill();

        } else if (card.id === 'dogfight') {
            // Combat reticle & opposing fighter silhouettes
            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 1.5;
            // Crosshairs
            ctx.beginPath();
            ctx.moveTo(-28, 0);
            ctx.lineTo(-8, 0);
            ctx.moveTo(8, 0);
            ctx.lineTo(28, 0);
            ctx.moveTo(0, -28);
            ctx.lineTo(0, -8);
            ctx.moveTo(0, 8);
            ctx.lineTo(0, 28);
            ctx.stroke();

            // Diamond target reticle
            ctx.beginPath();
            ctx.moveTo(0, -18);
            ctx.lineTo(18, 0);
            ctx.lineTo(0, 18);
            ctx.lineTo(-18, 0);
            ctx.closePath();
            ctx.stroke();

            // Hostile bogey dot
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
            ctx.fill();

        } else if (card.id === 'flightschool') {
            // Newtonian flight vector vs nose heading showing drift angle
            ctx.strokeStyle = card.locked ? '#64748b' : '#34d399';
            ctx.lineWidth = 1.5;

            // Nose heading vector arrow (pointing up-right)
            ctx.beginPath();
            ctx.moveTo(-16, 14);
            ctx.lineTo(18, -14);
            ctx.stroke();

            // Velocity drift vector (pointing straight right)
            ctx.strokeStyle = card.locked ? 'rgba(100, 116, 139, 0.4)' : 'rgba(52, 211, 153, 0.45)';
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(-16, 14);
            ctx.lineTo(24, 14);
            ctx.stroke();
            ctx.setLineDash([]);

            // Sideslip beta arc
            ctx.strokeStyle = card.locked ? '#64748b' : '#34d399';
            ctx.beginPath();
            ctx.arc(-16, 14, 24, -Math.PI / 4, 0);
            ctx.stroke();

            // Drift symbol
            ctx.font = 'bold 11px monospace';
            ctx.fillStyle = card.locked ? '#64748b' : '#34d399';
            ctx.fillText('β DRIFT', 16, 2);
        }
        ctx.restore();

        // 8. Description Bullet Points
        const listStartY = card.y + 215;
        const lineH = 22;
        ctx.textAlign = 'left';
        ctx.font = '12px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = card.locked ? '#64748b' : '#cbd5e1';

        for (let d = 0; d < card.description.length; d++) {
            ctx.fillText(card.description[d], card.x + 24, listStartY + d * lineH);
        }

        // 9. Frosted Launch Button Pill at Bottom
        const btnW = card.w - 48;
        const btnH = 38;
        const btnX = card.x + 24;
        const btnY = card.y + card.h - 56;

        ctx.fillStyle = card.locked ? 'rgba(30, 41, 59, 0.4)' : (isSelected ? card.color : 'rgba(255, 255, 255, 0.08)');
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, 19);
        ctx.fill();

        ctx.strokeStyle = card.locked ? '#475569' : (isSelected ? '#ffffff' : card.color);
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = card.locked ? '#64748b' : (isSelected ? '#0b1120' : '#ffffff');
        ctx.fillText(card.hotkeyPrompt, btnX + btnW / 2, btnY + btnH / 2);

        ctx.restore();
    }

    // ── Bottom Tactical Controls Reference Bar ─────────
    const footerY = h - 68;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#60d5ff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('NAVIGATE: [ ← / → ] or Direct Click   •   LAUNCH: [ SPACE / ENTER ] or [ 1 / 2 ]', w / 2, footerY);

    ctx.fillStyle = '#8899aa';
    ctx.font = '12px monospace';
    ctx.fillText('STRAFE ROLL: Double-Tap [A/D]   •   CANNON: [C]   •   MISSILE LOCK: [X]   •   FLARES: [Q]   •   QUIT: [ESC]', w / 2, footerY + 24);

    // Academic project credit
    ctx.fillStyle = '#475569';
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillText('TE INFT — Computer Graphics Project  •  Skyfall Evasion Newtonian Engine', w / 2, h - 16);
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

    // In Dogfight mode, show active hostile jets remaining under the timer pill
    if (state.gameMode === 'dogfight') {
        const aliveEnemies = state.enemies ? state.enemies.filter(e => e.alive).length : 0;
        ctx.save();
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = aliveEnemies > 0 ? '#ff3344' : '#22cc77';
        ctx.shadowColor = aliveEnemies > 0 ? '#ff2233' : '#22cc77';
        ctx.shadowBlur = 8;
        ctx.fillText(`HOSTILE JETS: ${aliveEnemies} / 2`, w / 2, pillY + pillH + 16);
        ctx.restore();
    }

    // ── Top-Left Tactical HUD Panel ─────────────────────
    const isDogfight = state.gameMode === 'dogfight';
    const panelX = 16;
    const panelY = 16;
    const panelW = 224;
    const panelH = isDogfight ? 190 : 140;

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

    // ── 2. Flare Charges (5 static icons) ───────────────
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

    // ── 3. Machine Gun Ammo UI (Single 500-round pool) ───
    const maxAmmo = CONFIG.maxAmmo || 500;
    const ammoCount = player.ammo !== undefined ? player.ammo : maxAmmo;

    // Header label & status row
    const gunLabelY = flareY + 24;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#c5d8ea';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('GUN AMMO', hudX, gunLabelY);

    ctx.textAlign = 'right';
    ctx.fillStyle = ammoCount > 100 ? '#ffffff' : (ammoCount > 0 ? '#ffaa22' : '#ff4444');
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`${ammoCount} / ${maxAmmo}`, hudX + hudW, gunLabelY);

    // Ammo Bar row
    const ammoBarY = gunLabelY + 18;
    const ammoBarH = 7;

    ctx.beginPath();
    ctx.roundRect(hudX, ammoBarY, hudW, ammoBarH, 3.5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fill();

    const ammoPct = Math.max(0, Math.min(1, ammoCount / maxAmmo));
    if (ammoPct > 0) {
        const fillW = Math.max(hudW * ammoPct, 3);
        ctx.save();
        const barColor = ammoCount > 100 ? '#ffdd44' : '#ff5533';
        ctx.shadowColor = barColor;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.roundRect(hudX, ammoBarY, fillW, ammoBarH, 3.5);
        ctx.fillStyle = barColor;
        ctx.fill();
        ctx.restore();
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(hudX, ammoBarY, hudW, ammoBarH, 3.5);
    ctx.stroke();

    // ── 4. Dogfight Missile Counter (Strict 6-missile limit) ─
    if (isDogfight) {
        const missileY = ammoBarY + ammoBarH + 14;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#c5d8ea';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('MISSILES [X]', hudX, missileY);

        ctx.textAlign = 'right';
        const mCount = player.missiles !== undefined ? player.missiles : 6;
        ctx.fillStyle = mCount > 0 ? '#60d5ff' : '#ff4444';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`${mCount} / 6`, hudX + hudW, missileY);

        // 6 pips
        const pipW = 26;
        const pipH = 5;
        const pipY = missileY + 16;
        for (let i = 0; i < 6; i++) {
            const hasMissile = i < mCount;
            const pipX = hudX + i * 32;

            ctx.fillStyle = hasMissile ? '#60d5ff' : 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(pipX, pipY, pipW, pipH);
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

    // ── Hard-Lock Reticle (Player Locking onto Enemy) ──
    drawLockOnReticle(ctx, player, w, h);

    // ── Radar Warning Receiver (RWR) Alert ─────────────
    drawRWRWarning(ctx, w, h, state);

    // ── Flight School Mode Overlay ─────────────────────
    if (state.gameMode === 'flightschool') {
        drawFlightSchoolHUD(ctx, w, h, state);
    }

    // ── Phase Transition UI Warnings ───────────────────
    if (state.phaseWarning && state.phaseWarning.timer > 0) {
        const warn = state.phaseWarning;
        const progress = Math.max(0, Math.min(1, warn.timer / warn.duration));

        ctx.save();
        ctx.globalAlpha = progress;

        const warnY = h * 0.40;

        // Dark background HUD banner
        ctx.fillStyle = 'rgba(8, 12, 22, 0.78)';
        ctx.fillRect(0, warnY - 48, w, 96);

        // Neon boundary lines top & bottom
        ctx.strokeStyle = warn.color || '#ff8800';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = warn.color || '#ff8800';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(0, warnY - 48);
        ctx.lineTo(w, warnY - 48);
        ctx.moveTo(0, warnY + 48);
        ctx.lineTo(w, warnY + 48);
        ctx.stroke();

        // Bold warning text in center
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 40px "Segoe UI", Arial, sans-serif';
        ctx.shadowColor = warn.color || '#ff8800';
        ctx.shadowBlur = 28;
        ctx.fillStyle = warn.color || '#ff8800';
        ctx.fillText(warn.text, w / 2, warnY - 10);

        // High-tech subtitle
        if (warn.subtext) {
            ctx.shadowBlur = 8;
            ctx.font = 'bold 14px monospace';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(warn.subtext, w / 2, warnY + 24);
        }

        ctx.restore();
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
        ctx.fillStyle = '#8899aa';
        ctx.font = '14px "Segoe UI", Arial, sans-serif';
        ctx.fillText('[ Press ESC to Quit to Menu ]', w / 2, h / 2 + 72);
    }
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

    // ── 1. Flares (yellow decoy dots) ───────────────────
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

    // ── 2. Missiles (color-coded by archetype) ──────────
    for (let i = 0; i < state.missiles.length; i++) {
        const m = state.missiles[i];
        if (!m.alive) continue;
        const pt = worldToMinimap(m.x, m.y, player.x, player.y, range, vx, vy, mw, mh);
        if (!pt.inBounds) continue;

        const def = CONFIG.missileTypes[m.type] || CONFIG.missileTypes.basic;
        const dotColor = def.hudDot || (m.type === 'interceptor' ? '#ff2233' : (m.type === 'heavy' ? '#ff8800' : '#94a3b8'));
        const dotRadius = m.type === 'heavy' ? 3.8 : (m.type === 'interceptor' ? 2.5 : 3.0);

        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        // High-threat ring for Interceptor
        if (m.type === 'interceptor') {
            ctx.strokeStyle = '#ff2233';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, dotRadius + 2.5, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // ── 5. Enemy AI Jets (Dogfight Mode - Red Diamonds) ─
    if (state.enemies && state.enemies.length > 0) {
        for (let i = 0; i < state.enemies.length; i++) {
            const e = state.enemies[i];
            if (!e.alive) continue;
            const pt = worldToMinimap(e.x, e.y, player.x, player.y, range, vx, vy, mw, mh);
            if (!pt.inBounds) continue;

            ctx.save();
            ctx.fillStyle = '#ff1133';
            ctx.shadowColor = '#ff1133';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y - 4.5);
            ctx.lineTo(pt.x + 4.5, pt.y);
            ctx.lineTo(pt.x, pt.y + 4.5);
            ctx.lineTo(pt.x - 4.5, pt.y);
            ctx.closePath();
            ctx.fill();

            // Heading indicator line
            ctx.strokeStyle = '#ff3355';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y);
            ctx.lineTo(pt.x + Math.cos(e.heading) * 8, pt.y + Math.sin(e.heading) * 8);
            ctx.stroke();
            ctx.restore();
        }
    }

    // ── 6. Player (white dot at center + heading line) ──
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
export function drawGameOverScreen(ctx, w, h, stats, state) {
    const isFlightSchool = state && state.gameMode === 'flightschool';
    const isVictory = (state && state.dogfightResult === 'victory') || (stats && stats.dogfightResult === 'victory');
    const isDogfight = (state && state.gameMode === 'dogfight') || isVictory;

    // Dark overlay
    ctx.fillStyle = isFlightSchool ? 'rgba(5, 18, 30, 0.90)' : (isVictory ? 'rgba(5, 20, 25, 0.90)' : 'rgba(10, 10, 30, 0.88)');
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (isFlightSchool) {
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 25;
        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 44px "Segoe UI", Arial, sans-serif';
        ctx.fillText('FLIGHT TRAINING DEBRIEF', w / 2, h * 0.23);
        ctx.shadowBlur = 0;

        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = '#60d5ff';
        ctx.fillText('Tactical Newtonian Flight Mechanics Completed', w / 2, h * 0.30);
    } else if (isVictory) {
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 30;
        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 46px "Segoe UI", Arial, sans-serif';
        ctx.fillText('VICTORY - AIRSPACE SECURED', w / 2, h * 0.23);
        ctx.shadowBlur = 0;

        ctx.font = 'bold 17px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#60d5ff';
        ctx.fillText('All Hostile AI Fighter Jets Destroyed', w / 2, h * 0.30);
    } else {
        // "GAME OVER"
        ctx.shadowColor = '#ff3344';
        ctx.shadowBlur = 25;
        ctx.fillStyle = '#ff4455';
        ctx.font = 'bold 48px "Segoe UI", Arial, sans-serif';
        ctx.fillText(isDogfight ? 'DEFEAT - SHOT DOWN' : 'GAME OVER', w / 2, h * 0.25);
        ctx.shadowBlur = 0;
    }

    // Stats
    let statLines;
    if (isFlightSchool) {
        const fs = state.flightSchool || {};
        const masteredCount = (fs.driftDone ? 1 : 0) + (fs.breakTurnDone ? 1 : 0) +
                              (fs.dashDone ? 1 : 0) + (fs.scissorsDone ? 1 : 0);
        statLines = [
            ['Flight Duration', formatTime(stats.timeSurvived)],
            ['Maneuvers Mastered', `${masteredCount} / 4 Drills Completed`],
            ['Scissors Reversals', `${fs.scissorsCount || 0} Alternating Cuts`],
            ['Practice Drones Hit', `${stats.enemiesDestroyed || 0} Targets`],
        ];
    } else if (isDogfight) {
        statLines = [
            ['Combat Duration', formatTime(stats.timeSurvived)],
            ['Hostiles Neutralized', isVictory ? '2 / 2 (100%)' : `${stats.enemiesDestroyed || 0} / 2`],
            ['Missiles Intercepted', String(stats.missilesDestroyed || 0)],
        ];
    } else {
        statLines = [
            ['Time Survived', formatTime(stats.timeSurvived)],
            ['Missiles Destroyed', String(stats.missilesDestroyed)],
            ['Near Misses', String(stats.nearMisses)],
        ];
    }

    const startY = h * 0.44;
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

    // Restart and menu prompts
    const pulse = 0.5 + Math.sin(Date.now() / 400) * 0.5;
    ctx.textAlign = 'center';
    ctx.fillStyle = (isVictory || isFlightSchool) ? `rgba(52, 211, 153, ${pulse})` : `rgba(96, 213, 255, ${pulse})`;
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.fillText(isFlightSchool ? '[ Press SPACE or 3 to Fly Again ]' : '[ Press SPACE or D to Play Again ]', w / 2, h * 0.76);

    ctx.fillStyle = '#8899aa';
    ctx.font = '15px "Segoe UI", Arial, sans-serif';
    ctx.fillText('[ Press ESC to Return to Menu ]', w / 2, h * 0.82);
}

/**
 * Render the Flight School HUD overlay:
 * 1. Tactical Flight Director with step-by-step instructions for Break Turn, Flat Scissors, and Drift.
 * 2. Maneuver checklist with completion checkboxes.
 * 3. Real-time Newtonian telemetry readout (G-Force, Sideslip Drift Angle, Airspeed).
 * 4. Animated maneuver completion notifications.
 * 
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {object} state
 */
export function drawFlightSchoolHUD(ctx, w, h, state) {
    const player = state.player;
    if (!player) return;
    const fs = state.flightSchool || {};

    ctx.save();

    // ── 1. Top Flight Director Instruction Banner ───────
    let currentTitle = '';
    let currentInstruction = '';
    let currentTarget = '';
    let accentColor = '#34d399';

    if (!fs.driftDone) {
        currentTitle = 'DRILL 1: AERODYNAMIC DRIFT';
        currentInstruction = 'Build cruise speed, then bank hard with [A] or [D]. Observe your velocity vector sliding sideways from your nose.';
        const driftDeg = (Math.abs(player.driftAngle || 0) * 180 / Math.PI).toFixed(1);
        currentTarget = `Target: Sideslip Angle > 18° at Speed > 180 px/s  (Current: ${driftDeg}°, Speed: ${Math.round(player.speed)})`;
        accentColor = '#38bdf8';
    } else if (!fs.breakTurnDone) {
        currentTitle = 'DRILL 2: HIGH-G BREAK TURN';
        currentInstruction = 'Hold [SHIFT] for Afterburner, then slam [A] or [D] into a maximum rate turn. Induced drag will bleed speed and whip your nose.';
        currentTarget = `Target: G-Force Load > 3.0 G  (Current: ${(player.gForce || 1.0).toFixed(1)} G)`;
        accentColor = '#f59e0b';
    } else if (!fs.dashDone) {
        currentTitle = 'DRILL 3: LATERAL STRAFE / DASH ROLL';
        currentInstruction = 'Double-tap [A] or [D] in rapid succession to fire lateral RCS vector thrusters and execute a 2D displacement roll.';
        currentTarget = 'Target: Double-Tap [A] (Port Roll) or [D] (Starboard Roll)';
        accentColor = '#a855f7';
    } else if (!fs.scissorsDone) {
        currentTitle = 'DRILL 4: FLAT SCISSORS REVERSAL';
        currentInstruction = 'Execute rapid alternating turns ([A] then [D]) to create a scissors deceleration pattern and force trailing hostiles to overshoot.';
        currentTarget = `Target: 3 Rapid Alternating Direction Reversals (Progress: ${fs.scissorsCount || 0} / 3)`;
        accentColor = '#ec4899';
    } else {
        currentTitle = '★ ALL MANEUVERS MASTERED — PILOT COMBAT READY';
        currentInstruction = 'Airspace is clear for free flight. Practice machine gunnery [C] or press [T] to spawn an unarmed practice drone.';
        currentTarget = 'Target: [T] Spawn Drone   •   [Y] Spawn Missile   •   [ESC] Exit';
        accentColor = '#10b981';
    }

    // Flight Director Banner Box
    const bannerW = 720;
    const bannerH = 76;
    const bannerX = w / 2 - bannerW / 2;
    const bannerY = 56;

    // Frosted glass background
    ctx.fillStyle = 'rgba(10, 18, 34, 0.82)';
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 10);
    ctx.fill();

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Director header
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '900 14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = accentColor;
    ctx.fillText(currentTitle, bannerX + 16, bannerY + 10);

    // Subtext instruction
    ctx.font = '12px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(currentInstruction, bannerX + 16, bannerY + 31);

    // Target requirement
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(currentTarget, bannerX + 16, bannerY + 52);

    // ── 2. Maneuver Checklist Panel (Top-Right) ─────────
    const panelW = 285;
    const panelH = 222;
    const panelX = w - panelW - 16;
    const panelY = 16;

    ctx.fillStyle = 'rgba(10, 18, 34, 0.82)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 10);
    ctx.fill();

    ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Checklist Title
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#34d399';
    ctx.fillText('FLIGHT SCHOOL CHECKLIST', panelX + 14, panelY + 12);

    const checklist = [
        { label: 'Aerodynamic Drift', done: fs.driftDone, key: 'Bank at Cruise Speed' },
        { label: 'High-G Break Turn', done: fs.breakTurnDone, key: '[SHIFT] + [A/D]' },
        { label: 'Lateral Dash Roll', done: fs.dashDone, key: 'Double-Tap [A/D]' },
        { label: 'Flat Scissors (3x)', done: fs.scissorsDone, key: `${fs.scissorsCount || 0}/3 Reversals` },
    ];

    const checkStartY = panelY + 32;
    const itemH = 33;

    for (let i = 0; i < checklist.length; i++) {
        const item = checklist[i];
        const itemY = checkStartY + i * itemH;

        // Checkbox icon
        ctx.fillStyle = item.done ? '#10b981' : 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(panelX + 14, itemY + 2, 16, 16, 4);
        ctx.fill();
        ctx.strokeStyle = item.done ? '#10b981' : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (item.done) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('✓', panelX + 22, itemY + 14);
            ctx.textAlign = 'left';
        }

        // Maneuver name
        ctx.font = item.done ? '12px "Segoe UI", Arial, sans-serif' : 'bold 12px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = item.done ? '#6ee7b7' : '#ffffff';
        ctx.fillText(item.label, panelX + 38, itemY + 4);

        // Key prompt / subtext
        ctx.font = '10px monospace';
        ctx.fillStyle = item.done ? '#10b981' : '#94a3b8';
        ctx.fillText(item.done ? 'MASTERED ✓' : item.key, panelX + 38, itemY + 18);
    }

    // Vector Legend in checklist panel
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#22c55e';
    ctx.fillText('🟢 NOSE HEADING', panelX + 14, panelY + panelH - 34);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('🔵 VELOCITY VECTOR', panelX + 135, panelY + panelH - 34);

    // Interactive Action Prompts
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#60d5ff';
    ctx.fillText('[T] DRONE   [Y] MISSILE   [ESC] MENU', panelX + 14, panelY + panelH - 14);

    // ── 3. Real-Time Telemetry Box (Above Speedometer) ──
    const telemX = 16;
    const telemY = h - 225;
    const telemW = 165;
    const telemH = 68;

    ctx.fillStyle = 'rgba(10, 18, 34, 0.82)';
    ctx.beginPath();
    ctx.roundRect(telemX, telemY, telemW, telemH, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(96, 213, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('NEWTONIAN TELEMETRY', telemX + 10, telemY + 8);

    ctx.font = '11px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`G-FORCE : ${(player.gForce || 1.0).toFixed(1)} G`, telemX + 10, telemY + 26);

    const driftDeg = (player.driftAngle * 180 / Math.PI).toFixed(1);
    ctx.fillStyle = Math.abs(player.driftAngle) > 0.25 ? '#38bdf8' : '#ffffff';
    ctx.fillText(`SIDESLIP: ${driftDeg}° β`, telemX + 10, telemY + 42);

    ctx.fillStyle = player.dashCooldown <= 0 ? '#34d399' : '#f59e0b';
    ctx.fillText(`STRAFE  : ${player.dashCooldown <= 0 ? 'READY' : 'COOLDOWN'}`, telemX + 10, telemY + 58);

    // ── 4. Maneuver Success Feedback Flash Banner ───────
    if (fs.feedbackTimer > 0) {
        const alpha = Math.min(1, fs.feedbackTimer);
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const fbY = h * 0.28;
        ctx.fillStyle = 'rgba(6, 78, 59, 0.94)';
        ctx.beginPath();
        ctx.roundRect(w / 2 - 240, fbY - 24, 480, 48, 8);
        ctx.fill();

        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 16;
        ctx.stroke();

        ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`✓ ${fs.feedbackMessage}`, w / 2, fbY);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
    }

    ctx.restore();
}

/**
 * Render dynamic Hard-Lock reticle over targeted enemy jet.
 * Box starts Grey, shrinks and turns Yellow during the 0.5s timer,
 * and turns solid Red when lock is complete and ready to fire.
 * 
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} player
 * @param {number} w
 * @param {number} h
 */
export function drawLockOnReticle(ctx, player, w, h) {
    if (!player || !player.isLocking || !player.lockedTarget || !player.lockedTarget.alive) return;

    const sp = worldToScreen(player.lockedTarget.x, player.lockedTarget.y, w, h);
    // Normalized progress p in [0, 1]
    const p = Math.max(0, Math.min(1, player.lockTimer / player.lockDuration));

    // Target box starts at 64px, shrinks down to 32px over the 0.5s duration
    const boxSize = 64 - 32 * p;
    const half = boxSize / 2;

    // Color transition:
    // Starts Grey at 0, turns Yellow during [0, 1), turns solid Red when lock is complete (p >= 1)
    let boxColor;
    if (p <= 0.01) {
        boxColor = '#94a3b8'; // Grey
    } else if (p < 1.0) {
        boxColor = '#facc15'; // Yellow
    } else {
        boxColor = '#ef4444'; // Solid Red
    }

    ctx.save();
    ctx.lineWidth = p >= 1 ? 2.5 : 2.0;
    ctx.strokeStyle = boxColor;
    ctx.shadowColor = boxColor;
    ctx.shadowBlur = p >= 1 ? 14 : (p > 0 ? 8 : 0);

    // 1. Four High-Tech Corner Brackets
    const bracketLen = boxSize * 0.28;
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(sp.x - half, sp.y - half + bracketLen);
    ctx.lineTo(sp.x - half, sp.y - half);
    ctx.lineTo(sp.x - half + bracketLen, sp.y - half);
    // Top-Right
    ctx.moveTo(sp.x + half - bracketLen, sp.y - half);
    ctx.lineTo(sp.x + half, sp.y - half);
    ctx.lineTo(sp.x + half, sp.y - half + bracketLen);
    // Bottom-Right
    ctx.moveTo(sp.x + half, sp.y + half - bracketLen);
    ctx.lineTo(sp.x + half, sp.y + half);
    ctx.lineTo(sp.x + half - bracketLen, sp.y + half);
    // Bottom-Left
    ctx.moveTo(sp.x - half + bracketLen, sp.y + half);
    ctx.lineTo(sp.x - half, sp.y + half);
    ctx.lineTo(sp.x - half, sp.y + half - bracketLen);
    ctx.stroke();

    // 2. Target Box Full Outline
    ctx.strokeRect(sp.x - half, sp.y - half, boxSize, boxSize);

    // 3. Radial Lock-Progress Arc
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, half + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    ctx.stroke();

    // 4. Center Crosshairs Dot
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = boxColor;
    ctx.fill();

    // 5. Reticle Status Readout
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = boxColor;
    const label = p >= 1.0 ? 'LOCK SOLID [READY]' : `LOCKING ${(p * 100).toFixed(0)}%`;
    ctx.fillText(label, sp.x, sp.y + half + 14);

    ctx.restore();
}

/**
 * Radar Warning Receiver (RWR):
 * When an enemy AI starts its 2.5s lock-on timer against the player,
 * render a large, flashing "MISSILE LOCK DETECTED" warning in the center of the player's screen.
 * 
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {object} state
 */
export function drawRWRWarning(ctx, w, h, state) {
    if (!state.enemies || state.enemies.length === 0) return;
    const hasLock = state.enemies.some(e => e.alive && e.lockTimer > 0);
    if (!hasLock) return;

    ctx.save();
    // Rapid flashing strobe effect
    const flash = Math.sin(Date.now() / 85) > 0;
    const bannerY = h * 0.32;
    const bannerW = 580;
    const bannerH = 72;

    // Dark red tactical overlay banner in center of screen
    ctx.fillStyle = 'rgba(28, 6, 12, 0.88)';
    ctx.fillRect(w / 2 - bannerW / 2, bannerY - bannerH / 2, bannerW, bannerH);

    // Neon red warning perimeter lines
    ctx.strokeStyle = flash ? '#ff0033' : '#aa1122';
    ctx.lineWidth = flash ? 3 : 2;
    ctx.shadowColor = '#ff0033';
    ctx.shadowBlur = flash ? 24 : 8;
    ctx.strokeRect(w / 2 - bannerW / 2, bannerY - bannerH / 2, bannerW, bannerH);

    // Large Bold Warning Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 32px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = flash ? '#ff1744' : '#ffffff';
    ctx.shadowBlur = flash ? 20 : 6;
    ctx.fillText('MISSILE LOCK DETECTED', w / 2, bannerY - 8);

    // Subtext instruction
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#ff8899';
    ctx.shadowBlur = 0;
    ctx.fillText('RADAR WARNING RECEIVER — EVADE OR POP FLARES [Q]', w / 2, bannerY + 20);

    ctx.restore();
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
    if (player.rollTimer > 0) {
        badgeText = 'STRAFE ROLL';
        badgeColor = '#a855f7';
    } else if (player.boosting) {
        badgeText = 'AFTERBURNER';
        badgeColor = '#ff7700';
    } else if (Math.abs(player.driftAngle || 0) > 0.22) {
        badgeText = 'AERO DRIFT';
        badgeColor = '#38bdf8';
    } else if (player.isTurning) {
        badgeText = 'G-DRAG';
        badgeColor = '#ffbb22';
    }

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = badgeColor;
    ctx.fillText(badgeText, cx, cy - r - 22);

    // Dynamic sideslip drift angle readout below dial
    const driftDeg = (Math.abs(player.driftAngle || 0) * 180 / Math.PI).toFixed(0);
    ctx.font = '10px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`DRIFT ${driftDeg}°`, cx, cy + r + 22);

    ctx.restore();
}
