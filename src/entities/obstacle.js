/**
 * obstacle.js — Static obstacle entities (mountains + asteroids)
 * 
 * Obstacles serve as tactical cover — players can bait missiles
 * into colliding with them. Mountains use AABB collision, asteroids
 * use circle collision.
 */

import { CONFIG } from '../config.js';
import { randRange, randInt } from '../utils/math.js';

/**
 * Create a static obstacle entity.
 * @param {number} x - world X
 * @param {number} y - world Y
 * @param {'circle'|'aabb'} shape - collision shape
 * @param {number} size - radius for circle, or base size for AABB
 * @returns {object} obstacle entity
 */
export function createObstacle(x, y, shape, size) {
    if (shape === 'aabb') {
        return {
            x, y, shape,
            w: size * 1.8,
            h: size * 1.4,
            radius: size,  // approximate radius for broad-phase
            alive: true,
            // Pre-generate mountain peaks for consistent drawing
            peaks: generateMountainPeaks(size),
        };
    }
    return {
        x, y, shape,
        radius: size,
        alive: true,
        // Pre-generate asteroid vertices for consistent drawing
        vertices: generateAsteroidVertices(size),
    };
}

/**
 * Generate jagged mountain peak points (for vector-drawn mountains).
 */
function generateMountainPeaks(size) {
    const peaks = [];
    const count = randInt(3, 5);
    const baseW = size * 1.8;
    for (let i = 0; i < count; i++) {
        peaks.push({
            xOff: (i / (count - 1) - 0.5) * baseW,
            height: size * (0.6 + Math.random() * 0.8),
        });
    }
    return peaks;
}

/**
 * Generate rough asteroid vertices (for vector-drawn asteroids).
 */
function generateAsteroidVertices(radius) {
    const verts = [];
    const count = randInt(8, 12);
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const r = radius * (0.7 + Math.random() * 0.3);
        verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    return verts;
}

/**
 * Draw an obstacle.
 * @param {object} obs
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} screenPos
 */
export function drawObstacle(obs, ctx, screenPos) {
    if (!obs.alive) return;

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);

    if (obs.shape === 'aabb') {
        // Mountain: jagged polygon
        const halfW = obs.w / 2;
        const halfH = obs.h / 2;

        ctx.beginPath();
        ctx.moveTo(-halfW, halfH); // bottom-left

        // Draw peaks
        for (const peak of obs.peaks) {
            ctx.lineTo(peak.xOff, -peak.height);
        }

        ctx.lineTo(halfW, halfH); // bottom-right
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, -obs.h, 0, halfH);
        grad.addColorStop(0, '#556677');
        grad.addColorStop(0.5, '#445566');
        grad.addColorStop(1, '#334455');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = '#778899';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Snow caps
        for (const peak of obs.peaks) {
            ctx.beginPath();
            ctx.arc(peak.xOff, -peak.height + 4, 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(230, 240, 255, 0.6)';
            ctx.fill();
        }
    } else {
        // Asteroid: rough circle polygon
        ctx.beginPath();
        ctx.moveTo(obs.vertices[0].x, obs.vertices[0].y);
        for (let i = 1; i < obs.vertices.length; i++) {
            ctx.lineTo(obs.vertices[i].x, obs.vertices[i].y);
        }
        ctx.closePath();

        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, obs.radius);
        grad.addColorStop(0, '#8899aa');
        grad.addColorStop(1, '#556677');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = '#99aabb';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Crater details
        ctx.beginPath();
        ctx.arc(obs.radius * 0.2, -obs.radius * 0.15, obs.radius * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fill();
    }

    ctx.restore();
}
