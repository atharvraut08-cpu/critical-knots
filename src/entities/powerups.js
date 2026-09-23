/**
 * powerups.js — Collectible Health Kits (+50 HP) and Tactical Boost Crates
 * 
 * Items:
 * - Health Kit: +50 HP restoration (nanotech field)
 * - Shield Pod: +50 Energy Shield buffer
 * - Missile Pod: Restocks wing-mounted air-to-air missiles (+2)
 * - Boost Pod: Nitro afterburner supercharge
 */

import { emit } from './particle.js';

export function createPowerup({ id, type, x, y, amount = 50 }) {
    return {
        id,
        type, // 'health' | 'shield' | 'missile' | 'boost'
        x,
        y,
        radius: 20,
        amount,
        alive: true,
        age: Math.random() * 5,
        sparkleTimer: 0,
    };
}

export function updatePowerup(powerup, dt) {
    if (!powerup.alive) return;
    powerup.age += dt;

    // Ambient sparkles
    powerup.sparkleTimer -= dt;
    if (powerup.sparkleTimer <= 0) {
        powerup.sparkleTimer = 0.08;
        const color = powerup.type === 'health' ? '#34c759'
            : powerup.type === 'shield' ? '#007aff'
            : powerup.type === 'missile' ? '#ff9500'
            : '#af52de';

        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 22;
        emit({
            x: powerup.x + Math.cos(angle) * dist,
            y: powerup.y + Math.sin(angle) * dist,
            vx: (Math.random() - 0.5) * 15,
            vy: -15 - Math.random() * 15,
            radius: 1.8,
            color,
            lifeMax: 0.45,
        });
    }
}

export function drawPowerup(powerup, ctx, screenPos) {
    if (!powerup.alive) return;

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);

    // Floating bobbing motion
    const bob = Math.sin(powerup.age * 3) * 4;
    ctx.translate(0, bob);

    const r = powerup.radius;
    const pulse = 1 + Math.sin(powerup.age * 4.5) * 0.12;

    let mainColor = '#34c759'; // Health green
    let glowColor = 'rgba(52, 199, 89, 0.25)';
    let label = '+50 HP';

    if (powerup.type === 'shield') {
        mainColor = '#007aff';
        glowColor = 'rgba(0, 122, 255, 0.25)';
        label = 'SHIELD';
    } else if (powerup.type === 'missile') {
        mainColor = '#ff9500';
        glowColor = 'rgba(255, 149, 0, 0.25)';
        label = 'MISSILE';
    } else if (powerup.type === 'boost') {
        mainColor = '#af52de';
        glowColor = 'rgba(175, 82, 222, 0.25)';
        label = 'NITRO';
    }

    // ── Outer Volumetric Glow ───────────────────────────────
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.8 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = glowColor;
    ctx.fill();

    // ── Rotating Radar Ring ─────────────────────────────────
    ctx.save();
    ctx.rotate(powerup.age * 1.5);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2);
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.restore();

    // ── Core Hexagonal / Circular Container ─────────────────
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // ── Tactical Icon Inside ────────────────────────────────
    if (powerup.type === 'health') {
        // Medical 3D Cross (+50 HP)
        ctx.fillStyle = '#34c759';
        const crossW = 6;
        const crossL = 18;
        // Vertical bar
        ctx.fillRect(-crossW / 2, -crossL / 2, crossW, crossL);
        // Horizontal bar
        ctx.fillRect(-crossL / 2, -crossW / 2, crossL, crossW);

        // Highlight
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-crossW / 4, -crossL / 4, crossW / 2, crossL / 2);
    } else if (powerup.type === 'shield') {
        // Shield Emblem
        ctx.strokeStyle = '#007aff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(8, -4);
        ctx.lineTo(6, 6);
        ctx.lineTo(0, 10);
        ctx.lineTo(-6, 6);
        ctx.lineTo(-8, -4);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 122, 255, 0.4)';
        ctx.fill();
    } else if (powerup.type === 'missile') {
        // Dual Missile Chevron
        ctx.fillStyle = '#ff9500';
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(7, 6);
        ctx.lineTo(0, 3);
        ctx.lineTo(-7, 6);
        ctx.closePath();
        ctx.fill();
    } else {
        // Lightning Bolt for Nitro Boost
        ctx.fillStyle = '#af52de';
        ctx.beginPath();
        ctx.moveTo(2, -9);
        ctx.lineTo(-5, 0);
        ctx.lineTo(1, 0);
        ctx.lineTo(-2, 9);
        ctx.lineTo(5, -1);
        ctx.lineTo(-1, -1);
        ctx.closePath();
        ctx.fill();
    }

    // ── Floating Label ──────────────────────────────────────
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = mainColor;
    ctx.fillText(label, 0, -r - 6);

    ctx.restore();
}
