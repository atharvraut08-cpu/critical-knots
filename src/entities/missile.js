/**
 * missile.js — Multi-class threat entities with acceleration and flare spoofing
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
import { angleDiff, clamp } from '../utils/math.js';
import { emit } from './particle.js';

/**
 * Create a new missile entity.
 * @param {number} x - spawn world X
 * @param {number} y - spawn world Y
 * @param {number} heading - initial heading angle (radians)
 * @param {'basic'|'heavy'|'interceptor'} type - missile archetype
 * @returns {object} missile entity
 */
export function createMissile(x, y, heading, type = 'basic', source = 'enemy', target = null) {
    let t = String(type).toLowerCase();
    if (t === 'standard' || t === 'homing') t = 'basic';
    if (t === 'fast' || t === 'rocket' || t === 'hyper') t = 'interceptor';

    const def = CONFIG.missileTypes[t] || CONFIG.missileTypes.basic;

    return {
        x,
        y,
        heading,
        speed: def.baseSpeed,
        maxSpeed: def.maxSpeed,
        accel: def.accel,
        turnRate: def.turnRate,
        baseTurnRate: def.turnRate,
        type: t,
        radius: def.radius,
        alive: true,
        source,                  // 'enemy' | 'player'
        target,                  // targeted entity (player or EnemyJet)

        // ── 3-Second Boost Phase vs Coast Phase ─────────
        boostDuration: CONFIG.missileBoostDuration || 3.0,
        isBoosting: true,        // active high-acceleration rocket burn
        coastDrag: CONFIG.missileCoastDrag || 0.00035, // gentle glide drag coeff after engine cutoff
        stallSpeed: CONFIG.missileStallSpeed !== undefined ? CONFIG.missileStallSpeed : 0,    // px/s speed threshold (0 = no speed-based deletion)
        maxLifetime: CONFIG.missileMaxLifetime || 30.0, // seconds max flight duration before self-destruct (increased to 30s)

        // ── Proportional Navigation (PN) Guidance ───────
        previousLos: null,       // previous Line-of-Sight angle (lambda)
        pnGain: CONFIG.missilePnGain || 3.5, // navigation constant N

        // Flare lock-break state
        confuseTarget: null,    // reference or { x, y } of tracked flare decoy
        confusedUntil: 0,
        age: 0,
        trailTimer: 0,
        sparkTimer: 0,
    };
}

/**
 * Update missile kinematics, seeker guidance, and flare lock evaluation.
 * Implements Proportional Navigation (PN) and a 3-second motor Boost Phase
 * transitioning into an unpowered Coast Phase succumbing to quadratic drag.
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

    const def = CONFIG.missileTypes[missile.type] || CONFIG.missileTypes.basic;

    // ── 1. Boost Phase vs Coast Phase Kinematics ────────
    if (missile.age <= missile.boostDuration) {
        // High-acceleration rocket motor boost phase (first 3.0s)
        missile.isBoosting = true;
        const boostAccel = CONFIG.missileBoostAccel || 210;
        if (missile.speed < missile.maxSpeed) {
            missile.speed = Math.min(missile.maxSpeed, missile.speed + boostAccel * dt);
        }
        missile.turnRate = def.turnRate;
    } else {
        // Engine-off Coast Phase: succumbs to gentle aerodynamic drag (glides realistically)
        missile.isBoosting = false;
        const coastDragCoeff = missile.coastDrag || CONFIG.missileCoastDrag || 0.00035;
        const dragAccel = coastDragCoeff * missile.speed * missile.speed;
        missile.speed = Math.max(0, missile.speed - dragAccel * dt);

        // Control surface turning authority smoothly degrades as airspeed drops
        const dynamicPressure = Math.max(0.35, missile.speed / (missile.maxSpeed || 235));
        missile.turnRate = def.turnRate * dynamicPressure;
    }

    // Despawn ONLY if flight duration exceeds maxLifetime (at least 30s) — never delete based on low velocity
    const maxLife = missile.maxLifetime || CONFIG.missileMaxLifetime || 30.0;
    if (missile.age > maxLife) {
        missile.alive = false;
        emit(missile.x, missile.y, 4, 'smoke', '160,165,175', {
            speedMin: 15,
            speedMax: 40,
            sizeMin: 2,
            sizeMax: 4.5,
            lifeMin: 0.2,
            lifeMax: 0.45,
        });
        return;
    }

    // ── 2. Seeker Target Evaluation (Flares & Hostiles) ─
    const designatedTarget = (missile.target && missile.target.alive) ? missile.target : player;
    let targetX = designatedTarget ? designatedTarget.x : (missile.x + Math.cos(missile.heading) * 100);
    let targetY = designatedTarget ? designatedTarget.y : (missile.y + Math.sin(missile.heading) * 100);

    // Check if currently tracking an active flare decoy
    if (missile.confuseTarget && missile.confuseTarget.alive && missile.confusedUntil > now) {
        targetX = missile.confuseTarget.x;
        targetY = missile.confuseTarget.y;
    } else {
        missile.confuseTarget = null;
        missile.confusedUntil = 0;

        // Evaluate all active flares in airspace
        if (flares && flares.length > 0) {
            const candidates = [];

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
                    const flareBurnRatio = Math.max(0, f.life / f.maxLife);
                    const heat = f.heatSignature || 1.0;
                    const proximityFactor = Math.max(0.1, 1 - (distToFlare / CONFIG.flareDetectionRadius));

                    const sensorNoise = 0.75 + Math.random() * 0.5;
                    const score = proximityFactor * (0.4 + flareBurnRatio * 0.6) * heat * sensorNoise * (1 - angleDelta / CONFIG.flareSeekerFov);

                    if (score > (1 - CONFIG.flareAttractionChance)) {
                        candidates.push({ flare: f, score });
                    }
                }
            }

            if (candidates.length > 0) {
                candidates.sort((a, b) => b.score - a.score);
                const selectedIdx = Math.floor(Math.random() * Math.min(candidates.length, 3));
                const chosenFlare = candidates[selectedIdx].flare;

                missile.confuseTarget = chosenFlare;
                missile.confusedUntil = now + chosenFlare.life;
                targetX = chosenFlare.x;
                targetY = chosenFlare.y;
            }
        }
    }

    // ── 3. Proportional Navigation (PN) Seeker Guidance ─
    if (missile.turnRate > 0) {
        // True direction vector to target: target.position - missile.position
        const dx = targetX - missile.x;
        const dy = targetY - missile.y;
        const currentLos = Math.atan2(dy, dx);

        // Angular error between missile nose heading and line-of-sight to target
        // angleDiff(from, to) = to - from -> angleDiff(heading, currentLos) = currentLos - heading
        const losError = angleDiff(missile.heading, currentLos);

        if (missile.previousLos === null) {
            missile.previousLos = currentLos;
            const maxTurn = missile.turnRate * dt;
            missile.heading += clamp(losError, -maxTurn, maxTurn);
        } else {
            // Line-of-sight angular rate: dLambda / dt = (currentLos - previousLos) / dt
            const deltaLos = angleDiff(missile.previousLos, currentLos);
            const losRate = deltaLos / Math.max(0.001, dt);
            missile.previousLos = currentLos;

            // Proportional Navigation Guidance Law: commanded turn = N * losRate
            const commandedTurnRate = (missile.pnGain || 3.5) * losRate;

            // Augmented with direct proportional pursuit toward target line-of-sight
            const blendedTurnRate = commandedTurnRate + losError * 2.0;

            // Fin aerodynamic turn rate limit
            const maxTurn = missile.turnRate * dt;
            const turnStep = clamp(blendedTurnRate * dt, -maxTurn, maxTurn);
            missile.heading += turnStep;
        }
    }

    // ── 4. Kinematic Position Integration ───────────────
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

    const shadowOffset = (CONFIG.altitudeShadowOffset || 16) * 0.45;
    const type = missile.type;
    const isPlayerMissile = missile.source === 'player';

    // ── 1. Realistic Altitude Drop Shadow (Clean, Compact) ───────────
    ctx.save();
    ctx.translate(screenPos.x + shadowOffset, screenPos.y + shadowOffset);
    ctx.rotate(missile.heading + Math.PI / 2);
    ctx.fillStyle = 'rgba(10, 15, 25, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 1.2, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── 2. Sleek Missile Model (~1/5th Plane Size, Zero Neon Glow) ───
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(missile.heading + Math.PI / 2);

    if (isPlayerMissile) {
        // ── PLAYER HEAT-SEEKER: Sleek matte white dart with blue guidance tip ──
        const w = 1.2;
        const l = 5.5;

        // Fuselage
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-w, -l, w * 2, l * 2);

        // Tactical blue guidance nose cone
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.moveTo(0, -l - 3.2);
        ctx.lineTo(-w, -l);
        ctx.lineTo(w, -l);
        ctx.closePath();
        ctx.fill();

        // Rear stabilizing fins
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(-w, l - 3.5);
        ctx.lineTo(-w - 2.0, l);
        ctx.lineTo(-w, l);
        ctx.moveTo(w, l - 3.5);
        ctx.lineTo(w + 2.0, l);
        ctx.lineTo(w, l);
        ctx.fill();

        // Forward canards
        ctx.beginPath();
        ctx.moveTo(-w, -l + 1.5);
        ctx.lineTo(-w - 1.2, -l + 2.8);
        ctx.lineTo(-w, -l + 2.8);
        ctx.moveTo(w, -l + 1.5);
        ctx.lineTo(w + 1.2, -l + 2.8);
        ctx.lineTo(w, -l + 2.8);
        ctx.fill();

        // Crisp vector outline
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(-w, -l, w * 2, l * 2);

        // Clean rocket motor exhaust (Zero shadowBlur/shadowColor) - Only during active Boost Phase
        if (missile.isBoosting) {
            const flameLen = 3.5 + Math.random() * 1.5;
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.moveTo(-w * 0.7, l);
            ctx.lineTo(0, l + flameLen);
            ctx.lineTo(w * 0.7, l);
            ctx.closePath();
            ctx.fill();
        }

    } else if (type === 'heavy') {
        // ── HEAVY: Compact high-drag ordnance (matte slate + hazard orange) ──
        const w = 1.5;
        const l = 5.5;

        // Dark slate fuselage
        ctx.fillStyle = '#334155';
        ctx.fillRect(-w, -l, w * 2, l * 2);

        // Solid safety orange nose cone
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.moveTo(0, -l - 3.0);
        ctx.lineTo(-w, -l);
        ctx.lineTo(w, -l);
        ctx.closePath();
        ctx.fill();

        // High-vis midsection band
        ctx.fillStyle = '#f97316';
        ctx.fillRect(-w, -1, w * 2, 2);

        // Heavy cruciform fins
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(-w, l - 3.5);
        ctx.lineTo(-w - 2.5, l);
        ctx.lineTo(-w, l);
        ctx.moveTo(w, l - 3.5);
        ctx.lineTo(w + 2.5, l);
        ctx.lineTo(w, l);
        ctx.fill();

        // Crisp vector outline
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(-w, -l, w * 2, l * 2);

        // Clean rocket motor exhaust - Only during active Boost Phase
        if (missile.isBoosting) {
            const flameLen = 4.0 + Math.random() * 1.5;
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.moveTo(-w * 0.7, l);
            ctx.lineTo(0, l + flameLen);
            ctx.lineTo(w * 0.7, l);
            ctx.closePath();
            ctx.fill();
        }

    } else if (type === 'interceptor') {
        // ── INTERCEPTOR: Needle-sharp hyper-velocity dart (matte crimson red) ──
        const w = 1.1;
        const l = 6.5;

        // Slender matte red body
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-w, -l, w * 2, l * 2);

        // Needle piercing nose cone
        ctx.fillStyle = '#18181b';
        ctx.beginPath();
        ctx.moveTo(0, -l - 4.2);
        ctx.lineTo(-w, -l);
        ctx.lineTo(w, -l);
        ctx.closePath();
        ctx.fill();

        // Swept delta fins
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.moveTo(-w, l - 4.0);
        ctx.lineTo(-w - 2.2, l);
        ctx.lineTo(-w, l);
        ctx.moveTo(w, l - 4.0);
        ctx.lineTo(w + 2.2, l);
        ctx.lineTo(w, l);
        ctx.fill();

        // Crisp vector outline
        ctx.strokeStyle = '#450a0a';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(-w, -l, w * 2, l * 2);

        // Clean rocket motor exhaust - Only during active Boost Phase
        if (missile.isBoosting) {
            const flameLen = 4.5 + Math.random() * 2.0;
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(-w * 0.7, l);
            ctx.lineTo(0, l + flameLen);
            ctx.lineTo(w * 0.7, l);
            ctx.closePath();
            ctx.fill();
        }

    } else {
        // ── BASIC: Standard Sidewinder (clean matte military grey) ──
        const w = 1.2;
        const l = 5.2;

        // Solid light grey ceramic fuselage
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-w, -l, w * 2, l * 2);

        // Graphite seeker radome tip
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(0, -l - 3.0);
        ctx.lineTo(-w, -l);
        ctx.lineTo(w, -l);
        ctx.closePath();
        ctx.fill();

        // Graphite steering canards
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(-w, -l + 1.2);
        ctx.lineTo(-w - 1.2, -l + 2.4);
        ctx.lineTo(-w, -l + 2.4);
        ctx.moveTo(w, -l + 1.2);
        ctx.lineTo(w + 1.2, -l + 2.4);
        ctx.lineTo(w, -l + 2.4);
        ctx.fill();

        // Rear stabilizing fins
        ctx.beginPath();
        ctx.moveTo(-w, l - 3.2);
        ctx.lineTo(-w - 2.0, l);
        ctx.lineTo(-w, l);
        ctx.moveTo(w, l - 3.2);
        ctx.lineTo(w + 2.0, l);
        ctx.lineTo(w, l);
        ctx.fill();

        // Crisp vector outline
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(-w, -l, w * 2, l * 2);

        // Clean rocket motor exhaust - Only during active Boost Phase
        if (missile.isBoosting) {
            const flameLen = 3.5 + Math.random() * 1.5;
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.moveTo(-w * 0.7, l);
            ctx.lineTo(0, l + flameLen);
            ctx.lineTo(w * 0.7, l);
            ctx.closePath();
            ctx.fill();
        }
    }

    ctx.restore();
}
