/**
 * bullet.js — Advanced Machine Gun Projectile Physics
 * 
 * Implements Newtonian velocity inheritance and aerodynamic kinetic drag.
 * - Inherits firing aircraft's velocity vector + muzzle velocity.
 * - Experiences high-speed quadratic drag, bleeding kinetic energy over range.
 * - Despawns naturally when kinetic velocity decays or range limit is reached.
 */

import { CONFIG } from '../config.js';

/**
 * Create a new machine gun bullet entity.
 * 
 * @param {number} x - spawn origin X
 * @param {number} y - spawn origin Y
 * @param {number} heading - firing aircraft nose heading
 * @param {number} parentVx - firing aircraft velocity X
 * @param {number} parentVy - firing aircraft velocity Y
 * @returns {object} bullet entity
 */
export function createBullet(x, y, heading, parentVx = 0, parentVy = 0) {
    const muzzleSpeed = CONFIG.bulletSpeed || 950; // px/s muzzle velocity

    // Newtonian Velocity Inheritance: aircraft velocity vector + muzzle impulse
    const bvx = parentVx + Math.cos(heading) * muzzleSpeed;
    const bvy = parentVy + Math.sin(heading) * muzzleSpeed;

    return {
        x,
        y,
        vx: bvx,
        vy: bvy,
        heading,
        radius: CONFIG.bulletRadius || 3.5,
        life: CONFIG.bulletLife || 1.1,
        maxLife: CONFIG.bulletLife || 1.1,
        initialSpeed: Math.hypot(bvx, bvy),
        dragCoeff: CONFIG.bulletDragCoeff || 0.0018, // quadratic kinetic drag coefficient
        alive: true,
    };
}

/**
 * Update bullet kinematics with quadratic aerodynamic drag.
 * 
 * @param {object} bullet
 * @param {number} dt
 */
export function updateBullet(bullet, dt) {
    if (!bullet.alive) return;

    bullet.life -= dt;
    if (bullet.life <= 0) {
        bullet.alive = false;
        return;
    }

    const speed = Math.hypot(bullet.vx, bullet.vy);

    // Quadratic aerodynamic drag deceleration: F_drag = -C_d * v * v_dir
    const dragAccel = bullet.dragCoeff * speed * speed;
    const dragDecelX = (bullet.vx / (speed || 1)) * dragAccel;
    const dragDecelY = (bullet.vy / (speed || 1)) * dragAccel;

    bullet.vx -= dragDecelX * dt;
    bullet.vy -= dragDecelY * dt;

    // Kinematic position integration
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;

    // Update heading to match current travel vector
    bullet.heading = Math.atan2(bullet.vy, bullet.vx);

    // If kinetic speed falls below effective ballistic threshold, bullet falls away
    if (speed < 240) {
        bullet.alive = false;
    }
}

/**
 * Draw machine gun tracer projectile with crisp vector rendering.
 * 
 * @param {object} bullet
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} screenPos
 */
export function drawBullet(bullet, ctx, screenPos) {
    if (!bullet.alive) return;

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(bullet.heading);

    const speedRatio = Math.max(0.2, Math.hypot(bullet.vx, bullet.vy) / (bullet.initialSpeed || 950));
    const tracerLen = 14 * speedRatio;

    // Clean tracer streak
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-tracerLen, 0);
    ctx.lineTo(2, 0);
    ctx.stroke();

    // Incandescent tungsten core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(2, 0, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}
