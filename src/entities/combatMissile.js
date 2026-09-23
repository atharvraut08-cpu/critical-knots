/**
 * combatMissile.js — Player-fired wing-mounted air-to-air homing missiles
 * 
 * Mechanics:
 * - Launched from aircraft wing pylons (alternating port/starboard)
 * - Heat-seeking guidance towards locked enemy target
 * - High-speed rocket motor with accelerating thrust
 * - Volumetric exhaust smoke trail
 * - Proximity and direct hit detonation dealing 50 damage
 * - Vulnerable to countermeasure flares (spoof lock)
 */

import { emit } from './particle.js';
import { clamp } from '../utils/math.js';

export function createCombatMissile({ id, ownerId, ownerTeam, targetId, x, y, heading, speed = 360 }) {
    return {
        id,
        ownerId,
        ownerTeam,
        targetId,
        x,
        y,
        heading,
        speed,
        baseSpeed: speed,
        maxSpeed: 520,
        accel: 220,
        turnRate: 3.2,
        radius: 8,
        alive: true,
        age: 0,
        lifeTime: 6.0, // seconds before fuel burnout
        ignited: true,
        trailTimer: 0,
        spoofed: false,
    };
}

export function updateCombatMissile(missile, dt, targets, flares = []) {
    if (!missile.alive) return;

    missile.age += dt;
    if (missile.age >= missile.lifeTime) {
        missile.alive = false;
        return;
    }

    // Check if flare distracts missile
    if (!missile.spoofed && flares.length > 0) {
        for (const flare of flares) {
            const dist = Math.hypot(flare.x - missile.x, flare.y - missile.y);
            if (dist < 320) {
                // Check if in seeker cone
                const angleToFlare = Math.atan2(flare.y - missile.y, flare.x - missile.x);
                let diff = angleToFlare - missile.heading;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                if (Math.abs(diff) < 1.2) {
                    missile.spoofed = true;
                    missile.targetId = null;
                    break;
                }
            }
        }
    }

    // Guidance towards target
    if (!missile.spoofed && missile.targetId && targets) {
        const target = targets.find(t => t.id === missile.targetId && t.alive);
        if (target) {
            const targetAngle = Math.atan2(target.y - missile.y, target.x - missile.x);
            let diff = targetAngle - missile.heading;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;

            const turnStep = missile.turnRate * dt;
            missile.heading += clamp(diff, -turnStep, turnStep);
        }
    }

    // Acceleration
    missile.speed = Math.min(missile.maxSpeed, missile.speed + missile.accel * dt);

    // Kinematic motion
    missile.x += Math.cos(missile.heading) * missile.speed * dt;
    missile.y += Math.sin(missile.heading) * missile.speed * dt;

    // Rocket exhaust particle emission
    missile.trailTimer -= dt;
    if (missile.trailTimer <= 0) {
        missile.trailTimer = 0.016;

        // Smoke puff
        emit({
            x: missile.x - Math.cos(missile.heading) * 12,
            y: missile.y - Math.sin(missile.heading) * 12,
            vx: -Math.cos(missile.heading) * 40 + (Math.random() - 0.5) * 20,
            vy: -Math.sin(missile.heading) * 40 + (Math.random() - 0.5) * 20,
            radius: 3.5 + Math.random() * 2.5,
            color: 'rgba(230, 235, 245, 0.75)',
            lifeMax: 0.6,
        });

        // Flame spark
        emit({
            x: missile.x - Math.cos(missile.heading) * 8,
            y: missile.y - Math.sin(missile.heading) * 8,
            vx: -Math.cos(missile.heading) * 80 + (Math.random() - 0.5) * 30,
            vy: -Math.sin(missile.heading) * 80 + (Math.random() - 0.5) * 30,
            radius: 2.2,
            color: '#ff9900',
            lifeMax: 0.15,
        });
    }
}

export function drawCombatMissile(missile, ctx, screenPos, teamColors) {
    if (!missile.alive) return;

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(missile.heading + Math.PI / 2);

    const teamColor = (teamColors && teamColors[missile.ownerTeam]) || '#ff3b30';

    // ── Rocket Exhaust Plume ────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(-2.5, 9);
    ctx.lineTo(0, 20 + Math.random() * 6);
    ctx.lineTo(2.5, 9);
    ctx.fillStyle = '#ff9500';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-1.2, 9);
    ctx.lineTo(0, 15);
    ctx.lineTo(1.2, 9);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // ── Missile Body ────────────────────────────────────────
    ctx.fillStyle = '#e8ecf2';
    ctx.beginPath();
    ctx.moveTo(0, -14); // Nose
    ctx.lineTo(3, -7);
    ctx.lineTo(3, 9);
    ctx.lineTo(-3, 9);
    ctx.lineTo(-3, -7);
    ctx.closePath();
    ctx.fill();

    // Seeker Radome (team color accent)
    ctx.fillStyle = teamColor;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(2.5, -9);
    ctx.lineTo(-2.5, -9);
    ctx.closePath();
    ctx.fill();

    // Forward Canards
    ctx.fillStyle = '#334455';
    ctx.beginPath();
    ctx.moveTo(-7, -4);
    ctx.lineTo(0, -7);
    ctx.lineTo(7, -4);
    ctx.lineTo(0, -5);
    ctx.closePath();
    ctx.fill();

    // Tail Fins
    ctx.beginPath();
    ctx.moveTo(-8, 9);
    ctx.lineTo(0, 6);
    ctx.lineTo(8, 9);
    ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}
