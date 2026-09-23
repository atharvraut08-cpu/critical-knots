/**
 * obstacle.js — Environmental obstacle entity
 * 
 * Stratified Mesa / Cliff Formations:
 * Stratified rock plateaus with sheer drop-offs, elevation shadows,
 * and textured rock surfaces.
 * 
 * CG Concepts:
 * - Affine transformations (drawing multi-facet geometries)
 * - Topographic contouring & elevation shading
 */

import { CONFIG } from '../config.js';
import { randRange, randInt } from '../utils/math.js';

/**
 * Create an environmental cliff/mesa obstacle entity.
 * @param {number} x - world X
 * @param {number} y - world Y
 * @param {'cliff'} [type='cliff'] - obstacle type
 * @param {number} [size=70] - base radius/scale
 * @returns {object} obstacle entity
 */
export function createObstacle(x, y, type = 'cliff', size = 70) {
    return {
        x, y,
        type: 'cliff',
        shape: 'circle',
        radius: size,
        visualRadius: size,
        alive: true,
        vertices: generatePlateauVertices(size),
        innerVertices: generatePlateauVertices(size * 0.72),
    };
}

/**
 * Generate vertices for stratified mesa/cliff plateaus.
 */
function generatePlateauVertices(radius) {
    const verts = [];
    const count = randInt(7, 10);
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const r = radius * (0.82 + Math.random() * 0.25);
        verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    return verts;
}

/**
 * Draw an environmental cliff obstacle with lighting, shadows, and rock face detailing.
 * 
 * @param {object} obs
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} screenPos
 */
export function drawObstacle(obs, ctx, screenPos) {
    if (!obs.alive) return;

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);

    const r = obs.radius;
    const shadowOffset = CONFIG.altitudeShadowOffset;

    // ── Cliff / Mesa Formation ──────────────────────────
    // 1. Terrain drop shadow cast by high plateau
    ctx.fillStyle = 'rgba(8, 12, 22, 0.4)';
    ctx.beginPath();
    ctx.moveTo(obs.vertices[0].x + shadowOffset, obs.vertices[0].y + shadowOffset);
    for (let i = 1; i < obs.vertices.length; i++) {
        ctx.lineTo(obs.vertices[i].x + shadowOffset, obs.vertices[i].y + shadowOffset);
    }
    ctx.closePath();
    ctx.fill();

    // 2. Base Stratified Rock Wall (Outer rim)
    ctx.beginPath();
    ctx.moveTo(obs.vertices[0].x, obs.vertices[0].y);
    for (let i = 1; i < obs.vertices.length; i++) {
        ctx.lineTo(obs.vertices[i].x, obs.vertices[i].y);
    }
    ctx.closePath();

    const wallGrad = ctx.createLinearGradient(-r, -r, r, r);
    wallGrad.addColorStop(0, '#5f6977');
    wallGrad.addColorStop(0.5, '#47505d');
    wallGrad.addColorStop(1, '#2c333e');
    ctx.fillStyle = wallGrad;
    ctx.fill();
    ctx.strokeStyle = '#788698';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. Top Plateau Surface (Inner polygon)
    ctx.beginPath();
    ctx.moveTo(obs.innerVertices[0].x, obs.innerVertices[0].y);
    for (let i = 1; i < obs.innerVertices.length; i++) {
        ctx.lineTo(obs.innerVertices[i].x, obs.innerVertices[i].y);
    }
    ctx.closePath();

    const plateauGrad = ctx.createLinearGradient(-r * 0.5, -r * 0.5, r * 0.5, r * 0.5);
    plateauGrad.addColorStop(0, '#8694a5');
    plateauGrad.addColorStop(1, '#5f6c7c');
    ctx.fillStyle = plateauGrad;
    ctx.fill();
    ctx.strokeStyle = '#9eb0c4';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
}
