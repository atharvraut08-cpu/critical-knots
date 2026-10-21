/**
 * enemy.js — Intelligent computer-controlled adversary fighter jet entity
 * 
 * Architecture & Mechanics:
 * 1. Kinematic Steering Behaviors:
 *    - Dynamically pursues and maneuvers to get directly behind the player's tail.
 *    - Smooth angular velocity integration with acceleration / deceleration.
 * 2. Finite Payload:
 *    - 8 Heat-seeking missiles
 *    - 3 Flare charges
 * 3. Dot Product FOV Cone (30 degrees):
 *    - Uses vector dot product between nose heading vector and direction to player.
 *    - Only locks onto player when within 30-degree cone (cos(15°) ≈ 0.9659).
 *    - Hard-locks after exactly 2.5 seconds, resetting to 0 if player breaks cone.
 * 4. Defensive Flare Deploy:
 *    - Euclidean distance check against incoming player-fired missiles.
 *    - Automatically deploys flare salvo when missile enters critical radius.
 */

import { CONFIG } from '../config.js';
import { createMissile } from './missile.js';
import { deployFlareSalvo } from '../systems/countermeasures.js';
import { emit, emitTrail } from './particle.js';
import { clamp } from '../utils/math.js';

export class EnemyJet {
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} heading
     * @param {string|number} id
     */
    constructor(x, y, heading = Math.PI, id = 1, isDrone = false) {
        this.id = id;
        this.isDrone = isDrone;
        this.callsign = isDrone ? 'TARGET-DRONE' : `BOGEY-${id}`;
        this.x = x;
        this.y = y;
        this.heading = heading;
        const initSpeed = isDrone ? 150 : (CONFIG.enemyBaseSpeed || 175);
        this.vx = Math.cos(heading) * initSpeed;
        this.vy = Math.sin(heading) * initSpeed;
        this.speed = initSpeed;
        this.baseSpeed = initSpeed;
        this.turnRate = isDrone ? 0.55 : (CONFIG.enemyTurnRate || 1.30);
        this.radius = CONFIG.enemyRadius || 15;
        this.alive = true;
        this.health = 100;
        this.maxHealth = 100;

        // Finite payload: strictly 8 missiles and 3 flares for combat enemies (0 for practice drone)
        this.missiles = isDrone ? 0 : (CONFIG.enemyMissiles || 8);
        this.maxMissiles = isDrone ? 0 : (CONFIG.enemyMissiles || 8);
        this.flares = isDrone ? 0 : (CONFIG.enemyFlares || 3);
        this.maxFlares = isDrone ? 0 : (CONFIG.enemyFlares || 3);
        this.flareCooldown = 0;

        // Hard-lock missile system
        this.lockTimer = 0;
        this.lockDuration = CONFIG.dogfightLockTime || 0.5;
        this.fireCooldown = 0.8;
        this.inFov = false;
        this.dotProduct = 0;

        // Visual timers
        this.trailTimer = 0;
        this.boosting = false;
    }

    /**
     * Update AI flight kinematics, steering, hard-lock targeting, and defensive countermeasures.
     * Implements Newtonian flight, separation steering, and dual pursuit curves:
     * - "Lead Pursuit" when far away (intercepting ahead of the player's flight vector).
     * - "Lag Pursuit" when close (turning wider behind the player's tail to prevent overshooting).
     * 
     * @param {number} dt
     * @param {object} player
     * @param {Array<object>} missiles
     * @param {Array<object>} flares
     * @param {object} state
     */
    update(dt, player, missiles, flares, state) {
        if (!this.alive) return;

        // ── 0. Dummy Target Drone Flight Behavior (Flight School Mode) ─────────
        // Target drone does not shoot back; flies in a continuous wide circle at moderate speed
        if (this.isDrone) {
            const droneSpeed = 150;
            const circleTurnRate = 0.55; // rad/s for continuous wide circular holding pattern
            this.heading += circleTurnRate * dt;
            this.vx = Math.cos(this.heading) * droneSpeed;
            this.vy = Math.sin(this.heading) * droneSpeed;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.speed = droneSpeed;
            this.boosting = false;

            // Engine thruster particle trail
            this.trailTimer -= dt;
            if (this.trailTimer <= 0) {
                const tailX = this.x - Math.cos(this.heading) * this.radius;
                const tailY = this.y - Math.sin(this.heading) * this.radius;
                emitTrail(tailX, tailY, this.heading, '250,180,50');
                this.trailTimer = 0.04;
            }
            return;
        }

        // ── 1. Separation Steering: Prevent enemy planes overlapping (150px radius) ──
        let sepForceX = 0;
        let sepForceY = 0;
        const separationThreshold = 150; // pixels

        if (state && state.enemies) {
            for (let i = 0; i < state.enemies.length; i++) {
                const other = state.enemies[i];
                if (other === this || !other.alive) continue;

                // Euclidean distance check between active enemy aircraft
                const diffX = this.x - other.x;
                const diffY = this.y - other.y;
                const dist = Math.hypot(diffX, diffY);

                if (dist < separationThreshold) {
                    // Repulsive vector force directed away from neighbor
                    let repX = diffX;
                    let repY = diffY;
                    if (dist < 1) {
                        repX = (this.id % 2 === 0 ? 1 : -1);
                        repY = (this.id % 2 === 0 ? -1 : 1);
                    } else {
                        repX /= dist;
                        repY /= dist;
                    }

                    // Linear falloff: strongest repulsion at closest distance
                    const repulsionMagnitude = (separationThreshold - dist) / separationThreshold;
                    sepForceX += repX * repulsionMagnitude;
                    sepForceY += repY * repulsionMagnitude;
                }
            }
        }

        // ── 2. Intercept Pursuit Curves: Lead vs Lag Pursuit ───
        if (player && player.alive) {
            const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
            const leadThreshold = CONFIG.enemyLeadDistance || 350;
            let targetX, targetY;

            if (distToPlayer > leadThreshold) {
                // LEAD PURSUIT: Aim ahead of the player's velocity vector to cut off their turn
                const pvx = player.vx !== undefined ? player.vx : (Math.cos(player.heading) * (player.speed || 220));
                const pvy = player.vy !== undefined ? player.vy : (Math.sin(player.heading) * (player.speed || 220));
                const tIntercept = clamp(distToPlayer / Math.max(20, this.speed), 0.25, 1.6);
                targetX = player.x + pvx * tIntercept;
                targetY = player.y + pvy * tIntercept;
            } else {
                // LAG PURSUIT: Turn wider than player, targeting directly behind their tail to prevent overshooting
                const lagOffset = CONFIG.enemyLagOffset || 240;
                targetX = player.x - Math.cos(player.heading) * lagOffset;
                targetY = player.y - Math.sin(player.heading) * lagOffset;
            }

            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const distToTarget = Math.hypot(dx, dy);

            const pursuitX = distToTarget > 1 ? dx / distToTarget : Math.cos(this.heading);
            const pursuitY = distToTarget > 1 ? dy / distToTarget : Math.sin(this.heading);

            // Blend pursuit vector with repulsive separation vector to fly in formation
            const steerX = pursuitX + sepForceX * 2.2;
            const steerY = pursuitY + sepForceY * 2.2;

            // Desired heading based on blended steering vector
            const desiredHeading = Math.atan2(steerY, steerX);

            // Shortest angular difference normalized to [-PI, PI]
            let angleDiff = desiredHeading - this.heading;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

            // Turn towards blended vector with angular rate limit
            const maxTurn = this.turnRate * dt;
            const turnStep = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
            this.heading += turnStep;

            // ── 3. Newtonian Flight Kinematics & Aerodynamics ──
            const ufx = Math.cos(this.heading);
            const ufy = Math.sin(this.heading);
            const ulx = -Math.sin(this.heading);
            const uly = Math.cos(this.heading);

            // Throttle & boost control based on range
            if (distToPlayer > 440) {
                this.boosting = true;
            } else if (distToPlayer < 150) {
                this.boosting = false;
            }

            const thrust = this.boosting ? 750 : 380;
            this.vx += ufx * thrust * dt;
            this.vy += ufy * thrust * dt;

            // Lateral grip damping (drift resistance)
            const vl = this.vx * ulx + this.vy * uly;
            const latGrip = CONFIG.lateralGrip || 3.8;
            this.vx += ulx * (-latGrip * vl) * dt;
            this.vy += uly * (-latGrip * vl) * dt;

            // Quadratic aerodynamic drag
            const curSpeed = Math.hypot(this.vx, this.vy);
            const dragCoeff = CONFIG.dragCoeff || 0.0093;
            const dragAccel = dragCoeff * curSpeed * curSpeed;
            if (curSpeed > 0.01) {
                this.vx -= (this.vx / curSpeed) * dragAccel * dt;
                this.vy -= (this.vy / curSpeed) * dragAccel * dt;
            }
        } else {
            this.boosting = false;
        }

        // Kinematic position integration with physical separation force
        this.x += this.vx * dt + sepForceX * 80 * dt;
        this.y += this.vy * dt + sepForceY * 80 * dt;
        this.speed = Math.hypot(this.vx, this.vy);

        // ── 3. Field of View (FOV) Check via Dot Product (30-Degree Cone) ──────
        // Nose heading unit vector:
        const noseX = Math.cos(this.heading);
        const noseY = Math.sin(this.heading);

        this.inFov = false;
        this.dotProduct = 0;

        if (player && player.alive) {
            const toPlayerX = player.x - this.x;
            const toPlayerY = player.y - this.y;
            const playerDist = Math.hypot(toPlayerX, toPlayerY);

            if (playerDist > 5 && playerDist < 1600) {
                // Normalized direction vector to player
                const dirX = toPlayerX / playerDist;
                const dirY = toPlayerY / playerDist;

                // Dot product calculation: cos(theta) = u · v
                this.dotProduct = noseX * dirX + noseY * dirY;

                // 30-degree total cone: half-angle is 15 degrees
                const cosThreshold = Math.cos((30 / 2) * Math.PI / 180);
                if (this.dotProduct >= cosThreshold) {
                    this.inFov = true;
                }
            }
        }

        // ── 4. Hard-Lock Missile System (AI establishes lock for 2.5s) ────────
        if (this.fireCooldown > 0) {
            this.fireCooldown -= dt;
        }

        if (this.inFov && this.missiles > 0 && this.fireCooldown <= 0) {
            this.lockTimer += dt;
            if (this.lockTimer >= this.lockDuration) {
                // Launch heat-seeking missile at player!
                this.fireMissileAtPlayer(player, state);
                this.missiles--;
                this.lockTimer = 0;
                this.fireCooldown = 3.0; // standoff delay before initiating next lock
            }
        } else {
            // Target left 30-degree cone or player dead -> timer immediately resets to 0
            this.lockTimer = 0;
        }

        // ── 5. Defensive Flare Salvo (Euclidean Distance Check) ────────────────
        if (this.flareCooldown > 0) {
            this.flareCooldown -= dt;
        }

        if (this.flares > 0 && this.flareCooldown <= 0) {
            const criticalRadius = CONFIG.enemyFlareCriticalRadius || 280;

            for (let i = 0; i < missiles.length; i++) {
                const m = missiles[i];
                if (!m.alive || m.source !== 'player') continue;

                // Euclidean distance check: sqrt((x2 - x1)^2 + (y2 - y1)^2)
                const distToMissile = Math.hypot(m.x - this.x, m.y - this.y);

                if (distToMissile <= criticalRadius) {
                    // Pop defensive flare salvo!
                    deployFlareSalvo(this, state, true);
                    break;
                }
            }
        }

        // ── 6. Engine Thruster Trails ─────────────────────────────────────────
        this.trailTimer -= dt;
        if (this.trailTimer <= 0) {
            const tailX = this.x - Math.cos(this.heading) * this.radius;
            const tailY = this.y - Math.sin(this.heading) * this.radius;
            const color = this.boosting ? '240,110,40' : '200,60,40';
            emitTrail(tailX, tailY, this.heading, color);
            this.trailTimer = CONFIG.trailEmitRate || 0.03;
        }
    }

    /**
     * Fire a heat-seeking missile tracking the player.
     * 
     * @param {object} player
     * @param {object} state
     */
    fireMissileAtPlayer(player, state) {
        const noseDist = this.radius * 2.2;
        const spawnX = this.x + Math.cos(this.heading) * noseDist;
        const spawnY = this.y + Math.sin(this.heading) * noseDist;

        const missile = createMissile(spawnX, spawnY, this.heading, 'heavy', 'enemy', player);
        missile.speed = Math.max(missile.speed, this.speed + 90);
        state.missiles.push(missile);

        // Visual flash & missile launch ejection smoke
        emit(spawnX, spawnY, 6, 'spark', '255,140,50', {
            speedMin: 25,
            speedMax: 70,
            sizeMin: 1.2,
            sizeMax: 2.8,
            lifeMin: 0.1,
            lifeMax: 0.22,
        });
        emit(spawnX, spawnY, 3, 'smoke', '180,180,190', {
            speedMin: 10,
            speedMax: 30,
            sizeMin: 3,
            sizeMax: 6,
            lifeMin: 0.25,
            lifeMax: 0.5,
        });
    }
}

/**
 * Factory function to create an enemy jet.
 */
export function createEnemy(x, y, heading = Math.PI, id = 1, isDrone = false) {
    return new EnemyJet(x, y, heading, id, isDrone);
}

/**
 * Draw hostile AI fighter jet using clean, solid matte colors (dark red / military charcoal)
 * with crisp vector outlines and NO neon glow.
 * 
 * @param {EnemyJet} enemy
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} screenPos
 */
export function drawEnemy(enemy, ctx, screenPos) {
    if (!enemy.alive) return;

    ctx.save();

    const s = enemy.radius;
    const shadowOffset = CONFIG.altitudeShadowOffset || 16;

    // Helper: Build menacing supersonic fighter jet silhouette
    const buildAirframePath = (context) => {
        context.beginPath();
        // Needle radome
        context.moveTo(0, -s * 2.3);

        // Port fuselage strake
        context.lineTo(-s * 0.35, -s * 1.1);
        context.lineTo(-s * 0.60, -s * 0.3);

        // Port forward-swept wing
        context.lineTo(-s * 1.75, -s * 0.7);
        context.lineTo(-s * 1.85, -s * 0.45);
        context.lineTo(-s * 0.75, s * 0.75);

        // Port engine nozzle & fin
        context.lineTo(-s * 0.55, s * 1.2);
        context.lineTo(-s * 0.20, s * 1.2);

        // Center Beaver tail
        context.lineTo(0, s * 0.85);

        // Starboard engine nozzle & fin
        context.lineTo(s * 0.20, s * 1.2);
        context.lineTo(s * 0.55, s * 1.2);

        // Starboard forward-swept wing
        context.lineTo(s * 0.75, s * 0.75);
        context.lineTo(s * 1.85, -s * 0.45);
        context.lineTo(s * 1.75, -s * 0.7);

        // Starboard fuselage strake
        context.lineTo(s * 0.60, -s * 0.3);
        context.lineTo(s * 0.35, -s * 1.1);

        context.closePath();
    };

    // ── 1. Altitude Drop Shadow (clean matte shadow) ────
    ctx.save();
    ctx.translate(screenPos.x + shadowOffset * 0.75, screenPos.y + shadowOffset);
    ctx.rotate(enemy.heading + Math.PI / 2);
    ctx.scale(0.92, 0.92);
    buildAirframePath(ctx);
    ctx.fillStyle = 'rgba(10, 15, 26, 0.30)';
    ctx.fill();
    ctx.restore();

    // ── 2. Aircraft Body & Affine Transformation ────────
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(enemy.heading + Math.PI / 2);

    // Afterburner Thrust Plumes (Clean solid vector flames, NO neon glow/shadowBlur)
    const exhaustLen = enemy.boosting ? s * 1.1 : s * 0.55;
    ctx.fillStyle = enemy.boosting ? '#f97316' : '#ea580c';
    ctx.beginPath();
    // Port nozzle flame
    ctx.moveTo(-s * 0.48, s * 1.2);
    ctx.lineTo(-s * 0.375, s * 1.2 + exhaustLen);
    ctx.lineTo(-s * 0.27, s * 1.2);
    // Starboard nozzle flame
    ctx.moveTo(s * 0.27, s * 1.2);
    ctx.lineTo(s * 0.375, s * 1.2 + exhaustLen);
    ctx.lineTo(s * 0.48, s * 1.2);
    ctx.fill();

    // Inner bright nozzle core
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, s * 1.2);
    ctx.lineTo(-s * 0.375, s * 1.2 + exhaustLen * 0.45);
    ctx.lineTo(-s * 0.33, s * 1.2);
    ctx.moveTo(s * 0.33, s * 1.2);
    ctx.lineTo(s * 0.375, s * 1.2 + exhaustLen * 0.45);
    ctx.lineTo(s * 0.42, s * 1.2);
    ctx.fill();

    // Solid Matte Airframe Fill: Realistic Military Matte Dark Crimson / Slate or High-Vis Target Drone
    buildAirframePath(ctx);
    ctx.fillStyle = enemy.isDrone ? '#3f3f46' : '#27272a'; // High-vis target drone matte grey or charcoal
    ctx.fill();

    // Matte Wing Accents (High-vis blaze orange for target drone, dark crimson for combat enemies)
    ctx.fillStyle = enemy.isDrone ? '#ea580c' : '#881337';
    ctx.beginPath();
    // Port wing matte accent
    ctx.moveTo(-s * 0.60, -s * 0.3);
    ctx.lineTo(-s * 1.75, -s * 0.7);
    ctx.lineTo(-s * 1.85, -s * 0.45);
    ctx.lineTo(-s * 0.75, s * 0.75);
    ctx.closePath();
    // Starboard wing matte accent
    ctx.moveTo(s * 0.60, -s * 0.3);
    ctx.lineTo(s * 1.75, -s * 0.7);
    ctx.lineTo(s * 1.85, -s * 0.45);
    ctx.lineTo(s * 0.75, s * 0.75);
    ctx.closePath();
    ctx.fill();

    // Crisp Vector Outlines (Zero shadowBlur, Zero shadowColor)
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.3;
    buildAirframePath(ctx);
    ctx.stroke();

    // Wing panel seam lines
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-s * 0.60, -s * 0.3);
    ctx.lineTo(-s * 0.75, s * 0.75);
    ctx.moveTo(s * 0.60, -s * 0.3);
    ctx.lineTo(s * 0.75, s * 0.75);
    ctx.stroke();

    // Realistic Matte Canopy (Solid tinted glass with clean vector highlight)
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.85, s * 0.22, s * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#991b1b'; // Solid matte crimson canopy
    ctx.fill();
    ctx.strokeStyle = '#450a0a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Subtle Canopy Specular Glint
    ctx.beginPath();
    ctx.ellipse(-s * 0.07, -s * 0.95, s * 0.07, s * 0.22, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(254, 202, 202, 0.45)';
    ctx.fill();

    ctx.restore();

    // ── 3. Screen-Space Callsign & Payload Indicator ──
    ctx.save();
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ef4444';
    ctx.fillText(`${enemy.callsign}`, screenPos.x, screenPos.y - s * 2.5);

    // Clean payload indicators
    ctx.font = '9px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`M:${enemy.missiles} F:${enemy.flares}`, screenPos.x, screenPos.y - s * 2.5 - 11);
    ctx.restore();

    ctx.restore();
}
