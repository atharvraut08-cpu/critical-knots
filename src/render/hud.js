/**
 * hud.js — HUD, title screen, game-over screen, and 4-Team Tactical Combat HUD
 * 
 * Renders all UI overlays:
 * - Single-player survival & free-flight HUD
 * - 4-Team Multiplayer Combat HUD (scores, radar, lock-on reticle, ordnance)
 * - Health & Shield status displays
 * - Wing-mounted missile readiness
 * - Live Kill Feed
 * - Tab Tactical Scoreboard
 */

import { CONFIG } from '../config.js?v=2.3';
import { clamp } from '../utils/math.js?v=2.3';
import { worldToScreen } from '../camera.js?v=2.3';

export const TEAM_COLORS = [
    { name: 'Crimson', main: '#ff3b30', dark: '#801814', glow: 'rgba(255, 59, 48, 0.4)' },
    { name: 'Cobalt',  main: '#007aff', dark: '#0d4077', glow: 'rgba(0, 122, 255, 0.4)' },
    { name: 'Emerald', main: '#34c759', dark: '#146328', glow: 'rgba(52, 199, 89, 0.4)' },
    { name: 'Solar',   main: '#ff9500', dark: '#8a4e00', glow: 'rgba(255, 149, 0, 0.4)' },
];

export function drawTitleScreen(ctx, w, h, state) {
    ctx.fillStyle = 'rgba(10, 10, 30, 0.85)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = '#60d5ff';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#60d5ff';
    ctx.font = 'bold 54px "Segoe UI", Arial, sans-serif';
    ctx.fillText('SKYFALL EVASION', w / 2, h * 0.19);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#aaccee';
    ctx.font = '17px "Segoe UI", Arial, sans-serif';
    ctx.fillText('A 2D Missile Survival Arcade Game', w / 2, h * 0.255);

    const pulse = 0.6 + Math.sin(Date.now() / 400) * 0.4;
    ctx.fillStyle = `rgba(96, 213, 255, ${pulse})`;
    ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    ctx.fillText('[ Press SPACE to Start Game ]', w / 2, h * 0.36);

    ctx.fillStyle = '#8899aa';
    ctx.font = '13px monospace';
    const controls = [
        ['← / A', 'Bank Left (Induces Drag)'],
        ['→ / D', 'Bank Right (Induces Drag)'],
        ['SHIFT (hold)', 'Speed Boost / Afterburner'],
        ['C / L-CLICK', 'Fire 20mm Machine Gun'],
        ['F / R-CLICK', 'Fire Wing-Mounted Missile'],
        ['Q', 'Deploy Flare Decoys'],
        ['E', 'Trigger EMP Shockwave'],
        ['TAB (hold)', 'Squadron Tactical Scoreboard'],
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

    ctx.textAlign = 'center';
    ctx.fillStyle = '#556677';
    ctx.font = '12px "Segoe UI", Arial, sans-serif';
    ctx.fillText('TE INFT — Computer Graphics Project', w / 2, h * 0.94);
}

/**
 * Draw in-game HUD for Single-Player survival mode.
 */
export function drawHUD(ctx, w, h, state) {
    const player = state.player;
    if (!player) return;

    const margin = 20;

    // Timer
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#60d5ff';
    ctx.font = 'bold 28px monospace';
    const mins = Math.floor(state.timeAlive / 60);
    const secs = Math.floor(state.timeAlive % 60);
    const ms = Math.floor((state.timeAlive % 1) * 100);
    const timerStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
    ctx.fillText(timerStr, w / 2, margin);

    // Fuel Bar
    const barW = 180;
    const barH = 12;
    const barX = margin;
    const barY = margin + 20;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(barX, barY, barW, barH);
    const fuelFrac = player.fuel / player.maxFuel;
    ctx.fillStyle = fuelFrac > 0.4 ? '#34c759' : fuelFrac > 0.2 ? '#ff9500' : '#ff3b30';
    ctx.fillRect(barX, barY, barW * fuelFrac, barH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`FUEL: ${Math.round(player.fuel)}%`, barX, barY - 14);

    // Charges (Flares & EMP)
    const chargeY = barY + barH + 16;
    ctx.fillText(`FLARES [Q]: ${player.flares}/${CONFIG.maxFlares}`, margin, chargeY);
    ctx.fillText(`EMP [E]: ${player.emp}/${CONFIG.maxEmp}`, margin, chargeY + 18);
    ctx.fillText(`GUN AMMO [C]: ${player.ammoInMag} (MAGS: ${player.magsRemaining})`, margin, chargeY + 36);

    // Audio Mute Indicator
    ctx.save();
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = state.isMuted ? '#ff9500' : '#64748b';
    ctx.fillText(`[M] AUDIO: ${state.isMuted ? 'MUTED' : 'ON'}`, w - margin, margin + 14);
    ctx.restore();
}

/**
 * Draw 4-Team Multiplayer Combat HUD:
 * - 4 Team score cards at the top
 * - Lock-on seeker reticle over targeted enemy
 * - Cockpit health, shield, and wing missile ordnance rack
 * - 360° Team radar / minimap
 * - Kill feed
 * - Full tactical scoreboard (when Tab is held)
 */
export function drawMultiplayerHUD(ctx, w, h, state, input) {
    const player = state.player;
    if (!player) return;

    // ── Victory / Match Ended Screen ────────────────────
    if (state.matchEnded) {
        drawVictoryScreen(ctx, w, h, state);
        return;
    }

    // ── 1. Tactical 4-Team Header Banner ────────────────
    drawTeamScoreHeader(ctx, w, state);

    // ── 2. Target Lock-On Seeker Reticle ────────────────
    drawTargetLockReticle(ctx, state);

    // ── 3. Cockpit Ordnance & Status (Bottom Left) ──────
    drawCockpitStatus(ctx, player, h);

    // ── 4. Tactical Radar / Minimap (Bottom Right) ──────
    drawTacticalRadar(ctx, w, h, state);

    // ── 5. Live Kill Feed (Top Right) ───────────────────
    drawKillFeed(ctx, w, state);

    // ── 6. Full Tactical Scoreboard (Held TAB) ──────────
    if (input && input.scoreboard) {
        drawScoreboard(ctx, w, h, state);
    }

    // ── 7. Audio Mute Indicator ─────────────────────────
    ctx.save();
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = state.isMuted ? '#ff9500' : '#64748b';
    ctx.fillText(`[M] AUDIO: ${state.isMuted ? 'MUTED' : 'ON'}`, w - 24, 76);
    ctx.restore();
}

function drawTeamScoreHeader(ctx, w, state) {
    const teamNames = state.roomData ? state.roomData.teamNames : ['Crimson', 'Cobalt', 'Emerald', 'Solar'];
    const teamScores = state.teamScores || [0, 0, 0, 0];
    const cardW = 140;
    const cardH = 46;
    const gap = 12;
    const totalW = cardW * 4 + gap * 3;
    const startX = (w - totalW) / 2;
    const startY = 14;

    const allPlayers = [state.player, ...(state.remotePlayers || [])];

    for (let t = 0; t < 4; t++) {
        const x = startX + t * (cardW + gap);
        const style = TEAM_COLORS[t];
        const isMyTeam = state.player && state.player.team === t;
        const livingCount = allPlayers.filter(p => p.team === t && p.alive).length;

        // Card background
        ctx.fillStyle = isMyTeam ? 'rgba(30, 41, 59, 0.9)' : 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(x, startY, cardW, cardH);

        // Top team color stripe
        ctx.fillStyle = style.main;
        ctx.fillRect(x, startY, cardW, 3);

        if (isMyTeam) {
            ctx.strokeStyle = style.main;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x, startY, cardW, cardH);
        }

        // Team Name & Score
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = style.main;
        const displayName = teamNames[t] ? teamNames[t].substring(0, 14) : `Team ${t + 1}`;
        ctx.fillText(displayName, x + 8, startY + 8);

        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${teamScores[t]} PTS`, x + 8, startY + 22);

        // Living member pips (3 dots)
        for (let dot = 0; dot < 3; dot++) {
            ctx.beginPath();
            ctx.arc(x + cardW - 12 - dot * 10, startY + 28, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = dot < livingCount ? style.main : 'rgba(255, 255, 255, 0.15)';
            ctx.fill();
        }
    }
}

function drawTargetLockReticle(ctx, state) {
    const player = state.player;
    if (!player || !player.lockTargetId) return;

    const allTargets = state.remotePlayers || [];
    const target = allTargets.find(t => t.id === player.lockTargetId && t.alive);
    if (!target) return;

    const screenPos = worldToScreen(target.x, target.y);
    const boxSize = 56;
    const progress = player.lockProgress || 0;
    const isLocked = progress >= 1.0;

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);

    const reticleColor = isLocked ? '#ff3b30' : '#ff9500';
    ctx.strokeStyle = reticleColor;
    ctx.lineWidth = 2;

    // Corner brackets
    const bLen = 12;
    const half = boxSize / 2;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(-half, -half + bLen);
    ctx.lineTo(-half, -half);
    ctx.lineTo(-half + bLen, -half);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(half - bLen, -half);
    ctx.lineTo(half, -half);
    ctx.lineTo(half, -half + bLen);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(-half, half - bLen);
    ctx.lineTo(-half, half);
    ctx.lineTo(-half + bLen, half);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(half - bLen, half);
    ctx.lineTo(half, half);
    ctx.lineTo(half, half - bLen);
    ctx.stroke();

    // Rotary lock indicator
    ctx.beginPath();
    ctx.arc(0, 0, boxSize * 0.7, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.strokeStyle = isLocked ? '#ff3b30' : '#60d5ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Status Text
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = reticleColor;
    if (isLocked) {
        ctx.fillText('► HARD LOCK — [F] / [R-CLICK] ◄', 0, half + 16);
    } else {
        ctx.fillText(`SEEKING... ${Math.round(progress * 100)}%`, 0, half + 16);
    }

    ctx.restore();
}

function drawCockpitStatus(ctx, player, h) {
    const startX = 24;
    const startY = h - 140;

    // Health Bar
    const barW = 220;
    const barH = 14;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(startX, startY, barW, barH);

    const hpFrac = clamp(player.health / player.maxHealth, 0, 1);
    const hpColor = hpFrac > 0.5 ? '#34c759' : hpFrac > 0.25 ? '#ff9500' : '#ff3b30';
    ctx.fillStyle = hpColor;
    ctx.fillRect(startX, startY, barW * hpFrac, barH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.strokeRect(startX, startY, barW, barH);

    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`HULL INTEGRITY: ${Math.round(player.health)} / 100 HP`, startX, startY - 6);

    // Shield Bar (if any)
    if (player.shield > 0) {
        const shieldFrac = clamp(player.shield / player.maxShield, 0, 1);
        ctx.fillStyle = '#00c6ff';
        ctx.fillRect(startX, startY + barH + 4, barW * shieldFrac, 6);
        ctx.fillText(`KINETIC SHIELD: ${Math.round(player.shield)}`, startX + barW + 10, startY + barH + 10);
    }

    // Wing Missiles Readiness Rack
    const missileY = startY + 36;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('WING MISSILE PYLONS:', startX, missileY);

    for (let m = 0; m < 2; m++) {
        const mX = startX + 160 + m * 24;
        const ready = player.missilesReady > m;
        ctx.fillStyle = ready ? '#ff9500' : '#334155';
        ctx.fillRect(mX, missileY - 12, 16, 14);
        ctx.strokeStyle = ready ? '#ffffff' : '#64748b';
        ctx.strokeRect(mX, missileY - 12, 16, 14);
    }

    ctx.fillStyle = player.missilesReady > 0 ? '#ff9500' : '#64748b';
    ctx.fillText(`[F] / [R-CLICK] TO FIRE (${player.missilesReady} READY)`, startX, missileY + 18);

    // Guns and Flares
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`20MM GUN [C / L-CLICK]: ${player.ammoInMag} RDS`, startX, missileY + 36);
    ctx.fillText(`FLARE DECOYS [Q]: ${player.flares} | EMP PULSE [E]: ${player.emp}`, startX, missileY + 54);
}

function drawTacticalRadar(ctx, w, h, state) {
    const radarRadius = 80;
    const cx = w - radarRadius - 24;
    const cy = h - radarRadius - 24;
    const worldRange = 2400; // max radar distance

    ctx.save();
    // Circular radar panel
    ctx.beginPath();
    ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 15, 28, 0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(96, 213, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Range rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(cx, cy, radarRadius * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    // Radar rotating sweep line
    const sweep = (Date.now() / 1000) * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweep) * radarRadius, cy + Math.sin(sweep) * radarRadius);
    ctx.strokeStyle = 'rgba(96, 213, 255, 0.25)';
    ctx.stroke();

    const player = state.player;
    if (!player) {
        ctx.restore();
        return;
    }

    // Local player in center (White triangle facing up)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5);
    ctx.lineTo(cx - 4, cy + 4);
    ctx.lineTo(cx + 4, cy + 4);
    ctx.closePath();
    ctx.fill();

    // Health Kits on Radar
    if (state.pickups) {
        for (const pk of state.pickups) {
            if (!pk.alive) continue;
            const dx = pk.x - player.x;
            const dy = pk.y - player.y;
            const dist = Math.hypot(dx, dy);
            if (dist < worldRange) {
                const rx = cx + (dx / worldRange) * radarRadius;
                const ry = cy + (dy / worldRange) * radarRadius;
                ctx.fillStyle = pk.type === 'health' ? '#34c759' : '#007aff';
                ctx.fillRect(rx - 2, ry - 2, 4, 4);
            }
        }
    }

    // Remote Players / Jets
    const allRemotes = state.remotePlayers || [];
    for (const other of allRemotes) {
        if (!other.alive) continue;
        const dx = other.x - player.x;
        const dy = other.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist < worldRange) {
            const rx = cx + (dx / worldRange) * radarRadius;
            const ry = cy + (dy / worldRange) * radarRadius;
            const style = TEAM_COLORS[other.team % 4] || TEAM_COLORS[0];
            ctx.fillStyle = style.main;
            ctx.beginPath();
            ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}

function drawKillFeed(ctx, w, state) {
    const feed = state.killFeed || [];
    const startX = w - 24;
    const startY = 68;
    const lineH = 26;

    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';

    const recent = feed.slice(-5);
    for (let i = 0; i < recent.length; i++) {
        const item = recent[i];
        const y = startY + i * lineH;
        const killerTeam = TEAM_COLORS[item.killerTeam % 4] || TEAM_COLORS[0];
        const victimTeam = TEAM_COLORS[item.targetTeam % 4] || TEAM_COLORS[0];

        // Background pill
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.fillRect(startX - 260, y - 14, 260, 22);

        // Killer name
        ctx.fillStyle = killerTeam.main;
        const text = `${item.killerName} ──[${item.weapon}]──> `;
        ctx.fillText(text, startX - 70, y);

        // Victim name
        ctx.fillStyle = victimTeam.main;
        ctx.fillText(item.targetName, startX - 10, y);
    }
    ctx.restore();
}

function drawScoreboard(ctx, w, h, state) {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 30, 0.88)';
    ctx.fillRect(0, 0, w, h);

    const tableW = 860;
    const startX = (w - tableW) / 2;
    const startY = 80;

    ctx.textAlign = 'center';
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#60d5ff';
    ctx.fillText('SQUADRON COMBAT SCOREBOARD [TAB]', w / 2, startY);

    const allPlayers = [state.player, ...(state.remotePlayers || [])];
    const teamNames = state.roomData ? state.roomData.teamNames : ['Crimson', 'Cobalt', 'Emerald', 'Solar'];

    let currY = startY + 40;

    for (let t = 0; t < 4; t++) {
        const style = TEAM_COLORS[t];
        const teamPlayers = allPlayers.filter(p => p.team === t);
        const teamScore = state.teamScores ? state.teamScores[t] : 0;

        // Team Header
        ctx.fillStyle = style.dark;
        ctx.fillRect(startX, currY, tableW, 28);
        ctx.fillStyle = style.main;
        ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`TEAM ${t + 1}: ${teamNames[t]} (${teamScore} PTS)`, startX + 16, currY + 19);

        currY += 32;

        // Pilot Rows
        ctx.font = '12px monospace';
        for (const p of teamPlayers) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(startX, currY, tableW, 24);

            ctx.fillStyle = p.alive ? '#ffffff' : '#64748b';
            ctx.fillText(p.name + (p.isBot ? ' [BOT]' : '') + (p.id === state.player.id ? ' (YOU)' : ''), startX + 24, currY + 16);

            ctx.textAlign = 'right';
            ctx.fillText(p.alive ? 'ACTIVE' : 'DOWNED', startX + 400, currY + 16);
            ctx.fillText(`KILLS: ${p.kills || 0}`, startX + 540, currY + 16);
            ctx.fillText(`DEATHS: ${p.deaths || 0}`, startX + 680, currY + 16);
            ctx.fillText(`SCORE: ${p.score || 0}`, startX + 820, currY + 16);
            ctx.textAlign = 'left';

            currY += 26;
        }

        currY += 12;
    }

    ctx.restore();
}

export function drawGameOverScreen(ctx, w, h, state) {
    ctx.fillStyle = 'rgba(10, 10, 30, 0.9)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = '#ff3344';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#ff3344';
    ctx.font = 'bold 44px "Segoe UI", Arial, sans-serif';
    ctx.fillText('AIRCRAFT DESTROYED', w / 2, h * 0.28);
    ctx.shadowBlur = 0;

    const pulse = 0.6 + Math.sin(Date.now() / 400) * 0.4;
    ctx.fillStyle = `rgba(96, 213, 255, ${pulse})`;
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.fillText('[ Press SPACE or R to Restart ]', w / 2, h * 0.68);
}

export function drawVictoryScreen(ctx, w, h, state) {
    const endData = state.matchEndData || {
        winnerTeam: 0,
        winnerTeamName: 'Crimson Vanguard',
        winnerColor: '#ff3b30',
        teamScores: [500, 320, 210, 150],
        players: [],
    };

    ctx.save();
    // Backdrop blur / overlay
    ctx.fillStyle = 'rgba(6, 11, 25, 0.88)';
    ctx.fillRect(0, 0, w, h);

    const winnerColor = endData.winnerColor || TEAM_COLORS[endData.winnerTeam]?.main || '#ff3b30';

    // Ambient radial glow behind banner
    const glowGrad = ctx.createRadialGradient(w / 2, h * 0.32, 20, w / 2, h * 0.32, 450);
    glowGrad.addColorStop(0, winnerColor + '55');
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, h);

    // Modal Box
    const boxW = Math.min(840, w - 80);
    const boxH = Math.min(560, h - 80);
    const boxX = (w - boxW) / 2;
    const boxY = (h - boxH) / 2;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = winnerColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(boxX, boxY, boxW, boxH, 16);
    } else {
        ctx.rect(boxX, boxY, boxW, boxH);
    }
    ctx.fill();
    ctx.stroke();

    // Crown / Star Trophy icon
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '32px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('★ ★ ★', w / 2, boxY + 45);

    // Big Victory Title
    ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = winnerColor;
    ctx.shadowColor = winnerColor;
    ctx.shadowBlur = 20;
    ctx.fillText('AIRSPACE CONQUERED', w / 2, boxY + 90);
    ctx.shadowBlur = 0;

    // Subtitle with winner name
    ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${(endData.winnerTeamName || 'VICTORY').toUpperCase()} CLAIMS THE SKIES!`, w / 2, boxY + 128);

    // Top Ace / MVP calculation
    const allPlayers = endData.players && endData.players.length > 0
        ? endData.players
        : [state.player, ...(state.remotePlayers || [])].filter(Boolean);
    const mvp = allPlayers.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];

    if (mvp) {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
        ctx.lineWidth = 1;
        const mvpW = 420;
        const mvpX = (w - mvpW) / 2;
        const mvpY = boxY + 155;
        ctx.fillRect(mvpX, mvpY, mvpW, 36);
        ctx.strokeRect(mvpX, mvpY, mvpW, 36);

        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`TOP ACE MVP: ${mvp.name || 'Pilot'} — ${mvp.kills || 0} KILLS | ${mvp.score || 0} PTS`, w / 2, mvpY + 18);
    }

    // 4 Team Standings Cards
    const cardW = (boxW - 60) / 4;
    const cardY = boxY + 215;
    const teamScores = endData.teamScores || [0, 0, 0, 0];
    const teamIndices = [0, 1, 2, 3].sort((a, b) => teamScores[b] - teamScores[a]);

    for (let rank = 0; rank < 4; rank++) {
        const t = teamIndices[rank];
        const cardX = boxX + 20 + rank * (cardW + 5);
        const col = TEAM_COLORS[t];

        ctx.fillStyle = t === endData.winnerTeam ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.7)';
        ctx.fillRect(cardX, cardY, cardW - 10, 140);
        ctx.strokeStyle = col.main;
        ctx.lineWidth = t === endData.winnerTeam ? 2 : 1;
        ctx.strokeRect(cardX, cardY, cardW - 10, 140);

        // Rank Badge
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = rank === 0 ? '#ffd700' : rank === 1 ? '#e2e8f0' : '#94a3b8';
        ctx.fillText(`#${rank + 1} PLACE`, cardX + (cardW - 10) / 2, cardY + 22);

        // Team Name
        ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = col.main;
        const tName = state.roomData?.teamNames?.[t] || col.name;
        ctx.fillText(tName.substring(0, 14), cardX + (cardW - 10) / 2, cardY + 52);

        // Score
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${teamScores[t]}`, cardX + (cardW - 10) / 2, cardY + 92);
        ctx.font = '10px monospace';
        ctx.fillStyle = '#64748b';
        ctx.fillText('POINTS', cardX + (cardW - 10) / 2, cardY + 112);
    }

    // Call to action button: Return to Lobby
    const btnW = 320;
    const btnH = 46;
    const btnX = (w - btnW) / 2;
    const btnY = boxY + boxH - 72;

    const pulse = 0.85 + Math.sin(Date.now() / 250) * 0.15;
    ctx.fillStyle = winnerColor;
    ctx.globalAlpha = pulse;
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.globalAlpha = 1.0;

    ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('RETURN TO HANGAR LOBBY', w / 2, btnY + 23);

    ctx.font = '11px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('[ Press SPACE or Click Anywhere to Exit ]', w / 2, btnY + 62);

    ctx.restore();
}
