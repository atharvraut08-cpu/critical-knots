/**
 * missile.js — Multi-class threat entities with acceleration, EMP disruption, and flare spoofing
 * 
 * CG Concepts:
 * - Kinematic motion: velocity integration, acceleration curves, dt scaling
 * - Vector math: target bearing via atan2, shortest angular delta, lerpAngle pursuit
 * - Affine transformations: translate + rotate transform stack, drop shadow projection
 * 
 * Four Archetypes:
 * 1. Standard (Sidewinder): Balanced heatseeker, matches player cruise speed
 * 2. Heavy (Titan): Slow cruise, relentless turn-rate, dense dark smoke, massive warhead
 * 3. Fast (Falcon): 295 px/s (faster than player cruise 220), high acceleration
 * 4. Hyper (Viper): 385 px/s (faster than player boost 352), high standoff acceleration, low turning
 */

import { CONFIG } from '../config.js';
import { lerpAngle, distance, angleTo } from '../utils/vector.js';
import { angleDiff } from '../utils/math.js';
import { emit } from './particle.js';

/**
 * Create a new missile entity.
 * @param {number} x - spawn world X
 * @param {number} y - spawn world Y
 * @param {number} heading - initial heading angle (radians)
 * @param {'standard'|'heavy'|'fast'|'hyper'} type - missile archetype
 * @returns {object} missile entity
 */
export function createMissile(x, y, heading, type = 'standard') {
    // Map legacy types if passed
    if (type === 'homing') type = 'standard';
    if (type === 'rocket') type = 'fast';

    const def = CONFIG.missileTypes[type] || CONFIG.missileTypes.standard;

    return {
        x,
        y,
        heading,
        speed: def.baseSpeed,
        maxSpeed: def.maxSpeed,
        accel: def.accel,
        turnRate: def.turnRate,
        baseTurnRate: def.turnRate,
        type,
        radius: def.radius,
        alive: true,
        // Flare lock-break state
        confuseTarget: null,    // reference or { x, y } of tracked flare decoy
        confusedUntil: 0,
        // EMP electronic disruption state
        disabledTimer: 0,       // seconds guidance computer is offline
        age: 0,
        trailTimer: 0,
        sparkTimer: 0,
    };
}

/**
 * Update missile kinematics, seeker guidance, EMP disruption, and flare lock evaluation.
 * 
 * @param {object} missile
 * @param {number} dt
 * @param {object} player - { x, y }
 * @param {Array<object>} [flares] - active flare decoys
 * @param {number} now - current game time
 */
export function updateMissile(missile, dt, player, flares = [], now = 0) {
    if (!missile.alive) return;

    missile.age += dt;
    missile.trailTimer -= dt;
    missile.sparkTimer -= dt;

    // ── EMP Electronic Disruption ───────────────────────
    if (missile.disabledTimer > 0) {
        missile.disabledTimer -= dt;

        // Guidance computer is offline: turn rate zeroed, missile wobbles ballistically
        const wobble = Math.sin(missile.age * 18) * 0.12 * dt;
        missile.heading += wobble;

        // Spark particles flying from fried electronics
        if (missile.sparkTimer <= 0) {
            emit(missile.x, missile.y, 1, 'spark', '100,200,255', {
                speedMin: 40,
                speedMax: 110,
                sizeMin: 1.2,
                sizeMax: 2.8,
            });
            missile.sparkTimer = 0.08;
        }
    } else {
        // ── Normal Kinematic Acceleration ───────────────────
        if (missile.speed < missile.maxSpeed) {
            missile.speed = Math.min(missile.maxSpeed, missile.speed + missile.accel * dt);
        }

        // ── Seeker Guidance & Flare Lock-Break Evaluation ───
        let targetX = player.x;
        let targetY = player.y;

        // Check if currently tracking an active flare
        if (missile.confuseTarget && missile.confuseTarget.alive && missile.confusedUntil > now) {
            targetX = missile.confuseTarget.x;
            targetY = missile.confuseTarget.y;
        } else {
            missile.confuseTarget = null;
            missile.confusedUntil = 0;

            // Evaluate all active flares in airspace
            if (flares && flares.length > 0) {
                let bestFlare = null;
                let bestScore = -1;

                for (let i = 0; i < flares.length; i++) {
                    const f = flares[i];
                    if (!f.alive) continue;

                    const distToFlare = distance(missile, f);
                    if (distToFlare > CONFIG.flareDetectionRadius) continue;

                    // Seeker angle difference check
                    const bearingToFlare = angleTo(missile, f);
                    const angleDelta = Math.abs(angleDiff(missile.heading, bearingToFlare));

                    // Flare must be within seeker field-of-view (~77°)
                    if (angleDelta < CONFIG.flareSeekerFov) {
                        const distToPlayer = distance(missile, player);
                        const flareBurnRatio = Math.max(0, f.life / f.maxLife); // brighter when young

                        // Heat attraction score: closer & brighter flares dominate jet exhaust
                        const proximityFactor = Math.max(0.1, 1 - (distToFlare / CONFIG.flareDetectionRadius));
                        const score = proximityFactor * (0.5 + flareBurnRatio * 0.8) * (1 - angleDelta / CONFIG.flareSeekerFov);

                        if (score > bestScore && score > (1 - CONFIG.flareAttractionChance)) {
                            bestScore = score;
                            bestFlare = f;
                        }
                    }
                }

                if (bestFlare) {
                    missile.confuseTarget = bestFlare;
                    missile.confusedUntil = now + bestFlare.life;
                    targetX = bestFlare.x;
                    targetY = bestFlare.y;
                }
            }
        }

        // ── Proportional Navigation / Angular Pursuit ───────
        if (missile.turnRate > 0) {
            const dx = targetX - missile.x;
            const dy = targetY - missile.y;
            const desiredAngle = Math.atan2(dy, dx);

            missile.heading = lerpAngle(
                missile.heading,
                desiredAngle,
                missile.turnRate * dt
            );
        }
    }

    // ── Kinematic Position Integration ──────────────────
    missile.x += Math.cos(missile.heading) * missile.speed * dt;
    missile.y += Math.sin(missile.heading) * missile.speed * dt;
}

/**
 * Draw the missile using affine transformations, CAD silhouette detailing, and drop shadow.
 * 
 * @param {object} missile
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} screenPos
 */
export function drawMissile(missile, ctx, screenPos) {
    if (!missile.alive) return;

    ctx.save();

    const shadowOffset = CONFIG.altitudeShadowOffset * 0.65;
    const r = missile.radius;
    const type = missile.type;

    // ── 1. Altitude Drop Shadow ─────────────────────────
    ctx.save();
    ctx.translate(screenPos.x + shadowOffset, screenPos.y + shadowOffset);
    ctx.rotate(missile.heading + Math.PI / 2);
    ctx.fillStyle = 'rgba(10, 15, 25, 0.32)';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.45, r * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── 2. Missile Model ────────────────────────────────
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(missile.heading + Math.PI / 2);

    if (type === 'heavy') {
        // ── Titan: Heavy Cruise Missile ─────────────────────
        // Fuselage: thick cylindrical body
        ctx.fillStyle = '#2d333b';
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.8);
        ctx.lineTo(-r * 0.75, -r * 0.9);
        ctx.lineTo(-r * 0.75, r * 1.2);
        ctx.lineTo(r * 0.75, r * 1.2);
        ctx.lineTo(r * 0.75, -r * 0.9);
        ctx.closePath();
        ctx.fill();

        // Warhead nose cap
        ctx.fillStyle = '#cc1122';
        ctx.beginPath();
        ctx.moveTo(0, -r * 2.2);
        ctx.lineTo(-r * 0.65, -r * 1.1);
        ctx.lineTo(r * 0.65, -r * 1.1);
        ctx.closePath();
        ctx.fill();

        // Hazard stripes on body
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(-r * 0.65, -r * 0.3, r * 1.3, r * 0.3);

        // Rear stabilizing tandem fins
        ctx.fillStyle = '#444d56';
        ctx.beginPath();
        ctx.moveTo(-r * 0.75, r * 0.4);
        ctx.lineTo(-r * 1.5, r * 1.2);
        ctx.lineTo(-r * 0.75, r * 1.1);
        ctx.moveTo(r * 0.75, r * 0.4);
        ctx.lineTo(r * 1.5, r * 1.2);
        ctx.lineTo(r * 0.75, r * 1.1);
        ctx.fill();

    } else if (type === 'fast') {
        // ── Falcon: Swept-Wing Interceptor ──────────────────
        // Needle nose cone
        ctx.fillStyle = '#ff7700';
        ctx.beginPath();
        ctx.moveTo(0, -r * 2.3);
        ctx.lineTo(-r * 0.45, -r * 0.8);
        ctx.lineTo(r * 0.45, -r * 0.8);
        ctx.closePath();
        ctx.fill();

        // Fuselage
        ctx.fillStyle = '#47505d';
        ctx.fillRect(-r * 0.45, -r * 0.8, r * 0.9, r * 2.0);

        // Swept delta canards & rear fins
        ctx.fillStyle = '#e05500';
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, -r * 0.4);
        ctx.lineTo(-r * 1.2, r * 0.3);
        ctx.lineTo(-r * 0.45, r * 0.1);
        ctx.moveTo(r * 0.45, -r * 0.4);
        ctx.lineTo(r * 1.2, r * 0.3);
        ctx.lineTo(r * 0.45, r * 0.1);

        ctx.moveTo(-r * 0.45, r * 0.8);
        ctx.lineTo(-r * 1.3, r * 1.5);
        ctx.lineTo(-r * 0.2, r * 1.2);
        ctx.moveTo(r * 0.45, r * 0.8);
        ctx.lineTo(r * 1.3, r * 1.5);
        ctx.lineTo(r * 0.2, r * 1.2);
        ctx.fill();

    } else if (type === 'hyper') {
        // ── Viper: Hypersonic Waverider Dart ────────────────
        // Chiseled hyper-velocity wedge
        ctx.fillStyle = '#20102b';
        ctx.beginPath();
        ctx.moveTo(0, -r * 2.5);
        ctx.lineTo(-r * 0.55, r * 1.2);
        ctx.lineTo(0, r * 0.8);
        ctx.lineTo(r * 0.55, r * 1.2);
        ctx.closePath();
        ctx.fill();

        // Plasma heatshield nose tip
        ctx.fillStyle = '#ff22cc';
        ctx.shadowColor = '#ff22cc';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, -r * 2.5);
        ctx.lineTo(-r * 0.25, -r * 1.5);
        ctx.lineTo(r * 0.25, -r * 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Titanium strakes
        ctx.strokeStyle = '#c033ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.5);
        ctx.lineTo(0, r * 0.8);
        ctx.stroke();

    } else {
        // ── Standard: Sidewinder Heatseeker ─────────────────
        // Ceramic body
        ctx.fillStyle = '#d0d8e0';
        ctx.fillRect(-r * 0.45, -r * 0.9, r * 0.9, r * 2.1);

        // Seeker glass dome & red warhead collar
        ctx.fillStyle = '#ff3344';
        ctx.beginPath();
        ctx.arc(0, -r * 0.9, r * 0.45, Math.PI, 0);
        ctx.fill();

        // Forward steering canards
        ctx.fillStyle = '#333e4d';
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, -r * 0.5);
        ctx.lineTo(-r * 0.9, -r * 0.2);
        ctx.lineTo(-r * 0.45, -r * 0.2);
        ctx.moveTo(r * 0.45, -r * 0.5);
        ctx.lineTo(r * 0.9, -r * 0.2);
        ctx.lineTo(r * 0.45, -r * 0.2);
        ctx.fill();

        // Rear stabilizing fins
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, r * 0.7);
        ctx.lineTo(-r * 1.15, r * 1.35);
        ctx.lineTo(-r * 0.45, r * 1.2);
        ctx.moveTo(r * 0.45, r * 0.7);
        ctx.lineTo(r * 1.15, r * 1.35);
        ctx.lineTo(r * 0.45, r * 1.2);
        ctx.fill();
    }

    // ── 3. Motor Exhaust Plume ──────────────────────────
    // If disabled by EMP, motor sputters/dies
    if (missile.disabledTimer <= 0) {
        const flameColor = type === 'hyper' ? '#c033ff' : (type === 'fast' ? '#ffaa00' : '#ffdd44');
        const flameLen = r * (0.8 + Math.random() * 0.6);
        ctx.beginPath();
        ctx.moveTo(-r * 0.3, r * 1.2);
        ctx.lineTo(0, r * 1.2 + flameLen);
        ctx.lineTo(r * 0.3, r * 1.2);
        ctx.fillStyle = flameColor;
        ctx.fill();
    }

    ctx.restore();
}
