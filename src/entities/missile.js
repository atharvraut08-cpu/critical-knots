/**
 * missile.js — Missile entity: homing + unguided rocket archetypes
 * 
 * CG Concepts demonstrated:
 * - Vector math: normalize direction to target before scaling by turnRate
 * - Kinematic motion: velocity from heading angle, scaled by dt
 * - Affine transformations: translate + rotate for oriented drawing
 * 
 * Design note: One homing function, two behaviors — flare confusion
 * reuses the identical homing math with a different target position.
 */

import { CONFIG } from '../config.js';
import { lerpAngle } from '../utils/vector.js';

/**
 * Create a new missile entity.
 * @param {number} x - spawn world X
 * @param {number} y - spawn world Y
 * @param {number} heading - initial heading angle (radians)
 * @param {'homing'|'rocket'} type - missile archetype
 * @returns {object} missile entity
 */
export function createMissile(x, y, heading, type) {
    const isHoming = type === 'homing';
    return {
        x,
        y,
        heading,
        speed: isHoming ? CONFIG.homingSpeed : CONFIG.rocketSpeed,
        turnRate: isHoming ? CONFIG.homingTurnRate : CONFIG.rocketTurnRate,
        type,
        radius: isHoming ? CONFIG.homingRadius : CONFIG.rocketRadius,
        alive: true,
        confusedUntil: 0,       // flare effect: pursue flare instead of player
        confuseTarget: null,    // { x, y } of the flare being tracked
        age: 0,                 // for trail emission timing
        trailTimer: 0,
    };
}

/**
 * Update a missile's position and heading.
 * CG Concept: Vector math — compute desired angle via atan2, then
 * lerpAngle toward it to create smooth homing pursuit curves.
 * The unguided rocket has turnRate=0, so lerpAngle is a no-op,
 * demonstrating the contrast case for the homing algorithm.
 * 
 * Design note (flare interaction): while confusedUntil > now,
 * desiredAngle targets the flare position instead of the player,
 * reusing the identical homing function with a different target.
 * 
 * @param {object} missile
 * @param {number} dt
 * @param {object} player - { x, y } target
 * @param {number} now - current game time for flare confusion check
 */
export function updateMissile(missile, dt, player, now) {
    if (!missile.alive) return;

    missile.age += dt;
    missile.trailTimer -= dt;

    // ── Homing pursuit (vector math) ────────────────────
    if (missile.turnRate > 0) {
        // Determine pursuit target: flare or player
        let targetX, targetY;
        if (missile.confusedUntil > now && missile.confuseTarget) {
            // Flare confusion: same homing math, different target
            targetX = missile.confuseTarget.x;
            targetY = missile.confuseTarget.y;
        } else {
            targetX = player.x;
            targetY = player.y;
            missile.confusedUntil = 0;
        }

        // Vector math: compute desired heading angle via atan2
        const dx = targetX - missile.x;
        const dy = targetY - missile.y;
        const desiredAngle = Math.atan2(dy, dx);

        // Angular interpolation: smoothly turn toward desired heading
        // lerpAngle handles ±π wraparound correctly
        missile.heading = lerpAngle(
            missile.heading,
            desiredAngle,
            missile.turnRate * dt
        );
    }

    // ── Kinematic motion: position update ───────────────
    // Velocity = speed × direction from heading angle, scaled by dt
    missile.x += Math.cos(missile.heading) * missile.speed * dt;
    missile.y += Math.sin(missile.heading) * missile.speed * dt;
}

/**
 * Draw a missile using affine transformations.
 * Homing missiles are red/diamond-shaped; rockets are orange/elongated.
 * 
 * @param {object} missile
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} screenPos
 */
export function drawMissile(missile, ctx, screenPos) {
    if (!missile.alive) return;

    ctx.save();

    // Affine transform: translate to screen position, rotate by heading
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(missile.heading + Math.PI / 2);

    const r = missile.radius;

    if (missile.type === 'homing') {
        // Homing missile: red diamond shape with glow
        // Visually distinct from rocket per accessibility requirement
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.6);
        ctx.lineTo(-r * 0.6, 0);
        ctx.lineTo(0, r * 0.8);
        ctx.lineTo(r * 0.6, 0);
        ctx.closePath();

        ctx.fillStyle = '#ff3344';
        ctx.fill();
        ctx.shadowColor = '#ff3344';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Fins
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, 0);
        ctx.lineTo(-r * 1.0, r * 0.6);
        ctx.lineTo(-r * 0.3, r * 0.3);
        ctx.moveTo(r * 0.6, 0);
        ctx.lineTo(r * 1.0, r * 0.6);
        ctx.lineTo(r * 0.3, r * 0.3);
        ctx.fillStyle = '#cc2233';
        ctx.fill();
    } else {
        // Rocket: orange elongated shape — no fins, faster, straighter
        // Shape difference ensures distinguishability even under color-blindness
        ctx.beginPath();
        ctx.moveTo(0, -r * 2.0);
        ctx.lineTo(-r * 0.4, -r * 0.5);
        ctx.lineTo(-r * 0.4, r * 0.8);
        ctx.lineTo(r * 0.4, r * 0.8);
        ctx.lineTo(r * 0.4, -r * 0.5);
        ctx.closePath();

        ctx.fillStyle = '#ff8800';
        ctx.fill();
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Thruster glow on both types
    ctx.beginPath();
    ctx.arc(0, r * 0.8, r * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffdd44';
    ctx.fill();

    ctx.restore();
}
